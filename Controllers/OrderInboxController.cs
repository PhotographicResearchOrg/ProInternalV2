using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers;
using ProInternal.Models.OrderIntegration;
using ProInternal.Services.OrderIntegration;
using System.Collections.Generic;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Controllers
{
    /*
     * The Needs Review tab of the Order Toolbench: list held orders,
     * look at one, fix and release it, or reject it. Also pulls
     * waiting POS and EDI order files into the inbox.
     */
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class OrderInboxController : ControllerBase
    {
        private readonly IOrderInboxDataAccess _inbox;
        private const string JobKeyHeader = "x-integration-key";

        private readonly HeldOrderReleaseService _release;
        private readonly OrderIntegrationService _integration;
        private readonly IConfiguration _configuration;

        public OrderInboxController(
            IOrderInboxDataAccess inbox,
            HeldOrderReleaseService release,
            OrderIntegrationService integration,
            IConfiguration configuration)
        {
            _inbox = inbox;
            _release = release;
            _integration = integration;
            _configuration = configuration;
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

        /* Product lookup for giving a line the right product. */
        [HttpGet("products")]
        public async Task<ActionResult<IEnumerable<ProductLookupDto>>> SearchProducts(
            [FromQuery] string? term,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(term) || term.Trim().Length < 2)
                return Ok(new List<ProductLookupDto>());

            return Ok(
                await _inbox.SearchProductsAsync(term.Trim(), cancellationToken));
        }

        /* Save the corrections, check the order again, import it if it passes. */
        [HttpPost("release")]
        public async Task<ActionResult<HeldOrderReleaseResult>> Release(
            [FromBody] HeldOrderReleaseRequest request,
            CancellationToken cancellationToken)
        {
            if (!User.IsAllowed(_configuration, OrderPermissions.Review))
                return Forbid();

            if (request.InboxId <= 0)
                return BadRequest("InboxId is required.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized("Unable to identify the current user.");

            return Ok(
                await _release.ReleaseAsync(request, actionBy, cancellationToken));
        }

        [HttpPost("reject")]
        public async Task<ActionResult<OrderInboxActionResponse>> Reject(
            [FromBody] RejectInboxOrderRequest request,
            CancellationToken cancellationToken)
        {
            if (!User.IsAllowed(_configuration, OrderPermissions.Review))
                return Forbid();

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

        /*
         * Read a folder and load every waiting order file.
         *
         * Each is used two ways, running exactly the same code:
         *   - the Import button on the Needs Review tab (a signed-in
         *     user with the Orders.Review permission)
         *   - a Windows scheduled task (the x-integration-key header,
         *     checked against OrderIntegration:JobKey)
         */
        [AllowAnonymous]
        [HttpPost("import/pos")]
        public async Task<ActionResult<OrderImportSummary>> ImportPos(
            CancellationToken cancellationToken)
        {
            var refused = AuthorizeImport(out var actionBy);

            if (refused is not null)
                return refused;

            return Ok(await _integration.ImportPosFolderAsync(actionBy, cancellationToken));
        }

        [AllowAnonymous]
        [HttpPost("import/edi")]
        public async Task<ActionResult<OrderImportSummary>> ImportEdi(
            CancellationToken cancellationToken)
        {
            var refused = AuthorizeImport(out var actionBy);

            if (refused is not null)
                return refused;

            return Ok(await _integration.ImportEdiFolderAsync(actionBy, cancellationToken));
        }

        /* Null = allowed, and actionBy says who is running it. */
        private ActionResult? AuthorizeImport(out string actionBy)
        {
            actionBy = string.Empty;

            if (User.Identity?.IsAuthenticated == true)
            {
                if (!User.IsAllowed(_configuration, OrderPermissions.Review))
                    return StatusCode(StatusCodes.Status403Forbidden);

                actionBy = GetCurrentUser() ?? "Order Toolbench";
                return null;
            }

            if (HasValidJobKey())
            {
                actionBy = "Scheduled Import";
                return null;
            }

            return Unauthorized();
        }

        private bool HasValidJobKey()
        {
            var configuredKey = _configuration["OrderIntegration:JobKey"];

            if (string.IsNullOrWhiteSpace(configuredKey))
                return false;

            if (!Request.Headers.TryGetValue(JobKeyHeader, out var supplied))
                return false;

            var suppliedKey = supplied.ToString();

            if (string.IsNullOrWhiteSpace(suppliedKey))
                return false;

            var expectedBytes = Encoding.UTF8.GetBytes(configuredKey);
            var suppliedBytes = Encoding.UTF8.GetBytes(suppliedKey);

            return expectedBytes.Length == suppliedBytes.Length &&
                   CryptographicOperations.FixedTimeEquals(expectedBytes, suppliedBytes);
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
