#nullable disable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using ProInternal.Models.Ai;

namespace ProInternal.Services.Ai
{
    /*
     * Market research through Perplexity's Agent API (POST /v1/agent), which replaced Sonar Chat
     * Completions in September 2026. The answer comes back with numbered web sources.
     *
     * appsettings.json (keep the key in Secrets Manager, not in the file):
     *   "Perplexity": {
     *     "ApiKey": "...",
     *     "BaseUrl": "https://api.perplexity.ai",   (optional)
     *     "Preset": "fast",                          (optional; fast | low | medium | high)
     *     "MaxOutputTokens": 1500                    (optional)
     *   }
     */
    public sealed class PerplexityResearchService
    {
        private readonly IHttpClientFactory _http;
        private readonly IConfiguration _config;

        public PerplexityResearchService(IHttpClientFactory http, IConfiguration config)
        {
            _http = http;
            _config = config;
        }

        public static readonly IReadOnlyDictionary<string, string> Topics = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["COMPETITORS"] = "Who are the main competing products and brands for this product, and how do they compare on features and price? Include direct alternatives a camera store would stock.",
            ["REVIEWS"]     = "What do reviewers and buyers say about this product? Summarise the praise and the common complaints, and note any reliability or compatibility problems.",
            ["PRICING"]     = "What is the typical street price in the US right now, and at which major retailers? Give the price, the retailer and the date you found it.",
            ["MARKET"]      = "What are the trends in this product's category, and is anything new launching or being discontinued that a buyer should know about?"
        };

        public bool Configured => !string.IsNullOrWhiteSpace(_config["Perplexity:ApiKey"]);

