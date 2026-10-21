#nullable disable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using ProInternal.Models.Ai;

namespace ProInternal.Services.Ai
{
    /*
     * Product lookup and competitor prices through Perplexity (the same key and service as market research).
     * Perplexity is asked for one JSON object; the answer is parsed tolerantly (a ```json block, or the first
     * {...} in the text). Every result is saved to the product as a dated Markdown snapshot that carries the
     * parsed data in a ```json block, so a saved result reopens exactly as it was shown.
     */
    public static class ProductLookupService
    {
        public const string LookupFeature = "PRODUCT_LOOKUP";
        public const string PricesFeature = "COMPETITOR_PRICING";
        public const string LookupCategory = "product-lookup";
        public const string PricesCategory = "competitor-prices";

        public const string LookupQuestion =
            "Find this product's manufacturer details: the official product name, a short description (one sentence), a full description " +
            "(one or two paragraphs), key features, technical specifications, the UPC (12 digits) and EAN (13 digits) if published, " +
            "and product image URLs from the manufacturer or a major retailer.";

        public const string LookupInstructions =
            "Reply with ONE JSON object and nothing else, in this shape: " +
            "{\"name\":\"\",\"shortDescription\":\"\",\"description\":\"\",\"features\":[\"\"],\"specs\":[{\"label\":\"\",\"value\":\"\"}]," +
            "\"upc\":\"\",\"upcSource\":0,\"ean\":\"\",\"images\":[{\"url\":\"\",\"source\":0,\"description\":\"\"}],\"notes\":[\"\"]}. " +
            "source and upcSource are the number of the source the value came from. Use empty strings or empty lists for anything " +
            "you can't find; never guess a UPC or EAN. Image URLs must be direct links to image files (jpg, png or webp). " +
            "Write the description in plain English for a camera store's buyers, without marketing superlatives. " +
            "Put anything uncertain in notes.";

        public const string PricesQuestion =
            "What are this product's current selling prices at US retailers? List each retailer once with its price for a new unit, " +
            "the product page URL, whether it is in stock, and the date the price was seen.";

        public const string PricesInstructions =
            "Reply with ONE JSON object and nothing else, in this shape: " +
            "{\"prices\":[{\"retailer\":\"\",\"price\":0,\"currency\":\"USD\",\"url\":\"\",\"inStock\":true,\"seenOn\":\"YYYY-MM-DD\",\"condition\":\"new\"}]," +
            "\"lowest\":0,\"typical\":0,\"summary\":\"\"}. " +
            "Only list prices you found on a page, for this exact product (not a kit or bundle unless it is the same product code). " +
            "price is a number without a currency sign; use null for inStock when the page doesn't say. " +
            "typical is the most common price; summary is one or two sentences on where the street price sits and any MAP pattern.";

        // ------------------------------------------------------------ parsing

        /* The JSON object in an answer: a ```json block, else the outermost {...}. Null when there is none. */
        public static JsonObject ExtractJson(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return null;
            var fence = Regex.Match(text, "```(?:json)?\\s*(\\{[\\s\\S]*?\\})\\s*```", RegexOptions.IgnoreCase);
            var candidate = fence.Success ? fence.Groups[1].Value : null;
            if (candidate == null)
            {
                var start = text.IndexOf('{');
                var end = text.LastIndexOf('}');
                if (start < 0 || end <= start) return null;
                candidate = text.Substring(start, end - start + 1);
            }
            try
            {
                return JsonNode.Parse(candidate, documentOptions: new JsonDocumentOptions
                {
                    AllowTrailingCommas = true,
                    CommentHandling = JsonCommentHandling.Skip
                }) as JsonObject;
            }
            catch (JsonException)
            {
                return null;
            }
        }

        public static void FillLookup(ProductLookupResult r, string text)
        {
            var o = ExtractJson(text);
            if (o == null) { r.RawText = text; return; }

            r.Name = S(o["name"]);
            r.ShortDescription = S(o["shortDescription"]);
            r.Description = S(o["description"]);
            r.Features = Strings(o["features"]);
            r.Specs = (o["specs"] as JsonArray ?? new JsonArray())
                .Select(x => new LookupSpec { Label = S(x?["label"]), Value = S(x?["value"]) })
                .Where(x => !string.IsNullOrWhiteSpace(x.Label) && !string.IsNullOrWhiteSpace(x.Value))
                .ToList();
            r.Upc = Digits(S(o["upc"]), 12);
            r.UpcSource = Int(o["upcSource"]);
            r.Ean = Digits(S(o["ean"]), 13);
            r.Images = (o["images"] as JsonArray ?? new JsonArray())
                .Select(x => new LookupImage { Url = S(x?["url"]), Source = Int(x?["source"]), Description = S(x?["description"]) })
                .Where(x => Uri.TryCreate(x.Url, UriKind.Absolute, out var u) && (u.Scheme == "https" || u.Scheme == "http"))
                .GroupBy(x => x.Url).Select(g => g.First())
                .Take(20)
                .ToList();
            r.Notes = Strings(o["notes"]);
        }

