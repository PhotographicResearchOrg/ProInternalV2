using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ProInternal.Models.OrderIntegration;
using ProInternal.Services.OrderIntegration.Adapters.Outbox;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Controllers
{
    /*
     * Where a fulfillment system answers about an order it was sent.
     *
     *   POST api/OrderIntegration/responses/{destination}
     *   header x-integration-key: the key for that destination
     *   body   one contract order response (order-response.schema.json)
     *
     * {destination} is the system the order was sent to, e.g. computyme.
     * It must match the destination on the send record, so one system
     * cannot answer for an order sent to another.
     *
     * Keys are per destination and separate from the Shopify key:
     *   OrderIntegration:ResponseKeys:COMPUTYME
     *
     * What is recorded, on the send the response answers:
     *   ACKNOWLEDGEMENT     ACCEPTED / ACCEPTED_WITH_CHANGES -> ACKNOWLEDGED
     *                       REJECTED -> FAILED with the reason
     *   FULFILLMENT_UPDATE  shipments with carrier and tracking number
     *   STATUS_UPDATE       logged against the order
     *   EXCEPTION           an ERROR marks the send FAILED; others are logged
     *
     * Answers:
     *   200  APPLIED
     *   400  INVALID_RESPONSE   not a contract response; nothing changed
     *   401  missing or wrong key
     *   404  ORDER_NOT_FOUND    no order sent to this destination matches
     *   409  ORDER_AMBIGUOUS    send references.channel to say which
     *
     * Sending the same message again is safe.
     */
    [AllowAnonymous]
    [Route("api/OrderIntegration/responses")]
    [ApiController]
    public sealed class OrderResponseController : ControllerBase
    {
        private const string IntegrationKeyHeader = "x-integration-key";
        private const int MaximumBodyBytes = 1024 * 1024;

        /* The contract allows nothing it does not define. */
        private static readonly JsonSerializerOptions ContractJson = new()
        {
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
        };

        private readonly IOrderOutboxDataAccess _outbox;
        private readonly IConfiguration _configuration;
        private readonly ILogger<OrderResponseController> _logger;

        public OrderResponseController(
            IOrderOutboxDataAccess outbox,
            IConfiguration configuration,
            ILogger<OrderResponseController> logger)
        {
            _outbox = outbox;
            _configuration = configuration;
            _logger = logger;
        }

        [HttpPost("{destination}")]
        public async Task<IActionResult> Receive(
            string destination,
            CancellationToken cancellationToken)
        {
            destination = (destination ?? string.Empty).Trim().ToUpperInvariant();

            if (!HasValidKey(destination))
                return Unauthorized();

            /* Read the body as sent, so exactly what arrived can be logged. */
            string body;

            using (var reader = new StreamReader(Request.Body, Encoding.UTF8))
            {
                body = await reader.ReadToEndAsync(cancellationToken);
            }

            if (string.IsNullOrWhiteSpace(body) ||
                Encoding.UTF8.GetByteCount(body) > MaximumBodyBytes)
            {
                return Invalid("The request body is empty or larger than 1 MB.");
            }

            OrderResponseMessage? message;

            try
            {
                message = JsonSerializer.Deserialize<OrderResponseMessage>(body, ContractJson);
            }
            catch (JsonException ex)
            {
                return Invalid("The message does not follow the order response contract: " + ex.Message);
            }

            if (message is null)
                return Invalid("The message is empty.");

            var problems = Check(message);

            if (problems.Count > 0)
                return Invalid("The message does not follow the order response contract.", problems);

            var applied = await _outbox.ApplyResponseAsync(
                destination,
                message.OrderRef.OrderId,
                Channel(message),
                State(message),
                message.OrderRef.FulfillmentOrderId,
                Reason(message),
                ShipmentsJson(message),
                ActionType(message),
                body,
                actionBy: $"{destination} API",
                actionSource: "Fulfillment Response API",
                cancellationToken);

            var result = new OrderResponseResult
            {
                Status = applied.Code,
                Message = applied.Message,
                OrderId = applied.OrderId,
                Channel = applied.Channel
            };

            if (!applied.Success)
            {
                _logger.LogWarning(
                    "Order response from {Destination} not applied: {Code}. Reference {Reference}, message {MessageId}.",
                    destination,
                    applied.Code,
                    message.OrderRef.OrderId,
                    message.MessageId);
            }

            return applied.Code switch
            {
                "APPLIED" => Ok(result),
                "ORDER_NOT_FOUND" => NotFound(result),
                "ORDER_AMBIGUOUS" => Conflict(result),
                _ => BadRequest(result)
            };
        }

        /* ---- the contract's rules that the shape alone does not enforce ---- */

        private static List<string> Check(OrderResponseMessage message)
        {
            var problems = new List<string>();

            if (string.IsNullOrWhiteSpace(message.OrderRef.OrderId))
                problems.Add("orderRef.orderId is required.");

            switch (message.ResponseType)
            {
                case ResponseType.ACKNOWLEDGEMENT:
                    if (message.Acknowledgement is null)
                    {
                        problems.Add("acknowledgement is required when responseType is ACKNOWLEDGEMENT.");
                    }
                    else if (message.Acknowledgement.AckResult == AckResult.REJECTED)
                    {
                        if (message.Acknowledgement.RejectReason is null)
                            problems.Add("acknowledgement.rejectReason is required when ackResult is REJECTED.");

                        if (string.IsNullOrWhiteSpace(message.Acknowledgement.Message))
                            problems.Add("acknowledgement.message is required when ackResult is REJECTED.");
                    }

                    break;

                case ResponseType.FULFILLMENT_UPDATE:
                    if (message.Fulfillment is null)
                        problems.Add("fulfillment is required when responseType is FULFILLMENT_UPDATE.");

                    break;

                case ResponseType.STATUS_UPDATE:
                    if (message.StatusUpdate is null)
                        problems.Add("statusUpdate is required when responseType is STATUS_UPDATE.");

                    break;

                case ResponseType.EXCEPTION:
                    if (message.Exceptions is null || message.Exceptions.Count == 0)
                        problems.Add("exceptions is required when responseType is EXCEPTION.");

                    break;
            }

            foreach (var shipment in message.Fulfillment?.Shipments ?? [])
            {
                if (string.IsNullOrWhiteSpace(shipment.ShipmentId))
                    problems.Add("fulfillment.shipments[].shipmentId is required.");
            }

            return problems;
        }

        /* ---- contract message -> what is recorded ---- */

        private static string? State(OrderResponseMessage message)
        {
            if (message.ResponseType == ResponseType.ACKNOWLEDGEMENT)
            {
                return message.Acknowledgement!.AckResult == AckResult.REJECTED
                    ? "FAILED"
                    : "ACKNOWLEDGED";
            }

            if (message.ResponseType == ResponseType.EXCEPTION &&
                message.Exceptions!.Any(e => e.Severity == ExceptionSeverity.ERROR))
            {
                return "FAILED";
            }

            /* A shipment or a status update does not, by itself, change the answer. */
            return null;
        }

        private static string? Reason(OrderResponseMessage message)
        {
            var parts = new List<string>();

            var ack = message.Acknowledgement;

            if (ack is not null)
            {
                if (ack.RejectReason is not null)
                    parts.Add(ack.RejectReason.Value.ToString());

                if (!string.IsNullOrWhiteSpace(ack.Message))
                    parts.Add(ack.Message.Trim());
            }

            foreach (var exception in message.Exceptions ?? [])
            {
                var where = string.IsNullOrWhiteSpace(exception.LineId)
                ? string.Empty
                : $" ({{line:{exception.LineId}}})";

                parts.Add($"{exception.Severity}: {exception.Message}{where}");
            }

            if (message.StatusUpdate is not null)
            {
                parts.Add(
                    $"Status {message.StatusUpdate.Status}" +
                    (string.IsNullOrWhiteSpace(message.StatusUpdate.Note)
                        ? string.Empty
                        : $": {message.StatusUpdate.Note}"));
            }

            foreach (var line in message.Fulfillment?.Lines ?? [])
            {
                if (line.Status is LineResponseStatus.SHIPPED or LineResponseStatus.ACCEPTED)
                    continue;

                var text = $"{{line:{line.LineId}}}: " +
           line.Status.ToString().Replace('_', ' ').ToLowerInvariant();

                if (line.QuantityShipped is not null)
                    text += $", {line.QuantityShipped:0.####} shipped";

                if (line.QuantityBackordered is not null)
                    text += $", {line.QuantityBackordered:0.####} backordered";

                if (!string.IsNullOrWhiteSpace(line.ExpectedDate))
                    text += $", expected {line.ExpectedDate}";

                if (!string.IsNullOrWhiteSpace(line.Note))
                    text += $". {line.Note.Trim()}";

                parts.Add(text);
            }

            if (parts.Count == 0)
                return null;

            var reason = string.Join(" | ", parts);

            return reason.Length <= 1000 ? reason : reason[..1000];
        }

        private static string? ShipmentsJson(OrderResponseMessage message)
        {
            var shipments = message.Fulfillment?.Shipments;

            return shipments is null || shipments.Count == 0
                ? null
                : JsonSerializer.Serialize(shipments);
        }

        private static string ActionType(OrderResponseMessage message)
        {
            return message.ResponseType switch
            {
                ResponseType.ACKNOWLEDGEMENT =>
                    message.Acknowledgement!.AckResult == AckResult.REJECTED
                        ? "Fulfillment Rejected"
                        : "Fulfillment Confirmed",
                ResponseType.FULFILLMENT_UPDATE => "Shipment Reported",
                ResponseType.STATUS_UPDATE => "Fulfillment Status",
                _ => "Fulfillment Exception"
            };
        }

        /* An optional hint for which kind of order the reference means. */
        private static string? Channel(OrderResponseMessage message)
        {
            if (message.References is null ||
                !message.References.TryGetValue("channel", out var channel))
            {
                return null;
            }

            channel = channel?.Trim().ToLowerInvariant();

            return channel is "warehouse" or "consumer" ? channel : null;
        }

        private BadRequestObjectResult Invalid(string message, List<string>? errors = null)
        {
            return BadRequest(new OrderResponseResult
            {
                Status = "INVALID_RESPONSE",
                Message = message,
                Errors = errors ?? new List<string>()
            });
        }

        private bool HasValidKey(string destination)
        {
            if (string.IsNullOrEmpty(destination))
                return false;

            var configuredKey =
                _configuration[$"OrderIntegration:ResponseKeys:{destination}"];

            if (string.IsNullOrWhiteSpace(configuredKey))
            {
                _logger.LogError(
                    "OrderIntegration:ResponseKeys:{Destination} is not configured.",
                    destination);

                return false;
            }

            if (!Request.Headers.TryGetValue(IntegrationKeyHeader, out var supplied))
                return false;

            var suppliedKey = supplied.ToString();

            if (string.IsNullOrWhiteSpace(suppliedKey))
                return false;

            var expectedBytes = Encoding.UTF8.GetBytes(configuredKey);
            var suppliedBytes = Encoding.UTF8.GetBytes(suppliedKey);

            return expectedBytes.Length == suppliedBytes.Length &&
                   CryptographicOperations.FixedTimeEquals(expectedBytes, suppliedBytes);
        }
    }
}
