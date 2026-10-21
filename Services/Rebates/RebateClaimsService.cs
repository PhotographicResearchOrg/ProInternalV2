using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using ProInternal.Services.Files;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Net;
using System.Net.Mail;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Services.Rebates
{
    /*
     * Claims (accounting) on both rails:
     *   Recreate invoice  builds the credit invoice PDF from the AR credit,
     *                     writes it where the member site reads it
     *                     (RebateDesk:InvoiceFolder, default \\10.0.1.161\webserver_e,
     *                     file <invoice number>.pdf), keeps a copy on S3, and
     *                     marks the claim invoiced
     *   Reprint           the PDF already in that folder
     *   Debit memo        stamps the DM on the chosen claims, builds the CSV
     *                     (same columns as before), the Member Level Claim
     *                     Detail (by dealer) and a ZIP of the members' proof
     *                     files, keeps them on S3, and emails the letter with
     *                     both files attached and a download link to the ZIP
     *   Proof             a claim's proof files are on the IR site at
     *                     RebateDesk:ProofBaseUrl + <claim #>_<file name>
     *                     (default https://PromasterIR.Promaster.com/Proof/)
     */
    public sealed class RebateClaimsService
    {
        public const string InvoiceCategory = "REBATE_INVOICE";
        public const string DebitMemoCategory = "REBATE_DEBIT_MEMO";
        public const string DebitMemoProofCategory = "REBATE_DEBIT_MEMO_PROOF";
        /* S3 download links can last at most seven days. */
        private static readonly TimeSpan ProofLinkLife = TimeSpan.FromDays(7);
        private static readonly CultureInfo Us = CultureInfo.GetCultureInfo("en-US");

        private readonly IRebateDeskDataAccess _data;
        private readonly IFileLibrary _files;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _http;

        public RebateClaimsService(IRebateDeskDataAccess data, IFileLibrary files, IConfiguration config, IHttpClientFactory http)
        {
            _data = data;
            _files = files;
            _config = config;
            _http = http;
        }

        /* ---------------- proof files ---------------- */

        private string ProofBaseUrl
        {
            get
            {
                var b = _config["RebateDesk:ProofBaseUrl"] is { Length: > 0 } u ? u : "https://PromasterIR.Promaster.com/Proof/";
                return b.EndsWith('/') ? b : b + "/";
            }
        }

        /* A proof file's address on the IR site. */
        public string ProofUrl(int orderId, string fileName) =>
            ProofBaseUrl + Uri.EscapeDataString($"{orderId}_{fileName.Trim()}");

        /* "a.pdf|b.jpg" from the database, as links. */
        public List<object> ProofLinks(int orderId, string? pipeList) =>
            (pipeList ?? "").Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(f => (object)new { name = f, url = ProofUrl(orderId, f) }).ToList();

        /* Where proof files live (the IR site serves them as ProofBaseUrl + <claim #>_<name>). Same share
           the IR Maintenance screen wrote to. */
        private string ProofShare =>
            _config["RebateDesk:ProofSharePath"] is { Length: > 0 } p ? p : @"\\10.0.0.13\Temp\uploads\Master";

        private static readonly HashSet<string> ProofTypes = new(StringComparer.OrdinalIgnoreCase)
            { ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".tif", ".tiff", ".heic", ".webp", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".msg", ".eml", ".zip" };

        /* Support files added to an instant-rebate claim from the desk: saved to the proof share, listed on the
           claim (dbo.InsertRebateAdditionalFile + dbo.MarkAsHasAdditionalFiles, as IR Maintenance did), and logged. */
        public async Task<object> AddClaimFilesAsync(int orderId, IFormFileCollection files, string actor, CancellationToken ct)
        {
            if (files == null || files.Count == 0) throw new RebateFileException("Choose at least one file.");
            var saved = new List<object>();
            foreach (var f in files)
            {
                if (f.Length == 0) continue;
                var name = Path.GetFileName(f.FileName ?? "").Trim();
                if (name.Length == 0 || name.Length > 200) throw new RebateFileException("Each file needs a name under 200 characters.");
                if (!ProofTypes.Contains(Path.GetExtension(name)))
                    throw new RebateFileException($"{name}: that kind of file cannot be added as proof.");
                foreach (var c in Path.GetInvalidFileNameChars()) name = name.Replace(c, '_');

                var path = Path.Combine(ProofShare, $"{orderId}_{name}");
                await using (var stream = new FileStream(path, FileMode.Create, FileAccess.Write))
                    await f.CopyToAsync(stream, ct);

                await _data.ExecuteAsync("dbo.InsertRebateAdditionalFile", new { OrderId = orderId, FileName = name });
                await _data.ExecuteAsync("dbo.MarkAsHasAdditionalFiles", new { OrderId = orderId });
                await _data.ExecuteAsync("piv2.Claim_FileEvent", new { OrderId = orderId, Added = true, FileName = name, Actor = actor });
                saved.Add(new { name, url = ProofUrl(orderId, name) });
            }
            return new { files = saved };
        }

        /* Takes a support file off a claim (dbo.DeleteRebateProofFile, as IR Maintenance did) and deletes it from the share. */
        public async Task RemoveClaimFileAsync(int orderId, string fileName, string actor, string? reason)
        {
            var name = Path.GetFileName(fileName ?? "").Trim();
            if (name.Length == 0) throw new RebateFileException("Which file?");
            await _data.ExecuteAsync("dbo.DeleteRebateProofFile", new { OrderId = orderId, FileName = name });
            var path = Path.Combine(ProofShare, $"{orderId}_{name}");
            try { if (File.Exists(path)) File.Delete(path); }
            catch (IOException) { /* the claim no longer lists it; a locked file on the share is left */ }
            await _data.ExecuteAsync("piv2.Claim_FileEvent", new { OrderId = orderId, Added = false, FileName = name, Actor = actor, Reason = reason });
        }

        private static string Rail(string? rail) => string.Equals(rail, "PP", StringComparison.OrdinalIgnoreCase) ? "PP" : "IR";

        private string InvoiceFolder =>
            _config["RebateDesk:InvoiceFolder"] is { Length: > 0 } f ? f : @"\\10.0.1.161\webserver_e";

        private static string TemplatePath(params string[] parts) =>
            Path.Combine(new[] { AppContext.BaseDirectory, "Templates", "Rebates" }.Concat(parts).ToArray());

        /* ---------------- invoices ---------------- */

        public async Task<object> RecreateInvoiceAsync(string rail, int orderId, string actor, string? reason)
        {
            rail = Rail(rail);
            var (data, member) = await InvoiceDataAsync(rail, orderId);
            var template = TemplatePath(rail == "PP" ? "CreditPriceTemplate.pdf" : "CreditTemplate.pdf");
            if (!File.Exists(template))
                throw new RebateFileException($"The invoice template is missing on the server ({Path.GetFileName(template)}).");

            var pdf = CreditInvoicePdf.Build(template, data);
            var fileName = data.InvoiceNumber + ".pdf";

            /* Where the member site reads invoices; written under a temporary name, then swapped in. */
            string? sharePath = null;
            var folder = InvoiceFolder;
            if (!string.Equals(folder, "off", StringComparison.OrdinalIgnoreCase))
            {
                sharePath = Path.Combine(folder, fileName);
                var temporary = sharePath + "." + Guid.NewGuid().ToString("N") + ".tmp";
                try
                {
                    await File.WriteAllBytesAsync(temporary, pdf);
                    File.Move(temporary, sharePath, overwrite: true);
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    try { if (File.Exists(temporary)) File.Delete(temporary); } catch { /* best effort */ }
                    throw new RebateFileException($"The invoice was built but could not be written to {folder}: {ex.Message}");
                }
            }

            using var stream = new MemoryStream(pdf);
            var stored = await _files.StoreAsync(stream, InvoiceCategory, member, fileName, "application/pdf", actor,
                $"{(rail == "PP" ? "Price protection" : "Instant rebate")} credit invoice, claim {orderId}");

            await _data.ExecuteAsync("piv2.Claim_MarkInvoiced", new
            {
                Rail = rail,
                OrderId = orderId,
                InvoiceNumber = data.InvoiceNumber,
                FileId = stored.FileId,
                SharePath = sharePath,
                Actor = actor,
                Reason = reason
            });

            return new { invoiceNumber = data.InvoiceNumber, fileId = stored.FileId, sharePath, total = data.Total };
        }

        /* The PDF the member site has for this claim, or null when there is none yet. */
        public async Task<(byte[] Pdf, string FileName)?> ReprintAsync(string rail, int orderId)
        {
            var (data, _) = await InvoiceDataAsync(Rail(rail), orderId);
            var path = Path.Combine(InvoiceFolder, data.InvoiceNumber + ".pdf");
            if (!File.Exists(path)) return null;
            return (await File.ReadAllBytesAsync(path), data.InvoiceNumber + ".pdf");
        }

        private async Task<(CreditInvoiceData Data, string Member)> InvoiceDataAsync(string rail, int orderId)
        {
            var sets = await _data.QuerySetsAsync("piv2.Claim_InvoiceSource", new { Rail = rail, OrderId = orderId });
            var lines = sets.ElementAtOrDefault(0) ?? new List<RebateRow>();
            var ar = sets.ElementAtOrDefault(1)?.FirstOrDefault();

            if (lines.Count == 0)
                throw new RebateFileException("That claim does not exist.");
            if (ar == null)
                throw new RebateFileException("The credit is not in AR yet, so there is no invoice number. " +
                                              "If the nightly run has passed, use Resend credit; otherwise wait for tonight's run.");

            var first = lines[0];
            var member = (first.Get<int?>("memberId") ?? 0).ToString(CultureInfo.InvariantCulture);
            var processed = first.Get<DateTime?>("processedAt");
            var posted = ar.Get<DateTime?>("postedAt");

            var data = new CreditInvoiceData
            {
                InvoiceNumber = (ar.Get<string>("invoiceNumber") ?? "").Trim(),
                ClaimNumber = (ar.Get<string>("vinvno") ?? orderId.ToString(CultureInfo.InvariantCulture)).Trim(),
                AccountNumber = member,
                Program = first.Get<string>("vendorName") ?? "",
                ProgramWeek = first.Get<string>("programWeek") ?? "",
                ProcessDate = processed?.ToString("MM/dd/yyyy", Us) ?? "",
                PostedDate = posted?.ToString("MM/dd/yyyy", Us) ?? "",
                Terms = ar.Get<string>("terms") ?? "",
                ContactName = $"{first.Get<string>("fname")} {first.Get<string>("lname")}".Trim(),
                ContactPhone = first.Get<string>("phone") ?? "",
                ContactEmail = first.Get<string>("email") ?? "",
                DebitMemo = first.Get<string>("memo") ?? "",
                Total = Math.Abs(ar.Get<decimal?>("amount") ?? lines.Sum(l => l.Get<decimal?>("net") ?? 0)),
                Lines = lines.Select(l => new CreditInvoiceLine
                {
                    ProCode = l.Get<string>("proCode") ?? "",
                    Quantity = l.Get<int?>("quantity") ?? 0,
                    Description = l.Get<string>("description") ?? "",
                    UnitPrice = l.Get<decimal?>("reimbursementAmount") ?? 0,
                    Extended = l.Get<decimal?>("net") ?? 0
                }).ToList()
            };

            if (data.InvoiceNumber.Length == 0)
                throw new RebateFileException("The AR credit has no invoice number.");
            return (data, member);
        }

        /* ---------------- debit memos ---------------- */

        public sealed class DebitMemoRequest
        {
            public string Rail { get; set; } = "IR";
            public string DM { get; set; } = "";
            public string OrderIds { get; set; } = "";
            public string VendorIds { get; set; } = "";
            public string VendorName { get; set; } = "";
            public string? EmailTo { get; set; }
            public string? Ref1 { get; set; }
            public string? Ref2 { get; set; }
            public bool SendEmail { get; set; }
            /* Test run: where the test goes. */
            public string? TestTo { get; set; }
            internal bool IsTest { get; set; }
        }

        public async Task<object> CreateDebitMemoAsync(DebitMemoRequest req, IFormFileCollection? support, string actor, CancellationToken cancellationToken)
        {
            var rail = Rail(req.Rail);
            if (req.SendEmail && string.IsNullOrWhiteSpace(req.EmailTo))
                throw new RebateFileException("Enter who receives the debit memo, or untick Email it.");

            var created = (await _data.QueryAsync("piv2.Claim_CreateDebitMemo", new
            {
                Rail = rail,
                DM = req.DM,
                OrderIds = req.OrderIds,
                VendorIds = req.VendorIds,
                VendorName = req.VendorName,
                EmailTo = req.EmailTo,
                Ref1 = req.Ref1,
                Ref2 = req.Ref2,
                Actor = actor
            })).First();
            var id = created.Get<int>("debitMemoId");
            var total = created.Get<decimal>("total");

            /* The memo is stamped; from here a failure only affects delivery, which can be repeated. */
            var (csv, fileName) = await DebitMemoCsvAsync(id);
            using (var stream = new MemoryStream(csv))
            {
                var stored = await _files.StoreAsync(stream, DebitMemoCategory, req.DM.Trim(), fileName, "text/csv", actor, $"Debit memo {req.DM.Trim()}");
                await _data.ExecuteAsync("piv2.Claim_SetDebitMemoDelivery", new { DebitMemoId = id, FileId = stored.FileId, Emailed = false, EmailError = (string?)null });
            }

            /* Member Level Claim Detail (by dealer), always. */
            var (detail, detailName) = await MemberDetailAsync(id, rail);
            using (var stream = new MemoryStream(detail))
                await _files.StoreAsync(stream, DebitMemoCategory, req.DM.Trim(), detailName,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", actor, $"Debit memo {req.DM.Trim()}: member level claim detail");

            /* The members' proof files in one ZIP on S3, with a download link for the email (instant rebates). */
            ProofZip? proof = null;
            string? proofError = null;
            if (rail == "IR")
            {
                try { proof = await BuildProofZipAsync(req.OrderIds, req.DM.Trim(), actor, cancellationToken); }
                catch (Exception ex) when (ex is HttpRequestException or IOException or InvalidOperationException or TaskCanceledException)
                {
                    proofError = ex.Message.Length > 300 ? ex.Message[..300] : ex.Message;
                }
            }

            string? emailError = null;
            if (req.SendEmail)
            {
                try
                {
                    await SendDebitMemoAsync(req, total, fileName, csv, detailName, detail, proof, support, cancellationToken);
                    await _data.ExecuteAsync("piv2.Claim_SetDebitMemoDelivery", new { DebitMemoId = id, FileId = (long?)null, Emailed = true, EmailError = (string?)null });
                }
                catch (Exception ex) when (ex is SmtpException or InvalidOperationException or FormatException)
                {
                    emailError = ex.Message.Length > 450 ? ex.Message[..450] : ex.Message;
                    await _data.ExecuteAsync("piv2.Claim_SetDebitMemoDelivery", new { DebitMemoId = id, FileId = (long?)null, Emailed = false, EmailError = emailError });
                }
            }

            return new
            {
                debitMemoId = id, claims = created.Get<int>("claims"), total, emailed = req.SendEmail && emailError == null, emailError,
                proofFiles = proof?.Files ?? 0, proofMissing = proof?.Missing ?? 0, proofLink = proof?.Link, proofExpires = proof?.Expires, proofError
            };
        }

        /* Same columns as the legacy file: one row per claim and product, total at the bottom. */
        public async Task<(byte[] Csv, string FileName)> DebitMemoCsvAsync(int debitMemoId) =>
            CsvFrom(await _data.QuerySetsAsync("piv2.Claim_DebitMemoLines", new { DebitMemoId = debitMemoId }), debitMemoId);

        private static (byte[] Csv, string FileName) CsvFrom(List<List<RebateRow>> sets, int debitMemoId)
        {
            var memo = sets.ElementAtOrDefault(0)?.FirstOrDefault() ?? throw new RebateFileException("That debit memo does not exist.");
            var lines = sets.ElementAtOrDefault(1) ?? new List<RebateRow>();

            var sb = new StringBuilder();
            sb.AppendLine("Date Processed,Reimbursed Amount,Product Code,Qty.,Extended Amount,Model,Program Week,Program");
            decimal total = 0;
            foreach (var l in lines)
            {
                var ext = l.Get<decimal?>("extended") ?? 0;
                total += ext;
                var cat = l.Get<string>("catalogNumber");
                var code = string.IsNullOrWhiteSpace(cat) ? l.Get<string>("proCode") : $"{cat.Trim()} | {l.Get<string>("proCode")}";
                sb.AppendLine(string.Join(",",
                    Csv(l.Get<DateTime?>("processedAt")?.ToString("MM/dd/yyyy", Us)),
                    Csv((l.Get<decimal?>("reimbursementAmount") ?? 0).ToString("C", Us)),
                    Csv(code),
                    Csv((l.Get<int?>("quantity") ?? 0).ToString(Us)),
                    Csv(ext.ToString("C", Us)),
                    Csv(l.Get<string>("description")),
                    Csv(l.Get<string>("programWeek")),
                    Csv(l.Get<string>("vendorName"))));
            }
            sb.AppendLine($",,,,{Csv(total.ToString("C", Us))},,,");
            var dm = (memo.Get<string>("debitMemo") ?? debitMemoId.ToString(CultureInfo.InvariantCulture)).Trim();
            return (Encoding.UTF8.GetBytes(sb.ToString()), $"{dm}.csv");
        }

        private static string Csv(string? value)
        {
            var v = (value ?? "").Replace("\r", " ").Replace("\n", " ");
            return v.IndexOfAny(new[] { ',', '"' }) >= 0 ? "\"" + v.Replace("\"", "\"\"") + "\"" : v;
        }

        /* The vendor's letter, as the legacy screen chose it by vendor name. */
        public static string LetterFor(string vendorName)
        {
            var v = (vendorName ?? "").ToUpperInvariant();
            if (v.Contains("SAM")) return "Samsung";
            if (v.Contains("FUJI")) return "Fuji";
            if (v.Contains("DJI")) return "DJI";
            if (v.Contains("LEXAR")) return "Lexar";
            if (v.Contains("NERDS")) return "DroneNerds";
            if (v.Contains("OM_SYSTEM") || v.Contains("OLYMPUS")) return "Olympus";
            if (v.Contains("FEIYU")) return "FEIYU";
            if (v.Contains("LOWEPRO")) return "Lowepro";
            if (v.Contains("MANFROTTO") || v.Contains("GITZO")) return "Manfrotto";
            if (v.Contains("LASTOLITE")) return "Lastolite";
            if (v.Contains("PANA")) return "Pana";
            return "Generic";
        }

        private async Task SendDebitMemoAsync(DebitMemoRequest req, decimal total, string fileName, byte[] csv,
                                              string detailName, byte[] detail, ProofZip? proof,
                                              IFormFileCollection? support, CancellationToken cancellationToken)
        {
            var letter = TemplatePath("DebitMemo", LetterFor(req.VendorName) + ".html");
            if (!File.Exists(letter)) letter = TemplatePath("DebitMemo", "Generic.html");
            var body = File.Exists(letter) ? await File.ReadAllTextAsync(letter, cancellationToken) : "Debit memo <%DebitMemo%> for <%Amount%>.";
            body = body.Replace("<%DebitMemo%>", WebUtility.HtmlEncode(req.DM.Trim()))
                       .Replace("<%Date%>", DateTime.Now.ToString("MM/dd/yyyy", Us))
                       .Replace("<%Ref1%>", WebUtility.HtmlEncode(req.Ref1 ?? ""))
                       .Replace("<%Ref2%>", WebUtility.HtmlEncode(req.Ref2 ?? ""))
                       .Replace("<%Amount%>", total.ToString("C", Us));

            /* Proof: the old letters point at vendorfiles.promaster.com/<Vendor>/, which is no longer filled.
               Those links now go to this memo's ZIP; a letter without one gets a line added. */
            if (proof?.Link is { Length: > 0 } link)
            {
                var safe = WebUtility.HtmlEncode(link);
                var linked = System.Text.RegularExpressions.Regex.Replace(body, @"https?://vendorfiles\.promaster\.com/[^\s""'<]*", safe,
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                var note = $"<p>Proof of purchase for the {proof.Files} file(s) on this debit memo: <a href=\"{safe}\">download the ZIP</a> " +
                           $"(available until {proof.Expires:MM/dd/yyyy}).</p>";
                body = linked != body ? linked + note : body + note;
            }

            if (req.IsTest)
                body = "<div style=\"background:#fff4e5;border:1px solid #f0b37e;padding:10px;margin-bottom:12px;font-weight:bold\">" +
                       "TEST RUN: this debit memo was not created and the claims are not marked. Not sent to the vendor.</div>" + body;

            var from = _config["RebateDesk:DebitMemoFrom"] is { Length: > 0 } f ? f : _config["Email:GmailUser"] ?? "noreply@promaster.com";
            using var message = new MailMessage
            {
                From = new MailAddress(from, "PRO Accounting"),
                Subject = string.IsNullOrWhiteSpace(req.Ref1) ? $"PRO debit memo {req.DM.Trim()}" : req.Ref1!.Trim(),
                Body = body,
                IsBodyHtml = true
            };
            foreach (var address in (req.EmailTo ?? "").Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Distinct(StringComparer.OrdinalIgnoreCase))
                message.To.Add(address);
            if (!req.IsTest && _config["RebateDesk:DebitMemoBcc"] is { Length: > 0 } bcc)
                message.Bcc.Add(bcc);

            var streams = new List<Stream> { new MemoryStream(csv), new MemoryStream(detail) };
            message.Attachments.Add(new Attachment(streams[0], fileName, "text/csv"));
            message.Attachments.Add(new Attachment(streams[1], detailName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            if (support != null)
            {
                foreach (var file in support.Take(10))
                {
                    var s = new MemoryStream();
                    await file.CopyToAsync(s, cancellationToken);
                    s.Position = 0;
                    streams.Add(s);
                    message.Attachments.Add(new Attachment(s, Path.GetFileName(file.FileName)));
                }
            }

            try
            {
                using var smtp = new SmtpClient(_config["Email:SmtpHost"], _config.GetValue<int>("Email:SmtpPort"))
                {
                    EnableSsl = _config.GetValue<bool>("Email:UseSsl"),
                    Credentials = new NetworkCredential(_config["Email:GmailUser"], _config["Email:GmailAppPassword"])
                };
                await smtp.SendMailAsync(message, cancellationToken);
            }
            finally
            {
                foreach (var s in streams) s.Dispose();
            }
        }

        /* ---------------- test run ---------------- */

        /* Everything a real memo builds (letter, CSV, member level detail, proof ZIP and link), emailed only to the
           test address with TEST in the subject. Nothing is stamped on the claims and no memo is recorded. */
        public async Task<object> TestDebitMemoAsync(DebitMemoRequest req, IFormFileCollection? support, string actor, CancellationToken cancellationToken)
        {
            var rail = Rail(req.Rail);
            var to = (req.TestTo ?? "").Trim();
            if (to.Length == 0) throw new RebateFileException("Enter where the test goes in Send test to.");
            if (string.IsNullOrWhiteSpace(req.OrderIds)) throw new RebateFileException("Tick at least one claim.");
            var dm = string.IsNullOrWhiteSpace(req.DM) ? "TEST" : req.DM.Trim();

            var sets = await _data.QuerySetsAsync("piv2.Claim_DebitMemoLines",
                new { DebitMemoId = (int?)null, Rail = rail, VendorIds = req.VendorIds, OrderIds = req.OrderIds, DM = dm });
            var lines = sets.ElementAtOrDefault(1) ?? new List<RebateRow>();
            if (lines.Count == 0) throw new RebateFileException("None of the ticked claims has lines to bill.");
            var total = lines.Sum(l => l.Get<decimal?>("extended") ?? 0);

            var (csv, fileName) = CsvFrom(sets, 0);
            var (detail, detailName) = await DetailFromAsync(sets, 0, rail);

            ProofZip? proof = null;
            string? proofError = null;
            if (rail == "IR")
            {
                try { proof = await BuildProofZipAsync(req.OrderIds, $"TEST {dm}", actor, cancellationToken); }
                catch (Exception ex) when (ex is HttpRequestException or IOException or InvalidOperationException or TaskCanceledException)
                {
                    proofError = ex.Message.Length > 300 ? ex.Message[..300] : ex.Message;
                }
            }

            var test = new DebitMemoRequest
            {
                Rail = rail, DM = dm, OrderIds = req.OrderIds, VendorIds = req.VendorIds, VendorName = req.VendorName,
                EmailTo = to, Ref1 = $"TEST: {(string.IsNullOrWhiteSpace(req.Ref1) ? $"PRO debit memo {dm}" : req.Ref1!.Trim())}",
                Ref2 = req.Ref2, SendEmail = true, IsTest = true
            };
            string? emailError = null;
            try { await SendDebitMemoAsync(test, total, fileName, csv, detailName, detail, proof, support, cancellationToken); }
            catch (Exception ex) when (ex is SmtpException or InvalidOperationException or FormatException)
            {
                emailError = ex.Message.Length > 450 ? ex.Message[..450] : ex.Message;
            }

            return new
            {
                test = true, sentTo = to, emailed = emailError == null, emailError,
                claims = lines.Select(l => l.Get<int>("orderId")).Distinct().Count(), total,
                proofFiles = proof?.Files ?? 0, proofMissing = proof?.Missing ?? 0, proofLink = proof?.Link, proofError
            };
        }

        /* ---------------- member level claim detail ---------------- */

        /* One row per claim and product, grouped by dealer with a subtotal each, and each claim's proof files. */
        public async Task<(byte[] Xlsx, string FileName)> MemberDetailAsync(int debitMemoId, string rail) =>
            await DetailFromAsync(await _data.QuerySetsAsync("piv2.Claim_DebitMemoLines", new { DebitMemoId = debitMemoId }), debitMemoId, rail);

        private async Task<(byte[] Xlsx, string FileName)> DetailFromAsync(List<List<RebateRow>> sets, int debitMemoId, string rail)
        {
            var memo = sets.ElementAtOrDefault(0)?.FirstOrDefault() ?? throw new RebateFileException("That debit memo does not exist.");
            var lines = sets.ElementAtOrDefault(1) ?? new List<RebateRow>();
            var dm = (memo.Get<string>("debitMemo") ?? debitMemoId.ToString(CultureInfo.InvariantCulture)).Trim();

            var proofs = new Dictionary<int, List<string>>();
            if (rail == "IR" && lines.Count > 0)
            {
                var ids = string.Join(",", lines.Select(l => l.Get<int>("orderId")).Distinct());
                foreach (var f in await _data.QueryAsync("piv2.Claim_ProofFiles", new { OrderIds = ids }))
                {
                    var o = f.Get<int>("orderId");
                    if (!proofs.TryGetValue(o, out var list)) proofs[o] = list = new List<string>();
                    list.Add(f.Get<string>("fileName") ?? "");
                }
            }

            var wb = new Spire.Xls.Workbook();
            wb.Worksheets.Clear();
            var ws = wb.Worksheets.Add("Member level claim detail");
            string[] head = { "Dealer #", "Dealer", "Claim #", "Claimed", "Approved", "Product", "PRO code | Catalog #", "Program week",
                              "Qty", "Each (vendor share)", "Extended", "Proof files" };
            for (var c = 0; c < head.Length; c++)
            {
                ws.Range[1, c + 1].Text = head[c];
                ws.Range[1, c + 1].Style.Font.IsBold = true;
            }

            var r = 2;
            decimal grand = 0;
            foreach (var dealer in lines.GroupBy(l => l.Get<int?>("memberId") ?? 0).OrderBy(g => g.Key))
            {
                decimal sub = 0;
                foreach (var l in dealer.OrderBy(l => l.Get<int>("orderId")))
                {
                    var orderId = l.Get<int>("orderId");
                    var ext = l.Get<decimal?>("extended") ?? 0;
                    sub += ext;
                    var cat = l.Get<string>("catalogNumber");
                    ws.Range[r, 1].NumberValue = dealer.Key;
                    ws.Range[r, 2].Text = l.Get<string>("memberName") ?? "";
                    ws.Range[r, 3].NumberValue = orderId;
                    if (l.Get<DateTime?>("claimDate") is DateTime cd) { ws.Range[r, 4].NumberValue = cd.ToOADate(); ws.Range[r, 4].NumberFormat = "mm/dd/yyyy"; }
                    if (l.Get<DateTime?>("processedAt") is DateTime pd) { ws.Range[r, 5].NumberValue = pd.ToOADate(); ws.Range[r, 5].NumberFormat = "mm/dd/yyyy"; }
                    ws.Range[r, 6].Text = l.Get<string>("description") ?? "";
                    ws.Range[r, 7].Text = string.IsNullOrWhiteSpace(cat) ? (l.Get<string>("proCode") ?? "") : $"{l.Get<string>("proCode")} | {cat.Trim()}";
                    ws.Range[r, 8].Text = l.Get<string>("programWeek") ?? "";
                    ws.Range[r, 9].NumberValue = l.Get<int?>("quantity") ?? 0;
                    ws.Range[r, 10].NumberValue = (double)(l.Get<decimal?>("reimbursementAmount") ?? 0);
                    ws.Range[r, 10].NumberFormat = "$#,##0.00";
                    ws.Range[r, 11].NumberValue = (double)ext;
                    ws.Range[r, 11].NumberFormat = "$#,##0.00";
                    /* The names as they are in the proof ZIP. */
                    if (proofs.TryGetValue(orderId, out var files) && files.Count > 0)
                        ws.Range[r, 12].Text = string.Join(", ", files.Select(f => $"{orderId}_{f}"));
                    r++;
                }
                ws.Range[r, 2].Text = $"Dealer {dealer.Key} subtotal";
                ws.Range[r, 11].NumberValue = (double)sub;
                ws.Range[r, 11].NumberFormat = "$#,##0.00";
                ws.Range[r, 2, r, 11].Style.Font.IsBold = true;
                grand += sub;
                r += 2;
            }
            ws.Range[r, 2].Text = "Total";
            ws.Range[r, 11].NumberValue = (double)grand;
            ws.Range[r, 11].NumberFormat = "$#,##0.00";
            ws.Range[r, 2, r, 11].Style.Font.IsBold = true;
            ws.AllocatedRange.AutoFitColumns();

            using var ms = new MemoryStream();
            wb.SaveToStream(ms, Spire.Xls.FileFormat.Version2016);
            return (ms.ToArray(), $"{dm} Member Level Claim Detail.xlsx");
        }

        /* ---------------- proof ZIP ---------------- */

        public sealed record ProofZip(long FileId, int Files, int Missing, string? Link, DateTime Expires);

        /* Every proof file of the memo's claims, read from the IR site, in one ZIP on S3. Files that cannot be read are listed in the ZIP. */
        private async Task<ProofZip?> BuildProofZipAsync(string orderIds, string dm, string actor, CancellationToken cancellationToken)
        {
            var files = await _data.QueryAsync("piv2.Claim_ProofFiles", new { OrderIds = orderIds });
            if (files.Count == 0) return null;

            var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(60);
            var found = 0;
            var missing = new List<string>();
            var invalid = Path.GetInvalidFileNameChars();

            using var zipStream = new MemoryStream();
            using (var zip = new ZipArchive(zipStream, ZipArchiveMode.Create, leaveOpen: true))
            {
                foreach (var f in files)
                {
                    var orderId = f.Get<int>("orderId");
                    var name = (f.Get<string>("fileName") ?? "").Trim();
                    var entryName = string.Concat($"{orderId}_{name}".Where(ch => !invalid.Contains(ch)));
                    try
                    {
                        using var resp = await client.GetAsync(ProofUrl(orderId, name), HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                        if (!resp.IsSuccessStatusCode) { missing.Add($"{entryName} ({(int)resp.StatusCode})"); continue; }
                        var entry = zip.CreateEntry(entryName, CompressionLevel.Optimal);
                        await using var es = entry.Open();
                        await using var src = await resp.Content.ReadAsStreamAsync(cancellationToken);
                        await src.CopyToAsync(es, cancellationToken);
                        found++;
                    }
                    catch (HttpRequestException ex)
                    {
                        missing.Add($"{entryName} ({ex.Message})");
                    }
                }
                if (missing.Count > 0)
                {
                    var note = zip.CreateEntry("_missing.txt");
                    await using var w = new StreamWriter(note.Open());
                    await w.WriteAsync("These proof files are listed on the claims but could not be read:\r\n" + string.Join("\r\n", missing));
                }
            }

            zipStream.Position = 0;
            var stored = await _files.StoreAsync(zipStream, DebitMemoProofCategory, dm, $"{dm} proof.zip", "application/zip", actor,
                $"Debit memo {dm}: proof files ({found} of {files.Count})");
            var link = await _files.DownloadUrlAsync(stored.FileId, ProofLinkLife);
            return new ProofZip(stored.FileId, found, missing.Count, link, DateTime.Now.Add(ProofLinkLife));
        }
    }
}