        public static void FillPrices(CompetitorPriceResult r, string text)
        {
            var o = ExtractJson(text);
            if (o == null) { r.RawText = text; return; }

            r.Prices = (o["prices"] as JsonArray ?? new JsonArray())
                .Select(x => new CompetitorPrice
                {
                    Retailer = S(x?["retailer"]),
                    Price = Dec(x?["price"]),
                    Currency = string.IsNullOrWhiteSpace(S(x?["currency"])) ? "USD" : S(x?["currency"]).ToUpperInvariant(),
                    Url = S(x?["url"]),
                    InStock = Bool(x?["inStock"]),
                    SeenOn = S(x?["seenOn"]),
                    Condition = S(x?["condition"])
                })
                .Where(x => !string.IsNullOrWhiteSpace(x.Retailer) && x.Price is > 0)
                .OrderBy(x => x.Price)
                .ToList();
            r.Lowest = Dec(o["lowest"]) is > 0 and var lo ? lo : r.Prices.Select(p => p.Price).Min();
            r.Typical = Dec(o["typical"]) is > 0 and var ty ? ty : Median(r.Prices.Select(p => p.Price.Value).ToList());
            r.Summary = S(o["summary"]);
        }

        private static decimal? Median(List<decimal> v)
        {
            if (v.Count == 0) return null;
            v.Sort();
            return v.Count % 2 == 1 ? v[v.Count / 2] : Math.Round((v[v.Count / 2 - 1] + v[v.Count / 2]) / 2, 2);
        }

        /* A UPC or EAN only when it is exactly the right number of digits (never a guess or a partial code). */
        private static string Digits(string s, int n)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            var d = new string(s.Where(char.IsDigit).ToArray());
            return d.Length == n ? d : null;
        }

