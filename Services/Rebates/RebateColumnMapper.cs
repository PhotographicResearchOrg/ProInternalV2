using Amazon;
using Amazon.BedrockRuntime;
using Amazon.BedrockRuntime.Model;
using Amazon.Runtime;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ProInternal.Models.Rebates;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Services.Rebates
{
    /* Header names vendors use for each field. Exact (normalized) matches first, then "contains". */
    public static class RebateColumnAliases
    {
        private static readonly (string Field, string[] Exact, string[] Contains)[] Rules =
        {
            (RebateFields.ProCode,       new[] { "pro code", "procode", "pro #", "pro#", "pro item", "pro item #", "pro sku", "pro id", "pro number", "pro" },
                                         new[] { "pro code", "procode", "pro item", "pro sku" }),
            (RebateFields.Upc,           new[] { "upc", "upc code", "package upc", "upc #", "ean", "ean code", "gtin", "barcode", "upc ean" },
                                         new[] { "upc", "ean", "gtin", "barcode" }),
            (RebateFields.VendorSku,     new[] { "sku", "sku no", "sku #", "sku number", "item number", "item #", "item no", "part number", "part #", "part no",
                                                 "catalog number", "catalog #", "cat no", "cat #", "model number", "model #", "model no", "mfr part", "mfr #",
                                                 "vendor sku", "vendor item", "article", "article number", "material" },
                                         new[] { "sku", "item number", "item #", "part number", "part #", "catalog", "model number", "model #", "article" }),
            (RebateFields.StackProduct,  new[] { "stack product code", "stack product", "stack", "stack code", "stack pro code", "bundle with", "qualifier", "qualifying product" },
                                         new[] { "stack", "qualif", "bundle with" }),
            (RebateFields.Description,   new[] { "product description", "description", "model", "model name", "product", "item description", "product name", "model description", "item" },
                                         new[] { "description", "model" }),
            (RebateFields.InstantRebate, new[] { "instant rebate", "ir", "ir amount", "ir value", "consumer ir", "ir rebate", "rebate amount", "rebate", "instant savings", "savings", "consumer rebate", "consumer savings", "instant rebate amount",
                                                 "$ discount", "discount $", "dollar discount", "consumer discount", "discount" },
                                         new[] { "instant", "savings", "rebate amt", "rebate amount" }),
            (RebateFields.Reimbursement, new[] { "reimbursement", "dealer reimbursement", "reimb", "reimbursement amount", "payout", "dealer payout", "credit", "dealer credit", "support", "dealer support", "claim amount",
                                                 "wholesale rebate", "vendor share", "sta", "dealer rebate" },
                                         new[] { "reimb", "payout", "dealer credit", "support", "wholesale rebate" }),
            (RebateFields.MapPrice,      new[] { "map", "map price", "new map", "promo map", "ad price", "umap", "imap", "promo price", "sale price" },
                                         new[] { "map", "promo price" }),
            (RebateFields.StartDate,     new[] { "start date", "start", "begin date", "begin", "from", "effective date", "program start", "promo start", "valid from" },
                                         new[] { "start", "begin", "effective" }),
            (RebateFields.EndDate,       new[] { "end date", "end", "to", "through", "thru", "until", "program end", "promo end", "valid to", "valid through", "valid until" },
                                         new[] { "end", "through", "thru" }),
            (RebateFields.RebateType,    new[] { "rebate type", "type", "ir type", "program type", "promo type", "offer type" },
                                         new[] { "type" }),
            (RebateFields.Notes,         new[] { "notes", "note", "comments", "comment", "remarks" },
                                         new[] { "note", "comment", "remark" })
        };

        /* "end" matches "End Date" and "Program End", not "Vendor". */
        private static bool StartsWord(string header, string part) =>
            Regex.IsMatch(header, @"(^|\s)" + Regex.Escape(part));

        /* The field a header most likely means, or null. */
        public static string? Match(string header)
        {
            var h = RebateWorkbookReader.Normalize(header);
            if (h.Length == 0) return null;
            foreach (var rule in Rules)
                if (rule.Exact.Contains(h)) return rule.Field;
            foreach (var rule in Rules)
                if (rule.Contains.Any(c => StartsWord(h, c))) return rule.Field;
            return null;
        }

        /* Each field to the first column whose header matches it. */
        public static Dictionary<string, int?> Propose(IReadOnlyList<string> headers)
        {
            var mapping = RebateFields.All.ToDictionary(f => f, _ => (int?)null);
            /* Exact matches claim columns first, so "Start Date" is not taken by a "contains" rule elsewhere. */
            for (var pass = 0; pass < 2; pass++)
            {
                for (var i = 0; i < headers.Count; i++)
                {
                    if (mapping.Values.Contains(i)) continue;
                    var h = RebateWorkbookReader.Normalize(headers[i]);
                    foreach (var rule in Rules)
                    {
                        if (mapping[rule.Field] != null) continue;
                        var hit = pass == 0 ? rule.Exact.Contains(h) : rule.Contains.Any(c => StartsWord(h, c));
                        if (hit) { mapping[rule.Field] = i; break; }
                    }
                }
            }
            return mapping;
        }
    }

    public interface IRebateAiMapper
    {
        /* Null when the AI is not available; the caller then uses the header names alone. */
        Task<(Dictionary<string, int?> Mapping, string Note)?> ProposeAsync(
            IReadOnlyList<string> headers, IReadOnlyList<List<string>> sample, string vendorName, CancellationToken cancellationToken);
    }

    /*
     * Asks Claude on Bedrock which column is which field, from the header row
     * and a few sample rows. The answer is only a proposal: a person confirms
     * or changes it, and the confirmed mapping is saved as the vendor's
     * template so the AI is not asked again for the same layout.
     *
     * Settings: "RebateDesk": { "MappingModel": "" } (empty uses
     * Bedrock:TranslationModel, then us.anthropic.claude-sonnet-5-5), and
     * "Bedrock": { "Region": "us-east-1" }. The server's AWS identity needs
     * bedrock:InvokeModel on that model.
     */
    public sealed class BedrockRebateMapper : IRebateAiMapper
    {
        private const string DefaultModel = "us.anthropic.claude-sonnet-5-5";
        private readonly IConfiguration _configuration;
        private readonly ILogger<BedrockRebateMapper> _logger;
        private readonly Lazy<AmazonBedrockRuntimeClient> _client;
        private readonly string _model;

        public BedrockRebateMapper(IConfiguration configuration, ILogger<BedrockRebateMapper> logger)
        {
            _configuration = configuration;
            _logger = logger;
            _model = configuration["RebateDesk:MappingModel"] is { Length: > 0 } m ? m
                   : configuration["Bedrock:TranslationModel"] is { Length: > 0 } t ? t
                   : DefaultModel;
            var region = configuration["Bedrock:Region"];
            _client = new Lazy<AmazonBedrockRuntimeClient>(() => new AmazonBedrockRuntimeClient(
                RegionEndpoint.GetBySystemName(string.IsNullOrWhiteSpace(region) ? "us-east-1" : region)));
        }

        public async Task<(Dictionary<string, int?> Mapping, string Note)?> ProposeAsync(
            IReadOnlyList<string> headers, IReadOnlyList<List<string>> sample, string vendorName, CancellationToken cancellationToken)
        {
            if (string.Equals(_configuration["RebateDesk:MappingModel"], "off", StringComparison.OrdinalIgnoreCase))
                return null;

            var fields = new JsonObject();
            foreach (var f in RebateFields.All) fields[f] = RebateFields.Meaning[f];

            var columns = new JsonArray();
            for (var i = 0; i < headers.Count; i++)
            {
                var values = new JsonArray(sample.Take(6).Select(r => (JsonNode?)JsonValue.Create(i < r.Count ? r[i] : "")).ToArray());
                columns.Add(new JsonObject { ["index"] = i, ["header"] = headers[i], ["examples"] = values });
            }

            var input = new JsonObject
            {
                ["vendor"] = vendorName,
                ["fields"] = fields,
                ["columns"] = columns
            };

            const string system =
                "You map columns of a vendor's instant-rebate spreadsheet for a photo/video distributor to a fixed set of fields. " +
                "Use the header text and the example values. Each column maps to at most one field and each field to at most one column. " +
                "Leave a field null when no column clearly holds it; never guess. A PRO code is the distributor's own 4-5 digit product code; " +
                "vendor files usually do not have one, so map the vendor's own SKU / item / part number to vendorSku and the barcode to upc. Reimbursement is what the dealer is paid back per unit; instant rebate is the consumer discount; " +
                "when only one amount column exists and it is not clear which, map it to reimbursement and say so. " +
                "Answer with JSON only: {\"mapping\": {field: columnIndex or null}, \"note\": \"one short sentence on anything uncertain\"}.";

            var request = new ConverseRequest
            {
                ModelId = _model,
                System = new List<SystemContentBlock> { new SystemContentBlock { Text = system } },
                Messages = new List<Message>
                {
                    new Message
                    {
                        Role = ConversationRole.User,
                        Content = new List<ContentBlock> { new ContentBlock { Text = input.ToJsonString() } }
                    }
                },
                InferenceConfig = new InferenceConfiguration { MaxTokens = 1500, Temperature = 0 }
            };

            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                timeout.CancelAfter(TimeSpan.FromSeconds(45));
                var response = await _client.Value.ConverseAsync(request, timeout.Token);
                var text = string.Concat(response.Output?.Message?.Content?.Select(c => c.Text ?? "") ?? Enumerable.Empty<string>());
                return Parse(text, headers.Count);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning("Rebate column mapping by AI timed out; using header names.");
                return null;
            }
            catch (AmazonServiceException ex)
            {
                _logger.LogWarning(ex, "Rebate column mapping by AI failed; using header names.");
                return null;
            }
            catch (Exception ex) when (ex is JsonException or InvalidOperationException or AmazonClientException)
            {
                _logger.LogWarning(ex, "Rebate column mapping by AI returned something unusable; using header names.");
                return null;
            }
        }

        /* Keeps only valid column numbers for known fields. */
        public static (Dictionary<string, int?> Mapping, string Note)? Parse(string text, int columnCount)
        {
            var match = Regex.Match(text ?? "", @"\{[\s\S]*\}");
            if (!match.Success) return null;

            using var doc = JsonDocument.Parse(match.Value);
            if (!doc.RootElement.TryGetProperty("mapping", out var map) || map.ValueKind != JsonValueKind.Object)
                return null;

            var answers = new Dictionary<string, int>();
            foreach (var f in RebateFields.All)
                if (map.TryGetProperty(f, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var col) && col >= 0 && col < columnCount)
                    answers[f] = col;

            /* One column given for two fields is a guess: leave both for the person to decide. */
            var doubled = answers.Values.GroupBy(c => c).Where(g => g.Count() > 1).Select(g => g.Key).ToHashSet();
            var mapping = RebateFields.All.ToDictionary(f => f, f => answers.TryGetValue(f, out var c) && !doubled.Contains(c) ? (int?)c : null);

            var note = doc.RootElement.TryGetProperty("note", out var n) && n.ValueKind == JsonValueKind.String ? n.GetString() ?? "" : "";
            return (mapping, note.Length > 300 ? note[..300] : note);
        }
    }
}
