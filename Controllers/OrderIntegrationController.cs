using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using ProInternal.Models.OrderIntegration;
using ProInternal.Models.OrderIntegration.Shopify;
using ProInternal.Services.OrderIntegration;
using ProInternal.Services.OrderIntegration.Adapters.Inbound.Shopify;
using System;
using System.Collections.Generic;
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
        private const string IntegrationKeyHeader ="x-integration-key";

        private readonly IOrderIntegrationDataAccess _dataAccess;
        private readonly IOrderSchemaValidator _schemaValidator;
        private readonly IShopifyOrderAdapter _shopifyAdapter;
        private readonly IConfiguration _configuration;
        private readonly ILogger<OrderIntegrationController> _logger;

        private static readonly JsonSerializerOptions
            ShopifyJsonOptions = new()
            {PropertyNameCaseInsensitive = true};

        public OrderIntegrationController(
            IOrderIntegrationDataAccess dataAccess,
            IOrderSchemaValidator schemaValidator,
            IShopifyOrderAdapter shopifyAdapter,
            IConfiguration configuration,
            ILogger<OrderIntegrationController> logger)
        {
            _dataAccess = dataAccess;
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
                        Errors =[ new InboundOrderError
                            {
                                Code = "INVALID_ENVELOPE",
                                Field = null,
                                Message =
                                    "The Shopify webhook envelope is required."
                            }
                        ]
                    });
            }

            if (string.IsNullOrWhiteSpace(request.PayloadJson))
            {
                return Ok(
                    new InboundOrderResult
                    {
                        Status = "REJECTED",
                        Errors =
                        [
                            new InboundOrderError
                    {
                        Code = "MISSING_PAYLOAD",
                        Field = "payloadJson",
                        Message =
                            "The Shopify order payload is required."
                    }
                        ]
                    });
            }

            ShopifyOrderPayload? payload;

            try
            {
                payload =
                    JsonSerializer.Deserialize<ShopifyOrderPayload>(
                        request.PayloadJson,
                        ShopifyJsonOptions);
            }
            catch (JsonException ex)
            {
       

                return Ok(
                    new InboundOrderResult
                    {
                        Status = "REJECTED",
                        Errors =
                        [
                            new InboundOrderError
                    {
                        Code = "INVALID_SHOPIFY_JSON",
                        Field = "payloadJson",
                        Message =
                            "The Shopify order payload is not valid JSON."
                    }
                        ]
                    });
            }

            if (payload is null)
            {
                return Ok(
                    new InboundOrderResult
                    {
                        Status = "REJECTED",
                        Errors =
                        [
                            new InboundOrderError
                    {
                        Code = "EMPTY_SHOPIFY_ORDER",
                        Field = "payloadJson",
                        Message =
                            "The Shopify payload did not contain an order."
                    }
                        ]
                    });
            }

            var channelOrderId = payload.Id.ToString();

            var mapping =
                _shopifyAdapter.Map(
                    request,
                    payload);

            /*
             * An order that could not be mapped cannot safely be inserted into
             * OrderConsumer because the legacy table requires complete fields.
             */
            if (mapping.Order is null)
            {
                LogRejection(
                    request,
                    payload,
                    mapping.Errors);

                return Ok(
                    new InboundOrderResult
                    {
                        Status = "REJECTED",
                        ChannelOrderId = channelOrderId,
                        Errors = mapping.Errors.ToList()
                    });
            }

            var schemaValidation =
                _schemaValidator.Validate(mapping.Order);

            if (!schemaValidation.IsValid)
            {
                var schemaErrors =
                    schemaValidation.Errors
                        .Select(
                            message =>
                                new InboundOrderError
                                {
                                    Code = "CANONICAL_SCHEMA_INVALID",
                                    Field = null,
                                    Message = message
                                })
                        .ToList();

                LogRejection(
                    request,
                    payload,
                    schemaErrors);

                return Ok(
                    new InboundOrderResult
                    {
                        Status = "REJECTED",
                        ChannelOrderId = channelOrderId,
                        Errors = schemaErrors
                    });
            }

            /*
             * For now, PO Box is the only mapped business rejection that we
             * deliberately record in OrderConsumer with OrderStatusId 15.
             */
            var isPoBoxRejection =
                mapping.Errors.Any(
                    error =>
                        string.Equals(
                            error.Code,
                            "PO_BOX_NOT_ALLOWED",
                            StringComparison.OrdinalIgnoreCase));

            if (mapping.Errors.Count > 0 &&
                !isPoBoxRejection)
            {
                LogRejection(
                    request,
                    payload,
                    mapping.Errors);

                return Ok(
                    new InboundOrderResult
                    {
                        Status = "REJECTED",
                        ChannelOrderId = channelOrderId,
                        Errors = mapping.Errors.ToList()
                    });
            }

            try
            {
                if (isPoBoxRejection)
                {
                    LogRejection(
                        request,
                        payload,
                        mapping.Errors);

                    /*
                     * Record the rejected order in OrderConsumer.
                     * OrderStatusId 15 = Rejected.
                     */
                    return Ok(
                        await _dataAccess.ImportShopifyOrderAsync(
                            request,
                            mapping.Order,
                            mapping.Errors,
                            orderStatusId: 15,
                            cancellationToken));
                }

                /*
                 * Record the accepted order in OrderConsumer.
                 * OrderStatusId 1 = Open.
                 */
                return Ok(
                    await _dataAccess.ImportShopifyOrderAsync(
                        request,
                        mapping.Order,
                        Array.Empty<InboundOrderError>(),
                        orderStatusId: 1,
                        cancellationToken));
            }
            catch (SqlException ex)
            {
                /*
                 * This is a temporary infrastructure failure.
                 * Return 503 so PROAPI also returns 503 and Shopify retries.
                 */
              

                return StatusCode(
                    StatusCodes.Status503ServiceUnavailable,
                    new
                    {
                        status = "TEMPORARY_FAILURE",
                        message =
                            "The order database is temporarily unavailable."
                    });
            }
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

        private void LogRejection(
            ShopifyWebhookEnvelope envelope,
            ShopifyOrderPayload payload,
            IReadOnlyCollection<
                InboundOrderError> errors)
        {
            _logger.LogWarning(
                "Shopify webhook {WebhookId} for order {ShopifyOrderId} from {ShopDomain} was rejected with {ErrorCount} error(s): {Errors}",
                envelope.WebhookId,
                payload.Id,
                envelope.ShopDomain,
                errors.Count,
                string.Join(
                    " | ",
                    errors.Select(
                        x =>
                            $"{x.Code}: {x.Message}")));
        }
    }
}