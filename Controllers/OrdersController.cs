using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProInternal.Models.Orders;
using ProInternal.Services;
using ProInternal.Services.OrderIntegration;
using System.Collections.Generic;
using System.Security.Claims;
using ProInternal.Models.OrderIntegration;



namespace ProInternal.Controllers
{

    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class OrdersController : ControllerBase
    {
        private readonly IOrdersDataAccess _ordersDataAccess;
        private readonly OrderIntegrationService _orderIntegrationService;

        public OrdersController(IOrdersDataAccess ordersDataAccess, OrderIntegrationService orderIntegrationService)
        {
            _ordersDataAccess = ordersDataAccess;
            _orderIntegrationService = orderIntegrationService;
        }



    [HttpPost("process")]
    public async Task<ActionResult<OrderExportResult>>
    ProcessOrders([FromBody] ProcessOrdersRequest request,CancellationToken cancellationToken)
        {
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


    }
}