#nullable disable
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ProInternal.Helpers.Security;
using ProInternal.Models.Ai;
using ProInternal.Services;
using ProInternal.Services.Ai;
using ProInternal.Services.Files;

namespace ProInternal.Controllers
{
    /*
     * AI on the Product Desk, under control.
     *
     *   GET  api/ai/status                              what this user may run now, model, budget left
     *   GET  api/ai/products/{id}/research              the product's saved market research, newest first
     *   POST api/ai/products/{id}/research              ask Perplexity; the answer is saved to the product
     *   GET  api/ai/products/{id}/research/{fileId}     one saved answer (Markdown)
     *   GET  api/ai/products/{id}/forecast              sales history, saved forecasts with actuals
 *   POST api/ai/products/{id}/forecast              run a forecast (3, 6 or 12 months); saved to the product
 *   GET  api/ai/forecast/accuracy?from=&to=         how accurate past forecasts were (AI.Forecast or AI.Usage)
 *   GET  api/ai/usage?from=&to=                     usage and cost report (AI.Usage)
     *
     * Every call passes AiGovernance first (feature on, permission, monthly budget, daily limit)
     * and is written to piv2.AiUsageLog with the model that answered, success or failure.
     * Snapshots are stored in the File Library (category product-research, owner = product id).
     */
    [ApiController]
    [Route("api/ai")]
    public sealed class AiController : ControllerBase
    {
        private const string ResearchCategory = "product-research";

        private readonly AiGovernance _governance;
        private readonly PerplexityResearchService _perplexity;
        private readonly ForecastService _forecast;
        private readonly IProDataAccess _db;
        private readonly IFileLibrary _files;
        private readonly ILogger<AiController> _log;

        public AiController(AiGovernance governance, PerplexityResearchService perplexity, ForecastService forecast,
                            IProDataAccess db, IFileLibrary files, ILogger<AiController> log)
        {
            _governance = governance;
            _perplexity = perplexity;
            _forecast = forecast;
            _db = db;
            _files = files;
            _log = log;
        }

        private string Actor => Permissions.UserName(User);

        [HttpGet("status")]
        public ActionResult<AiStatus> Status() => _governance.Status(User);

        // ------------------------------------------------------------ market research

        [HttpGet("products/{productId:int}/research")]
        public ActionResult<List<ResearchSnapshot>> ResearchList(int productId)
        {
            if (!Permissions.HasAny(User, "AI.MarketResearch", AiGovernance.UsagePermission))
                return StatusCode(403, new { message = "You need AI.MarketResearch in Security Admin." });
            return _db.Ai_ResearchList(productId);
        }

        [HttpGet("products/{productId:int}/research/{fileId:long}")]
        public async Task<ActionResult<ResearchSnapshot>> ResearchGet(int productId, long fileId)
        {
            if (!Permissions.HasAny(User, "AI.MarketResearch", AiGovernance.UsagePermission))
                return StatusCode(403, new { message = "You need AI.MarketResearch in Security Admin." });

            var entry = await _files.GetAsync(fileId);
            if (entry == null || entry.Category != ResearchCategory || entry.OwnerKey != productId.ToString())
                return NotFound();

            using var stream = await _files.OpenAsync(fileId);
            using var reader = new StreamReader(stream, Encoding.UTF8);
            return new ResearchSnapshot
            {
                FileId = fileId,
                CalledAt = entry.UploadedAt,
                UserName = entry.UploadedBy,
                Question = entry.Notes,
                Markdown = await reader.ReadToEndAsync()
            };
        }

