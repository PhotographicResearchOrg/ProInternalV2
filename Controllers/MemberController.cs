#nullable disable   // optional fields: without this, [ApiController] treats every non-nullable string as required and returns 400
using System;
using System.Collections.Generic;
using Microsoft.Data.SqlClient;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Amazon.S3;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using ProInternal.Models.Member;
using ProInternal.Services;

namespace ProInternal.Controllers
{
    /// <summary>
    /// Member Desk. Reads and writes the member contract's SQL tables.
    /// Member:SqlIsMaster (appsettings) decides whether Computyme-owned fields
    /// are read live from ARMST (false) or from Roster and editable (true).
    /// </summary>
    [ApiController]
    [Authorize]                       // match the attribute ProductContractController uses
    [Route("api/members")]
    public class MemberController : ControllerBase
    {
        private readonly IProDataAccess _db;
        private readonly IAmazonS3 _s3;
        private readonly bool _sqlIsMaster;
        private readonly string _bucket;
        private const long MaxUploadBytes = 25 * 1024 * 1024;

        private static readonly HashSet<string> DocumentTypes = new(StringComparer.Ordinal)
        {
            "BUSINESS_CERT", "RESALE_CERT", "MEMBERSHIP_AGREEMENT", "CREDIT_APPLICATION",
            "W9", "EIN_LETTER", "VENDOR_AUTHORIZATION", "MAP_EVIDENCE", "OTHER"
        };

        public MemberController(IProDataAccess db, IAmazonS3 s3, IConfiguration config)
        {
            _db = db;
            _s3 = s3;
            _sqlIsMaster = config.GetValue<bool>("Member:SqlIsMaster");          // absent = false
            _bucket = config["MemberDocuments:Bucket"];
        }

        /// <summary>Who is making the change, for the history. Tries the claim names logins commonly use.</summary>
        private string CurrentUser
        {
            get
            {
                if (!string.IsNullOrWhiteSpace(User?.Identity?.Name)) return User.Identity.Name;
                string[] names = { "username", "userName", "UserName", "unique_name", "preferred_username", "name",
                                   System.Security.Claims.ClaimTypes.Name, "email", System.Security.Claims.ClaimTypes.Email,
                                   "sub", "userId", "UserId", System.Security.Claims.ClaimTypes.NameIdentifier };
                foreach (var n in names)
                {
                    var v = User?.Claims?.FirstOrDefault(c => c.Type == n)?.Value;
                    if (!string.IsNullOrWhiteSpace(v)) return v;
                }
                return "unknown";
            }
        }

        /// <summary>Temporary: shows which claims the login token carries. Remove once Who shows names.</summary>
        [HttpGet("whoami")]
        public IActionResult WhoAmI() => Ok(new
        {
            resolved = CurrentUser,
            claims = User?.Claims?.Select(c => new { c.Type, c.Value })
        });

