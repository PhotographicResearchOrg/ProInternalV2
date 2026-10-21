using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using ProInternal.Helpers.Security;
using ProInternal.Models.Rebates;
using ProInternal.Services.Rebates;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Controllers
{
    /*
     * Instant-rebate claims that need support or were declined: the panel shared by the
     * Rebate Desk (Needs support / declined) and the BRM dashboard.
     *
     * Reading: Rebates.View, or the /rebatedesk or /BRMdash screen; with drawer security,
     * RebateDesk.Declines.View (lines and timeline also Claims or Investigate).
     * Acting (files, back to queue, confirm decline): RebateDesk.Declines.Edit (Rebates.Accounting
     * before drawer security), or the /BRMdash screen, so BRMs keep doing what they did before.
     */
    [ApiController]
    [Route("api/rebatedesk/ir")]
    [RequirePermission(RebateDeskController.ViewPermission, RebateDeskController.ScreenRoute, BrmRoute)]
    public sealed class RebateIrClaimsController : ControllerBase
    {
        public const string BrmRoute = "/BRMdash";

        private readonly IRebateDeskDataAccess _data;
        private readonly RebateClaimsService _claims;

        public RebateIrClaimsController(IRebateDeskDataAccess data, RebateClaimsService claims)
        {
            _data = data;
            _claims = claims;
        }

        private string Actor => Permissions.UserName(User);

        /* Claims needing support or declined, one row per claim, with their files. */
        [HttpGet("declines")]
        [RequireDrawer("Declines", Always = new[] { BrmRoute })]
        public Task<IActionResult> Declines([FromQuery] int months = 12) =>
            Read(async () =>
            {
                var rows = await _data.QueryAsync("piv2.Claim_Declines", new { Months = months });
                foreach (var r in rows)
                {
                    var id = Convert.ToInt32(r["orderID"]);
                    var master = r["masterFileLoc"] as string;
                    var list = string.Join('|', new[] { master == "Additional Files" ? null : master, r["additionalFiles"] as string }
                        .Where(s => !string.IsNullOrWhiteSpace(s)));
                    r["proof"] = _claims.ProofLinks(id, list);
                }
                return rows;
            });

        /* The claim's lines (product, PRO code, serial, week, qty, each, net). */
        [HttpGet("{orderId:int}/lines")]
        [RequireDrawer("Declines", "Claims", "Investigate", Always = new[] { BrmRoute })]
        public Task<IActionResult> Lines(int orderId) =>
            Read(async () =>
            {
                var sets = await _data.QuerySetsAsync("piv2.Claim_Get", new { Rail = "IR", OrderId = orderId });
                return sets.ElementAtOrDefault(1) ?? new List<RebateRow>();
            });

        /* Every step on a claim, and who has it now. */
        [HttpGet("{orderId:int}/timeline")]
        [RequireDrawer("Declines", "Claims", "Investigate", Always = new[] { BrmRoute })]
        public Task<IActionResult> Timeline(int orderId) =>
            Read(async () =>
            {
                var sets = await _data.QuerySetsAsync("piv2.Claim_Timeline", new { OrderId = orderId });
                return new { steps = sets.ElementAtOrDefault(0) ?? new List<RebateRow>(), now = sets.ElementAtOrDefault(1)?.FirstOrDefault() };
            });

        /* Support received: back into the approval queue (dbo.ResubmitRebateOrder, as the BRM dashboard did). */
        [HttpPost("{orderId:int}/resubmit")]
        [RequireDrawer("Declines", Edit = true, Legacy = new[] { RebateDeskController.AccountingPermission }, Always = new[] { BrmRoute })]
        public Task<IActionResult> Resubmit(int orderId, [FromBody] RebateReasonRequest body) =>
            Act(() => _data.ExecuteAsync("piv2.Claim_Resubmit", new { OrderId = orderId, Actor, Reason = body?.Reason ?? "" }));

        /* Second strike: declined for good (dbo.ConfirmDecline). */
        [HttpPost("{orderId:int}/confirm-decline")]
        [RequireDrawer("Declines", Edit = true, Legacy = new[] { RebateDeskController.AccountingPermission }, Always = new[] { BrmRoute })]
        public Task<IActionResult> ConfirmDecline(int orderId, [FromBody] RebateReasonRequest body) =>
            Act(() => _data.ExecuteAsync("piv2.Claim_ConfirmDecline", new { OrderId = orderId, Actor, Reason = body?.Reason ?? "" }));

        /* Support files on the claim. */
        [HttpPost("{orderId:int}/files")]
        [RequireDrawer("Declines", Edit = true, Legacy = new[] { RebateDeskController.AccountingPermission }, Always = new[] { BrmRoute })]
        [RequestSizeLimit(40 * 1024 * 1024)]
        public Task<IActionResult> AddFiles(int orderId, CancellationToken cancellationToken) =>
            Read(async () => await _claims.AddClaimFilesAsync(orderId, (await Request.ReadFormAsync(cancellationToken)).Files, Actor, cancellationToken));

        [HttpPost("{orderId:int}/files/remove")]
        [RequireDrawer("Declines", Edit = true, Legacy = new[] { RebateDeskController.AccountingPermission }, Always = new[] { BrmRoute })]
        public Task<IActionResult> RemoveFile(int orderId, [FromBody] RebateClaimFileRequest body) =>
            Act(() => _claims.RemoveClaimFileAsync(orderId, body?.FileName ?? "", Actor, body?.Reason));

        private async Task<IActionResult> Read<T>(Func<Task<T>> read)
        {
            try
            {
                return Ok(await read());
            }
            catch (SqlException ex) when (ex.Number >= 50700 && ex.Number < 50800)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (RebateFileException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        private Task<IActionResult> Act(Func<Task> action) =>
            Read(async () => { await action(); return new { success = true }; });
    }
}
