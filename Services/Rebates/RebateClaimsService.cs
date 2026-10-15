using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using ProInternal.Services.Files;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
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
     *                     (same columns as before), keeps it on S3, and emails
     *                     it with the vendor's letter
     */
    public sealed class RebateClaimsService
    {
        public const string InvoiceCategory = "REBATE_INVOICE";
        public const string DebitMemoCategory = "REBATE_DEBIT_MEMO";
        private static readonly CultureInfo Us = CultureInfo.GetCultureInfo("en-US");

        private readonly IRebateDeskDataAccess _data;
        private readonly IFileLibrary _files;
        private readonly IConfiguration _config;

        public RebateClaimsService(IRebateDeskDataAccess data, IFileLibrary files, IConfiguration config)
        {
            _data = data;
            _files = files;
            _config = config;
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

            string? emailError = null;
            if (req.SendEmail)
            {
                try
                {
                    await SendDebitMemoAsync(req, total, fileName, csv, support, cancellationToken);
                    await _data.ExecuteAsync("piv2.Claim_SetDebitMemoDelivery", new { DebitMemoId = id, FileId = (long?)null, Emailed = true, EmailError = (string?)null });
                }
                catch (Exception ex) when (ex is SmtpException or InvalidOperationException or FormatException)
                {
                    emailError = ex.Message.Length > 450 ? ex.Message[..450] : ex.Message;
                    await _data.ExecuteAsync("piv2.Claim_SetDebitMemoDelivery", new { DebitMemoId = id, FileId = (long?)null, Emailed = false, EmailError = emailError });
                }
            }

            return new { debitMemoId = id, claims = created.Get<int>("claims"), total, emailed = req.SendEmail && emailError == null, emailError };
        }

        /* Same columns as the legacy file: one row per claim and product, total at the bottom. */
        public async Task<(byte[] Csv, string FileName)> DebitMemoCsvAsync(int debitMemoId)
        {
            var sets = await _data.QuerySetsAsync("piv2.Claim_DebitMemoLines", new { DebitMemoId = debitMemoId });
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
            if (_config["RebateDesk:DebitMemoBcc"] is { Length: > 0 } bcc)
                message.Bcc.Add(bcc);

            var streams = new List<Stream> { new MemoryStream(csv) };
            message.Attachments.Add(new Attachment(streams[0], fileName, "text/csv"));
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
    }
}
