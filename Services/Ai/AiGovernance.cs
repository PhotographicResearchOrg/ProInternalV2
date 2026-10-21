#nullable disable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers.Security;
using ProInternal.Models.Ai;

namespace ProInternal.Services.Ai
{
    /*
     * Keeps AI spend under control. Every AI feature asks Check() before it calls a provider,
     * and Log() after, win or lose. Nothing here talks to a provider.
     *
     *   1. AI is on, and the feature is on                      appsettings  AI:Enabled, AI:Features:<Key>:Enabled
     *   2. the user holds the feature's permission              Security Admin, e.g. AI.MarketResearch
     *                                                           (always enforced, whatever Security:Mode says)
     *   3. this month's AI spend + this call stays in budget    AI:MonthlyBudgetUsd
     *   4. the user is under the feature's daily limit          AI:Features:<Key>:DailyLimitPerUser
     *
     * appsettings.json (every value optional; the defaults are shown):
     *   "AI": {
     *     "Enabled": true,
     *     "MonthlyBudgetUsd": 100,
     *     "Features": {
     *       "MarketResearch":    { "Enabled": true,  "Model": "Perplexity Agent (fast)", "EstimatedCostUsd": 0.03, "DailyLimitPerUser": 25 },
     *       "Translate":         { "Enabled": true,  "Model": "Claude on Bedrock",       "EstimatedCostUsd": 0.02, "DailyLimitPerUser": 100 },
     *       "ProductLookup":     { "Enabled": false },
     *       "CompetitorPricing": { "Enabled": false },
     *       "Forecast":          { "Enabled": true,  "Model": "PIV2 forecast + Claude on Bedrock", "EstimatedCostUsd": 0.01, "DailyLimitPerUser": 100 }
     *     }
     *   }
     * EstimatedCostUsd is per item (per product, per language). When a provider reports the real
     * cost (Perplexity does), the real cost is logged instead.
     */
    public sealed class AiGovernance
    {
        public sealed record Feature(string Key, string ConfigKey, string Permission, string Label, string Provider,
                                     string DefaultModel, decimal DefaultCost, int DefaultDailyLimit, bool DefaultEnabled);

        public const string UsagePermission = "AI.Usage";

        public static readonly IReadOnlyDictionary<string, Feature> Features = new[]
        {
            new Feature("MARKET_RESEARCH",    "MarketResearch",    "AI.MarketResearch",    "Market research",      "Perplexity", "Perplexity Agent (fast)", 0.03m, 25,  true),
            new Feature("TRANSLATE",          "Translate",         "AI.Translate",         "Translate",            "Bedrock",    "Claude on Bedrock",       0.02m, 100, true),
            new Feature("PRODUCT_LOOKUP",     "ProductLookup",     "AI.ProductLookup",     "Product lookup",       "Perplexity", "Perplexity Agent (fast)", 0.03m, 50,  false),
            new Feature("COMPETITOR_PRICING", "CompetitorPricing", "AI.CompetitorPricing", "Competitor pricing",   "DataForSEO", "Google Shopping",         0.05m, 50,  false),
            new Feature("FORECAST",           "Forecast",          "AI.Forecast",          "Forecast",             "Bedrock",    "PIV2 forecast + Claude on Bedrock", 0.01m, 100, true)
        }.ToDictionary(f => f.Key, StringComparer.OrdinalIgnoreCase);

        private readonly IConfiguration _config;
        private readonly IProDataAccess _db;

        public AiGovernance(IConfiguration config, IProDataAccess db)
        {
            _config = config;
            _db = db;
        }

        private bool AiEnabled => _config.GetValue("AI:Enabled", true);
        public decimal BudgetUsd => _config.GetValue("AI:MonthlyBudgetUsd", 100m);

        private T Setting<T>(Feature f, string name, T fallback) => _config.GetValue($"AI:Features:{f.ConfigKey}:{name}", fallback);

        public string ModelFor(string featureKey)
        {
            var f = Features[featureKey];
            return Setting(f, "Model", f.DefaultModel);
        }

        /* May this user run the feature now, for this many items? */
        public AiGate Check(ClaimsPrincipal user, string featureKey, int items = 1)
        {
            var f = Features[featureKey];
            var gate = new AiGate
            {
                Feature = f.Key,
                Label = f.Label,
                Provider = f.Provider,
                Model = Setting(f, "Model", f.DefaultModel),
                EstimatedCostUsd = Math.Round(Setting(f, "EstimatedCostUsd", f.DefaultCost) * Math.Max(1, items), 4),
                BudgetUsd = BudgetUsd,
                DailyLimit = Setting(f, "DailyLimitPerUser", f.DefaultDailyLimit)
            };

            if (!AiEnabled) return Deny(gate, "AI is switched off.");
            if (!Setting(f, "Enabled", f.DefaultEnabled)) return Deny(gate, $"{f.Label} isn't switched on yet.");
            if (!Permissions.HasAny(user, f.Permission)) return Deny(gate, $"You need {f.Permission} in Security Admin.");

            var usage = _db.Ai_UsageCheck(f.Key, Permissions.UserName(user));
            gate.MonthCostUsd = usage.MonthCostUsd;
            gate.UserTodayCalls = usage.UserTodayCalls;

            if (usage.MonthCostUsd + gate.EstimatedCostUsd > gate.BudgetUsd)
                return Deny(gate, $"This month's AI budget is used (${usage.MonthCostUsd:0.00} of ${gate.BudgetUsd:0.00}). It resets on the 1st, or ask for a higher budget.");
            if (usage.UserTodayCalls >= gate.DailyLimit)
                return Deny(gate, $"You've reached today's limit for {f.Label.ToLowerInvariant()} ({gate.DailyLimit}). It resets at midnight.");

            gate.Allowed = true;
            return gate;
        }

        public AiStatus Status(ClaimsPrincipal user)
        {
            var status = new AiStatus
            {
                Enabled = AiEnabled,
                BudgetUsd = BudgetUsd,
                CanSeeUsage = Permissions.HasAny(user, UsagePermission)
            };
            foreach (var f in Features.Values)
            {
                var gate = Check(user, f.Key);
                status.Features.Add(gate);
                status.MonthCostUsd = Math.Max(status.MonthCostUsd, gate.MonthCostUsd);
            }
            return status;
        }

        public long Log(ClaimsPrincipal user, string featureKey, string model, int? productId, int items,
                        decimal? reportedCostUsd, bool ok, string question = null, string detail = null, long? fileId = null)
        {
            var f = Features[featureKey];
            var estimate = Setting(f, "EstimatedCostUsd", f.DefaultCost) * Math.Max(1, items);
            return _db.Ai_UsageLog(
                Permissions.UserName(user), f.Key, f.Provider, string.IsNullOrWhiteSpace(model) ? ModelFor(f.Key) : model,
                productId, Math.Max(1, items),
                ok ? (reportedCostUsd ?? estimate) : (reportedCostUsd ?? 0m),
                reportedCostUsd == null,
                ok ? "OK" : "FAILED", question, detail, fileId);
        }

        private static AiGate Deny(AiGate gate, string reason)
        {
            gate.Allowed = false;
            gate.Reason = reason;
            return gate;
        }
    }
}