        /// <summary>Business rule errors from the procedures (THROW 504xx) become 400s with the message.</summary>
        private IActionResult Run(Action action, Func<IActionResult> ok)
        {
            try { action(); return ok(); }
            catch (SqlException ex) when (ex.Number >= 50400 && ex.Number < 50500)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // ------------------------------------------------------------ members

        [HttpGet]
        public ActionResult<List<MemberListItem>> Search([FromQuery] string term = null) =>
            _db.Member_Search(term);

        [HttpGet("{accountNumber:regex(^\\d{{1,6}}$)}")]
        public ActionResult<MemberDetail> Get(string accountNumber)
        {
            var member = _db.Member_Get(accountNumber, _sqlIsMaster);
            return member == null ? NotFound() : member;
        }

        [HttpPut("{accountNumber:regex(^\\d{{1,6}}$)}")]
        public IActionResult Save(string accountNumber, [FromBody] MemberSaveRequest request) =>
            Run(() => _db.Member_Save(accountNumber, request, _sqlIsMaster, CurrentUser),
                () => Ok(_db.Member_Get(accountNumber, _sqlIsMaster)));

        // ------------------------------------------------------------ access rules

        [HttpGet("access-rules")]
        public ActionResult<List<AccessRule>> Rules() => _db.AccessRule_List();

        [HttpGet("access-rules/{code}/members")]
        public ActionResult<List<AccessRuleMember>> RuleMembers(string code) => _db.AccessRule_Members(code);

        [HttpPost("access-rules")]
        public IActionResult SaveRule([FromBody] AccessRule rule)
        {
            if (string.IsNullOrWhiteSpace(rule?.Description) || rule.Description.Trim().Length < 10)
                return BadRequest(new { message = "Describe the rule in plain English (at least 10 characters)." });
            if (string.IsNullOrWhiteSpace(rule.BusinessReason) || rule.BusinessReason.Trim().Length < 5)
                return BadRequest(new { message = "Say why the rule exists." });

            int id = 0;
            try { id = _db.AccessRule_Save(rule, CurrentUser); }
            catch (SqlException ex) when (ex.Number == 547)   // CHECK constraint
            {
                return BadRequest(new { message = "The rule is incomplete: " + ex.Message });
            }
            catch (SqlException ex) when (ex.Number >= 50400 && ex.Number < 50500)
            {
                return BadRequest(new { message = ex.Message });
            }
            return Ok(new { authorizationId = id });
        }

        [HttpPost("{accountNumber:regex(^\\d{{1,6}}$)}/grants")]
        public IActionResult Grant(string accountNumber, [FromBody] GrantRequest request) =>
            Run(() => _db.MemberAuthorization_Grant(accountNumber, request, CurrentUser),
                () => Ok(_db.Member_Get(accountNumber, _sqlIsMaster)));

        [HttpDelete("grants/{memberAuthorizationId:int}")]
        public IActionResult Revoke(int memberAuthorizationId) =>
            Run(() => _db.MemberAuthorization_Revoke(memberAuthorizationId, CurrentUser), () => NoContent());

        // ------------------------------------------------------------ brand actions (Access tab)

        [HttpGet("brands")]
        public ActionResult<List<BrandOption>> Brands() => _db.Brand_List();

        /// <summary>Lift every block on one brand: grants the rules that block it (reason kept), removes hand-set blocks.</summary>
        [HttpPost("{accountNumber:regex(^\\d{{1,6}}$)}/brands/{brandId:int}/allow")]
        public IActionResult AllowBrand(string accountNumber, int brandId, [FromBody] BrandAllowRequest request) =>
            Run(() => _db.MemberBrand_Allow(accountNumber, brandId, request?.Reason, CurrentUser),
                () => Ok(_db.Member_Get(accountNumber, _sqlIsMaster)));

        /// <summary>Hand-set block on one brand, same as ticking it on Brand Gating. The reason goes to the access log.</summary>
        [HttpPost("{accountNumber:regex(^\\d{{1,6}}$)}/brands/{brandId:int}/block")]
        public IActionResult BlockBrand(string accountNumber, int brandId, [FromBody] BrandAllowRequest request) =>
            Run(() => _db.MemberBrand_Block(accountNumber, brandId, request?.Reason, CurrentUser),
                () => Ok(_db.Member_Get(accountNumber, _sqlIsMaster)));

        // ------------------------------------------------------------ documents

        [HttpPost("{accountNumber:regex(^\\d{{1,6}}$)}/documents")]
        [RequestSizeLimit(MaxUploadBytes)]
        public async Task<IActionResult> Upload(string accountNumber, [FromForm] IFormFile file,
                                                [FromForm] string documentType, [FromForm] string title,
                                                [FromForm] DateTime? expiresOn)
        {
            if (string.IsNullOrEmpty(_bucket)) return StatusCode(500, new { message = "MemberDocuments:Bucket is not configured." });
            if (file == null || file.Length == 0) return BadRequest(new { message = "Choose a file." });
            if (file.Length > MaxUploadBytes) return BadRequest(new { message = "Files are limited to 25 MB." });
            if (!DocumentTypes.Contains(documentType ?? "")) return BadRequest(new { message = "Choose a document type." });

            var safeName = Regex.Replace(Path.GetFileName(file.FileName), @"[^\w.\-]+", "_");
            var key = $"member-documents/{accountNumber}/{Guid.NewGuid():N}-{safeName}";

            await using (var stream = file.OpenReadStream())
            {
                await _s3.PutObjectAsync(new global::Amazon.S3.Model.PutObjectRequest
                {
                    BucketName = _bucket,
                    Key = key,
                    InputStream = stream,
                    ContentType = file.ContentType,
                    ServerSideEncryptionMethod = ServerSideEncryptionMethod.AES256
                });
            }

            try
            {
                var id = _db.MemberDocument_Add(accountNumber, documentType, title, file.FileName, key,
                                                file.ContentType, file.Length, expiresOn, CurrentUser);
                return Ok(new { documentId = id });
            }
            catch (SqlException ex) when (ex.Number >= 50400 && ex.Number < 50500)
            {
                await _s3.DeleteObjectAsync(_bucket, key);   // no orphan files
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>Short-lived link; the bucket stays private.</summary>
        [HttpGet("documents/{documentId:int}/url")]
        public IActionResult DocumentUrl(int documentId)
        {
            var doc = _db.MemberDocument_Get(documentId);
            if (doc == null) return NotFound();

            var url = _s3.GetPreSignedURL(new global::Amazon.S3.Model.GetPreSignedUrlRequest
            {
                BucketName = _bucket,
                Key = doc.StorageKey,
                Expires = DateTime.UtcNow.AddMinutes(10),
                ResponseHeaderOverrides = { ContentDisposition = $"inline; filename=\"{doc.FileName.Replace("\"", "")}\"" }
            });
            return Ok(new { url });
        }

        [HttpPut("documents/{documentId:int}/review")]
        public IActionResult Review(int documentId, [FromBody] DocumentReviewRequest request) =>
            Run(() => _db.MemberDocument_Review(documentId, request, CurrentUser), () => NoContent());

        [HttpDelete("documents/{documentId:int}")]
        public IActionResult DeleteDocument(int documentId) =>
            Run(() => _db.MemberDocument_Delete(documentId, CurrentUser), () => NoContent());   // soft delete; file kept

        // ------------------------------------------------------------ MAP violations

        [HttpPost("{accountNumber:regex(^\\d{{1,6}}$)}/map-violations")]
        public IActionResult AddViolation(string accountNumber, [FromBody] MapViolationRequest request) =>
            Run(() => _db.MapViolation_Add(accountNumber, request, CurrentUser),
                () => Ok(_db.Member_Get(accountNumber, _sqlIsMaster)));

        [HttpPut("map-violations/{violationId:int}/end")]
        public IActionResult EndViolation(int violationId, [FromBody] MapViolationEndRequest request) =>
            Run(() => _db.MapViolation_End(violationId, request, CurrentUser), () => NoContent());
    }
}
