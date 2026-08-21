using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using ProInternal.Models.Accounting;
using Spire.Pdf;
using Spire.Pdf.Texts;
using System.Data;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Amazon;
using Amazon.BedrockRuntime;
using Amazon.BedrockRuntime.Model;

namespace ProInternal.Services
{
    public class InvoiceExtractionService : IInvoiceExtractionService
    {
        private readonly ILogger<InvoiceExtractionService> _logger;
        private IProDataAccess _proDataAccess;
        private IUvicornDataAccess _Uvicorn;

        public InvoiceExtractionService(ILogger<InvoiceExtractionService> logger, IProDataAccess proDataAccess, IUvicornDataAccess uvicornDataAccess)
        {
            _logger = logger;
            _proDataAccess = proDataAccess;
            _Uvicorn = uvicornDataAccess;
        }


        private (string? VendorId, decimal VendorConfidence, string? VendorName)
      ResolveVendor(string rawText)
        {
            // 1️⃣ Name match (strongest)
            var match = _proDataAccess.FindVendorByName(rawText);
            if (match != null)
                return ( match.VendorId, 0.95m, match.Name);

            // 2️⃣ Address match
            var addressMatch = _proDataAccess.FindVendorByAddress(rawText);
            if (addressMatch != null)
                return (addressMatch.VendorId, 0.75m, addressMatch.Name);

            return (null, 0m, null);
        }


        private (string? MemberId, decimal MemberConfidence, string? MemberName)
  ResolveMember(string rawText)
        {
            // 1️⃣ Address match (strongest)
            var byAddress = _proDataAccess.FindMemberByAddress(rawText);
            if (byAddress != null)
                return (byAddress.AccountNumber, 0.95m, byAddress.Company);

            // 2️⃣ Name / DBA match
            var byName = _proDataAccess.FindMemberByName(rawText);
            if (byName != null)
                return (byName.AccountNumber, 0.85m, byName.Company);

            return (null, 0m, null);
        }






        private static string NormalizeVendorName(string vendorName)
        {
            if (string.IsNullOrWhiteSpace(vendorName))
                return vendorName;

            // Upper for consistency
            var name = vendorName.ToUpperInvariant();

            // Remove punctuation
            name = Regex.Replace(name, @"[^\w\s]", " ");

            // Remove legal suffixes
            var stopWords = new[]
            {
       "PRO", "INC", "LLC", "LTD", "CORP", "CORPORATION", "CO", "COMPANY", "PROMASTER"
    };

            var tokens = name
                .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(t => !stopWords.Contains(t))
                .ToList();

            // Return first meaningful token (brand anchor)
            return tokens.Count > 0
               ? string.Join(" ", tokens)
               : vendorName;
        }


        private async Task<InvoiceExtractionPreviewDto> TestBedrock(IFormFile file)
        {
         

            var modelId = "global.anthropic.claude-sonnet-4-6";

            const string prompt = """
You are an accounting invoice extraction engine.

Analyze the attached PDF invoice.

Return ONLY valid JSON.

Do not wrap the response in markdown.

If a field cannot be determined, return null.

Schema:

{
  "vendorName": "",
  "memberName": "",
  "shippingCompany": "",
  "invoiceNumber": "",
  "poNumber": "",
  "invoiceDate": null,
  "dueDate": null,
  "date": null,
  "totalAmount": null,
  "rawText": ""
}
""";

            using var memory = new MemoryStream();
            await file.CopyToAsync(memory);

            var client = new AmazonBedrockRuntimeClient(RegionEndpoint.USEast1);

            var request = new ConverseRequest
            {
                ModelId = modelId,
                Messages =
                [
                    new Message
            {
                Role = ConversationRole.User,
                Content =
                [
                    new ContentBlock
                    {
                        Text = prompt
                    },
                    new ContentBlock
                    {
                        Document = new DocumentBlock
                        {
                            Name = "Invoice",
                            Format = DocumentFormat.Pdf,
                            Source = new DocumentSource
                            {
                                Bytes = new MemoryStream(memory.ToArray())
                            }
                        }
                    }
                ]
            }
                ]
            };

            var response = await client.ConverseAsync(request);

            var json = response.Output.Message.Content
                .First(c => c.Text != null)
                .Text;

            _logger.LogInformation(json);

    
            return JsonConvert.DeserializeObject<InvoiceExtractionPreviewDto>(json)!;
        }


