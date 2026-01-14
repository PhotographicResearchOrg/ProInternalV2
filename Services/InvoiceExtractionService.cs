using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using ProInternal.Models.Accounting;
using Spire.Pdf;
using Spire.Pdf.Texts;
using System.Text;
using System.Text.RegularExpressions;

namespace ProInternal.Services
{
    public class InvoiceExtractionService : IInvoiceExtractionService
    {
        private readonly ILogger<InvoiceExtractionService> _logger;
        private IProDataAccess _proDataAccess;
        public InvoiceExtractionService(ILogger<InvoiceExtractionService> logger, IProDataAccess proDataAccess)
        {
            _logger = logger;
            _proDataAccess = proDataAccess;
        }

        public async Task<InvoiceExtractionPreviewDto> ExtractPreviewAsync(IFormFile file)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("Invalid PDF file");

            await using var stream = file.OpenReadStream();

            var pdf = new PdfDocument();
            pdf.LoadFromStream(stream);

            var sb = new StringBuilder();

            foreach (PdfPageBase page in pdf.Pages)
            {
                var extractor = new PdfTextExtractor(page);
                var options = new PdfTextExtractOptions { IsExtractAllText = true };
                sb.AppendLine(extractor.ExtractText(options));
            }

            pdf.Close();

            var rawText = Normalize(sb.ToString());

            var dto = new InvoiceExtractionPreviewDto
            {
                RawText = rawText,
                InvoiceNumber = MatchAny(rawText, InvoiceNumberPatterns),
                PONumber = MatchAny(rawText, PONumberPatterns),
                InvoiceDate = MatchAnyDate(rawText, InvoiceDatePatterns),
                DueDate = MatchAnyDate(rawText, DueDatePatterns),
                OrderDate = MatchAnyDate(rawText, OrderDatePatterns),
                TotalAmount = MatchAnyDecimal(rawText, TotalAmountPatterns),
                ShippingCompany = ExtractCompany(rawText)
            };

            dto.CalculateConfidence();
            return dto;
        }

        // =====================================================
        // PATTERN SETS (THE SAFETY NET)
        // =====================================================

        private static readonly string[] InvoiceNumberPatterns =
        {
            @"Invoice\s*(No\.?|#|Number)?\s*[:\-]?\s*([A-Z0-9\-]{5,})",
            @"INV\s*(No\.?)?\s*[:\-]?\s*([A-Z0-9\-]{5,})",
            @"INVOICE:\s*([A-Z0-9\-]{5,})"
        };

        private static readonly string[] PONumberPatterns =
        {
            @"PO\s*(No\.?|Number)?\s*[:\-]?\s*(\d{3,})",
            @"Purchase\s*Order\s*[:\-]?\s*(\d{3,})"
        };

        private static readonly string[] InvoiceDatePatterns =
        {
            @"Invoice\s*Date\s*[:\-]?\s*(\d{1,2}/\d{1,2}/\d{2,4})",
            @"Date\s*[:\-]?\s*(\d{1,2}/\d{1,2}/\d{2,4})"
        };

        private static readonly string[] DueDatePatterns =
        {
            @"Due\s*Date\s*[:\-]?\s*(\d{1,2}/\d{1,2}/\d{2,4})",
            @"Invoice\s*Due\s*[:\-]?\s*(\d{1,2}/\d{1,2}/\d{2,4})"
        };

        private static readonly string[] OrderDatePatterns =
        {
            @"Order\s*Date\s*[:\-]?\s*(\d{1,2}/\d{1,2}/\d{2,4})"
        };

        private static readonly string[] TotalAmountPatterns =
        {
            @"Total\s*[:\$]?\s*([\d,]+\.\d{2})",
            @"Invoice\s*Total\s*[:\$]?\s*([\d,]+\.\d{2})",
            @"Amount\s*Due\s*[:\$]?\s*([\d,]+\.\d{2})"
        };

        private static readonly string[] ShipToAnchors =
        {
            "Ship To",
            "Shipping Address",
            "Sold To",
            "Deliver To"
        };

        // =====================================================
        // EXTRACTION HELPERS
        // =====================================================

        private static string? MatchAny(string text, IEnumerable<string> patterns)
        {
            foreach (var pattern in patterns)
            {
                var m = Regex.Match(text, pattern, RegexOptions.IgnoreCase);
                if (m.Success)
                    return m.Groups[^1].Value.Trim();
            }
            return null;
        }

        private static DateTime? MatchAnyDate(string text, IEnumerable<string> patterns)
        {
            var raw = MatchAny(text, patterns);
            return DateTime.TryParse(raw, out var dt) ? dt : null;
        }

        private static decimal? MatchAnyDecimal(string text, IEnumerable<string> patterns)
        {
            var raw = MatchAny(text, patterns)?.Replace(",", "");
            return decimal.TryParse(raw, out var d) ? d : null;
        }

