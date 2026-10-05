using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProInternal.Models.OrderIntegration;
using ProInternal.Services.OrderIntegration;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Controllers
{
    /*
     * The Needs Review tab of the Order Toolbench.
     *
     * Pass 1: list held orders, look at one, reject with a reason.
     * Nothing here changes an order's content.
     */
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class OrderInboxController : ControllerBase
    {
        private readonly IOrderInboxDataAccess _inbox;

        public OrderInboxController(IOrderInboxDataAccess inbox)
        {
            _inbox = inbox;
        }

        [HttpGet("review")]
        public async Task<ActionResult<IEnumerable<OrderInboxReviewItem>>> GetReview(
            [FromQuery] bool includeRejected,
            CancellationToken cancellationToken)
        {
            return Ok(
                await _inbox.GetReviewAsync(includeRejected, cancellationToken));
        }

        [HttpGet("review/{inboxId:long}")]
        public async Task<ActionResult<OrderInboxReviewDetail>> GetReviewDetail(
            long inboxId,
            CancellationToken cancellationToken)
        {
            var detail =
                await _inbox.GetReviewDetailAsync(inboxId, cancellationToken);

            if (detail is null)
                return NotFound();

            return Ok(detail);
        }

        [HttpPost("reject")]
        public async Task<ActionResult<OrderInboxActionResponse>> Reject(
            [FromBody] RejectInboxOrderRequest request,
            CancellationToken cancellationToken)
        {
            if (request.InboxId <= 0)
                return BadRequest("InboxId is required.");

            if (string.IsNullOrWhiteSpace(request.Reason))
                return BadRequest("A rejection reason is required.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized("Unable to identify the current user.");

            return Ok(
                await _inbox.RejectAsync(
                    request.InboxId,
                    request.Reason.Trim(),
                    actionBy,
                    cancellationToken));
        }

        /* Same rule as OrdersController. */
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
    }
}
