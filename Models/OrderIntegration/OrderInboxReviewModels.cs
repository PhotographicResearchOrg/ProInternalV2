using System;
using System.Collections.Generic;

namespace ProInternal.Models.OrderIntegration
{
    /* One row of dbo.PIV2_OrderInbox, as the review procedures return it. */
    public sealed class OrderInboxRow
    {
        public long InboxId { get; set; }
        public string Channel { get; set; } = string.Empty;
        public string? StoreId { get; set; }
        public string? ChannelOrderId { get; set; }
        public string State { get; set; } = string.Empty;
        public string? RawDocument { get; set; }
        public string? CanonicalJson { get; set; }
        public string? ErrorsJson { get; set; }
        public string? TargetTable { get; set; }
        public int? TargetOrderId { get; set; }
        public DateTimeOffset ReceivedAt { get; set; }
        public DateTimeOffset LastAttemptAt { get; set; }
        public int AttemptCount { get; set; }
        public string? ReviewedBy { get; set; }
        public DateTimeOffset? ReviewedAt { get; set; }
        public string? ReviewNote { get; set; }
    }

    /* What the Order Toolbench shows for one held order. */
    public class OrderInboxReviewItem
    {
        public long InboxId { get; set; }
        public string Channel { get; set; } = string.Empty;
        public string? StoreId { get; set; }
        public string? ChannelOrderId { get; set; }
        public string? OrderNumber { get; set; }
        public string State { get; set; } = string.Empty;

        public string? CustomerName { get; set; }
        public string? CustomerEmail { get; set; }
        public decimal? Total { get; set; }
        public string? Currency { get; set; }
        public int ItemCount { get; set; }

        public DateTimeOffset ReceivedAt { get; set; }
        public DateTimeOffset LastAttemptAt { get; set; }
        public int AttemptCount { get; set; }

        public List<OrderInboxProblem> Problems { get; set; } = new();

        public string? TargetTable { get; set; }
        public int? TargetOrderId { get; set; }

        public string? ReviewedBy { get; set; }
        public DateTimeOffset? ReviewedAt { get; set; }
        public string? ReviewNote { get; set; }
    }

    /* The list row plus everything needed to look at the order. */
    public sealed class OrderInboxReviewDetail : OrderInboxReviewItem
    {
        public OrderInboxAddress? ShipTo { get; set; }
        public List<OrderInboxLine> Lines { get; set; } = new();

        /* The document exactly as it arrived. Read-only. */
        public string? RawDocument { get; set; }
    }

    public sealed class OrderInboxProblem
    {
        public string Code { get; set; } = string.Empty;
        public string? Field { get; set; }
        public string? Message { get; set; }
    }

    public sealed class OrderInboxAddress
    {
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Name { get; set; }
        public string? Attention { get; set; }
        public string? Line1 { get; set; }
        public string? Line2 { get; set; }
        public string? City { get; set; }
        public string? Region { get; set; }
        public string? PostalCode { get; set; }
        public string? Country { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
    }

    public sealed class OrderInboxLine
    {
        public string? LineId { get; set; }
        public string? Sku { get; set; }
        public string? ProductName { get; set; }
        public decimal? Quantity { get; set; }
        public decimal? UnitPrice { get; set; }
        public decimal? LineTotal { get; set; }
    }

    public sealed class RejectInboxOrderRequest
    {
        public long InboxId { get; set; }
        public string? Reason { get; set; }
    }

    public sealed class OrderInboxActionResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    /* ---- Fix and release a held order ---- */

    /*
     * What a person changed on a held order. Only the fields that are
     * sent are changed; anything left null stays as it is.
     */
    public sealed class HeldOrderReleaseRequest
    {
        public long InboxId { get; set; }

        /* One entry per line being given a different product. */
        public List<HeldOrderLineEdit> Lines { get; set; } = new();

        public HeldOrderShipToEdit? ShipTo { get; set; }

        public string? Email { get; set; }
    }

    public sealed class HeldOrderLineEdit
    {
        public string? LineId { get; set; }

        /* The PRO product code this line should be. */
        public string? Sku { get; set; }

        /* True to take this line off the order. */
        public bool Remove { get; set; }
    }

    public sealed class HeldOrderShipToEdit
    {
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Line1 { get; set; }
        public string? Line2 { get; set; }
        public string? City { get; set; }
        public string? Region { get; set; }
        public string? PostalCode { get; set; }
        public string? Country { get; set; }
        public string? Phone { get; set; }
    }

    public sealed class HeldOrderReleaseResult
    {
        /* True when the order was imported and left Needs Review. */
        public bool Released { get; set; }

        public string Message { get; set; } = string.Empty;

        /* The consumer order it became, when released. */
        public int? OrderId { get; set; }

        /* Why it is still held, when it is. */
        public List<OrderInboxProblem> Problems { get; set; } = new();
    }

    public sealed class ProductLookupDto
    {
        public string ProductCode { get; set; } = string.Empty;
        public string? ModelName { get; set; }
    }

    /* ---- POS and EDI file imports ---- */

    /* The result of writing one inbound order to Orders. */
    public sealed class InboundOrderImported
    {
        public int OrderId { get; init; }

        /* IMPORTED or ALREADY_IMPORTED. */
        public string ResultStatus { get; init; } = string.Empty;

        /* Lines whose price on the order differed from the PRO price. */
        public int PriceDifferences { get; init; }
    }

    /* What one run of an import did. */
    public sealed class OrderImportSummary
    {
        /* POS or EDI. */
        public string Channel { get; set; } = string.Empty;

        /* False only when the run could not be completed. */
        public bool Success { get; set; } = true;

        public string Message { get; set; } = string.Empty;

        public int Files { get; set; }

        /* The four counts below are orders, not files. */
        public int Imported { get; set; }
        public int NeedsReview { get; set; }
        public int Rejected { get; set; }
        public int Duplicates { get; set; }

        /* Files left in the folder to try again on the next run. */
        public int Skipped { get; set; }

        public List<OrderImportFileResult> Results { get; set; } = new();
    }

    /* One order from one file (an EDI file can hold several). */
    public sealed class OrderImportFileResult
    {
        public string FileName { get; set; } = string.Empty;

        /* IMPORTED, NEEDS_REVIEW, REJECTED, DUPLICATE or SKIPPED. */
        public string Status { get; set; } = string.Empty;

        public string? Account { get; set; }
        public string? PoNumber { get; set; }

        /* The order it became, when imported. */
        public int? OrderId { get; set; }

        public long? InboxId { get; set; }

        /* Lines whose price on the order differed from the PRO price. */
        public int PriceDifferences { get; set; }

        public List<string> Problems { get; set; } = new();
    }
}