        private static string Normalize(string input)
        {
            return Regex.Replace(input, @"[ \t]+", " ")
                        .Replace("\r", "")
                        .Trim();
        }

        // =====================================================
        // SHIP / SOLD TO EXTRACTION (BROADER)
        // =====================================================

        private static string? ExtractCompany(string rawText)
        {
            foreach (var anchor in ShipToAnchors)
            {
                var match = Regex.Match(
                    rawText,
                    $"{anchor}:?\\s*(.+?)(?:Invoice|Total|Order|PO|$)",
                    RegexOptions.IgnoreCase | RegexOptions.Singleline
                );

                if (!match.Success)
                    continue;

                var lines = match.Groups[1].Value
                    .Split('\n', StringSplitOptions.RemoveEmptyEntries)
                    .Select(l => l.Trim())
                    .Where(l => l.Length > 2)
                    .ToList();

                // Heuristic:
                // Prefer lines that look like company names
                var candidate = lines.FirstOrDefault(l =>
                    !Regex.IsMatch(l, @"\d") &&     // no street numbers
                    !l.Contains(",") &&             // not a person
                    l.Length >= 3
                );

                if (candidate != null)
                    return candidate;
            }

            return null;
        }


        public InvoiceExtractionPreviewDto ApplyVendorLearning(InvoiceExtractionPreviewDto dto,string rawText,int vendorId)
        {
            var rules = _proDataAccess.GetVendorInvoiceLearning(vendorId);

            foreach (var rule in rules)
            {
                string? value = rule.Strategy switch
                {
                    "Regex" => MatchRegex(rawText, rule.Pattern),
                    "LabelAfter" => ExtractAfterLabel(rawText, rule.Pattern),
                    "BlockAfter" => ExtractBlock(rawText, rule.Pattern),
                    _ => null
                };

                if (string.IsNullOrWhiteSpace(value))
                    continue;

                ApplyField(dto, rule.FieldName, value);

                _proDataAccess.TouchVendorInvoiceLearning(rule.Id);
            }

            return dto;
        }

        private static string? MatchRegex(string text, string pattern)
        {
            var m = Regex.Match(text, pattern, RegexOptions.IgnoreCase | RegexOptions.Multiline);
            return m.Success ? m.Groups[^1].Value.Trim() : null;
        }

        private static string? ExtractBlock(string text, string header)
        {
            var pattern = $@"{Regex.Escape(header)}\s*(.+?)(?:\n\s*\n|$)";
            var match = Regex.Match(
                text,
                pattern,
                RegexOptions.IgnoreCase | RegexOptions.Singleline
            );

            return match.Success
                ? match.Groups[1].Value.Trim()
                : null;
        }


        private static string? ExtractAfterLabel(string text, string label)
        {
            var pattern = $@"{Regex.Escape(label)}\s*[:\-]?\s*(.+)";
            var match = Regex.Match(
                text,
                pattern,
                RegexOptions.IgnoreCase | RegexOptions.Multiline
            );

            return match.Success
                ? match.Groups[1].Value.Trim()
                : null;
        }


        private void ApplyField(InvoiceExtractionPreviewDto dto,string field,string value)
        {
            switch (field)
            {
                case "InvoiceNumber": dto.InvoiceNumber ??= value; break;
                case "PONumber": dto.PONumber ??= value; break;
                case "ShippingCompany": dto.ShippingCompany ??= value; break;
                case "TotalAmount":
                    if (decimal.TryParse(value.Replace(",", ""), out var d))
                        dto.TotalAmount ??= d;
                    break;
            }
        }



        public void DetectAndSaveVendorLearning(InvoiceExtractionPreviewDto extracted,VendorBillingRequestDto final,int vendorId,string rawText)
        {
            // Invoice #
            LearnIfChanged(
                vendorId,
                "InvoiceNumber",
                extracted.InvoiceNumber,
                final.VendorInv,
                rawText
            );

            // PO
            LearnIfChanged(
                vendorId,
                "PONumber",
                extracted.PONumber,
                final.PO,
                rawText
            );

            // Total
            LearnIfChanged(
                vendorId,
                "TotalAmount",
                extracted.TotalAmount?.ToString("0.00"),
                final.Amount.ToString("0.00"),
                rawText
            );
        }

        private void LearnIfChanged(
    int vendorId,
    string field,
    string? extracted,
    string? corrected,
    string rawText
)
        {
            if (string.IsNullOrWhiteSpace(corrected))
                return;

            if (!string.IsNullOrWhiteSpace(extracted) &&
                extracted.Trim().Equals(corrected.Trim(), StringComparison.OrdinalIgnoreCase))
                return;

            // 🔒 build a safe regex from corrected value
            var escaped = Regex.Escape(corrected.Trim());

            _proDataAccess.UpsertVendorInvoiceLearning(new VendorInvoiceLearningDto
            {
                VendorId = vendorId,
                FieldName = field,
                Strategy = "Regex",
                Pattern = escaped
            });
        }



    }
}
