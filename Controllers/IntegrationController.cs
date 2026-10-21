using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using ProInternal.Helpers.Security;
using ProInternal.Models.Integration;
using ProInternal.Services.Files;
using ProInternal.Services.Integration;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Controllers
{
    /*
     * The Integration desk: every domain's outgoing messages and the
     * answers to them. Reading needs Integration.View (or the /integration
     * screen); resending, cancelling and sending now need Integration.Resend.
     */
    [ApiController]
    [Route("api/integration")]
    [RequirePermission(IntegrationController.ViewPermission, IntegrationController.ScreenRoute)]
    public sealed class IntegrationController : ControllerBase
    {
        public const string ViewPermission = "Integration.View";
        public const string ResendPermission = "Integration.Resend";
        public const string ScreenRoute = "/integration";

        private readonly IIntegrationDataAccess _data;
        private readonly IntegrationDispatcher _dispatcher;
        private readonly IFileLibrary _files;

        public IntegrationController(IIntegrationDataAccess data, IntegrationDispatcher dispatcher, IFileLibrary files)
        {
            _data = data;
            _dispatcher = dispatcher;
            _files = files;
        }

        [HttpGet("summary")]
        public async Task<IActionResult> Summary() => Ok(await _data.SummaryAsync());

        /* With no status, lists everything that needs a person: rejected, failed, overdue. */
        [HttpGet("messages")]
        public async Task<IActionResult> Search(
            [FromQuery] string? domain, [FromQuery] string? destination, [FromQuery] string? status,
            [FromQuery] string? q, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            var rows = await _data.SearchAsync(domain, destination, status, q, page, pageSize);
            return Ok(new { total = rows.Count > 0 ? rows[0].TotalRows : 0, rows });
        }

        [HttpGet("messages/{messageId:long}")]
        public async Task<IActionResult> Get(long messageId)
        {
            var detail = await _data.GetAsync(messageId);
            return detail == null ? NotFound() : Ok(detail);
        }

        [HttpPost("messages/{messageId:long}/resend")]
        [RequirePermission(ResendPermission)]
        public Task<IActionResult> Resend(long messageId, [FromBody] IntegrationActionRequest body) =>
            Act(() => _data.ResendAsync(messageId, Permissions.UserName(User), body?.Reason ?? ""));

        [HttpPost("messages/{messageId:long}/cancel")]
        [RequirePermission(ResendPermission)]
        public Task<IActionResult> Cancel(long messageId, [FromBody] IntegrationActionRequest body) =>
            Act(() => _data.CancelAsync(messageId, Permissions.UserName(User), body?.Reason ?? ""));

        /* Runs one dispatch cycle now instead of waiting for the next. */
        [HttpPost("dispatch")]
        [RequirePermission(ResendPermission)]
        public async Task<IActionResult> DispatchNow(CancellationToken cancellationToken)
        {
            var sent = await _dispatcher.RunOnceAsync(cancellationToken);
            return Ok(new { sent });
        }

        /* A short-lived download link for a stored file. */
        [HttpGet("files/{fileId:long}/download")]
        public async Task<IActionResult> Download(long fileId)
        {
            var url = await _files.DownloadUrlAsync(fileId, TimeSpan.FromMinutes(10));
            return url == null ? NotFound() : Ok(new { url });
        }

        /* Business-rule refusals from the procedures (50600 range) become 400s with their message. */
        private async Task<IActionResult> Act(Func<Task> action)
        {
            try
            {
                await action();
                return Ok(new { success = true });
            }
            catch (SqlException ex) when (ex.Number >= 50600 && ex.Number < 50700)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}
