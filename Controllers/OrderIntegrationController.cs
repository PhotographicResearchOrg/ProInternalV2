using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using ProInternal.Models.OrderIntegration;
using ProInternal.Models.OrderIntegration.Shopify;
using ProInternal.Services.OrderIntegration.Adapters.Core;
using ProInternal.Services.OrderIntegration.Adapters.Inbound.Shopify;
using ProInternal.Services.OrderIntegration;
using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;


namespace ProInternal.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public sealed class OrderIntegrationController : ControllerBase
    {
        private const string IntegrationKeyHeader = "x-integration-key";
        private const string ShopifyChannel = "SHOPIFY";
        private const string OrderConsumerTable = "OrderConsumer";

        /*
         * PIV2_ShopifyOrderConsumer_Import raises errors 50001-50013 when
         * the ORDER is the problem (unknown SKU, no email, incomplete
         * address). Those are not outages: the order goes to review.
         * Any other database error is treated as a real outage.
         */
        private const int ImportBusinessErrorFirst = 50001;
        private const int ImportBusinessErrorLast = 50013;

        private readonly IOrderIntegrationDataAccess _dataAccess;
        private readonly IOrderInboxDataAccess _inbox;
        private readonly IOrderSchemaValidator _schemaValidator;
        private readonly IShopifyOrderAdapter _shopifyAdapter;
        private readonly IConfiguration _configuration;
        private readonly ILogger<OrderIntegrationController> _logger;

        private static readonly JsonSerializerOptions
            ShopifyJsonOptions = new()
            { PropertyNameCaseInsensitive = true };

        public OrderIntegrationController(
            IOrderIntegrationDataAccess dataAccess,
            IOrderInboxDataAccess inbox,
            IOrderSchemaValidator schemaValidator,
            IShopifyOrderAdapter shopifyAdapter,
            IConfiguration configuration,
            ILogger<OrderIntegrationController> logger)
        {
            _dataAccess = dataAccess;
            _inbox = inbox;
            _schemaValidator = schemaValidator;
            _shopifyAdapter = shopifyAdapter;
            _configuration = configuration;
            _logger = logger;
        }

        [HttpGet("{orderId}/preview")]
        public ActionResult<CanonicalOrder> GetPreview(
            string orderId)
        {
            var order = _dataAccess.GetCanonicalOrder(orderId);

            if (order is null)
                return NotFound();

            var validation = _schemaValidator.Validate(order);

            if (!validation.IsValid)
            {
                return UnprocessableEntity(
                    new
                    {
                        orderId,
                        errors = validation.Errors
                    });
            }

            return Ok(order);
        }


        /*
         * Shopify orders/create webhook.
         *
         * Order of work:
         *   1. Save the delivery to the order inbox. Nothing else runs
         *      until that save has succeeded.
         *   2. Parse, map, validate, import.
         *   3. Record the outcome on the inbox record.
         *
         * Outcomes (HTTP 200 in every case; the order is on record):
         *   IMPORTED            clean, written to OrderConsumer as Open
         *   REJECTED_RECORDED   PO box, written to OrderConsumer as Rejected
         *   NEEDS_REVIEW        a problem a person can fix; held in the inbox
         *   REJECTED            unreadable; held in the inbox with the reason
         *   DUPLICATE           this delivery or order was already handled
         *
         * HTTP 503 is returned only when the database could not be
         * reached, so that Shopify retries. A retry finds the inbox
         * record still RECEIVED and processes it again.
         */
        [AllowAnonymous]
        [HttpPost("inbound/shopify/orders")]
        public async Task<IActionResult> ReceiveShopifyOrder(
            [FromBody] ShopifyWebhookEnvelope request,
            CancellationToken cancellationToken)
        {
            if (!HasValidIntegrationKey())
            {
                return Unauthorized();
            }

            if (request is null)
            {
                return BadRequest(
                    new InboundOrderResult
                    {
                        Status = "REJECTED",
                        Errors =
                        [
                            Error("INVALID_ENVELOPE", null,
                                "The Shopify webhook envelope is required.")
                        ]
                    });
            }

            /*
             * Read the order id without trusting the payload. This never
             * throws; an unreadable payload simply has no id yet.
             */
            var channelOrderId = TryReadShopifyOrderId(request.PayloadJson);

            /* 1. Save first. */
            OrderInboxReceipt receipt;

            try
            {
                receipt = await _inbox.ReceiveAsync(
                    ShopifyChannel,
                    request.ShopDomain,
                    channelOrderId,
                    request.WebhookId,
                    request.PayloadJson,
                    new
                    {
                        request.WebhookId,
                        request.EventId,
                        request.Topic,
                        request.ShopDomain,
                        request.ApiVersion,
                        request.TriggeredAt
                    },
                    cancellationToken);
            }
            catch (DbException ex)
            {
                _logger.LogError(
                    ex,
                    "Shopify webhook {WebhookId} for order {ShopifyOrderId} could not be saved to the order inbox.",
                    request.WebhookId,
                    channelOrderId);

                return TemporaryFailure();
            }

            /*
             * Already finished on an earlier delivery: answer from the
             * record. A record still RECEIVED was interrupted before it
             * finished, so it is processed again below.
             */
            if (receipt.IsDuplicate &&
                !string.Equals(receipt.State, OrderInboxState.Received, StringComparison.OrdinalIgnoreCase))
            {
                return Ok(
                    new InboundOrderResult
                    {
                        Status = "DUPLICATE",
                        OrderId = receipt.TargetOrderId?.ToString(),
                        ChannelOrderId = channelOrderId
                    });
            }

            /* 2 and 3. Process, then record the outcome. */
            try
            {
                return await ProcessShopifyOrderAsync(
                    request,
                    receipt.InboxId,
                    channelOrderId,
                    cancellationToken);
            }
            catch (DbException ex)
            {
                /*
                 * The order is safe in the inbox as RECEIVED. Return 503
                 * so Shopify retries and processing is attempted again.
                 */
                _logger.LogError(
                    ex,
                    "Shopify webhook {WebhookId} for order {ShopifyOrderId} is saved as inbox record {InboxId} but could not be processed.",
                    request.WebhookId,
                    channelOrderId,
                    receipt.InboxId);

                return TemporaryFailure();
            }
        }

        private async Task<IActionResult> ProcessShopifyOrderAsync(
            ShopifyWebhookEnvelope request,
            long inboxId,
            string? channelOrderId,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.PayloadJson))
            {
                return await HoldAsync(
                    inboxId,
                    OrderInboxState.Rejected,
                    channelOrderId,
                    null,
                    [Error("MISSING_PAYLOAD", "payloadJson", "The Shopify order payload is required.")],
                    cancellationToken);
            }

            ShopifyOrderPayload? payload;

            try
            {
                payload = JsonSerializer.Deserialize<ShopifyOrderPayload>(
                    request.PayloadJson,
                    ShopifyJsonOptions);
            }
            catch (JsonException ex)
            {
                return await HoldAsync(
                    inboxId,
                    OrderInboxState.Rejected,
                    channelOrderId,
                    null,
                    [Error("INVALID_SHOPIFY_JSON", "payloadJson",
                        "The Shopify order payload is not valid JSON: " + ex.Message)],
                    cancellationToken);
            }

            if (payload is null)
            {
                return await HoldAsync(
                    inboxId,
                    OrderInboxState.Rejected,
                    channelOrderId,
                    null,
                    [Error("EMPTY_SHOPIFY_ORDER", "payloadJson", "The Shopify payload did not contain an order.")],
                    cancellationToken);
            }

            channelOrderId = payload.Id.ToString();

            var mapping = _shopifyAdapter.Map(request, payload);

            if (mapping.Order is null)
            {
                return await HoldAsync(
                    inboxId,
                    OrderInboxState.NeedsReview,
                    channelOrderId,
                    null,
                    mapping.Errors,
                    cancellationToken);
            }

            var schemaValidation = _schemaValidator.Validate(mapping.Order);

            if (!schemaValidation.IsValid)
            {
                var errors = mapping.Errors
                    .Concat(
                        schemaValidation.Errors.Select(
                            message => Error("CANONICAL_SCHEMA_INVALID", null, message)))
                    .ToList();

                return await HoldAsync(
                    inboxId,
                    OrderInboxState.NeedsReview,
                    channelOrderId,
                    mapping.Order,
                    errors,
                    cancellationToken);
            }

            /*
             * PO Box is the one mapped business rejection that is recorded
             * in OrderConsumer with OrderStatusId 15, as before.
             */
            var isPoBoxRejection = mapping.Errors.Any(
                error => string.Equals(
                    error.Code,
                    "PO_BOX_NOT_ALLOWED",
                    StringComparison.OrdinalIgnoreCase));

            /* Any other mapping error is a problem a person can fix. */
            if (mapping.Errors.Count > 0 && !isPoBoxRejection)
            {
                return await HoldAsync(
                    inboxId,
                    OrderInboxState.NeedsReview,
                    channelOrderId,
                    mapping.Order,
                    mapping.Errors,
                    cancellationToken);
            }

            IReadOnlyList<InboundOrderError> recordedErrors =
                isPoBoxRejection
                    ? mapping.Errors
                    : Array.Empty<InboundOrderError>();

            InboundOrderResult imported;

            try
            {
                imported = await _dataAccess.ImportShopifyOrderAsync(
                    inboxId,
                    channelOrderId,
                    mapping.Order,
                    orderStatusId: isPoBoxRejection ? 15 : 1,
                    cancellationToken);
            }
            catch (DbException ex) when (IsImportBusinessError(ex))
            {
                /*
                 * The import refused THIS order (unknown SKU, no email,
                 * incomplete address). That is a review case, not an
                 * outage: hold it and tell Shopify it was received.
                 */
                return await HoldAsync(
                    inboxId,
                    OrderInboxState.NeedsReview,
                    channelOrderId,
                    mapping.Order,
                    [Error(ImportErrorCode(ex), null, ex.Message)],
                    cancellationToken);
            }

            int? orderConsumerId =
                int.TryParse(imported.OrderId, out var parsedId)
                    ? parsedId
                    : null;

            await _inbox.SetResultAsync(
                inboxId,
                isPoBoxRejection ? OrderInboxState.Rejected : OrderInboxState.Ready,
                mapping.Order,
                recordedErrors,
                OrderConsumerTable,
                orderConsumerId,
                cancellationToken);

            if (isPoBoxRejection)
            {
                LogHeld(inboxId, OrderInboxState.Rejected, request, channelOrderId, mapping.Errors);
            }

            /* The errors live on the inbox record; echo them to the caller. */
            return Ok(
                new InboundOrderResult
                {
                    Status = imported.Status,
                    OrderId = imported.OrderId,
                    ChannelOrderId = imported.ChannelOrderId,
                    Errors = recordedErrors.ToList()
                });
        }

        /*
         * Records an order that did not reach OrderConsumer. It stays in
         * the inbox with its errors, where the Needs Review screen reads
         * it. Shopify is told the delivery was received.
         */
        private async Task<IActionResult> HoldAsync(
            long inboxId,
            string state,
            string? channelOrderId,
            CanonicalOrder? order,
            IReadOnlyList<InboundOrderError> errors,
            CancellationToken cancellationToken)
        {
            await _inbox.SetResultAsync(
                inboxId,
                state,
                order,
                errors,
                targetTable: null,
                targetOrderId: null,
                cancellationToken);

            _logger.LogWarning(
                "Shopify order {ShopifyOrderId} is held as inbox record {InboxId} in state {State} with {ErrorCount} error(s): {Errors}",
                channelOrderId,
                inboxId,
                state,
                errors.Count,
                string.Join(" | ", errors.Select(x => $"{x.Code}: {x.Message}")));

            return Ok(
                new InboundOrderResult
                {
                    Status = state,
                    ChannelOrderId = channelOrderId,
                    Errors = errors.ToList()
                });
        }

        private void LogHeld(
            long inboxId,
            string state,
            ShopifyWebhookEnvelope envelope,
            string? channelOrderId,
            IReadOnlyCollection<InboundOrderError> errors)
        {
            _logger.LogWarning(
                "Shopify webhook {WebhookId} for order {ShopifyOrderId} from {ShopDomain} (inbox record {InboxId}) ended in state {State} with {ErrorCount} error(s): {Errors}",
                envelope.WebhookId,
                channelOrderId,
                envelope.ShopDomain,
                inboxId,
                state,
                errors.Count,
                string.Join(" | ", errors.Select(x => $"{x.Code}: {x.Message}")));
        }

        private IActionResult TemporaryFailure()
        {
            /*
             * A temporary infrastructure failure. Return 503 so PROAPI
             * also returns 503 and Shopify retries.
             */
            return StatusCode(
                StatusCodes.Status503ServiceUnavailable,
                new
                {
                    status = "TEMPORARY_FAILURE",
                    message = "The order database is temporarily unavailable."
                });
        }

        private static InboundOrderError Error(string code, string? field, string message)
        {
            return new InboundOrderError
            {
                Code = code,
                Field = field,
                Message = message
            };
        }

        /*
         * Reads "id" from the top level of the payload. Returns null for
         * anything unexpected; it must never stop the delivery being saved.
         */
        private static string? TryReadShopifyOrderId(string? payloadJson)
        {
            if (string.IsNullOrWhiteSpace(payloadJson))
                return null;

            try
            {
                using var document = JsonDocument.Parse(payloadJson);

                if (document.RootElement.ValueKind != JsonValueKind.Object ||
                    !document.RootElement.TryGetProperty("id", out var id))
                {
                    return null;
                }

                return id.ValueKind switch
                {
                    JsonValueKind.Number => id.GetRawText(),
                    JsonValueKind.String => string.IsNullOrWhiteSpace(id.GetString()) ? null : id.GetString(),
                    _ => null
                };
            }
            catch (JsonException)
            {
                return null;
            }
        }

        /*
         * The SQL error number, whichever SQL client library raised the
         * exception (both expose it as "Number").
         */
        private static int SqlErrorNumber(DbException ex)
        {
            return ex.GetType().GetProperty("Number")?.GetValue(ex) is int number
                ? number
                : 0;
        }

        private static bool IsImportBusinessError(DbException ex)
        {
            var number = SqlErrorNumber(ex);

            return number >= ImportBusinessErrorFirst &&
                   number <= ImportBusinessErrorLast;
        }

        private static string ImportErrorCode(DbException ex)
        {
            return SqlErrorNumber(ex) switch
            {
                50008 => "MISSING_EMAIL",
                50009 => "BILLING_ADDRESS_INCOMPLETE",
                50010 => "SHIPPING_ADDRESS_INCOMPLETE",
                50011 => "INVALID_CREATED_DATE",
                50012 => "NO_ORDER_ITEMS",
                50013 => "UNKNOWN_ITEM",
                _ => "IMPORT_REFUSED"
            };
        }

        private bool HasValidIntegrationKey()
        {
            var configuredKey =
                _configuration[
                    "OrderIntegration:ApiKey"];

            if (string.IsNullOrWhiteSpace(
                    configuredKey))
            {
                _logger.LogError(
                    "OrderIntegration:ApiKey is not configured.");

                return false;
            }

            if (!Request.Headers.TryGetValue(
                    IntegrationKeyHeader,
                    out var suppliedValues))
            {
                return false;
            }

            var suppliedKey =
                suppliedValues.ToString();

            if (string.IsNullOrWhiteSpace(
                    suppliedKey))
            {
                return false;
            }

            var expectedBytes =
                Encoding.UTF8.GetBytes(
                    configuredKey);

            var suppliedBytes =
                Encoding.UTF8.GetBytes(
                    suppliedKey);

            return
                expectedBytes.Length ==
                suppliedBytes.Length &&

                CryptographicOperations
                    .FixedTimeEquals(
                        expectedBytes,
                        suppliedBytes);
        }
    }
}
