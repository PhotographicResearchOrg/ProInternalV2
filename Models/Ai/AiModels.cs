#nullable disable
using System;
using System.Collections.Generic;

namespace ProInternal.Models.Ai
{
    /* ------------------------------------------------------------ governance */

    /* The answer to "may this user run this AI feature now?" */
    public class AiGate
    {
        public string Feature { get; set; }
        public string Label { get; set; }
        public bool Allowed { get; set; }
        public string Reason { get; set; }              // why not, in plain words
        public string Provider { get; set; }
        public string Model { get; set; }
        public decimal EstimatedCostUsd { get; set; }   // for this call
        public decimal MonthCostUsd { get; set; }       // all AI, this month
        public decimal BudgetUsd { get; set; }
        public int UserTodayCalls { get; set; }
        public int DailyLimit { get; set; }
    }

    public class AiStatus
    {
        public bool Enabled { get; set; }
        public decimal BudgetUsd { get; set; }
        public decimal MonthCostUsd { get; set; }
        public bool CanSeeUsage { get; set; }
        public List<AiGate> Features { get; set; } = new();
    }

    public class AiUsageCheck
    {
        public decimal MonthCostUsd { get; set; }
        public decimal FeatureMonthCostUsd { get; set; }
        public int UserTodayCalls { get; set; }
    }

    public class AiUsageRow
    {
        public long UsageId { get; set; }
        public DateTime CalledAt { get; set; }
        public string UserName { get; set; }
        public string Feature { get; set; }
        public string Provider { get; set; }
        public string Model { get; set; }
        public int? ProductId { get; set; }
        public string ProductCode { get; set; }
        public string ModelName { get; set; }
        public int Items { get; set; }
        public decimal CostUsd { get; set; }
        public bool CostIsEstimate { get; set; }
        public string Status { get; set; }
        public string Question { get; set; }
        public string Detail { get; set; }
    }

    /* ------------------------------------------------------------ market research */

    public class AiProductContext
    {
        public int ProductId { get; set; }
        public string ProductCode { get; set; }
        public string ModelName { get; set; }
        public string BrandName { get; set; }
        public string UPC { get; set; }
        public string VendorName { get; set; }
        public string CategoryPath { get; set; }
        public bool IsDiscontinued { get; set; }
    }

    public class ResearchRequest
    {
        public string Question { get; set; }
        public string Topic { get; set; }               // COMPETITORS | REVIEWS | PRICING | MARKET | null (own question)
    }

    public class ResearchSource
    {
        public int Number { get; set; }
        public string Title { get; set; }
        public string Url { get; set; }
        public string Date { get; set; }
    }

    public class ResearchAnswer
    {
        public string Text { get; set; }
        public List<ResearchSource> Sources { get; set; } = new();
        public string Model { get; set; }
        public decimal? ReportedCostUsd { get; set; }
    }

    /* One saved research answer (a dated snapshot in the product's files). */
    public class ResearchSnapshot
    {
        public long UsageId { get; set; }
        public long? FileId { get; set; }
        public DateTime CalledAt { get; set; }
        public string UserName { get; set; }
        public string Provider { get; set; }
        public string Model { get; set; }
        public decimal CostUsd { get; set; }
        public bool CostIsEstimate { get; set; }
        public string Question { get; set; }
        public string Detail { get; set; }              // topic
        public string Markdown { get; set; }            // filled when one snapshot is opened
    }

    /* ------------------------------------------------------------ forecast */

    public class ForecastRequest
    {
        public int Horizon { get; set; } = 6;            // 3, 6 or 12 months
    }

    public class SalesHistoryRow
    {
        public string Country { get; set; }
        public DateTime MonthStart { get; set; }
        public decimal Units { get; set; }
        public decimal Amount { get; set; }
    }

    public class ForecastPoint
    {
        public long UsageId { get; set; }
        public string Country { get; set; }               // ISO country, or ALL
        public DateTime MonthStart { get; set; }
        public decimal Likely { get; set; }
        public decimal Low { get; set; }
        public decimal High { get; set; }
        public string Method { get; set; }
        public decimal? Actual { get; set; }              // once the month has ended
    }

    public class ForecastRun
    {
        public long UsageId { get; set; }
        public DateTime CalledAt { get; set; }
        public string UserName { get; set; }
        public string Model { get; set; }
        public decimal CostUsd { get; set; }
        public bool CostIsEstimate { get; set; }
        public string Question { get; set; }
        public string Summary { get; set; }
        public int Months { get; set; }
        public List<ForecastPoint> Points { get; set; } = new();
    }

    public class ForecastView
    {
        public List<SalesHistoryRow> History { get; set; } = new();
        public List<ForecastRun> Runs { get; set; } = new();
    }

    public class ForecastAccuracyRow
    {
        public long UsageId { get; set; }
        public DateTime CalledAt { get; set; }
        public string UserName { get; set; }
        public string Model { get; set; }
        public string ProductCode { get; set; }
        public string ModelName { get; set; }
        public string BrandName { get; set; }
        public int MonthsScored { get; set; }
        public decimal Forecast { get; set; }
        public decimal Actual { get; set; }
        public decimal? ErrorPct { get; set; }
        public int MonthsInRange { get; set; }
    }
}
