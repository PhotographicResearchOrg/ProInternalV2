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
}
