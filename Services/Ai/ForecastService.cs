#nullable disable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Amazon;
using Amazon.BedrockRuntime;
using Amazon.BedrockRuntime.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ProInternal.Models.Ai;

namespace ProInternal.Services.Ai
{
    /*
     * Sales forecast for one product, for buyers.
     *
     *   1. History: units per month and country, last 36 complete months (piv2.Forecast_History).
     *   2. Forecast the product's total with ForecastEngine (built into the API, $0).
     *   3. Split the total by country using each country's share of the last 12 months.
     *   4. Claude (Bedrock) writes a short summary for the buyer.
     *   5. The run is logged to piv2.AiUsageLog (who, when, model, summary) and every month is
     *      saved to piv2.ProductForecast, so it can be compared with what actually sold.
     *
     * appsettings (optional):
     *   "Forecast": { "HistoryMonths": 36 }
     *   "Bedrock":  { "Region": "us-east-1", "SummaryModel": "us.anthropic.claude-sonnet-5-5" }
     */
    public sealed class ForecastService
    {
        private const string DefaultSummaryModel = "us.anthropic.claude-sonnet-5-5";

        private readonly IProDataAccess _db;
        private readonly AiGovernance _governance;
        private readonly IConfiguration _config;
        private readonly ILogger<ForecastService> _log;

        public ForecastService(IProDataAccess db, AiGovernance governance, IConfiguration config,
                               ILogger<ForecastService> log)
        {
            _db = db;
            _governance = governance;
            _config = config;
            _log = log;
        }

        public ForecastView View(int productId)
        {
            var view = _db.Forecast_Runs(productId);
            view.History = _db.Forecast_History(productId, _config.GetValue("Forecast:HistoryMonths", 36));
            return view;
        }

        public async Task<ForecastRun> RunAsync(ClaimsPrincipal user, int productId, int horizon, decimal estimatedCost, CancellationToken ct)
        {
            horizon = horizon <= 3 ? 3 : horizon <= 6 ? 6 : 12;
            var history = _db.Forecast_History(productId, _config.GetValue("Forecast:HistoryMonths", 36));
            var product = _db.Ai_ProductContext(productId) ?? throw new InvalidOperationException("That product doesn't exist.");

            /* every complete month in the window, oldest first, zeros where nothing sold */
            var thisMonth = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);
            var months = Enumerable.Range(1, _config.GetValue("Forecast:HistoryMonths", 36))
                                   .Select(i => thisMonth.AddMonths(-i)).Reverse().ToList();
            var byMonth = history.GroupBy(h => h.MonthStart).ToDictionary(g => g.Key, g => (double)g.Sum(x => x.Units));
            var series = months.Select(m => byMonth.TryGetValue(m, out var u) ? u : 0d).ToList();

            /* the forecast for the total */
            var (method, errorPct, points, engineModel) = ForecastTotal(series, horizon);

            /* country split by the last 12 months */
            var recent = history.Where(h => h.MonthStart >= thisMonth.AddMonths(-12)).ToList();
            if (recent.Sum(h => h.Units) <= 0) recent = history;
            var total = (double)recent.Sum(h => h.Units);
            var shares = total > 0
                ? recent.GroupBy(h => h.Country).Select(g => (Country: g.Key, Share: (double)g.Sum(x => x.Units) / total))
                        .Where(x => x.Share > 0).OrderByDescending(x => x.Share).ToList()
                : new List<(string Country, double Share)>();

            var rows = new List<ForecastPoint>();
            for (var i = 0; i < points.Count; i++)
            {
                var month = thisMonth.AddMonths(i);
                rows.Add(new ForecastPoint { Country = "ALL", MonthStart = month, Likely = D(points[i].Likely), Low = D(points[i].Low), High = D(points[i].High), Method = method });
                if (shares.Count > 1)
                {
                    foreach (var (country, share) in shares)
                        rows.Add(new ForecastPoint
                        {
                            Country = country, MonthStart = month,
                            Likely = D(points[i].Likely * share), Low = D(points[i].Low * share), High = D(points[i].High * share),
                            Method = $"{method}, {share:P0} of total"
                        });
                }
            }

            /* the buyer summary */
            string summary = null, summaryModel = null;
            try
            {
                (summary, summaryModel) = await SummaryAsync(product, months, series, rows.Where(r => r.Country == "ALL").ToList(), method, errorPct, shares, ct);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Forecast summary failed for product {ProductId}", productId);
            }
            summary ??= AutoSummary(rows.Where(r => r.Country == "ALL").ToList(), method, errorPct, shares);

            var model = $"{engineModel}{(errorPct > 0 ? $" (backtest error {errorPct:0}%)" : "")}"
                        + (summaryModel != null ? $" + {summaryModel}" : "");
            var question = $"Forecast {horizon} months";

