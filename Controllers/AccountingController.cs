using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Playwright;
using Microsoft.VisualBasic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using PdfSharp.Snippets.Drawing;
using ProInternal.Models.Accounting;
using ProInternal.Models.Accounts;
using ProInternal.Models.Auth;
using ProInternal.Models.Dashboard;
using ProInternal.Models.EzPaySummary;
using ProInternal.Models.InvoiceRecord;
using ProInternal.Models.Outstanding;
using ProInternal.Models.Patronage;
using ProInternal.Models.SendInvoicesRequest;
using ProInternal.Services;
using Spire.Pdf;
using Spire.Xls;
using System.Data;
using System.Drawing;
using System.Net;
using System.Net.Mail;
using System.Text;
using System.Text.RegularExpressions;


namespace ProInternal.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    //[Route("[controller]")]
    public class AccountingController : ControllerBase
    {
        private IProDataAccess _proDataAccess;
        private IDRADataAccess _dradataAccess;
        private IEDADataAccess _edadataAccess;
      

        public AccountingController(IProDataAccess proDataAccess, IDRADataAccess DRADataAccess, IEDADataAccess edadataAccess) 
        {
            _proDataAccess = proDataAccess;
            _dradataAccess = DRADataAccess;
            _edadataAccess = edadataAccess;

        }

        private readonly string _uploadRoot =
    @"\\10.0.1.161\e\Accounting\VendorInvoices\uploads";

        public static string GetMimeType(string filePath)
            {
                var ext = Path.GetExtension(filePath).ToLowerInvariant();

                return ext switch
                {
                    ".pdf" => "application/pdf",
                    ".png" => "image/png",
                    ".jpg" => "image/jpeg",
                    ".jpeg" => "image/jpeg",
                    ".gif" => "image/gif",
                    ".xls" => "application/vnd.ms-excel",
                    ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    _ => "application/octet-stream"
                };
            }
      



        [HttpGet("files/preview/{fileId}")]
        public IActionResult Preview(string fileId)
        {
            var file = _proDataAccess.GetAccountingFile(fileId);
            if (file == null) return NotFound();

            var path = Path.Combine(
                @"\\10.0.1.161\e\Accounting\VendorInvoices\uploads",
                file.StoredName
            );

            return PhysicalFile(
                path,
                GetMimeType(path),
                enableRangeProcessing: true
            );
        }



        [HttpGet("invoice/preview/{invoiceNumber}")]
        public IActionResult PreviewInvoice(string invoiceNumber)
        {
            var path = Path.Combine(
                @"\\10.0.1.161\webserver_e",
                $"{invoiceNumber}"
            );

            if (!System.IO.File.Exists(path))
                return NotFound();

            return PhysicalFile(
                path,
                "application/pdf",
                enableRangeProcessing: true
            );
        }






        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadFiles([FromForm] List<IFormFile> files)
        {
            if (files == null || files.Count == 0)
                return BadRequest("No files uploaded.");

            var results = new List<object>();

            foreach (var file in files)
            {
                // 🔒 PDF-ONLY GUARD (must be first)
                if (!file.ContentType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase) &&
                    !file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest("Only PDF files are allowed.");
                }

                // 1️⃣ Compute hash
                string hash;
                using (var read = file.OpenReadStream())
                {
                    hash = Convert.ToHexString(
                        System.Security.Cryptography.SHA256.HashData(read)
                    ).ToLowerInvariant();
                }

                // 2️⃣ Stored filename
                var storedName = $"{hash}.pdf";
                var fullPath = Path.Combine(_uploadRoot, storedName);

                // 3️⃣ Write file + DB record once
                if (!System.IO.File.Exists(fullPath))
                {
                    using var write = new FileStream(fullPath, FileMode.CreateNew);
                    await file.CopyToAsync(write);

                    _proDataAccess.UpsertAccountingFile(
                        hash,
                        storedName,
                        file.FileName
                    );
                }

                // 4️⃣ Return metadata
                results.Add(new
                {
                    fileId = hash,
                    originalName = file.FileName
                });
            }

            return Ok(results);
        }




        [HttpPost("credits")]
        public async Task<IActionResult> SaveCredits([FromBody] CreditBatchRequestDto request)
        {
            if (request?.OrderDetails == null || !request.OrderDetails.Any())
                return BadRequest("No credits supplied.");

            int duplicateCount = 0;

            // ✅ CREATE BATCH GUID ONCE
            var batchGuid = Guid.NewGuid();

            foreach (var credit in request.OrderDetails)
            {

                credit.BatchGuid = batchGuid;
                // 1️⃣ Insert credit (SQL)
                int creditId;

                try
                {
                    creditId = _proDataAccess.InsertAccountingCredit(credit);
                }
                catch (SqlException ex) when (ex.Number == 2601 || ex.Number == 2627)
                {
                    duplicateCount++;
                    continue;
                }



                foreach (var fileId in credit.FileIds)
                    {
                        _proDataAccess.LinkFileToCredit(
                            creditId,
                            credit.BatchGuid,
                            fileId
                        );
                    }

                    // 2️⃣ Post to legacy API
                    var apiResult = await PostCreditToApi(creditId, credit);

                if (!apiResult.Success)
                {
                    _proDataAccess.MarkCreditFailed(creditId, apiResult.Error);
                    continue; // batch-safe
                }

                // 3️⃣ Build invoice PDF (cover + attachments)
                try
                {
                    // 3️⃣ Build invoice PDF (cover + attachments)
                    await ProcessInvoiceFiles(
                        apiResult.InvoiceNumber,
                        credit.BatchGuid,
                        creditId,
                        credit
                    );

                    // ✅ Full success
                    _proDataAccess.MarkCreditSuccess(creditId, apiResult.InvoiceNumber);
                }
                catch (Exception ex)
                {
                    // ⚠️ Credit posted, invoice failed
                    _proDataAccess.MarkCreditInvoiceFailed(
                        creditId,
                        apiResult.InvoiceNumber,
                        ex.Message
                    );
                }



            }

            return Ok(new
            {
                success = true,
                duplicatesSkipped = duplicateCount
            });
        }





        [HttpPost("vendor-billing")]
        public async Task<IActionResult> SaveVendorBilling([FromBody] VendorBillingRequestDto request)
        {
            if (request == null)
                return BadRequest("Invalid payload.");

            try
            {
                var billingId = _proDataAccess.InsertVendorBilling(request);

                var apiResult = await PostVendorBillingToApi(billingId, request);

                if (!apiResult.Success)
                {
                    _proDataAccess.MarkVendorBillingFailed(billingId, apiResult.Error);
                    return BadRequest(apiResult.Error);
                }








                _proDataAccess.MarkVendorBillingSuccess(billingId, apiResult.InvoiceNumber);

                return Ok(new { invoice = apiResult.InvoiceNumber });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    error = "Vendor billing failed",
                    details = ex.Message
                });
            }
        }

   


        private async Task<(bool Success, string InvoiceNumber, string Error)> PostCreditToApi(int creditId, CreditRequestDto request)
        {
            try
            {


                string vendInv;

                if (!string.IsNullOrWhiteSpace(request.VendorInvoice))
                {
                    vendInv = request.EZPay
                        ? $"NMC{request.VendorInvoice}"
                        : request.VendorInvoice;
                }
                else
                {
                    vendInv = request.EZPay
                        ? "NMCNoINV"
                        : "";
                }

                var payload = new Dictionary<string, string>
                {
                    ["apiid"] = creditId.ToString(),
                    ["member"] = request.Account?? request.ProID.Substring(0, 4),
                    ["vendor"] = request.PostingAccount ?? "1320",
                    ["quan"] = "0",
                    ["po"] = string.IsNullOrWhiteSpace(request.PO) ? "N/A": request.PO,
                    ["amount"] = request.Amount.ToString("0.00"),
                    ["vendinv"] = vendInv
                };






                using var client = new HttpClient();
                //var response = await client.PostAsJsonAsync(
                //    "http://10.0.1.216:9191/AWS_PRO/subroutine/*pro*API.POST.CREDIT",
                //    payload);


                var response = await client.PostAsJsonAsync("http://10.0.1.216:9191/PRO_DEMO/subroutine/*pro.demo*API.POST.CREDIT",  payload);
                                                        

                // 🚨 ONLY transport failure here
                if (!response.IsSuccessStatusCode)
                    return (false, null, $"HTTP {response.StatusCode}");

                var result = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();

                string? invoice = null;
                string? error = null;

                foreach (var kvp in result)
                {
                    if (kvp.Key.Equals("Invoice", StringComparison.OrdinalIgnoreCase))
                        invoice = kvp.Value;

                    if (kvp.Key.Equals("error", StringComparison.OrdinalIgnoreCase)
                        && !string.IsNullOrWhiteSpace(kvp.Value))
                        error = kvp.Value;
                }

                // ✅ Success = invoice exists
                if (!string.IsNullOrEmpty(invoice))
                    return (true, invoice, null);

                // ❌ Business failure
                if (!string.IsNullOrEmpty(error))
                    return (false, null, error);

                // ⚠ Edge case
                return (false, null, "Unknown API response");
            }
            catch (Exception ex)
            {
                return (false, null, ex.Message);
            }
        }




        private async Task ProcessInvoiceFiles(string invoiceNumber,Guid batchGuid,int creditId,CreditRequestDto credit)
        {
            try
            {
                // -----------------------------
                // Paths
                // -----------------------------
                var batchRoot = Path.Combine(
                    @"\\10.0.1.161\e\Accounting\VendorInvoices\batches",
                    batchGuid.ToString()
                );

                Directory.CreateDirectory(batchRoot);

                // 🔍 PROOF FILE (do not remove yet)
                System.IO.File.WriteAllText(
                    Path.Combine(batchRoot, "step1_reached.txt"),
                    DateTime.Now.ToString("O")
                );

                var coverPath = Path.Combine(batchRoot, $"{invoiceNumber}_cover.pdf");
                var finalPath = Path.Combine(batchRoot, $"{invoiceNumber}.pdf");

                // -----------------------------
                // BUILD HTML
                // -----------------------------
                var html = BuildInvoiceHtml(credit, invoiceNumber);

                System.IO.File.WriteAllText(
                    Path.Combine(batchRoot, "step2_html_built.txt"),
                    "HTML OK"
                );

                    var localCoverPath = Path.Combine(
                    batchRoot,
                    $"{invoiceNumber}_cover.tmp.pdf"
                    );

                // -----------------------------
                // PDF GENERATION (🔥 MOST LIKELY FAILURE)
                // -----------------------------
                await GenerateCoverPdfFromHtml(html, localCoverPath);

                System.IO.File.Move(localCoverPath,coverPath,overwrite: true);

                System.IO.File.WriteAllText(
                    Path.Combine(batchRoot, "step3_pdf_created.txt"),
                    "PDF OK"
                );

                // -----------------------------
                // MERGE
                // -----------------------------
                var finalDoc = new PdfDocument();

                var coverDoc = new PdfDocument();
                coverDoc.LoadFromFile(coverPath);
                finalDoc.AppendPage(coverDoc);

                var files = _proDataAccess.GetFilesForCredit(creditId);

                foreach (var file in files)
                {
                    var sourcePath = Path.Combine(_uploadRoot, file.StoredName);
                    if (!System.IO.File.Exists(sourcePath)) continue;

                    var attachDoc = new PdfDocument();
                    attachDoc.LoadFromFile(sourcePath);
                    finalDoc.AppendPage(attachDoc);
                }

                finalDoc.SaveToFile(finalPath);
                finalDoc.Close();

                // -----------------------------
                // COPY TO WEB SERVER
                // -----------------------------
                var webServerFinalPath = Path.Combine(
                    @"\\10.0.1.161\webserver_e",
                    $"{invoiceNumber}.pdf"
                );

                System.IO.File.Copy(finalPath, webServerFinalPath, overwrite: true);
            }
            catch (Exception ex)
            {
                var failRoot = Path.Combine(
                    @"\\10.0.1.161\e\Accounting\VendorInvoices\batches",
                    batchGuid.ToString()
                );

                Directory.CreateDirectory(failRoot);

                System.IO.File.WriteAllText(
                    Path.Combine(failRoot, "ERROR.txt"),
                    ex.ToString()
                );
                throw;
            }
        }






        private string InlineCss(string html)
        {
            var cssPath = @"\\10.0.1.161\e\Accounting\VendorInvoices\Template\CSS\STYLE_CS.CSS";
            var css = System.IO.File.ReadAllText(cssPath);

            return html.Replace(
                "</head>",
                $"<style>{css}</style></head>"
            );
        }

        private string InlineLogo(string html)
        {
            var imgPath = @"\\10.0.1.161\e\Accounting\VendorInvoices\Template\images\PRO.png";
            var bytes = System.IO.File.ReadAllBytes(imgPath);

            var base64 = Convert.ToBase64String(bytes);

            return Regex.Replace(
                html,
                "<img[^>]+src=[\"'].*?PRO\\.png[\"'][^>]*>",
                $"<img src=\"data:image/png;base64,{base64}\" alt=\"PRO Logo\" />",
                RegexOptions.IgnoreCase
            );
        }








        private string BuildInvoiceHtml(
           CreditRequestDto credit,
           string invoiceNumber
       )
        {
            var templatePath = @"\\10.0.1.161\e\Accounting\VendorInvoices\Template\PRO_INVOICE.html";
            var html = System.IO.File.ReadAllText(templatePath);

            // 1️⃣ Remove external CSS link (must be first)
            html = html.Replace(
                "<link rel=\"stylesheet\" type=\"text/css\" href=\"CSS/STYLE.CSS\">",
                string.Empty
            );

            // 2️⃣ Core token replacements
            html = html
                .Replace("<!ACCOUNT>", credit.Account)
                .Replace("<!DATE>", DateTime.Now.ToString("MM/dd/yyyy"))
                .Replace("<!INVOICE>", invoiceNumber)
                .Replace("<!VINVOICE>", invoiceNumber) // IMPORTANT
                .Replace("<!TERMS>", "NET 30")
                .Replace("<!PONUMBER>", credit.PO ?? "N/A")
                .Replace("<!VENDOR>", credit.PostingAccount ?? "1320");



            var member = _proDataAccess.GetMemberByAccount(credit.Account);

            var billToHtml = member != null
                ? BuildBillToHtml(member)
                : "<p class='bold'>UNKNOWN ACCOUNT</p>";

            html = html.Replace("<!BILLTO>", billToHtml);




            // 4️⃣ Line items (tbody-safe)
            html = html.Replace("<!DETAIL>", $@"
            <tr>
                <td>1</td>
                <td>1320</td>
                <td>Rebates, Credits &amp; Misc</td>
                <td>{credit.Amount:0.00}</td>
                <td>{credit.Amount:0.00}</td>
            </tr>
            ");

            // 5️⃣ TOTAL DUE — STRUCTURED (prevents floating text)
            html = html.Replace("<!TOTALDUE>", $"{credit.Amount:0.00}");

            // 6️⃣ Inline assets (ORDER IS CRITICAL)
            html = InlineCss(html);   // FIRST
            html = InlineLogo(html);  // SECOND

            return html;
        }


        private string BuildBillToHtml(MemberDto member)
        {
            var sb = new StringBuilder();

            sb.AppendLine($"<p class='bold'>{WebUtility.HtmlEncode(member.Name)}</p>");

            if (!string.IsNullOrWhiteSpace(member.Address1))
                sb.AppendLine($"<p>{WebUtility.HtmlEncode(member.Address1)}</p>");

            if (!string.IsNullOrWhiteSpace(member.Address2))
                sb.AppendLine($"<p>{WebUtility.HtmlEncode(member.Address2)}</p>");

            sb.AppendLine(
                $"<p>{WebUtility.HtmlEncode(member.City)}, " +
                $"{WebUtility.HtmlEncode(member.State)} " +
                $"{WebUtility.HtmlEncode(member.Zip)}</p>"
            );

            return sb.ToString();
        }



        private async Task GenerateCoverPdfFromHtml(string html,string outputPdfPath)
        {
            using var playwright = await Playwright.CreateAsync();

            await using var browser = await playwright.Chromium.LaunchAsync(
                new BrowserTypeLaunchOptions
                {
                    Headless = true,
                   // ExecutablePath = @"C:\PlaywrightBrowsers\chrome-headless-shell.exe"
                });

            var page = await browser.NewPageAsync();

            await page.SetContentAsync(
                html,
                new PageSetContentOptions
                {
                    WaitUntil = WaitUntilState.NetworkIdle
                });

            await page.PdfAsync(
                new PagePdfOptions
                {
                    Path = outputPdfPath,
                    Format = "Letter",
                    PrintBackground = true
                });
        }




        private string ConvertExcelToPdf(string excelPath)
        {
            if (!System.IO.File.Exists(excelPath))
                throw new FileNotFoundException("Excel file not found", excelPath);

            var tempDir = Path.Combine(Path.GetTempPath(), "AccountingPdfTemp");
            Directory.CreateDirectory(tempDir);

            var pdfPath = Path.Combine(
                tempDir,
                Path.GetFileNameWithoutExtension(excelPath) + ".pdf"
            );

            var workbook = new Workbook();

            // Load Excel
            workbook.LoadFromFile(excelPath);

            // Optional but recommended
            foreach (Worksheet sheet in workbook.Worksheets)
            {
                sheet.PageSetup.FitToPagesWide = 1;
                sheet.PageSetup.FitToPagesTall = 1;
            }

            // Save as PDF
            workbook.SaveToFile(pdfPath, Spire.Xls.FileFormat.PDF);

            return pdfPath;
        }






        [HttpGet("credits")]
        public IActionResult GetCredits()
        {
            var data = _proDataAccess.GetCredits();
            return Ok(data);
        }


        [HttpGet("vendor-billing")]
        public IActionResult GetVendorBilling()
        {
            var data = _proDataAccess.GetVendorBilling();
            return Ok(data);
        }
        [HttpGet("search/member")]
        public IActionResult SearchMember([FromQuery] string term)
        {
            if (string.IsNullOrWhiteSpace(term) || term.Length < 2)
                return Ok(Enumerable.Empty<MemberLookupDto>());

            return Ok(_proDataAccess.SearchMember(term));
        }


        [HttpGet("search/vendor")]
        public IActionResult SearchVendor(
    [FromQuery] string term,
    [FromQuery] string type)
        {
            if (string.IsNullOrWhiteSpace(term))
                return Ok(Enumerable.Empty<VendorLookupDto>());

            return Ok(_proDataAccess.SearchVendor(term, type));
        }



        private async Task<(bool Success, string InvoiceNumber, string Error)>
    PostVendorBillingToApi(int billingId, VendorBillingRequestDto request)
        {
            try
            {
                var payload = new Dictionary<string, string>
                {
                    ["Vendor"] = request.VendorID.Substring(0, 4),
                    ["Member"] = request.ProID.Substring(0, 4),
                    ["BillDate"] = request.FutureBilling,
                    ["Terms"] = request.Terms,
                    ["FutureBilling"] = request.FutureBilling,
                    ["VendorInvoice"] = request.VendorInv,
                    ["VendorInvoiceDate"] = request.VendInvDate?.ToShortDateString(),
                    ["VendorDueDate"] = request.VendorDueDate?.ToShortDateString(),
                    ["Amount"] = request.Amount.ToString("0.00"),
                    ["DiscountPercent"] = request.Discount.ToString(),
                    ["PurchaseOrderNum"] = request.PO ?? "N/A",
                    ["SequenceNum"] = billingId.ToString()
                };

                //using var client = new HttpClient();
                //var response = await client.PostAsJsonAsync( "http://10.0.1.216:9191/AWS_PRO/subroutine/*pro*API.POST.CREDIT", payload
                //);

                using var client = new HttpClient();
                var response = await client.PostAsJsonAsync("http://10.0.1.216:9191/PRO_DEMO/subroutine/*pro.demo*API.POST.CREDIT", payload
                );

                if (!response.IsSuccessStatusCode)
                    return (false, null, "External API rejected vendor billing");

                var result = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();

                if (result.ContainsKey("error"))
                    return (false, null, result["error"]);

                var invoice = result.FirstOrDefault(x => x.Key.Contains("Invoice")).Value;

                return (true, invoice, null);
            }
            catch (Exception ex)
            {
                return (false, null, ex.Message);
            }
        }




        [HttpPost("InvoiceEmail")]
        public async Task<IActionResult> SendInvoiceEmail(
            [FromBody] InvoiceEmailRequest req,
            [FromServices] IConfiguration config)
        {
            if (string.IsNullOrWhiteSpace(req.To) ||
                string.IsNullOrWhiteSpace(req.InvoiceNumber))
                return BadRequest("Missing data.");

            var invoicePath = Path.Combine(
                @"\\10.0.1.161\webserver_e",
                $"{req.InvoiceNumber}.pdf"
            );

            if (!System.IO.File.Exists(invoicePath))
                return NotFound("Invoice PDF not found.");

            // -----------------------------
            // Build email body
            // -----------------------------
            var noteHtml = string.IsNullOrWhiteSpace(req.Note)
                ? ""
                : $@"
<div style=""border-left:4px solid #2563eb;
            padding-left:12px;
            margin-bottom:12px"">
  {WebUtility.HtmlEncode(req.Note)}
</div>";

            var body = $@"
<div style=""font:14px Segoe UI,Arial;color:#111827"">
  {noteHtml}
  <p>Please find the attached invoice.</p>
</div>";

            // -----------------------------
            // SMTP (Gmail)
            // -----------------------------
            var msg = new MailMessage
            {
                From = new MailAddress(
    "billing@yourdomain.com",   // 🔥 TEMP HARD CODE
    "Accounting"
),
                Subject = $"Invoice {req.InvoiceNumber}",
                Body = body,
                IsBodyHtml = true
            };

            // Support comma-separated emails
            foreach (var email in req.To.Split(',', StringSplitOptions.RemoveEmptyEntries))
                msg.To.Add(email.Trim());

            // Attach invoice PDF
            msg.Attachments.Add(
                new Attachment(invoicePath, "application/pdf")
            );




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

            return Ok(new { success = true });
        }







        [HttpGet("accounts")]
        public async Task<ActionResult<IEnumerable<OutstandingAccount>>> GetAccounts()
        {
            var accounts = await _proDataAccess.GetAccountsWithOutstanding();
            return Ok(accounts);
        }

        [HttpGet("accounts/{accountNumber}/invoices")]
        public async Task<ActionResult<IEnumerable<OutstandingInvoice>>> GetInvoices(string accountNumber)
        {
            var invoices = await _proDataAccess.GetInvoicesByAccount(accountNumber);
            return Ok(invoices);
        }


        [HttpPost("send-invoices")]
        public async Task<IActionResult> SendInvoices([FromBody] SendInvoicesRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.AccountNumber))
                return BadRequest("Account number is required.");

            if (string.IsNullOrWhiteSpace(request.Email))
                return BadRequest("Email address is required.");

            bool success = await _proDataAccess.SendInvoicesToMemberEmail(request.AccountNumber, request.Email);

            if (success)
                return Ok();
            else
                return StatusCode(500, "Failed to send invoices.");
        }




        [HttpPost("savePaymentType")]
        public IActionResult SavePaymentType([FromBody] PaymentType payment)
        {
            if (payment == null || string.IsNullOrWhiteSpace(payment.AccountNumber))
                return BadRequest("Invalid payment type data.");

            _proDataAccess.SavePaymentType(payment);
            return Ok();
        }



        [HttpGet("getPaymentTypes")]
        public IActionResult GetPaymentTypes()
        {
            var result = _proDataAccess.GetPaymentTypes();
            return Ok(result);
        }














        [HttpGet]
        [Route("ezpay-summary")]
        public async Task<ActionResult> GetEzPaySummary([FromQuery] DateTime date)
        {
            IEnumerable<EzPaySummary> summaryList = await _edadataAccess.GetEzPaySummary(date);

            return Ok(summaryList);
        }


        [HttpGet("ezpay-detail")]
        public async Task<IActionResult> GetEzPayDetail([FromQuery] DateTime date)
        {
            IEnumerable<EzPayDetail> detailList = await _edadataAccess.GetEzPayDetail(date);
            return Ok(detailList);
        }




        [HttpPost, DisableRequestSizeLimit]
        [Route("LoadQuarterFile")]
        public async Task<ActionResult> Result(IFormFile file)
        {
            QuarterlyRebates Loadeddata = await LoadQuarterlyData(file);

            if (Loadeddata != null)
            {
                this._proDataAccess.saveData(Loadeddata);
            }

            return Ok(new { success = true }); // ✅ ensures Angular receives a response
        }




        [HttpGet]
        [Route("forecast")]
        public IActionResult GetInvoices()
        {
            List<InvoiceRecord> result = this._proDataAccess.GetInvoices(); // Filter & map to DTO
            return Ok(result);
        }










        [HttpGet]
        [Route("GetPatronageHistorical")]
        public IActionResult GetPatronageHistorical()
        {
            List<PatronageHistorical> result = this._proDataAccess.GetPatronageHistorical();

            return Ok(result);
        }

        [HttpPut]
        [Route("ActivatePatronageBatch")]
        public bool ActivatePatronageBatch([FromBody] PatronageActivationRequest request)
        {
            return this._proDataAccess.activatePatronageBatch(request.BatchID, request.Active);
        }


        [HttpGet]
        [Route("getPatronageBatchDetails/{batchID}")]
        public ActionResult<List<PatronageUpload>> getPatronageBatchDetails(string batchID)
        {
            var details = this._proDataAccess.getPatronageBatchDetails(batchID);

            if (details == null || !details.Any())
            {
                return NotFound();
            }

            return Ok(details);
        }






        [HttpGet]
        [Route("GetRecentPatronageLoad")]
        public IActionResult GetRecentPatronageLoad()
        {
            List<PatronageUpload> result = this._proDataAccess.GetRecentPatronageLoad(); 
           
            return Ok(result);
        }



        [HttpPost, DisableRequestSizeLimit]
        [Route("LoadPatronageFile")]
        // public async Task<IEnumerable<SellThroughUploadError>> UploadSellThrough([FromForm] string date)
        public async Task<ActionResult> PatronageResult(IFormFile file)
        {





            List<PatronageUpload> Loadeddata = await LoadPatronageFile(file);
            if (Loadeddata == null)
            {
            
            }
            else
            {
       
                   this._proDataAccess.savePatronageData(Loadeddata);

            }

            return Ok(new { success = true, message = "Patronage file uploaded successfully." });

        }



        private async Task<List<PatronageUpload>> LoadPatronageFile(IFormFile file)
        {
            string requestBody = await new StreamReader(file.OpenReadStream()).ReadToEndAsync();
            var root = JsonConvert.DeserializeObject<dynamic>(requestBody.ToString());
            var patronageUploads = new List<PatronageUpload>();

            List<string> Term = new List<string>();

            DataTable dt = new DataTable();
            dt.Columns.Add("MemberNumber");
            dt.Columns.Add("Member");

            ////Get terms names
            foreach (var field in root[0])
                if (!string.IsNullOrEmpty(field.ToString()))
                {

                    //Do validation here. 
                    Term.Add(field.ToString());
                }



            // Assuming first row is header, start from row 1
            for (int i = 2; i < root.Count; i++)
            {
                var row = root[i];
                try
                {
                    PatronageUpload entry = new PatronageUpload
                    {
                        accountID = row.Count > 0 ? row[0]: 0,
                        totalValue = row.Count > 1 ? row[2] : 0,
                        perc = row.Count > 2 ? row[4] : 0,
                        shares = row.Count > 3 ? row[5] : 0,
                        balance = row.Count > 4 ? row[6] : 0,
                        profit = row.Count > 5 ? row[7] : 0,
                        dividend = row.Count > 6 ? row[8] : 0,
                        payment = row.Count > 7 ? row[10] : 0,
                        credit = row.Count > 8 ? row[11] : 0,
                        dateLoaded = DateTime.Now,
                        batchID = "", // You can set BatchID later
                        stockValue = row.Count > 9 ? row[3] : 0,
                        taxWithholding = row.Count > 10 ? row[9] : 0,
                        withdrawal =  "",
                        endingRetention = row.Count > 12 ? row[12] : 0,
                    };

                    patronageUploads.Add(entry);
                }
                catch (Exception ex)
                {
                    // Log or handle parsing error
                }
            }
            return patronageUploads;
        }


        private async Task<QuarterlyRebates> LoadQuarterlyData(IFormFile file)
        {  
            string requestBody = await new StreamReader(file.OpenReadStream()).ReadToEndAsync();
            var root = JsonConvert.DeserializeObject<dynamic>(requestBody.ToString());
            int count = root.Count;

            List<string> Term = new List<string>();
            List<string> Vendor = new List<string>();
            List<string> Programs = new List<string>();

            DataTable dt = new DataTable();
            dt.Columns.Add("MemberNumber");
            dt.Columns.Add("Member");

            //1st line are periods. 
            //Get terms names
                    foreach (var field in root[0])
                    if (!string.IsNullOrEmpty(field.ToString()))
                    {
                        Term.Add(field.ToString());

                    }

            //2nd line are programs. 
            //Get Vendors 
            foreach (var field in root[1])
                {
                    //Clean the list. 
                    if (!field.ToString().ToUpper().Contains("MEM"))
                        Vendor.Add(field.ToString());
                    //Drop when we hit end. 
                    if (field.ToString().ToUpper().Contains("MEMBER TOTAL"))
                    {
                        break;
                    }
                }


            int HeaderCounter = 0;
            //Need to build Program Name 
            foreach (var getVendor in Vendor)
            {
                try 
                { Programs.Add(Vendor[HeaderCounter] + " - " + Term[HeaderCounter]); }
                catch (Exception e) { }
                finally { HeaderCounter++; }
            }

            //Build Data Col fields.
            foreach (var program in Programs)
            {
                dt.Columns.Add(program);
            }

            //2 for member and member number
            int columnsFound = Programs.Count() + 2;
            int startCounter;

            //Rules. 
            //NO MERGED CELLS.
            //Thre must be a term in each col.
            //MAX of 10 cols. 
            int counter = 1;          
            foreach (var data in root )
            {              
                    try
                    {
                    if (counter > 2)
                    {
                        startCounter = 0;
                        DataRow _data = dt.NewRow();

                        foreach (var field in data)
                        {
                            if (startCounter < columnsFound)
                            {                                
                                _data[startCounter] = field.ToString();                               
                            }                         
                            startCounter++;
                        }
                        dt.Rows.Add(_data);
                    }
                    }            
                    catch { }
                    finally { counter++;  }             
            }

            QuarterlyRebates newData = new QuarterlyRebates();
            newData.FileData = dt;
            newData.ProgramList = Programs;
            //I now have my dtaa table 
            //save data 
            return newData;
        }


        [HttpGet]
        [Route("getCurrentQuarterlyData")]
        public List<QuarterlyDataSummary> getCurrentQuarterlyData()
        {
            List<QuarterlyDataSummary> QuarterlyDataSummary = this._proDataAccess.getCurrentQuarterlyData();
            return QuarterlyDataSummary;
        }

        [HttpGet]
        [Route("getHistoricalQRData")]
        public List<QuarterlyDataHistorical> getHistoricalQRData()
        {
            List<QuarterlyDataHistorical> QuarterlyDataSummary = this._proDataAccess.getHistoricalQRData();
            return QuarterlyDataSummary;
        }




        [HttpPut("DeletePatronageLoad")]
        public bool DeletePatronageLoad([FromBody] DeletePatronageRequest request)
        {
            return this._proDataAccess.deletePatronageLoad(request.Id);

        }





    [HttpPut]
        [Route("deleteQRUpload/{batchID}")]
        public bool deleteQRUpload(int batchID)
        {
            return this._proDataAccess.deleteQRUpload(batchID);
             
        }

        [HttpPut]
        [Route("activate/{batchID}")]
        public bool activate(int batchID)
        {
            return this._proDataAccess.activate(batchID);

        }


        [HttpGet]
        [Route("getQRBatchDetail/{batchID}")]
        public List<qrDetail> getQRBatchDetail(int batchID)
        {
            List<qrDetail> QuarterlyDataSummary = this._proDataAccess.getQRBatchDetail(batchID);
            return QuarterlyDataSummary;
        }

        [HttpGet]
        [Route("getQRBatchVendorDetail/{batchID}")]
        public List<qrDetail> getQRBatchVendorDetail(string batchID)
        {
            List<qrDetail> QuarterlyDataSummary = this._proDataAccess.getQRBatchVendorDetail(batchID);
            return QuarterlyDataSummary;
        }


        [HttpGet]
        [Route("CurrentQuarterLiability")]
        public List<QuarterlyRebate> GetQuarterRebateSummary()
        {
            List<QuarterlyRebate> QuarterRebateSummar = this._proDataAccess.GetQuarterRebateSummary();
            return QuarterRebateSummar;
        }
    }
}