        public async Task<InvoiceExtractionPreviewDto> ExtractPreviewAsync(IFormFile file)
        {
            //  AI extraction via Python (uvicorn)
            //var dto = await _Uvicorn.ExtractInvoicePreviewAsync(file);
            var dto = await TestBedrock(file);




            //  Resolve vendor / member using existing tuple resolvers
            var vendorName = !string.IsNullOrWhiteSpace(dto.VendorName)? NormalizeVendorName(dto.VendorName): dto.RawText;

            var vendor = ResolveVendor(vendorName);

            string? memberSource = dto.MemberName;
            if (!string.IsNullOrWhiteSpace(memberSource) &&
            memberSource.Contains("Photographic Research", StringComparison.OrdinalIgnoreCase))
            {
                memberSource = null;
            }

            // Prefer ShippingCompany if PRO was detected
            memberSource ??= dto.ShippingCompany;

            // Absolute fallback only
            memberSource ??= dto.RawText;

            var member = ResolveMember(memberSource);

            // SAFE numeric assignment (tuple → int?)
            dto.SuggestedVendorId =int.TryParse(vendor.VendorId, out var vid) ? vid : null;
            dto.VendorConfidence = vendor.VendorConfidence;



            if (dto.SuggestedVendorId.HasValue)
            {
                dto = ApplyVendorLearning(dto, dto.RawText, dto.SuggestedVendorId.Value);
            }
            // Only apply heuristic member if learning did NOT already set it
            if (!dto.SuggestedMemberId.HasValue)
            {
                dto.SuggestedMemberId =
                    int.TryParse(member.MemberId, out var mid) ? mid : null;

                dto.MemberConfidence = member.MemberConfidence;
            }


            // Final confidence calculation
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





        public InvoiceExtractionPreviewDto ApplyVendorLearning(
            InvoiceExtractionPreviewDto dto,
            string rawText,
            int vendorId
        )
        {
            var rules = _proDataAccess.GetVendorInvoiceLearning(vendorId);

            foreach (var rule in rules)
            {
                //MEMBER LEARNING (vendor + pattern scoped)
                if (rule.FieldName == "Member" && rule.Strategy == "Regex")
                {
                    var normalizedRaw = NormalizeVendorName(rawText);

                    if (Regex.IsMatch(normalizedRaw, rule.Pattern, RegexOptions.IgnoreCase) &&
                        int.TryParse(rule.ResolvedValue, out var memberId))
                    {
                        dto.SuggestedMemberId = memberId;
                        dto.MemberConfidence = 0.95m;

                        _proDataAccess.TouchVendorInvoiceLearning(rule.Id);
                        continue;
                    }
                }


                //ALL OTHER FIELDS
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

                case "InvoiceDate":
                    if (DateTime.TryParse(value, out var invDt))
                        dto.InvoiceDate ??= invDt;
                    break;

                case "DueDate":
                    if (DateTime.TryParse(value, out var dueDt))
                        dto.DueDate ??= dueDt;
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


            // Invoice Date
            LearnIfChanged(
                vendorId,
                "InvoiceDate",
                extracted.InvoiceDate?.ToString("MM/dd/yyyy"),
                final.VendInvDate?.ToString("MM/dd/yyyy"),
                rawText
            );

            // Due Date
            LearnIfChanged(
                vendorId,
                "DueDate",
                extracted.DueDate?.ToString("MM/dd/yyyy"),
                final.VendorDueDate?.ToString("MM/dd/yyyy"),
                rawText
            );

            // -------------------------
            // MEMBER learning (guarded)
            // -------------------------

            bool aiAlreadyCorrect =
                extracted.SuggestedMemberId.HasValue &&
                extracted.SuggestedMemberId.Value.ToString() == final.ProID;

            if (aiAlreadyCorrect)
                return; //exit ONLY member learning

            if (!string.IsNullOrWhiteSpace(extracted.MemberName) &&
                !string.IsNullOrWhiteSpace(final.ProID))
            {
                var normalized = NormalizeVendorName(extracted.MemberName);

                _proDataAccess.UpsertVendorInvoiceLearning(new VendorInvoiceLearningDto
                {
                    VendorId = vendorId,
                    FieldName = "Member",
                    Strategy = "Regex",
                    Pattern = Regex.Escape(normalized),
                    ResolvedValue = final.ProID
                });
            }


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

            var escaped = Regex.Escape(corrected.Trim());

            _proDataAccess.UpsertVendorInvoiceLearning(new VendorInvoiceLearningDto
            {
                VendorId = vendorId,
                FieldName = field,
                Strategy = "Regex",
                Pattern = escaped,
                ResolvedValue = corrected   //  THIS WAS MISSING
            });
        }




    }
}