            var usageId = _governance.Log(user, "FORECAST", model, productId, 1, null, true, question, Trim(summary, 1000));
            _db.Forecast_Save(usageId, productId, JsonSerializer.Serialize(rows.Select(r => new
            {
                country = r.Country,
                month = r.MonthStart.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                likely = r.Likely, low = r.Low, high = r.High, method = Trim(r.Method, 80)
            })));

            return new ForecastRun
            {
                UsageId = usageId,
                CalledAt = DateTime.UtcNow,
                UserName = Helpers.Security.Permissions.UserName(user),
                Model = model,
                CostUsd = estimatedCost,
                CostIsEstimate = true,
                Question = question,
                Summary = summary,
                Months = horizon,
                Points = rows.Select(r => { r.UsageId = usageId; return r; }).ToList()
            };
        }

        // ------------------------------------------------------------ engines

        private static (string Method, double ErrorPct, List<ForecastEngine.Point> Points, string Model) ForecastTotal(
            List<double> series, int horizon)
        {
            var r = ForecastEngine.Forecast(series, horizon);
            return (r.Method, r.BacktestErrorPct, r.Points, $"PIV2 forecast · {r.Method}");
        }

        private async Task<(string Text, string Model)> SummaryAsync(
            AiProductContext p, List<DateTime> months, List<double> series, List<ForecastPoint> forecast,
            string method, double errorPct, List<(string Country, double Share)> shares, CancellationToken ct)
        {
            var modelId = _config["Bedrock:SummaryModel"] is { Length: > 0 } m ? m : DefaultSummaryModel;
            var region = _config["Bedrock:Region"];
            using var client = new AmazonBedrockRuntimeClient(RegionEndpoint.GetBySystemName(string.IsNullOrWhiteSpace(region) ? "us-east-1" : region));

            var sb = new StringBuilder();
            sb.AppendLine($"Product: {p.BrandName} {p.ModelName} (code {p.ProductCode}){(p.IsDiscontinued ? ", discontinued" : "")}");
            sb.AppendLine("Units sold per month, oldest first:");
            sb.AppendLine(string.Join(", ", months.Zip(series, (mo, v) => $"{mo:MMM yy} {v:0}")));
            sb.AppendLine($"Forecast method: {method}; it missed by {errorPct:0}% on average when tested on the last months of history.");
            sb.AppendLine("Forecast (likely, with an 80% range):");
            sb.AppendLine(string.Join(", ", forecast.Select(f => $"{f.MonthStart:MMM yy} {f.Likely:0} ({f.Low:0}–{f.High:0})")));
            if (shares.Count > 0) sb.AppendLine("Share by country, last 12 months: " + string.Join(", ", shares.Select(s => $"{s.Country} {s.Share:P0}")));

            var request = new ConverseRequest
            {
                ModelId = modelId,
                System = new List<SystemContentBlock> { new SystemContentBlock { Text =
                    "You write sales forecast notes for buyers at ProMaster, a US photo and imaging distributor. " +
                    "In 3 to 5 short sentences of plain text: the expected units over the period and per month, the trend versus last year, " +
                    "seasonality worth planning for, how confident to be (use the error and the range), and the country mix if more than one. " +
                    "Use only the numbers given. No headings, no bullet points, no advice about anything not in the data." } },
                Messages = new List<Message>
                {
                    new Message { Role = ConversationRole.User, Content = new List<ContentBlock> { new ContentBlock { Text = sb.ToString() } } }
                },
                InferenceConfig = new InferenceConfiguration { MaxTokens = 400 }
            };

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(30));
            var response = await client.ConverseAsync(request, timeout.Token);
            var text = string.Concat(response.Output?.Message?.Content?.Select(c => c.Text ?? "") ?? Enumerable.Empty<string>()).Trim();
            return (string.IsNullOrWhiteSpace(text) ? null : text, $"Claude ({modelId})");
        }

        private static string AutoSummary(List<ForecastPoint> f, string method, double errorPct, List<(string Country, double Share)> shares)
        {
            if (f.Count == 0) return null;
            var total = f.Sum(x => x.Likely);
            var text = $"About {total:0} units over {f.Count} months ({f.Average(x => x.Likely):0.#} a month), " +
                       $"likely between {f.Sum(x => x.Low):0} and {f.Sum(x => x.High):0}. Method: {method}";
            if (errorPct > 0) text += $", which missed by {errorPct:0}% on average in testing";
            text += ".";
            if (shares.Count > 1) text += " Country mix: " + string.Join(", ", shares.Select(s => $"{s.Country} {s.Share:P0}")) + ".";
            return text;
        }

        private static decimal D(double v) => Math.Round((decimal)Math.Max(0, v), 1);
        private static string Trim(string s, int max) => string.IsNullOrEmpty(s) || s.Length <= max ? s : s[..max];
    }
}
