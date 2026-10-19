using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using ProInternal.Helpers.Security;
using ProInternal.Models.Rebates;
using ProInternal.Services.Files;
using ProInternal.Services.Rebates;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Controllers
{
    /*
     * The Rebate Desk, two rails:
     *   Instant rebates   uploads (template / AI / manual mapping), purgatory,
     *                     batches, programs, products, vendors and liability
     *   Price protection  programs, products, vendors and liability
     *
     * Permissions (Security Admin):
     *   Rebates.View    route /rebatedesk: read everything, both rails
     *   Rebates.Upload  upload, map, fix purgatory rows, load (the uploader can approve),
     *                   add a product from purgatory
     *   Rebates.Manage  turn programs and batches on or off, change amounts and dates,
     *                   manual entry, products and stacks, price protection, templates
     *   Rebates.Accounting  claims: resend a credit to Computyme, recreate or reprint
     *                   the credit invoice, debit memos to vendors
     *
     * Every rule is in the piv2.Rebate_* / piv2.PP_* procedures; a refusal
     * (50700-50799) comes back as 400 with its message.
     */
    [ApiController]
    [Route("api/rebatedesk")]
    [RequirePermission(ViewPermission, ScreenRoute)]
    public sealed class RebateDeskController : ControllerBase
    {
        public const string ViewPermission = "Rebates.View";
        public const string UploadPermission = "Rebates.Upload";
        public const string ManagePermission = "Rebates.Manage";
        public const string AccountingPermission = "Rebates.Accounting";
        public const string ScreenRoute = "/rebatedesk";

        private readonly IRebateDeskDataAccess _data;
        private readonly RebateUploadService _uploads;
        private readonly IFileLibrary _files;
        private readonly RebateClaimsService _claims;

        public RebateDeskController(IRebateDeskDataAccess data, RebateUploadService uploads, IFileLibrary files, RebateClaimsService claims)
        {
            _data = data;
            _uploads = uploads;
            _files = files;
            _claims = claims;
        }

        private string Actor => Permissions.UserName(User);

        private static string Rail(string? rail) => string.Equals(rail, "PP", StringComparison.OrdinalIgnoreCase) ? "PP" : "IR";

        /* ================= look-ups ================= */

        [HttpGet("overview")]
        public Task<IActionResult> Overview() => Read(async () => (await _data.QueryAsync("piv2.Rebate_Overview")).FirstOrDefault());

        [HttpGet("vendors")]
        public Task<IActionResult> Vendors([FromQuery] string? rail) =>
            Read(() => _data.QueryAsync("piv2.Rebate_Vendors", new { Rail = Rail(rail) }));

        [HttpGet("types")]
        public Task<IActionResult> Types() => Read(() => _data.QueryAsync("piv2.Rebate_Types"));

        [HttpGet("procodes")]
        public Task<IActionResult> ProCodes([FromQuery] string? q) =>
            Read(() => _data.QueryAsync("piv2.Rebate_FindProCodes", new { Q = q }));

        /* ================= uploads ================= */

        [HttpPost("uploads")]
        [RequirePermission(UploadPermission)]
        [RequestSizeLimit(30 * 1024 * 1024)]
        public Task<IActionResult> Upload([FromForm] int vendorId, [FromForm] IFormFile file, CancellationToken cancellationToken) =>
            Read(async () =>
            {
                var (uploadId, proposal) = await _uploads.StartAsync(vendorId, file, Actor, cancellationToken);
                return new { uploadId, proposal };
            });

        [HttpGet("uploads")]
        public Task<IActionResult> Uploads([FromQuery] string? status, [FromQuery] int take = 50) =>
            Read(() => _data.QueryAsync("piv2.Rebate_Uploads", new { Status = string.IsNullOrWhiteSpace(status) ? null : status, Take = take }));

        [HttpGet("uploads/{uploadId:int}")]
        public Task<IActionResult> GetUpload(int uploadId) =>
            Read(async () => UploadShape(await _data.QuerySetsAsync("piv2.Rebate_GetUpload", new { UploadId = uploadId })));

        [HttpPost("uploads/{uploadId:int}/proposal")]
        [RequirePermission(UploadPermission)]
        public Task<IActionResult> Proposal(int uploadId, [FromBody] RebateProposalRequest body, CancellationToken cancellationToken) =>
            Read(() => _uploads.ProposeAsync(uploadId, body ?? new RebateProposalRequest(), cancellationToken));

        [HttpPost("uploads/{uploadId:int}/mapping")]
        [RequirePermission(UploadPermission)]
        public Task<IActionResult> Mapping(int uploadId, [FromBody] RebateMappingRequest body) =>
            Read(async () => UploadShape(await _uploads.ApplyMappingAsync(uploadId, body, Actor)));

        [HttpPost("uploads/{uploadId:int}/load")]
        [RequirePermission(UploadPermission)]
        public Task<IActionResult> Load(int uploadId, [FromBody] RebateLoadRequest? body) =>
            Read(async () => (await _data.QueryAsync("piv2.Rebate_Load", new
            {
                UploadId = uploadId,
                Actor,
                RowIds = body?.RowIds is { Count: > 0 } ids ? string.Join(",", ids) : null
            })).FirstOrDefault());

        [HttpPost("uploads/{uploadId:int}/cancel")]
        [RequirePermission(UploadPermission)]
        public Task<IActionResult> CancelUpload(int uploadId, [FromBody] RebateReasonRequest body) =>
            Act(() => _data.ExecuteAsync("piv2.Rebate_CancelUpload", new { UploadId = uploadId, Actor, Reason = body?.Reason ?? "" }));

        /* Creates the rebate products the naming rule set calls for, for this upload's purgatory rows. */
        [HttpPost("uploads/{uploadId:int}/create-products")]
        [RequirePermission(UploadPermission, ManagePermission)]
        public Task<IActionResult> CreateMissingProducts(int uploadId, [FromBody] RebateCreateProductsRequest? body) =>
            Read(async () => (await _data.QueryAsync("piv2.Rebate_CreateMissingProducts", new
            {
                UploadId = uploadId,
                Actor,
                RowIds = body?.RowIds is { Count: > 0 } ids ? string.Join(",", ids) : null
            })).FirstOrDefault());

        /* A short-lived link to the original vendor file on S3. */
        [HttpGet("uploads/{uploadId:int}/file")]
        public Task<IActionResult> UploadFile(int uploadId) =>
            Read(async () =>
            {
                var head = (await _data.QuerySetsAsync("piv2.Rebate_GetUpload", new { UploadId = uploadId })).FirstOrDefault()?.FirstOrDefault()
                           ?? throw new RebateFileException("That upload does not exist.");
                var url = await _files.DownloadUrlAsync(head.Get<long>("fileId"), TimeSpan.FromMinutes(10));
                return new { url };
            });

        private static object UploadShape(List<List<RebateRow>> sets) => new
        {
            upload = sets.ElementAtOrDefault(0)?.FirstOrDefault(),
            rows = sets.ElementAtOrDefault(1) ?? new List<RebateRow>()
        };

        /* ================= purgatory and rows ================= */

        [HttpGet("purgatory")]
        public Task<IActionResult> Purgatory([FromQuery] int? vendorId) =>
            Read(() => _data.QueryAsync("piv2.Rebate_Purgatory", new { VendorId = vendorId }));

        [HttpPut("rows/{rowId:long}")]
        [RequirePermission(UploadPermission)]
        public Task<IActionResult> UpdateRow(long rowId, [FromBody] RebateRowUpdate body) =>
            Read(async () => (await _data.QueryAsync("piv2.Rebate_UpdateRow", new
            {
                RowId = rowId,
                body.ProCode,
                body.VendorSku,
                body.Upc,
                body.StackProduct,
                body.Description,
                body.InstantRebate,
                body.Reimbursement,
                body.MapPrice,
                body.ProPad,
                StartDate = body.StartDate?.Date,
                EndDate = body.EndDate?.Date,
                body.RebateType,
                body.Notes,
                Actor
            })).FirstOrDefault());

        /* One row with the file's original line (the purgatory list leaves that out to stay light). */
        [HttpGet("rows/{rowId:long}")]
        public Task<IActionResult> GetRow(long rowId) =>
            Read(async () => (await _data.QueryAsync("piv2.Rebate_GetRow", new { RowId = rowId })).FirstOrDefault());

        [HttpGet("rows/{rowId:long}/options")]
        public Task<IActionResult> RowOptions(long rowId) =>
            Read(() => _data.QueryAsync("piv2.Rebate_RowOptions", new { RowId = rowId }));

        [HttpPost("rows/{rowId:long}/model")]
        [RequirePermission(UploadPermission)]
        public Task<IActionResult> PickModel(long rowId, [FromBody] RebatePickModelRequest body) =>
            Read(async () => (await _data.QueryAsync("piv2.Rebate_PickModel", new { RowId = rowId, body?.ModelId, Actor })).FirstOrDefault());

        [HttpPost("rows/{rowId:long}/skip")]
        [RequirePermission(UploadPermission)]
        public Task<IActionResult> SkipRow(long rowId, [FromBody] RebateReasonRequest body) =>
            Act(() => _data.ExecuteAsync("piv2.Rebate_SkipRow", new { RowId = rowId, Actor, Reason = body?.Reason ?? "" }));

        [HttpPost("rows/skip")]
        [RequirePermission(UploadPermission)]
        public Task<IActionResult> SkipRows([FromBody] RebateRowsRequest body) =>
            Read(async () => (await _data.QueryAsync("piv2.Rebate_SkipRows", new
            {
                RowIds = string.Join(",", body?.RowIds ?? new List<long>()),
                Actor,
                Reason = body?.Reason ?? ""
            })).FirstOrDefault());

        /* "Load anyway": rows that overlap a live program may load, with a reason. */
        [HttpPost("rows/allow-overlap")]
        [RequirePermission(ManagePermission)]
        public Task<IActionResult> AllowOverlap([FromBody] RebateRowsRequest body) =>
            Read(async () => (await _data.QueryAsync("piv2.Rebate_AllowOverlap", new
            {
                RowIds = string.Join(",", body?.RowIds ?? new List<long>()),
                Actor,
                Reason = body?.Reason ?? ""
            })).FirstOrDefault());

        [HttpPost("rows/{rowId:long}/restore")]
        [RequirePermission(UploadPermission)]
        public Task<IActionResult> RestoreRow(long rowId) =>
            Act(() => _data.ExecuteAsync("piv2.Rebate_RestoreRow", new { RowId = rowId, Actor }));

        /* ================= vendor terms ================= */

        [HttpGet("vendors/{vendorId:int}/terms")]
        public Task<IActionResult> VendorTerms(int vendorId) =>
            Read(async () => (await _data.QueryAsync("piv2.Rebate_GetVendorTerms", new { VendorId = vendorId })).FirstOrDefault());

        [HttpPut("vendors/{vendorId:int}/terms")]
        [RequirePermission(ManagePermission)]
        public Task<IActionResult> SaveVendorTerms(int vendorId, [FromBody] RebateVendorTermsRequest body) =>
            Act(() => _data.ExecuteAsync("piv2.Rebate_SaveVendorTerms", new
            {
                VendorId = vendorId,
                body.CatalogPrefix,
                body.BrandIds,
                body.VendorSharePct,
                body.ComboPadPct,
                body.ExpireDays,
                body.DefaultRebateType,
                body.Notes,
                Actor
            }));

        /* ================= templates ================= */

        [HttpGet("templates")]
        public Task<IActionResult> Templates([FromQuery] int? vendorId) =>
            Read(() => _data.QueryAsync("piv2.Rebate_Templates", new { VendorId = vendorId }));

        [HttpPost("templates/{templateId:int}/retire")]
        [RequirePermission(ManagePermission)]
        public Task<IActionResult> RetireTemplate(int templateId, [FromBody] RebateReasonRequest body) =>
            Act(() => _data.ExecuteAsync("piv2.Rebate_RetireTemplate", new { TemplateId = templateId, Actor, Reason = body?.Reason ?? "" }));

        /* ================= batches ================= */

        [HttpGet("batches")]
        public Task<IActionResult> Batches([FromQuery] string? q, [FromQuery] int? vendorId, [FromQuery] string? state,
                                           [FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] int months = 12) =>
            Read(async () => Paged(await _data.QueryAsync("piv2.Rebate_Batches", new
            {
                Q = string.IsNullOrWhiteSpace(q) ? null : q.Trim(),
                VendorId = vendorId,
                State = string.IsNullOrWhiteSpace(state) ? null : state,
                Page = page,
                PageSize = pageSize,
                Months = months
            })));

        [HttpGet("batches/{batchId:int}/programs")]
        public Task<IActionResult> BatchPrograms(int batchId) =>
            Read(() => _data.QueryAsync("piv2.Rebate_BatchPrograms", new { BatchId = batchId }));

        [HttpPost("batches/{batchId:int}/active")]
        [RequirePermission(ManagePermission)]
        public Task<IActionResult> SetBatchActive(int batchId, [FromBody] RebateActiveRequest body) =>
            Read(async () => (await _data.QueryAsync("piv2.Rebate_SetBatchActive",
                new { BatchId = batchId, body.Active, Actor, Reason = body.Reason ?? "" })).FirstOrDefault());

        [HttpPost("batches/{batchId:int}/dates")]
        [RequirePermission(ManagePermission)]
        public Task<IActionResult> ChangeBatchDates(int batchId, [FromBody] RebateDatesRequest body) =>
            Read(async () => (await _data.QueryAsync("piv2.Rebate_ChangeBatchDates", new
            {
                BatchId = batchId,
                StartDate = body.StartDate.Date,
                EndDate = body.EndDate.Date,
                ExpireOn = body.ExpireOn?.Date,
                Actor,
                Reason = body.Reason ?? ""
            })).FirstOrDefault());

        /* ================= instant-rebate programs ================= */

        [HttpGet("programs")]
        public Task<IActionResult> Programs([FromQuery] int? vendorId, [FromQuery] int? modelId, [FromQuery] int? batchId,
                                            [FromQuery] string? state, [FromQuery] string? when, [FromQuery] string? q,
                                            [FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] int months = 12) =>
            Read(async () => Paged(await _data.QueryAsync("piv2.Rebate_Programs", new
            {
                VendorId = vendorId,
                ModelId = modelId,
                BatchId = batchId,
                State = string.IsNullOrWhiteSpace(state) ? null : state,
                When = string.IsNullOrWhiteSpace(when) ? null : when,
                Q = q,
                Page = page,
                PageSize = pageSize,
                Months = months
            })));

        [HttpPost("programs")]
        [RequirePermission(ManagePermission)]
        public Task<IActionResult> AddPrograms([FromBody] RebateAddProgramsRequest body) =>
            Read(async () => (await _data.QueryAsync("piv2.Rebate_AddPrograms", new
            {
                body.ModelId,
                body.IRType,
                body.InstantRebate,
                body.Reimbursement,
                body.ProPad,
                body.MapPrice,
                StartDate = body.StartDate.Date,
                EndDate = body.EndDate.Date,
                ExpireOn = body.ExpireOn.Date,
                body.RepeatWeeks,
                body.StartActive,
                Actor,
                body.Reason
            })).FirstOrDefault());

        [HttpPut("programs/{programId:int}/amounts")]
        [RequirePermission(ManagePermission)]
        public Task<IActionResult> ChangeAmounts(int programId, [FromBody] RebateAmountsRequest body) =>
            Act(() => _data.ExecuteAsync("piv2.Rebate_ChangeProgram", new
            {
                ProgramId = programId,
                body.InstantRebate,
                body.VendorShare,
                body.ProPad,
                body.MapPrice,
                Actor,
                Reason = body.Reason ?? ""
            }));

        [HttpPut("programs/{programId:int}/dates")]
        [RequirePermission(ManagePermission)]
        public Task<IActionResult> ChangeProgramDates(int programId, [FromBody] RebateDatesRequest body) =>
            Act(() => _data.ExecuteAsync("piv2.Rebate_ChangeProgramDates", new
            {
                ProgramId = programId,
                StartDate = body.StartDate.Date,
                EndDate = body.EndDate.Date,
                ExpireOn = body.ExpireOn?.Date,
                Actor,
                Reason = body.Reason ?? ""
            }));

        [HttpPost("programs/{programId:int}/active")]
        [RequirePermission(ManagePermission)]
        public Task<IActionResult> SetProgramActive(int programId, [FromBody] RebateActiveRequest body) =>
            Act(() => _data.ExecuteAsync("piv2.Rebate_SetProgramActive",
                new { ProgramId = programId, body.Active, Actor, Reason = body.Reason ?? "" }));

        /* ================= products (both rails) ================= */

        [HttpGet("products")]
        public Task<IActionResult> Products([FromQuery] string? rail, [FromQuery] int? vendorId, [FromQuery] string? q,
                                            [FromQuery] bool? active, [FromQuery] int page = 1, [FromQuery] int pageSize = 50) =>
            Read(async () => Paged(await _data.QueryAsync("piv2.Rebate_Products", new
            {
                Rail = Rail(rail),
                VendorId = vendorId,
                Q = q,
                Active = active,
                Page = page,
                PageSize = pageSize
            })));

        [HttpGet("products/{modelId:int}")]
        public Task<IActionResult> GetProduct(int modelId) =>
            Read(async () =>
            {
                var sets = await _data.QuerySetsAsync("piv2.Rebate_GetProduct", new { ModelId = modelId });
                var product = sets.ElementAtOrDefault(0)?.FirstOrDefault() ?? throw new RebateFileException("That product does not exist.");
                return new
                {
                    product,
                    proCodes = sets.ElementAtOrDefault(1) ?? new List<RebateRow>(),
                    stacks = sets.ElementAtOrDefault(2) ?? new List<RebateRow>(),
                    programs = sets.ElementAtOrDefault(3) ?? new List<RebateRow>()
                };
            });

        /* Uploaders may add a product from purgatory (ForRowId); changing existing products needs Manage. */
        [HttpPost("products")]
        [RequirePermission(UploadPermission, ManagePermission)]
        public Task<IActionResult> AddProduct([FromBody] RebateProductRequest body) =>
            Read(async () =>
            {
                var saved = (await _data.QueryAsync("piv2.Rebate_SaveProduct", ProductArgs(null, body))).First();
                if (body.ForRowId is long rowId)
                    await _data.QueryAsync("piv2.Rebate_PickModel", new { RowId = rowId, ModelId = saved.Get<int>("modelId"), Actor });
                return saved;
            });

        [HttpPut("products/{modelId:int}")]
        [RequirePermission(ManagePermission)]
        public Task<IActionResult> ChangeProduct(int modelId, [FromBody] RebateProductRequest body) =>
            Read(async () => (await _data.QueryAsync("piv2.Rebate_SaveProduct", ProductArgs(modelId, body))).First());

        private object ProductArgs(int? modelId, RebateProductRequest body) => new
        {
            ModelId = modelId,
            Rail = Rail(body.Rail),
            body.VendorId,
            body.Description,
            body.ProCodes,
            body.SerialNumbersRequired,
            Actor,
            body.Reason
        };

        [HttpPost("products/{modelId:int}/active")]
        [RequirePermission(ManagePermission)]
        public Task<IActionResult> SetProductActive(int modelId, [FromBody] RebateActiveRequest body) =>
            Act(() => _data.ExecuteAsync("piv2.Rebate_SetProductActive",
                new { ModelId = modelId, body.Active, Actor, Reason = body.Reason ?? "" }));

        [HttpPut("products/{modelId:int}/stacks")]
        [RequirePermission(ManagePermission)]
        public Task<IActionResult> SetStacks(int modelId, [FromBody] RebateStacksRequest body) =>
            Act(() => _data.ExecuteAsync("piv2.Rebate_SetStacks", new
            {
                ModelId = modelId,
                StackModelIds = string.Join(",", body?.StackModelIds ?? new List<int>()),
                Actor,
                body?.Reason
            }));

        /* ================= price protection ================= */

        [HttpGet("pp/programs")]
        public Task<IActionResult> PriceProtectionPrograms([FromQuery] int? vendorId, [FromQuery] int? modelId, [FromQuery] string? state,
                                                           [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? q,
                                                           [FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] int months = 12) =>
            Read(async () => Paged(await _data.QueryAsync("piv2.PP_Programs", new
            {
                VendorId = vendorId,
                ModelId = modelId,
                State = string.IsNullOrWhiteSpace(state) ? null : state,
                From = from?.Date,
                To = to?.Date,
                Q = q,
                Page = page,
                PageSize = pageSize,
                Months = months
            })));

        [HttpPost("pp/programs")]
        [RequirePermission(ManagePermission)]
        public Task<IActionResult> AddPriceProtection([FromBody] PriceProtectionProgramRequest body) =>
            Read(async () => (await _data.QueryAsync("piv2.PP_AddProgram", new
            {
                body.ModelId,
                ProgramDate = body.ProgramDate.Date,
                body.NewInvoiceCost,
                body.Amount,
                body.NewMap,
                body.StartActive,
                Actor,
                body.Reason
            })).FirstOrDefault());

        [HttpPut("pp/programs/{programId:int}")]
        [RequirePermission(ManagePermission)]
        public Task<IActionResult> ChangePriceProtection(int programId, [FromBody] PriceProtectionProgramRequest body) =>
            Act(() => _data.ExecuteAsync("piv2.PP_ChangeProgram", new
            {
                ProgramId = programId,
                ProgramDate = body.ProgramDate.Date,
                body.NewInvoiceCost,
                body.Amount,
                body.NewMap,
                Actor,
                Reason = body.Reason ?? ""
            }));

        [HttpPost("pp/programs/{programId:int}/active")]
        [RequirePermission(ManagePermission)]
        public Task<IActionResult> SetPriceProtectionActive(int programId, [FromBody] RebateActiveRequest body) =>
            Act(() => _data.ExecuteAsync("piv2.PP_SetProgramActive",
                new { ProgramId = programId, body.Active, Actor, Reason = body.Reason ?? "" }));

        /* ================= vendors and liability ================= */

        [HttpGet("liability")]
        public Task<IActionResult> Liability([FromQuery] string? rail, [FromQuery] int? vendorId,
                                             [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int months = 12) =>
            Read(async () =>
            {
                var sets = await _data.QuerySetsAsync("piv2.Rebate_VendorLiability", new
                {
                    Rail = Rail(rail),
                    VendorId = vendorId,
                    From = from?.Date,
                    To = to?.Date,
                    Months = months
                });
                return new
                {
                    vendors = sets.ElementAtOrDefault(0) ?? new List<RebateRow>(),
                    products = sets.ElementAtOrDefault(1) ?? new List<RebateRow>(),
                    openClaims = sets.ElementAtOrDefault(2) ?? new List<RebateRow>()
                };
            });

        /* ================= claims (accounting) ================= */

        [HttpGet("claims")]
        public Task<IActionResult> Claims([FromQuery] string? rail, [FromQuery] string? q, [FromQuery] int? vendorId, [FromQuery] string? state,
                                          [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 50,
                                          [FromQuery] int months = 12, [FromQuery] int? memberId = null, [FromQuery] int? modelId = null) =>
            Read(async () => Paged(await _data.QueryAsync("piv2.Claim_Search", new
            {
                Rail = Rail(rail),
                Q = q,
                VendorId = vendorId,
                State = string.IsNullOrWhiteSpace(state) ? null : state,
                From = from?.Date,
                To = to?.Date,
                Page = page,
                PageSize = pageSize,
                Months = months,
                MemberId = memberId,
                ModelId = modelId
            })));

        [HttpGet("claims/{rail}/{orderId:int}")]
        public Task<IActionResult> Claim(string rail, int orderId) =>
            Read(async () =>
            {
                var sets = await _data.QuerySetsAsync("piv2.Claim_Get", new { Rail = Rail(rail), OrderId = orderId });
                var lines = sets.ElementAtOrDefault(1) ?? new List<RebateRow>();
                if (lines.Count == 0) throw new RebateFileException("That claim does not exist.");
                return new
                {
                    decisions = sets.ElementAtOrDefault(0) ?? new List<RebateRow>(),
                    lines,
                    arCredits = sets.ElementAtOrDefault(2) ?? new List<RebateRow>(),
                    history = sets.ElementAtOrDefault(3) ?? new List<RebateRow>(),
                    /* The member's proof files, as links to the IR site. */
                    proof = (sets.ElementAtOrDefault(4) ?? new List<RebateRow>())
                        .Select(f => new { name = f.Get<string>("fileName"), url = _claims.ProofUrl(orderId, f.Get<string>("fileName") ?? "") })
                        .ToList()
                };
            });

        [HttpPost("claims/{rail}/{orderId:int}/resend")]
        [RequirePermission(AccountingPermission)]
        public Task<IActionResult> ResendCredit(string rail, int orderId, [FromBody] RebateReasonRequest body) =>
            Act(() => _data.ExecuteAsync("piv2.Claim_ResendCredit", new { Rail = Rail(rail), OrderId = orderId, Actor, Reason = body?.Reason ?? "" }));

        /* Status 3 (needs support) back into the approval queue, the same way the BRM dashboard does it. */
        [HttpPost("claims/{rail}/{orderId:int}/resubmit")]
        [RequirePermission(AccountingPermission)]
        public Task<IActionResult> Resubmit(string rail, int orderId, [FromBody] RebateReasonRequest body) =>
            Act(() => _data.ExecuteAsync("piv2.Claim_Resubmit", new { OrderId = orderId, Actor, Reason = body?.Reason ?? "" }));

        [HttpPost("claims/{rail}/{orderId:int}/invoice")]
        [RequirePermission(AccountingPermission)]
        public Task<IActionResult> RecreateInvoice(string rail, int orderId, [FromBody] RebateReasonRequest? body) =>
            Read(() => _claims.RecreateInvoiceAsync(rail, orderId, Actor, body?.Reason));

        /* The invoice PDF the member site has (reprint). */
        [HttpGet("claims/{rail}/{orderId:int}/invoice")]
        public async Task<IActionResult> Reprint(string rail, int orderId)
        {
            try
            {
                var pdf = await _claims.ReprintAsync(rail, orderId);
                return pdf == null
                    ? NotFound(new { success = false, message = "There is no invoice PDF for this claim yet. Use Recreate invoice." })
                    : File(pdf.Value.Pdf, "application/pdf", pdf.Value.FileName);
            }
            catch (RebateFileException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /* ================= investigate ================= */

        /* The lookup box: claim #, member number or name, rebate product, vendor. */
        [HttpGet("investigate/find")]
        public Task<IActionResult> InvestigateFind([FromQuery] string? q) =>
            Read(() => _data.QueryAsync("piv2.Investigate_Find", new { Q = q }));

        /* Every member who claimed a product (or a vendor's products), claimed against bought. */
        [HttpGet("investigate/claimants")]
        public Task<IActionResult> InvestigateClaimants([FromQuery] int? modelId, [FromQuery] int? vendorId, [FromQuery] int months = 12) =>
            Read(async () =>
            {
                var sets = await _data.QuerySetsAsync("piv2.Investigate_Claimants", new { ModelId = modelId, VendorId = vendorId, Months = months });
                return new
                {
                    members = sets.ElementAtOrDefault(0) ?? new List<RebateRow>(),
                    about = (sets.ElementAtOrDefault(1) ?? new List<RebateRow>()).FirstOrDefault()
                };
            });

        /* One member (and products): bought against claimed, by month, one row per claim, and the flags. */
        [HttpGet("investigate/member/{memberId:int}")]
        public Task<IActionResult> InvestigateMember(int memberId, [FromQuery] string? modelIds, [FromQuery] int months = 12) =>
            Read(async () =>
            {
                var sets = await _data.QuerySetsAsync("piv2.Investigate_Member", new
                {
                    MemberId = memberId,
                    ModelIds = string.IsNullOrWhiteSpace(modelIds) ? null : modelIds,
                    Months = months
                });
                var claims = sets.ElementAtOrDefault(2) ?? new List<RebateRow>();
                foreach (var c in claims)
                    c["proof"] = _claims.ProofLinks(c.Get<int>("orderId"), c.Get<string>("proofFiles"));
                return new
                {
                    products = sets.ElementAtOrDefault(0) ?? new List<RebateRow>(),
                    months = sets.ElementAtOrDefault(1) ?? new List<RebateRow>(),
                    claims,
                    purchases = sets.ElementAtOrDefault(3) ?? new List<RebateRow>(),
                    about = (sets.ElementAtOrDefault(4) ?? new List<RebateRow>()).FirstOrDefault()
                };
            });

        [HttpGet("debitmemos/candidates")]
        public Task<IActionResult> DebitMemoCandidates([FromQuery] string? rail, [FromQuery] string vendorIds, [FromQuery] DateTime from, [FromQuery] DateTime to) =>
            Read(async () =>
            {
                var lines = await _data.QueryAsync("piv2.Claim_DebitMemoCandidates", new { Rail = Rail(rail), VendorIds = vendorIds ?? "", From = from.Date, To = to.Date });
                var firstVendor = (vendorIds ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries).Select(v => int.TryParse(v, out var n) ? n : 0).FirstOrDefault(n => n > 0);
                var billing = firstVendor > 0 ? (await _data.QueryAsync("piv2.Claim_VendorBilling", new { VendorId = firstVendor })).FirstOrDefault() : null;
                var vendorName = lines.FirstOrDefault()?.Get<string>("vendorName") ?? "";
                return new { lines, emailTo = billing?.Get<string>("emailTo"), letter = RebateClaimsService.LetterFor(vendorName) };
            });

        [HttpPost("debitmemos")]
        [RequirePermission(AccountingPermission)]
        [RequestSizeLimit(40 * 1024 * 1024)]
        public Task<IActionResult> CreateDebitMemo([FromForm] RebateClaimsService.DebitMemoRequest body, CancellationToken cancellationToken) =>
            Read(() => _claims.CreateDebitMemoAsync(body, Request.HasFormContentType ? Request.Form.Files : null, Actor, cancellationToken));

        /* Test run: builds and emails everything to the test address; nothing is stamped or recorded. */
        [HttpPost("debitmemos/test")]
        [RequirePermission(AccountingPermission)]
        [RequestSizeLimit(40 * 1024 * 1024)]
        public Task<IActionResult> TestDebitMemo([FromForm] RebateClaimsService.DebitMemoRequest body, CancellationToken cancellationToken) =>
            Read(() => _claims.TestDebitMemoAsync(body, Request.HasFormContentType ? Request.Form.Files : null, Actor, cancellationToken));

        [HttpGet("debitmemos")]
        public Task<IActionResult> DebitMemos([FromQuery] string? rail, [FromQuery] string? q, [FromQuery] int months = 12) =>
            Read(() => _data.QueryAsync("piv2.Claim_DebitMemos", new { Rail = Rail(rail), Q = q, Take = 200, Months = months }));

        [HttpGet("debitmemos/{debitMemoId:int}/csv")]
        public async Task<IActionResult> DebitMemoCsv(int debitMemoId)
        {
            try
            {
                var (csv, name) = await _claims.DebitMemoCsvAsync(debitMemoId);
                return File(csv, "text/csv", name);
            }
            catch (RebateFileException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /* ================= history ================= */

        [HttpGet("history")]
        public Task<IActionResult> History([FromQuery] string? rail, [FromQuery] int? batchId, [FromQuery] int? programId,
                                           [FromQuery] int? uploadId, [FromQuery] int? modelId, [FromQuery] int take = 200) =>
            Read(() => _data.QueryAsync("piv2.Rebate_History", new
            {
                Rail = string.IsNullOrWhiteSpace(rail) ? null : Rail(rail),
                BatchId = batchId,
                ProgramId = programId,
                UploadId = uploadId,
                ModelId = modelId,
                Take = take
            }));

        /* ================= plumbing ================= */

        private static object Paged(List<RebateRow> rows) => new
        {
            total = rows.Count > 0 ? rows[0].Get<int>("totalRows") : 0,
            rows
        };

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
            catch (SqlException ex) when (ex.Number is 2601 or 2627)
            {
                return BadRequest(new { success = false, message = "That already exists; refresh and try again." });
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