        private static List<string> Strings(JsonNode n) =>
            (n as JsonArray ?? new JsonArray()).Select(S).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).ToList();

        private static string S(JsonNode n)
        {
            if (n is not JsonValue v) return null;
            if (v.TryGetValue<string>(out var s)) return string.IsNullOrWhiteSpace(s) ? null : s.Trim();
            return v.ToJsonString();
        }

        private static int? Int(JsonNode n)
        {
            if (n is not JsonValue v) return null;
            if (v.TryGetValue<int>(out var i)) return i;
            if (v.TryGetValue<double>(out var d)) return (int)d;
            return v.TryGetValue<string>(out var s) && int.TryParse(s, out var p) ? p : null;
        }

        private static decimal? Dec(JsonNode n)
        {
            if (n is not JsonValue v) return null;
            if (v.TryGetValue<decimal>(out var m)) return m;
            if (v.TryGetValue<double>(out var d)) return (decimal)d;
            if (v.TryGetValue<string>(out var s))
            {
                var clean = new string(s.Where(c => char.IsDigit(c) || c == '.').ToArray());
                if (decimal.TryParse(clean, NumberStyles.Number, CultureInfo.InvariantCulture, out var p)) return p;
            }
            return null;
        }

        private static bool? Bool(JsonNode n)
        {
            if (n is not JsonValue v) return null;
            if (v.TryGetValue<bool>(out var b)) return b;
            if (v.TryGetValue<string>(out var s))
            {
                s = s.Trim().ToLowerInvariant();
                if (s is "true" or "yes" or "in stock") return true;
                if (s is "false" or "no" or "out of stock") return false;
            }
            return null;
        }

        // ------------------------------------------------------------ snapshots

        private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = true };

        public static string LookupMarkdown(AiProductContext p, ProductLookupResult r, IEnumerable<ResearchSource> sources)
        {
            var sb = Header("Product lookup", p, r.CalledAt, r.UserName, r.Model, r.CostUsd, r.CostIsEstimate);
            if (r.RawText != null) { sb.AppendLine("## Answer"); sb.AppendLine(); sb.AppendLine(r.RawText); }
            else
            {
                if (r.Name != null) sb.AppendLine($"**Name:** {r.Name}\n");
                if (r.ShortDescription != null) sb.AppendLine($"**Short description:** {r.ShortDescription}\n");
                if (r.Description != null) { sb.AppendLine("## Description"); sb.AppendLine(); sb.AppendLine(r.Description); sb.AppendLine(); }
                if (r.Features.Count > 0) { sb.AppendLine("## Features"); sb.AppendLine(); r.Features.ForEach(f => sb.AppendLine($"- {f}")); sb.AppendLine(); }
                if (r.Specs.Count > 0) { sb.AppendLine("## Specifications"); sb.AppendLine(); r.Specs.ForEach(s => sb.AppendLine($"- **{s.Label}:** {s.Value}")); sb.AppendLine(); }
                sb.AppendLine($"**UPC:** {r.Upc ?? "not found"}{(r.UpcSource is int n ? $" [{n}]" : "")}  ");
                sb.AppendLine($"**EAN:** {r.Ean ?? "not found"}\n");
                if (r.Images.Count > 0) { sb.AppendLine("## Images"); sb.AppendLine(); r.Images.ForEach(i => sb.AppendLine($"- {i.Url}{(i.Source is int s ? $" [{s}]" : "")}")); sb.AppendLine(); }
                if (r.Notes.Count > 0) { sb.AppendLine("## Notes"); sb.AppendLine(); r.Notes.ForEach(x => sb.AppendLine($"- {x}")); sb.AppendLine(); }
            }
            Footer(sb, sources, r);
            return sb.ToString();
        }

        public static string PricesMarkdown(AiProductContext p, CompetitorPriceResult r, IEnumerable<ResearchSource> sources)
        {
            var sb = Header("Competitor prices", p, r.CalledAt, r.UserName, r.Model, r.CostUsd, r.CostIsEstimate);
            if (r.RawText != null) { sb.AppendLine("## Answer"); sb.AppendLine(); sb.AppendLine(r.RawText); }
            else
            {
                if (r.Summary != null) { sb.AppendLine(r.Summary); sb.AppendLine(); }
                sb.AppendLine($"**Lowest:** {Money(r.Lowest)} · **Typical:** {Money(r.Typical)}\n");
                sb.AppendLine("| Retailer | Price | In stock | Seen | Link |");
                sb.AppendLine("|---|---|---|---|---|");
                foreach (var x in r.Prices)
                    sb.AppendLine($"| {x.Retailer} | {Money(x.Price)} {x.Currency} | {(x.InStock == null ? "?" : x.InStock.Value ? "Yes" : "No")} | {x.SeenOn} | {x.Url} |");
                sb.AppendLine();
            }
            Footer(sb, sources, r);
            return sb.ToString();
        }

        private static string Money(decimal? d) => d is decimal v ? v.ToString("$#,##0.00", CultureInfo.InvariantCulture) : "—";

        private static StringBuilder Header(string title, AiProductContext p, DateTime atUtc, string user, string model, decimal cost, bool estimate)
        {
            var eastern = TimeZoneInfo.ConvertTimeFromUtc(atUtc, Eastern());
            var sb = new StringBuilder();
            sb.AppendLine($"# {title}: {p.BrandName} {p.ModelName} ({p.ProductCode})".Replace("  ", " "));
            sb.AppendLine();
            sb.AppendLine($"- **Run:** {eastern:MMM d, yyyy h:mm tt} ET by {user}");
            sb.AppendLine($"- **Model:** {model}");
            sb.AppendLine($"- **Cost:** ${cost:0.0000}{(estimate ? " (estimated)" : "")}");
            sb.AppendLine();
            return sb;
        }

        private static void Footer(StringBuilder sb, IEnumerable<ResearchSource> sources, object data)
        {
            var list = sources?.OrderBy(s => s.Number).ToList() ?? new List<ResearchSource>();
            if (list.Count > 0)
            {
                sb.AppendLine("## Sources");
                sb.AppendLine();
                foreach (var s in list)
                    sb.AppendLine($"{s.Number}. [{(string.IsNullOrWhiteSpace(s.Title) ? s.Url : s.Title)}]({s.Url}){(string.IsNullOrWhiteSpace(s.Date) ? "" : $" ({s.Date})")}");
                sb.AppendLine();
            }
            sb.AppendLine("_AI lookup. Check the sources before using it._");
            sb.AppendLine();
            sb.AppendLine("<!-- data: what the Product Desk shows when this snapshot is opened again -->");
            sb.AppendLine("```json");
            sb.AppendLine(JsonSerializer.Serialize(data, data.GetType(), Json));
            sb.AppendLine("```");
        }

        /* Reopens a saved snapshot: the data block at the end of the Markdown. */
        public static T FromMarkdown<T>(string markdown) where T : class
        {
            if (string.IsNullOrEmpty(markdown)) return null;
            var at = markdown.LastIndexOf("```json", StringComparison.Ordinal);
            if (at < 0) return null;
            var end = markdown.IndexOf("```", at + 7, StringComparison.Ordinal);
            if (end < 0) return null;
            try { return JsonSerializer.Deserialize<T>(markdown.Substring(at + 7, end - at - 7), Json); }
            catch (JsonException) { return null; }
        }

        private static TimeZoneInfo Eastern()
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById("America/New_York"); }
            catch { return TimeZoneInfo.FindSystemTimeZoneById("Eastern Standard Time"); }
        }
    }
}
