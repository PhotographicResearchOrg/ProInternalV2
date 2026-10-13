using Amazon;
using Amazon.BedrockRuntime;
using Amazon.BedrockRuntime.Model;
using Amazon.Runtime;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Services.ProductContract
{
    /* ------------------------------------------------------------------
     * Product content translation through AWS Bedrock (Claude).
     *
     * Translates one language's product content into other languages.
     * Nothing is saved here: the page shows the result, a person reviews
     * it, and the normal product save stores it marked "AI, not reviewed"
     * until someone ticks Reviewed.
     *
     * Credentials: the standard AWS chain (environment, profile, or the
     * server's role), the same source the app's other AWS calls use.
     * The identity needs bedrock:InvokeModel on the model below.
     *
     * Settings (all optional), appsettings.json:
     *   "Bedrock": { "Region": "us-east-1",
     *                "TranslationModel": "us.anthropic.claude-sonnet-5-5" }
     * ------------------------------------------------------------------ */
    public interface IProductTranslationService
    {
        Task<ProductTranslateResult> TranslateAsync(ProductTranslateRequest request, CancellationToken cancellationToken);
    }

    public sealed class ProductTranslateRequest
    {
        /* The language to translate from, e.g. "en". */
        public string SourceLocale { get; set; } = "en";

        /* That language's content, as the content contract shapes it. */
        public JsonObject? Source { get; set; }

        /* Languages to produce, e.g. ["de", "fr"]. */
        public List<string> Targets { get; set; } = new();

        /* Words never translated: brand, product code, model numbers. */
        public List<string> DoNotTranslate { get; set; } = new();
    }

    public sealed class ProductTranslateResult
    {
        public string Model { get; set; } = string.Empty;
        public List<TranslatedLocale> Results { get; set; } = new();
        public List<TranslationFailure> Failures { get; set; } = new();
    }

    public sealed class TranslatedLocale
    {
        public string Locale { get; set; } = string.Empty;
        public JsonObject Content { get; set; } = new();

        /* Things a person must check, e.g. safety or battery wording. */
        public List<string> Notes { get; set; } = new();
    }

    public sealed class TranslationFailure
    {
        public string Locale { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    public class BedrockProductTranslationService : IProductTranslationService
    {
        private const string DefaultRegion = "us-east-1";
        private const string DefaultModel = "us.anthropic.claude-sonnet-5-5";

        /* Text fields translated as plain text. HTML fields keep their tags. */
        private static readonly string[] TextFields = { "name", "shortDescription", "description", "outOfStockMessage" };
        private static readonly string[] HtmlFields = { "featuresHtml", "specsHtml" };

        private static readonly Dictionary<string, string> LanguageNames = new(StringComparer.OrdinalIgnoreCase)
        {
            ["en"] = "English (United States)",
            ["en-GB"] = "English (United Kingdom): British spelling and usage, e.g. colour, aluminium, centre",
            ["de"] = "German (Germany)",
            ["fr"] = "French (France)",
            ["es"] = "Spanish (Spain)",
            ["it"] = "Italian (Italy)",
            ["nl"] = "Dutch (Netherlands)"
        };

        private static readonly Regex LocaleCode = new("^[a-z]{2}(-[A-Z]{2})?$", RegexOptions.Compiled);
        private static readonly Regex Tag = new(@"<\s*(/?)\s*([a-zA-Z0-9]+)", RegexOptions.Compiled);

        private readonly AmazonBedrockRuntimeClient _client;
        private readonly string _model;

        public BedrockProductTranslationService(IConfiguration configuration)
        {
            var region = configuration["Bedrock:Region"];
            _model = configuration["Bedrock:TranslationModel"] is { Length: > 0 } model ? model : DefaultModel;
            _client = new AmazonBedrockRuntimeClient(
                RegionEndpoint.GetBySystemName(string.IsNullOrWhiteSpace(region) ? DefaultRegion : region));
        }

        public async Task<ProductTranslateResult> TranslateAsync(
            ProductTranslateRequest request, CancellationToken cancellationToken)
        {
            var result = new ProductTranslateResult { Model = _model };
            var source = PickSource(request.Source);

            var targets = request.Targets
                .Where(t => LocaleCode.IsMatch(t ?? "") && !string.Equals(t, request.SourceLocale, StringComparison.Ordinal))
                .Distinct()
                .Take(8)
                .ToList();

            /* One call per language, in parallel: faster, and one failure does not sink the rest. */
            var work = targets.Select(async target =>
            {
                try
                {
                    var (content, notes) = await TranslateOneAsync(request, source, target, cancellationToken);
                    lock (result) result.Results.Add(new TranslatedLocale { Locale = target, Content = content, Notes = notes });
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (AmazonServiceException ex)
                {
                    lock (result) result.Failures.Add(new TranslationFailure { Locale = target, Message = BedrockMessage(ex) });
                }
                catch (Exception ex)
                {
                    lock (result) result.Failures.Add(new TranslationFailure { Locale = target, Message = ex.Message });
                }
            });

            await Task.WhenAll(work);

            result.Results = result.Results.OrderBy(r => targets.IndexOf(r.Locale)).ToList();
            return result;
        }

        private async Task<(JsonObject Content, List<string> Notes)> TranslateOneAsync(
            ProductTranslateRequest request, JsonObject source, string target, CancellationToken cancellationToken)
        {
            var targetName = LanguageNames.TryGetValue(target, out var name) ? name : target;
            var sourceName = LanguageNames.TryGetValue(request.SourceLocale, out var sname) ? sname : request.SourceLocale;
            var keep = request.DoNotTranslate
                .Where(w => !string.IsNullOrWhiteSpace(w))
                .Select(w => w.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(400);

            var system = new StringBuilder()
                .AppendLine("You translate product content for ProMaster, a photo and video equipment distributor, for retail web pages.")
                .AppendLine("Rules:")
                .AppendLine("- Translate meaning, not word for word. Use the natural retail tone of the target market.")
                .AppendLine("- Never translate brand names, product names that are trademarks, product codes, model numbers, part numbers, or the protected words listed.")
                .AppendLine("- HTML fields: keep every tag and attribute exactly as given, in the same order. Translate only the text between tags.")
                .AppendLine("- Measurements: for any market other than en (United States), give metric. Convert imperial values, e.g. \"5 lb\" becomes \"2.3 kg\", \"10 in\" becomes \"25.4 cm\". Keep values that are already metric.")
                .AppendLine("- Keep lists the same length and order: features[i] is the translation of features[i]; specs[i] keeps its position.")
                .AppendLine("- Do not add claims, prices, warranties or information that is not in the source.")
                .AppendLine("- If the text contains safety warnings, battery or hazardous-material wording, warranty terms, or legal or regulatory statements, translate it, and add a short English note to \"notes\" naming it so a person checks it.")
                .AppendLine("- Reply with ONLY one JSON object, no other text: the same keys as the input \"content\", translated, plus \"notes\": an array of short English strings (empty if nothing to check).")
                .ToString();

            var input = new JsonObject
            {
                ["from"] = sourceName,
                ["to"] = targetName,
                ["protectedWords"] = new JsonArray(keep.Select(w => (JsonNode)w!).ToArray()),
                ["content"] = source.DeepClone()
            };

            var converse = new ConverseRequest
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
                InferenceConfig = new InferenceConfiguration { MaxTokens = 12000 }
            };

            var response = await _client.ConverseAsync(converse, cancellationToken);

            if (response.StopReason == StopReason.Max_tokens)
                throw new InvalidOperationException("The text is too long to translate in one go.");

            var text = string.Concat(response.Output?.Message?.Content?.Select(c => c.Text ?? "") ?? Enumerable.Empty<string>());
            var parsed = ParseJsonObject(text)
                         ?? throw new InvalidOperationException("The translation came back in an unexpected format. Try again.");

            return Shape(source, parsed, target);
        }

        /* Only the fields worth translating; documents keep their links, only titles change. */
        private static JsonObject PickSource(JsonObject? content)
        {
            var source = new JsonObject();
            if (content is null) return source;

            foreach (var field in TextFields.Concat(HtmlFields))
            {
                if (content[field] is JsonValue value && value.TryGetValue<string>(out var s) && !string.IsNullOrWhiteSpace(s))
                    source[field] = s;
            }

            if (content["features"] is JsonArray features && features.Count > 0)
                source["features"] = features.DeepClone();

            if (content["specs"] is JsonArray specs && specs.Count > 0)
                source["specs"] = specs.DeepClone();

            if (content["documents"] is JsonArray docs && docs.Count > 0)
            {
                source["documents"] = new JsonArray(docs.OfType<JsonObject>()
                    .Select(d => (JsonNode)new JsonObject { ["title"] = d["title"]?.DeepClone() })
                    .ToArray());
            }

            return source;
        }

        /*
         * Builds the target language's content from what came back, field by
         * field, so nothing the source did not have can slip in. Checks the
         * HTML kept its tags and lists kept their length; adds a note if not.
         */
        private static (JsonObject Content, List<string> Notes) Shape(JsonObject source, JsonObject parsed, string target)
        {
            var content = new JsonObject { ["locale"] = target };
            var notes = new List<string>();

            if (parsed["notes"] is JsonArray modelNotes)
                notes.AddRange(modelNotes.Select(n => n?.ToString() ?? "").Where(n => n.Length > 0).Take(10));

            foreach (var field in TextFields)
            {
                if (source[field] is null) continue;
                var value = Str(parsed[field]);
                if (!string.IsNullOrWhiteSpace(value)) content[field] = value.Trim();
                else notes.Add($"{field} was not translated.");
            }

            foreach (var field in HtmlFields)
            {
                if (source[field] is null) continue;
                var value = Str(parsed[field]);

                if (string.IsNullOrWhiteSpace(value))
                {
                    notes.Add($"{field} was not translated.");
                    continue;
                }

                if (TagSequence(Str(source[field])) != TagSequence(value))
                    notes.Add($"{field}: the HTML layout changed in translation. Check it before marking reviewed.");

                content[field] = value;
            }

            if (source["features"] is JsonArray sourceFeatures)
            {
                var features = (parsed["features"] as JsonArray)?.Select(f => Str(f)?.Trim() ?? "").ToList() ?? new List<string>();
                if (features.Count != sourceFeatures.Count)
                    notes.Add("Features: the number of features changed in translation. Check them.");
                content["features"] = new JsonArray(features.Where(f => f.Length > 0).Select(f => (JsonNode)f!).ToArray());
            }

            if (source["specs"] is JsonArray sourceSpecs)
            {
                var specs = (parsed["specs"] as JsonArray)?.OfType<JsonObject>()
                    .Select(s => new { Label = Str(s["label"])?.Trim() ?? "", Value = Str(s["value"])?.Trim() ?? "" })
                    .Where(s => s.Label.Length > 0 && s.Value.Length > 0)
                    .ToList() ?? new();
                if (specs.Count != sourceSpecs.Count)
                    notes.Add("Specs: the number of specs changed in translation. Check them.");
                content["specs"] = new JsonArray(specs
                    .Select(s => (JsonNode)new JsonObject { ["label"] = s.Label, ["value"] = s.Value }).ToArray());
            }

            if (source["documents"] is JsonArray sourceDocs)
            {
                var titles = (parsed["documents"] as JsonArray)?.OfType<JsonObject>().Select(d => Str(d["title"])).ToList() ?? new();
                content["documentTitles"] = new JsonArray(sourceDocs.Select((_, i) =>
                    (JsonNode?)(i < titles.Count ? titles[i] : null)).ToArray());
            }

            return (content, notes.Distinct().ToList());
        }

        private static string TagSequence(string? html) =>
            html is null ? "" : string.Join(",", Tag.Matches(html).Select(m => m.Groups[1].Value + m.Groups[2].Value.ToLowerInvariant()));

        private static string? Str(JsonNode? node) =>
            node is JsonValue v && v.TryGetValue<string>(out var s) ? s : null;

        /* Takes the JSON object out of the reply, with or without ``` fences around it. */
        private static JsonObject? ParseJsonObject(string text)
        {
            var start = text.IndexOf('{');
            var end = text.LastIndexOf('}');
            if (start < 0 || end <= start) return null;

            try
            {
                return JsonNode.Parse(text[start..(end + 1)]) as JsonObject;
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static string BedrockMessage(AmazonServiceException ex) => ex.ErrorCode switch
        {
            "AccessDeniedException" => "The server is not allowed to use the translation model. Attach the Bedrock policy to its AWS identity.",
            "ThrottlingException" => "Translation is busy. Wait a moment and try again.",
            "ValidationException" => $"Bedrock rejected the request: {ex.Message}",
            "ResourceNotFoundException" => "The translation model was not found in this region. Check Bedrock:TranslationModel.",
            _ => $"Translation failed: {ex.Message}"
        };
    }
}