        public async Task<ResearchAnswer> AskAsync(AiProductContext product, string question, CancellationToken cancellationToken)
        {
            var apiKey = _config["Perplexity:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
                throw new InvalidOperationException("Market research isn't set up: Perplexity:ApiKey is missing.");

            var baseUrl = (_config["Perplexity:BaseUrl"] ?? "https://api.perplexity.ai").TrimEnd('/');
            var preset = _config["Perplexity:Preset"] ?? "fast";
            var maxTokens = _config.GetValue("Perplexity:MaxOutputTokens", 1500);

            var instructions =
                "You are a market research assistant for ProMaster, a US distributor of photo and imaging products that sells to camera stores. " +
                "Answer for a buyer deciding what to stock and at what price. Be factual and specific, use short sections and bullet points, " +
                "cite every fact with the numbered sources, and say plainly when something can't be found. Give prices in US dollars with the retailer and date. " +
                "Do not invent product codes, prices or specifications.";

            var input = new StringBuilder();
            input.AppendLine($"Product: {product.BrandName} {product.ModelName}".Trim());
            input.AppendLine($"ProMaster product code: {product.ProductCode}");
            if (!string.IsNullOrWhiteSpace(product.UPC)) input.AppendLine($"UPC: {product.UPC}");
            if (!string.IsNullOrWhiteSpace(product.CategoryPath)) input.AppendLine($"Category: {product.CategoryPath}");
            if (product.IsDiscontinued) input.AppendLine("This product is discontinued at ProMaster.");
            input.AppendLine();
            input.AppendLine($"Question: {question}");

            var body = new JsonObject
            {
                ["preset"] = preset,
                ["instructions"] = instructions,
                ["input"] = input.ToString(),
                ["max_output_tokens"] = maxTokens
            };

            var client = _http.CreateClient("Perplexity");
            client.Timeout = TimeSpan.FromSeconds(120);
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/v1/agent")
            {
                Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json")
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            using var response = await client.SendAsync(request, cancellationToken);
            var raw = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException($"Perplexity answered {(int)response.StatusCode}: {Trim(raw, 300)}");

            return Parse(raw, preset);
        }

        /* Agent API response: output[] holds a "message" item (content[].text) and a "search_results" item (results[]). */
        public static ResearchAnswer Parse(string raw, string preset)
        {
            var root = JsonNode.Parse(raw) as JsonObject ?? throw new InvalidOperationException("Perplexity sent an empty answer.");
            var answer = new ResearchAnswer();

            var text = new StringBuilder();
            foreach (var item in root["output"] as JsonArray ?? new JsonArray())
            {
                var type = S(item?["type"]);
                if (type == "message")
                {
                    foreach (var c in item["content"] as JsonArray ?? new JsonArray())
                    {
                        if (S(c?["type"]) == "output_text") text.Append(S(c["text"]));
                    }
                }
                else if (type == "search_results")
                {
                    var n = 0;
                    foreach (var r in item["results"] as JsonArray ?? new JsonArray())
                    {
                        n++;
                        answer.Sources.Add(new ResearchSource
                        {
                            Number = r?["id"] is JsonValue idv && idv.TryGetValue<int>(out var id) ? id : n,
                            Title = S(r?["title"]),
                            Url = S(r?["url"]),
                            Date = r?["date"]?.ToString()
                        });
                    }
                }
            }
            if (text.Length == 0 && root["output_text"] is JsonValue ot) text.Append(S(ot));
            answer.Text = text.ToString().Trim();
            if (answer.Text.Length == 0) throw new InvalidOperationException("Perplexity didn't return an answer.");

            var model = S(root["model"]);
            answer.Model = $"Perplexity Agent ({preset})" + (string.IsNullOrWhiteSpace(model) ? "" : $" · {model}");
            answer.ReportedCostUsd = Cost(root);
            return answer;
        }

        /* Perplexity reports cost in USD in usage.cost.total_cost (Sonar); accept a few shapes, else null (estimate is logged). */
        private static decimal? Cost(JsonObject root)
        {
            JsonNode[] candidates =
            {
                root["usage"]?["cost"]?["total_cost"],
                root["usage"]?["total_cost"],
                root["cost"]?["total_cost"],
                root["usage"]?["cost"]
            };
            foreach (var c in candidates)
            {
                if (c is JsonValue v)
                {
                    if (v.TryGetValue<decimal>(out var d)) return d;
                    if (v.TryGetValue<double>(out var dbl)) return (decimal)dbl;
                    if (v.TryGetValue<string>(out var s) && decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var ps)) return ps;
                }
            }
            return null;
        }

        /* A JSON value as text, whatever its type; null when missing. */
        private static string S(JsonNode n) => n is JsonValue v ? (v.TryGetValue<string>(out var s) ? s : v.ToJsonString()) : null;

        private static string Trim(string s, int max) => string.IsNullOrEmpty(s) || s.Length <= max ? s : s[..max] + "…";

        /* The snapshot saved to the product: readable on its own, with everything needed to trust it. */
        public static string ToMarkdown(AiProductContext p, string question, string topic, ResearchAnswer a, string user, DateTime atUtc, decimal cost, bool estimate)
        {
            var eastern = TimeZoneInfo.ConvertTimeFromUtc(atUtc, Eastern());
            var sb = new StringBuilder();
            sb.AppendLine($"# Market research: {p.BrandName} {p.ModelName} ({p.ProductCode})".Replace("  ", " "));
            sb.AppendLine();
            sb.AppendLine($"- **Question:** {question}");
            if (!string.IsNullOrWhiteSpace(topic)) sb.AppendLine($"- **Topic:** {topic.ToLowerInvariant()}");
            sb.AppendLine($"- **Asked:** {eastern:MMM d, yyyy h:mm tt} ET by {user}");
            sb.AppendLine($"- **Model:** {a.Model}");
            sb.AppendLine($"- **Cost:** ${cost:0.0000}{(estimate ? " (estimated)" : "")}");
            sb.AppendLine();
            sb.AppendLine("## Answer");
            sb.AppendLine();
            sb.AppendLine(a.Text);
            if (a.Sources.Count > 0)
            {
                sb.AppendLine();
                sb.AppendLine("## Sources");
                sb.AppendLine();
                foreach (var s in a.Sources.OrderBy(x => x.Number))
                    sb.AppendLine($"{s.Number}. [{(string.IsNullOrWhiteSpace(s.Title) ? s.Url : s.Title)}]({s.Url}){(string.IsNullOrWhiteSpace(s.Date) ? "" : $" ({s.Date})")}");
            }
            sb.AppendLine();
            sb.AppendLine("_AI research. Check the sources before acting on it._");
            return sb.ToString();
        }

        private static TimeZoneInfo Eastern()
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById("America/New_York"); }
            catch { try { return TimeZoneInfo.FindSystemTimeZoneById("Eastern Standard Time"); } catch { return TimeZoneInfo.Utc; } }
        }
    }
}
