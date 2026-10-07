using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using ProInternal.Models.Orders;
using ProInternal.Services;
using ProInternal.Services.OrderIntegration;
using ProInternal.Services.OrderIntegration.Adapters.Core;
using ProInternal.Services.OrderIntegration.Adapters.Inbound;
using ProInternal.Services.OrderIntegration.Adapters.Outbound;
using ProInternal.Services.OrderIntegration.Adapters.Outbox;
using System.Collections.Generic;
using System.Security.Claims;


namespace ProInternal.Controllers
{

    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class OrdersController : ControllerBase
    {
        private readonly IOrdersDataAccess _ordersDataAccess;
        private readonly OrderIntegrationService _orderIntegrationService;
        private readonly IOrderIntegrationDataAccess _orderIntegrationDataAccess;
        private readonly IOrderSchemaValidator _orderSchemaValidator;
        private readonly IOrderOutboxDataAccess _outbox;
        private readonly ConsumerOrderExportService _consumerExport;
        private readonly IConfiguration _configuration;

        public OrdersController(
            IOrdersDataAccess ordersDataAccess,
            OrderIntegrationService orderIntegrationService,
            IOrderIntegrationDataAccess orderIntegrationDataAccess,
            IOrderSchemaValidator orderSchemaValidator,
            IOrderOutboxDataAccess outbox,
            ConsumerOrderExportService consumerExport,
            IConfiguration configuration)
        {
            _ordersDataAccess = ordersDataAccess;
            _orderIntegrationService = orderIntegrationService;
            _orderIntegrationDataAccess = orderIntegrationDataAccess;
            _orderSchemaValidator = orderSchemaValidator;
            _outbox = outbox;
            _consumerExport = consumerExport;
            _configuration = configuration;
        }

        /* True when the signed-in user may not do this. */
        private bool Denied(string permission)
        {
            return !User.IsAllowed(_configuration, permission);
        }



    [HttpPost("process")]
    public async Task<ActionResult<OrderExportResult>>
    ProcessOrders([FromBody] ProcessOrdersRequest request,CancellationToken cancellationToken)
        {
            if (Denied(OrderPermissions.Review))
                return Forbid();

            if (request.OrderIds is null ||
                request.OrderIds.Count == 0)
            {
                return BadRequest(
                    "Select at least one order.");
            }

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
            {
                return Unauthorized(
                    "Unable to identify the current user.");
            }

            var result =
                await _orderIntegrationService
                    .ExportToComputymeAsync(
                        request.OrderIds,
                        actionBy,
                        cancellationToken);

            /*
             * The file is written: the orders in it are now sent.
             * They become status 5 and move to the Sent tab, so the
             * same order cannot be processed twice.
             */
            if (result.Success)
            {
                await _outbox.MarkSentAsync(
                    result.BatchId,
                    actionBy,
                    "Order Toolbench",
                    cancellationToken);
            }

            /*
             * Validation and adapter failures are completed business
             * results, so return the structured result to Angular.
             */
            return Ok(result);
        }

        [HttpGet]
        public ActionResult<IEnumerable<OrderRecordDto>> GetOrders(
            [FromQuery] OrderSearchRequest request)
        {
            var orders = _ordersDataAccess.GetOrders(request);
            return Ok(orders);
        }

        private string? GetCurrentUser()
        {
            return
                User.FindFirst(ClaimTypes.Email)?.Value ??
                User.FindFirst("email")?.Value ??
                User.FindFirst(ClaimTypes.Name)?.Value ??
                User.FindFirst("preferred_username")?.Value ??
                User.FindFirst("unique_name")?.Value ??
                User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        }


        [HttpGet("{orderId}")]
        public ActionResult<OrderRecordDto> GetOrder(string orderId,[FromQuery] string? orderSectionId)
        {
            var order = _ordersDataAccess.GetOrder(orderId,orderSectionId);

            if (order == null)
                return NotFound();

            return Ok(order);
        }


        [HttpPost("override-hold")]
        public ActionResult<OrderActionResponse> OverrideOrderHold(
            [FromBody] OverrideOrderHoldRequest request)
        {
            if (Denied(OrderPermissions.Modify))
                return Forbid();

            if (string.IsNullOrWhiteSpace(request.OrderId))
                return BadRequest("OrderId is required.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized("Unable to identify the current user.");

            request.ActionBy = actionBy;
            request.ActionSource = "Order Toolbench";

            return Ok(
                _ordersDataAccess.OverrideOrderHold(request)
            );
        }


        [HttpPost("free-shipping")]
        public ActionResult<OrderActionResponse> SetFreeShipping(  [FromBody] SetFreeShippingRequest request)
        {
            if (Denied(OrderPermissions.Modify))
                return Forbid();

            if (string.IsNullOrWhiteSpace(request.OrderId))
                return BadRequest("OrderId is required.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized("Unable to identify the current user.");

            request.ActionBy = actionBy;
            request.ActionSource = "Order Toolbench";

            return Ok(
                _ordersDataAccess.SetFreeShipping(request)
            );
        }

        [HttpPost("reject")]
        public ActionResult<OrderActionResponse> RejectOrder(
          [FromBody] RejectOrderRequest request)
        {
            if (Denied(OrderPermissions.Review))
                return Forbid();

            if (string.IsNullOrWhiteSpace(request.OrderId))
                return BadRequest("OrderId is required.");

            if (string.IsNullOrWhiteSpace(request.Reason))
                return BadRequest("A rejection reason is required.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized("Unable to identify the current user.");

            request.ActionBy = actionBy;
            request.ActionSource = "Order Toolbench";

            return Ok(_ordersDataAccess.RejectOrder(request));
        }

        [HttpGet("{orderId}/ship-to-addresses")]
        public ActionResult<IEnumerable<OrderShipToOptionDto>>
        GetShipToAddresses(string orderId)
        {
            return Ok(
                _ordersDataAccess.GetShipToAddresses(orderId)
            );
        }


        [HttpPost("update-ship-to")]
        public ActionResult<OrderActionResponse> UpdateShipTo(
    [FromBody] UpdateOrderShipToRequest request)
        {
            if (Denied(OrderPermissions.Modify))
                return Forbid();

            if (string.IsNullOrWhiteSpace(request.OrderId))
                return BadRequest("OrderId is required.");

            var mode = request.Mode
                ?.Trim()
                .ToUpperInvariant();

            if (mode != "SAVED" && mode != "DROPSHIP")
                return BadRequest("Invalid address mode.");

            if (mode == "SAVED" && request.AddressId == null)
                return BadRequest("A saved address is required.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized(
                    "Unable to identify the current user."
                );

            request.Mode = mode;
            request.ActionBy = actionBy;
            request.ActionSource = "Order Toolbench";

            return Ok( _ordersDataAccess.UpdateShipTo(request));
        }


        [HttpGet("{orderId}/audit")]
        public ActionResult<IEnumerable<OrderAuditDto>> GetOrderAudit(
    string orderId)
        {
            if (string.IsNullOrWhiteSpace(orderId))
                return BadRequest("OrderId is required.");

            return Ok( _ordersDataAccess.GetOrderAudit(orderId));
        }

        // ---------------------------------------------------------------
        // Consumer orders. Same screen, separate tables: consumer and
        // warehouse order ids can collide, so consumer actions have
        // their own routes and never reach a warehouse procedure.
        // ---------------------------------------------------------------

        [HttpGet("consumer")]
        public ActionResult<IEnumerable<OrderRecordDto>> GetConsumerOrders()
        {
            return Ok(_ordersDataAccess.GetConsumerOrders());
        }

        [HttpGet("consumer/{orderId}")]
        public ActionResult<OrderRecordDto> GetConsumerOrder(string orderId)
        {
            if (!int.TryParse(orderId, out _))
                return BadRequest("A valid OrderId is required.");

            var order = _ordersDataAccess.GetConsumerOrder(orderId);

            if (order == null)
                return NotFound();

            return Ok(order);
        }

        [HttpGet("consumer/{orderId}/audit")]
        public ActionResult<IEnumerable<OrderAuditDto>> GetConsumerOrderAudit(
            string orderId)
        {
            if (!int.TryParse(orderId, out _))
                return BadRequest("A valid OrderId is required.");

            return Ok(_ordersDataAccess.GetConsumerOrderAudit(orderId));
        }

        [HttpPost("consumer/update-ship-to")]
        public ActionResult<OrderActionResponse> UpdateConsumerShipTo(
            [FromBody] UpdateOrderShipToRequest request)
        {
            if (Denied(OrderPermissions.Modify))
                return Forbid();

            if (!int.TryParse(request.OrderId, out _))
                return BadRequest("A valid OrderId is required.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized("Unable to identify the current user.");

            request.ActionBy = actionBy;
            request.ActionSource = "Order Toolbench";

            return Ok(_ordersDataAccess.UpdateConsumerShipTo(request));
        }

        [HttpPost("consumer/reject")]
        public ActionResult<OrderActionResponse> RejectConsumerOrder(
            [FromBody] RejectOrderRequest request)
        {
            if (Denied(OrderPermissions.Review))
                return Forbid();

            if (!int.TryParse(request.OrderId, out _))
                return BadRequest("A valid OrderId is required.");

            if (string.IsNullOrWhiteSpace(request.Reason))
                return BadRequest("A rejection reason is required.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized("Unable to identify the current user.");

            request.ActionBy = actionBy;
            request.ActionSource = "Order Toolbench";

            return Ok(_ordersDataAccess.RejectConsumerOrder(request));
        }

        // ---------------------------------------------------------------
        // Modify an order: line quantity, remove a line, shipping notes.
        //
        // After a warehouse change is saved the order is rebuilt as a
        // contract order and validated. A failure does not undo the
        // change; it is returned in ContractErrors so the user sees it
        // now and not only when the order is processed.
        // ---------------------------------------------------------------

        private const string ToolbenchSource = "Order Toolbench";

        [HttpPost("{orderId}/lines/{lineId}")]
        public ActionResult<OrderEditResponse> EditLine(
            string orderId,
            string lineId,
            [FromBody] OrderLineEditRequest request)
        {
            if (Denied(OrderPermissions.Modify))
                return Forbid();

            if (!TryReadIds(orderId, request.LineId ?? lineId, out var id, out var itemId))
                return BadRequest("A valid order and line are required.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized("Unable to identify the current user.");

            var result = _ordersDataAccess.EditLine(
                id, itemId, request.Quantity, actionBy, ToolbenchSource);

            return Ok(WithContractCheck(result, orderId));
        }

        [HttpPost("{orderId}/lines/{lineId}/remove")]
        public ActionResult<OrderEditResponse> RemoveLine(
            string orderId,
            string lineId,
            [FromBody] OrderLineEditRequest request)
        {
            if (Denied(OrderPermissions.Modify))
                return Forbid();

            if (!TryReadIds(orderId, request.LineId ?? lineId, out var id, out var itemId))
                return BadRequest("A valid order and line are required.");

            if (string.IsNullOrWhiteSpace(request.Reason))
                return BadRequest("A reason is required to remove a line.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized("Unable to identify the current user.");

            var result = _ordersDataAccess.RemoveLine(
                id, itemId, request.Reason.Trim(), actionBy, ToolbenchSource);

            return Ok(WithContractCheck(result, orderId));
        }

        [HttpPost("{orderId}/shipping-notes")]
        public ActionResult<OrderEditResponse> SetShippingNotes(
            string orderId,
            [FromBody] OrderShippingNotesRequest request)
        {
            if (Denied(OrderPermissions.Modify))
                return Forbid();

            if (!int.TryParse(orderId, out var id))
                return BadRequest("A valid OrderId is required.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized("Unable to identify the current user.");

            var result = _ordersDataAccess.SetShippingNotes(
                id, request.ShippingNotes, actionBy, ToolbenchSource);

            return Ok(WithContractCheck(result, orderId));
        }

        [HttpPost("consumer/{orderId}/lines/{lineId}")]
        public ActionResult<OrderEditResponse> EditConsumerLine(
            string orderId,
            string lineId,
            [FromBody] OrderLineEditRequest request)
        {
            if (Denied(OrderPermissions.Modify))
                return Forbid();

            if (!TryReadIds(orderId, request.LineId ?? lineId, out var id, out var itemId))
                return BadRequest("A valid order and line are required.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized("Unable to identify the current user.");

            return Ok(_ordersDataAccess.EditConsumerLine(
                id, itemId, request.Quantity, actionBy, ToolbenchSource));
        }

        [HttpPost("consumer/{orderId}/lines/{lineId}/remove")]
        public ActionResult<OrderEditResponse> RemoveConsumerLine(
            string orderId,
            string lineId,
            [FromBody] OrderLineEditRequest request)
        {
            if (Denied(OrderPermissions.Modify))
                return Forbid();

            if (!TryReadIds(orderId, request.LineId ?? lineId, out var id, out var itemId))
                return BadRequest("A valid order and line are required.");

            if (string.IsNullOrWhiteSpace(request.Reason))
                return BadRequest("A reason is required to remove a line.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized("Unable to identify the current user.");

            return Ok(_ordersDataAccess.RemoveConsumerLine(
                id, itemId, request.Reason.Trim(), actionBy, ToolbenchSource));
        }

        /*
         * A warehouse LineId is "OrderItemId:OrderId"; a consumer LineId
         * is the item id alone. Either way the item id is the first part.
         */
        private static bool TryReadIds(
            string orderId,
            string? lineId,
            out int id,
            out int itemId)
        {
            itemId = 0;

            if (!int.TryParse(orderId, out id))
                return false;

            var itemPart = (lineId ?? string.Empty).Split(':')[0];

            return int.TryParse(itemPart, out itemId);
        }

        private OrderEditResponse WithContractCheck(
            OrderEditResponse result,
            string orderId)
        {
            if (!result.Success)
                return result;

            try
            {
                var order = _orderIntegrationDataAccess.GetCanonicalOrder(orderId);

                if (order is null)
                {
                    result.ContractErrors.Add(
                        "The order could not be rebuilt as a contract order.");
                }
                else
                {
                    var validation = _orderSchemaValidator.Validate(order);

                    if (!validation.IsValid)
                        result.ContractErrors.AddRange(validation.Errors);
                }
            }
            catch (Exception ex)
            {
                result.ContractErrors.Add(ex.Message);
            }

            return result;
        }

        // ---------------------------------------------------------------
        // Send consumer orders, the Sent tab, responses and reopen.
        // ---------------------------------------------------------------

        [HttpPost("consumer/process")]
        public async Task<ActionResult<OrderExportResult>> ProcessConsumerOrders(
            [FromBody] ProcessConsumerOrdersRequest request,
            CancellationToken cancellationToken)
        {
            if (Denied(OrderPermissions.Review))
                return Forbid();

            if (request.OrderIds is null || request.OrderIds.Count == 0)
                return BadRequest("Select at least one order.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized("Unable to identify the current user.");

            return Ok(
                await _consumerExport.ExportToComputymeAsync(
                    request.OrderIds,
                    actionBy,
                    cancellationToken));
        }

        /* Sent orders and what came back. Both channels. */
        [HttpGet("sent")]
        public async Task<ActionResult<IEnumerable<SentOrderDto>>> GetSentOrders(
            [FromQuery] int days,
            CancellationToken cancellationToken)
        {
            var overdueHours =
                int.TryParse(
                    _configuration["OrderIntegration:ResponseOverdueHours"],
                    out var configured) && configured > 0
                    ? configured
                    : 24;

            return Ok(
                await _outbox.GetSentAsync(
                    days > 0 ? days : 30,
                    overdueHours,
                    cancellationToken));
        }

        /*
         * Records the destination's answer for a sent order. Until
         * Computyme returns responses itself, a person records it here.
         */
        [HttpPost("sent/response")]
        public async Task<ActionResult<OrderEditResponse>> SetSentResponse(
            [FromBody] SentOrderResponseRequest request,
            CancellationToken cancellationToken)
        {
            if (Denied(OrderPermissions.Review))
                return Forbid();

            if (!int.TryParse(request.OrderId, out var orderId))
                return BadRequest("A valid OrderId is required.");

            var state = request.State?.Trim().ToUpperInvariant();

            if (state != "ACKNOWLEDGED" && state != "FAILED")
                return BadRequest("State must be ACKNOWLEDGED or FAILED.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized("Unable to identify the current user.");

            return Ok(
                await _outbox.SetResponseAsync(
                    request.Channel,
                    orderId,
                    state,
                    request.DestinationOrderId,
                    request.Reason,
                    actionBy,
                    ToolbenchSource,
                    cancellationToken));
        }

        /* A sent or rejected order goes back to Open. */
        [HttpPost("reopen")]
        public async Task<ActionResult<OrderEditResponse>> ReopenOrder(
            [FromBody] ReopenOrderRequestV2 request,
            CancellationToken cancellationToken)
        {
            if (Denied(OrderPermissions.Review))
                return Forbid();

            if (!int.TryParse(request.OrderId, out var orderId))
                return BadRequest("A valid OrderId is required.");

            if (string.IsNullOrWhiteSpace(request.Reason))
                return BadRequest("A reason is required to reopen an order.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized("Unable to identify the current user.");

            return Ok(
                await _outbox.ReopenAsync(
                    request.Channel,
                    orderId,
                    request.Reason.Trim(),
                    actionBy,
                    ToolbenchSource,
                    cancellationToken));
        }


    }
}