        [HttpPost("products/{productId:int}/research")]
        public async Task<ActionResult<ResearchSnapshot>> Research(int productId, [FromBody] ResearchRequest request, CancellationToken cancellationToken)
        {
            var topic = request?.Topic?.Trim().ToUpperInvariant();
            string question = request?.Question?.Trim();
            if (string.IsNullOrEmpty(question) && topic != null && PerplexityResearchService.Topics.TryGetValue(topic, out var preset))
                question = preset;
            if (string.IsNullOrEmpty(question))
                return BadRequest(new { message = "Ask a question, or pick a topic." });
            if (question.Length > 1000)
                return BadRequest(new { message = "Keep the question under 1,000 characters." });

            var gate = _governance.Check(User, "MARKET_RESEARCH");
            if (!gate.Allowed)
                return StatusCode(403, new { message = gate.Reason });

            var product = _db.Ai_ProductContext(productId);
            if (product == null) return NotFound(new { message = "That product doesn't exist." });

            ResearchAnswer answer;
            try
            {
                answer = await _perplexity.AskAsync(product, question, cancellationToken);
            }
            catch (Exception ex) when (ex is InvalidOperationException or System.Net.Http.HttpRequestException or TaskCanceledException)
            {
                _log.LogWarning(ex, "Market research failed for product {ProductId}", productId);
                _governance.Log(User, "MARKET_RESEARCH", null, productId, 1, null, false, question, Trim(ex.Message, 900));
                return StatusCode(502, new { message = "Market research didn't answer: " + Trim(ex.Message, 300) });
            }

            var cost = answer.ReportedCostUsd ?? gate.EstimatedCostUsd;
            var estimate = answer.ReportedCostUsd == null;
            var now = DateTime.UtcNow;
            var markdown = PerplexityResearchService.ToMarkdown(product, question, topic, answer, Actor, now, cost, estimate);

            /* Save first, then log with the file id, so every logged answer can be opened again. */
            long? fileId = null;
            try
            {
                var fileName = $"{now:yyyy-MM-dd HHmm} {(topic ?? "question").ToLowerInvariant()}.md";
                using var content = new MemoryStream(Encoding.UTF8.GetBytes(markdown));
                var entry = await _files.StoreAsync(content, ResearchCategory, productId.ToString(), fileName, "text/markdown", Actor, Trim(question, 900));
                fileId = entry.FileId;
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Couldn't save market research for product {ProductId}", productId);
            }

            var usageId = _governance.Log(User, "MARKET_RESEARCH", answer.Model, productId, 1, answer.ReportedCostUsd, true, question, topic, fileId);

            return new ResearchSnapshot
            {
                UsageId = usageId,
                FileId = fileId,
                CalledAt = now,
                UserName = Actor,
                Provider = "Perplexity",
                Model = answer.Model,
                CostUsd = cost,
                CostIsEstimate = estimate,
                Question = question,
                Detail = topic,
                Markdown = markdown
            };
        }

        // ------------------------------------------------------------ forecast

        [HttpGet("products/{productId:int}/forecast")]
        public ActionResult<ForecastView> Forecast(int productId)
        {
            if (!Permissions.HasAny(User, "AI.Forecast", AiGovernance.UsagePermission))
                return StatusCode(403, new { message = "You need AI.Forecast in Security Admin." });
            return _forecast.View(productId);
        }

        [HttpPost("products/{productId:int}/forecast")]
        public async Task<ActionResult<ForecastRun>> RunForecast(int productId, [FromBody] ForecastRequest request, CancellationToken cancellationToken)
        {
            var gate = _governance.Check(User, "FORECAST");
            if (!gate.Allowed)
                return StatusCode(403, new { message = gate.Reason });

            try
            {
                return await _forecast.RunAsync(User, productId, request?.Horizon ?? 6, gate.EstimatedCostUsd, cancellationToken);
            }
            catch (InvalidOperationException ex)
            {
                _governance.Log(User, "FORECAST", null, productId, 1, null, false, "Forecast", Trim(ex.Message, 900));
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("forecast/accuracy")]
        public ActionResult<List<ForecastAccuracyRow>> ForecastAccuracy([FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            if (!Permissions.HasAny(User, "AI.Forecast", AiGovernance.UsagePermission))
                return StatusCode(403, new { message = "You need AI.Forecast in Security Admin." });
            var end = to ?? DateTime.UtcNow.Date;
            var start = from ?? end.AddMonths(-12);
            if (end < start) (start, end) = (end, start);
            return _db.Forecast_Accuracy(start, end);
        }

        // ------------------------------------------------------------ usage report

        [HttpGet("usage")]
        [RequirePermission(AiGovernance.UsagePermission, AlwaysEnforce = true)]
        public ActionResult<List<AiUsageRow>> Usage([FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            var end = to ?? DateTime.UtcNow.Date;
            var start = from ?? new DateTime(end.Year, end.Month, 1);
            if (end < start) (start, end) = (end, start);
            if ((end - start).TotalDays > 400) start = end.AddDays(-400);
            return _db.Ai_UsageReport(start, end);
        }

        private static string Trim(string s, int max) => string.IsNullOrEmpty(s) || s.Length <= max ? s : s[..max];
    }
}
