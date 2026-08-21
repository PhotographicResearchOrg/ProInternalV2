using Azure.Core;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using ProInternal.Models.Accounting;
using ProInternal.Models.Dashboard;
using ProInternal.Models.Exclusions;
using ProInternal.Models.Products;
using ProInternal.Models.Vendor;
using ProInternal.Services;
using System.ComponentModel.Design;
using System.Data;
using System.Net;
using System.Net.Mail;
using System.Numerics;
using static System.Runtime.InteropServices.JavaScript.JSType;


namespace ProInternal.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
 
    public class VendorController : ControllerBase
    {
        private IProDataAccess _prodataAccess;
        private IDRADataAccess _dradataAccess;
        private INukeDataAccess _nukedataAccess;
        private IEDADataAccess _edadataAccess;

        public VendorController(IProDataAccess proDataAccess, IDRADataAccess DRADataAccess, INukeDataAccess nukedataAccess, IEDADataAccess edadataAccess)
        {
            _prodataAccess = proDataAccess;
            _dradataAccess = DRADataAccess;
            _nukedataAccess = nukedataAccess;
            _edadataAccess = edadataAccess;
        }



        [HttpPost("sellthrough/export-email")]
        public async Task<IActionResult>
ExportSellThroughEmail(
    [FromBody]
    SellThroughExportEmailRequest request,
    [FromServices]
    IConfiguration config)
        {
            var msg = new MailMessage
            {
                From = new MailAddress(
                    "noreply@promaster.com",
                    "PRO Sell Through"
                ),
                Subject = "Sony Sell Through Export",
                Body = BuildExportEmail(request),
                IsBodyHtml = true
            };

            foreach (
                var email in
                request.EmailTo.Split(';', ',')
            )
            {
                if (!string.IsNullOrWhiteSpace(email))
                {
                    msg.To.Add(email.Trim());
                }
            }

            var bytes =
                Convert.FromBase64String(
                    request.Base64File
                );

            var stream =
                new MemoryStream(bytes);

            msg.Attachments.Add(
                new Attachment(
                    stream,
                    request.FileName,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )
            );

            var smtpHost =
                config.GetValue<string>(
                    "Email:SmtpHost"
                );

            var smtpPort =
                config.GetValue<int>(
                    "Email:SmtpPort"
                );

            var useSsl =
                config.GetValue<bool>(
                    "Email:UseSsl"
                );

            using var smtp =
                new SmtpClient(
                    smtpHost,
                    smtpPort
                )
                {
                    EnableSsl = useSsl,

                    Credentials =
                        new NetworkCredential(
                            config["Email:GmailUser"],
                            config["Email:GmailAppPassword"]
                        )
                };

            await smtp.SendMailAsync(msg);

            return Ok(
                new
                {
                    success = true
                }
            );
        }

        private string BuildExportEmail(
         SellThroughExportEmailRequest request)
        {
            var weekRows =
                string.Join(
                    "",
                    request.Weeks
                        .OrderBy(x => DateTime.Parse(x))
                        .Select(
                            x => $@"
<tr>
    <td style='padding:4px 8px;
               border:1px solid #d1d5db;
               font-size:12px;'>
        {x}
    </td>
</tr>"
                        )
                );

            var dealerRows =
                string.Join(
                    "",
                    (request.MissingDealers ?? new List<SellThroughMissingDealerDto>())
                        .OrderBy(x => x.MemberName)
                        .Select(
                            x => $@"
<tr>

    <td style='padding:4px 8px;
               border:1px solid #d1d5db;
               font-size:12px;
               white-space:nowrap;'>
        {x.Account}
    </td>

    <td style='padding:4px 8px;
               border:1px solid #d1d5db;
               font-size:12px;'>
        {x.MemberName}
    </td>

    <td style='padding:4px 8px;
               border:1px solid #d1d5db;
               font-size:12px;
               white-space:nowrap;'>
        {x.MissingWeeks}
    </td>

</tr>"
                        )
                );

            return $@"

<div style='font-family:Segoe UI,Arial,sans-serif;
            font-size:13px;
            line-height:1.3;
            color:#1f2937;
            max-width:1000px;'>

    <div style='padding-bottom:8px;
                margin-bottom:16px;
                border-bottom:2px solid #e5e7eb;'>

        <div style='font-size:18px;
                    font-weight:600;'>

            Sony Sell Through Export

        </div>

    </div>

    <div style='margin-bottom:14px;'>

        Attached is the requested Sony Sell Through export file.

    </div>

    <div style='font-size:14px;
                font-weight:600;
                margin-bottom:6px;'>

        Reporting Period

    </div>

    <table style='border-collapse:collapse;
                  margin-bottom:18px;
                  display:inline-table;'>

        {weekRows}

    </table>

    <div style='font-size:14px;
                font-weight:600;
                margin-bottom:6px;'>

        Compliance Exceptions

    </div>

    <table style='border-collapse:collapse;
                  width:100%;
                  margin-bottom:18px;'>

        <tr style='background:#f3f4f6;'>

            <th style='padding:5px 8px;
                       border:1px solid #d1d5db;
                       font-size:12px;
                       text-align:left;'>
                Account
            </th>

            <th style='padding:5px 8px;
                       border:1px solid #d1d5db;
                       font-size:12px;
                       text-align:left;'>
                Dealer
            </th>

            <th style='padding:5px 8px;
                       border:1px solid #d1d5db;
                       font-size:12px;
                       text-align:left;'>
                Missing Week
            </th>

        </tr>

        {dealerRows}

    </table>

    <div style='font-size:14px;
                font-weight:600;
                margin-bottom:6px;'>

        Notes

    </div>

    <div style='padding:8px;
                background:#f8fafc;
                border:1px solid #dbe3ea;
                font-size:12px;'>

        {WebUtility.HtmlEncode(request.Comments ?? "")}

    </div>

</div>";
        }

        [HttpPost("sellthrough/export")]
        public IActionResult ExportSellThrough(
    [FromBody]
    SellThroughExportRequest request)
        {
            var data =
                _prodataAccess
                    .GetSellThroughExportData(
                        request.Weeks,
                        request.Accounts
                    );

            return Ok(data);
        }


        private string BuildSellThroughExportEmail(
    string comments)
        {
            return $@"
<div style='font-family:Segoe UI,Arial,sans-serif;
            max-width:800px;'>

    <h2>
        Sony Sell Through Export
    </h2>

    <p>
        Attached is the requested Sony
        Sell Through export file.
    </p>

    <div style='background:#f9fafb;
                border-left:4px solid #2563eb;
                padding:12px;
                margin-top:20px;'>

        <strong>Notes</strong>

        <div style='margin-top:8px'>
            {comments}
        </div>

    </div>

</div>";
        }


        [HttpGet("sellthrough/request-history/{account}")]
        public IActionResult GetSellThroughRequestHistory(
    int account)
        {
            return Ok(
                _prodataAccess.GetSellThroughRequestHistory(account)
            );
        }



        [HttpGet("sellthrough/history/{account}")]
        public IActionResult GetSellThroughSubmissionHistory(int account)
        {
            return Ok(
                this._prodataAccess.GetSellThroughSubmissionHistory(account)
            );
        }


        [HttpPost("sellthrough/request")]
        public async Task<IActionResult> SendSellThroughRequest(
        [FromBody] SellThroughRequestEmailRequest request,
        [FromServices] IConfiguration config)
        {
            if (string.IsNullOrWhiteSpace(request.ContactEmail))
                return BadRequest("Contact email missing.");

            var body = $@"
                <div style='font-family:Segoe UI,Arial,sans-serif;
                            color:#111827;
                            max-width:700px;'>

                    <h2>Sell Through File Request</h2>

                    <p>
                        Hello,
                    </p>

                    <p>
                        Our records indicate that we have not received your SONY sell through
                        submission for the reporting period below.
                    </p>

                    <table style='border-collapse:collapse;margin-top:15px;'>

                        <tr>
                            <td style='padding:8px;font-weight:bold'>
                                Dealer
                            </td>
                            <td style='padding:8px'>
                                {request.DealerName}
                            </td>
                        </tr>

                        <tr>
                            <td style='padding:8px;font-weight:bold'>
                                Week Ending
                            </td>
                            <td style='padding:8px'>
                                {request.WeekEnding}
                            </td>
                        </tr>

                    </table>

                    <p style='margin-top:20px;'>
                        Please submit the required SONY sell through file
                        at your earliest convenience.
                    </p>

                    <p>
                        Thank you.
                    </p>

                </div>";

            var msg = new MailMessage
            {
                From = new MailAddress(
                    "noreply@promaster.com",
                    "PRO Sell Through"
                ),
                Subject = $"SONY Sell Through File Request - {request.WeekEnding}",
                Body = body,
                IsBodyHtml = true
            };

            msg.To.Add(request.ContactEmail);

            var smtpHost = config.GetValue<string>("Email:SmtpHost");
            var smtpPort = config.GetValue<int>("Email:SmtpPort");
            var useSsl = config.GetValue<bool>("Email:UseSsl");

            using var smtp = new SmtpClient(smtpHost, smtpPort)
            {
                EnableSsl = useSsl,
                Credentials = new NetworkCredential(
                    config["Email:GmailUser"],
                    config["Email:GmailAppPassword"]
                )
            };

            await smtp.SendMailAsync(msg);

            _prodataAccess.InsertSellThroughRequestAudit(
                1,
                request.Account,
                Convert.ToDateTime(request.WeekEnding),
                request.ContactEmail,
                request.RequestedBy
            );

            return Ok(new { success = true });
        }





        [Consumes("multipart/form-data")]
        [HttpPost("sellthrough/send")]
            public async Task<IActionResult> SendSellThroughFile(
        List<IFormFile> files,
        [FromForm] int account,
        [FromForm] string username,
        [FromForm] string dealerName,
        [FromForm] string brmName,
        [FromForm] string brmEmail,
        [FromForm] string weeks,
        [FromForm] string comments,
        [FromServices] IConfiguration config)
        {
            if (files == null || files.Count == 0)
                return BadRequest("File missing.");

            if (string.IsNullOrWhiteSpace(brmEmail))
                return BadRequest("BRM email missing.");

            var body = BuildSellThroughEmail(
                dealerName,
                brmName,
                weeks,
                comments
            );

            var msg = new MailMessage
            {
                From = new MailAddress(
                    "noreply@promaster.com",
                    "PRO Sell Through"
                ),
                Subject = $"Sell Through Submission - {dealerName}",
                Body = body,
                IsBodyHtml = true
            };

            msg.To.Add(brmEmail);

            foreach (var file in files)
            {
                msg.Attachments.Add(
                    new Attachment(
                        file.OpenReadStream(),
                        file.FileName,
                        file.ContentType
                    )
                );
            }

            var smtpHost = config.GetValue<string>("Email:SmtpHost");
            var smtpPort = config.GetValue<int>("Email:SmtpPort");
            var useSsl = config.GetValue<bool>("Email:UseSsl");

            using var smtp = new SmtpClient(smtpHost, smtpPort)
            {
                EnableSsl = useSsl,
                Credentials = new NetworkCredential(
                    config["Email:GmailUser"],
                    config["Email:GmailAppPassword"]
                )
            };

            await smtp.SendMailAsync(msg);

            foreach (var week in weeks.Split(','))
            {
                if (DateTime.TryParse(
                    week.Trim(),
                    out var weekEnding))
                {
                    _prodataAccess.InsertSellThroughSubmissionAudit(
                        1,                  // Sony
                        account,
                        weekEnding,
                        string.Join( ", ", files.Select(x => x.FileName)),
                        brmEmail,
                        username,
                        comments
                    );
                }
            }


            return Ok(new { success = true });
        }

        private string BuildSellThroughEmail(
    string dealerName,
    string brmName,
    string weeks,
    string comments)
        {
            return $@"

<div style='font-family:Segoe UI,Arial,sans-serif;
            max-width:800px;
            color:#111827;'>

<div style='padding-bottom:12px;
            border-bottom:1px solid #e5e7eb;
            margin-bottom:20px;'>

<h2 style='margin:0;
           color:#111827;
           font-size:20px;
           font-weight:600;'>

        Sell Through Submission Request

    </h2>

</div>
    <div style='border:1px solid #e5e7eb;
                border-top:none;
                padding:24px;'>

        <p>
            Hello {brmName},
        </p>

        <p>
            A sell through file has been submitted and requires processing.
        </p>

        <table style='border-collapse:collapse;
                       width:100%;
                       margin-top:20px;
                       margin-bottom:20px;'>

            <tr>
                <td style='font-weight:bold;padding:8px;width:180px'>
                    Dealer
                </td>
                <td style='padding:8px'>
                    {dealerName}
                </td>
            </tr>

            <tr>
                <td style='font-weight:bold;padding:8px'>
                    Missing Week(s)
                </td>
                <td style='padding:8px'>
                    {weeks}
                </td>
            </tr>

        </table>

<div style='background:#f8fafc;
            border:1px solid #e5e7eb;
            border-radius:6px;
            padding:12px;
            margin-top:15px;'>

            <strong>Comments</strong>

            <div style='margin-top:8px'>
                {WebUtility.HtmlEncode(comments)}
            </div>

        </div>

        <p style='margin-top:24px'>
            The sell through file is attached to this email.
        </p>

        <p>
            Please review and enter the applicable reporting data.
        </p>

    </div>

</div>";
        }


        [HttpGet("sellthrough")]
        public IActionResult GetSellThroughCompliance()
        {
            return Ok(this._prodataAccess.GetSellThroughCompliance());
        }


        [HttpGet("panareps")]
        public IActionResult GetAllReps()
        {
            var reps = this._edadataAccess.GetAllPanaReps();
            return Ok(reps);
     
        }


        [HttpGet("panaaccounts")]
        public IActionResult GetAllAccounts()
        {
            var accounts = this._edadataAccess.GetAllPanaAccounts();
            return Ok(accounts);
        }



        [HttpPost("savepanarep")]
        public async Task<ActionResult<PanaRep>> SaveRep([FromBody] PanaRep rep)
        {
            var saved = await this._edadataAccess.SavePanaRep(rep);
            return Ok(saved);
        }

        [HttpPost("savepanaaccount")]
        public async Task<ActionResult<PanaAccount>> SaveAccount([FromBody] PanaAccount account)
        {
            var saved = await this._edadataAccess.SavePanaAccount(account);
            return Ok(saved);
        }




        [HttpDelete("deletepanarep/{id}")]
        public async Task<IActionResult> DeleteRep(int id)
        {
            var success = await _edadataAccess.DeletePanaRep(id);
            return success ? Ok() : StatusCode(500, "Failed to delete rep.");
        }


        [HttpDelete("deletepanaaccount/{meca}")]
        public async Task<IActionResult> DeleteAccount(string meca)
        {
            var success = await _edadataAccess.DeletePanaAccount(meca);
            return success ? Ok() : StatusCode(500, "Failed to delete account.");
        }




        [HttpGet("vendorstock")]
        public List<VendorStock> GetVendorStock()
        {
            List<VendorStock> reuslt = this._prodataAccess.GetVendorStock().ToList();
            return reuslt;
        }


        [HttpGet("getAllVendors")]
        public IActionResult getAllVendors()
        {
            List<VendorSearch> results = this._prodataAccess.getAllVendors(); // Your service logic here
            return Ok(results); // Should return List<{ id, name }>
        }


        [HttpPost("saveVendorUser")]
        public async Task<IActionResult> saveVendorUser([FromBody] VendorUser vendorUser)
        {
            if (vendorUser == null)
            {
                return BadRequest("Invalid data.");
            }

            // Ensure that the 'company' is not null and has a valid ID
            if (vendorUser.CompanyId > 0 )
            {
                var data =  this._prodataAccess.saveVendorUser(vendorUser);
                // Return the result with the UserId
                return Ok(new { Status = data.Status, UserId = data.UserId });
          
            }
            else
            {
                return BadRequest("Invalid company data.");
            }
        }


    }
}
