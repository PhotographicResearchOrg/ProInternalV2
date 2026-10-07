using System;

namespace ProInternal.Models.Orders
{
    /* One row of the Sent tab: an order's latest send and its answer. */
    public sealed class SentOrderDto
    {
        public long ExportId { get; set; }
        public string OrderId { get; set; } = string.Empty;

        /* "warehouse" or "consumer". */
        public string Channel { get; set; } = string.Empty;

        public string? CustomerName { get; set; }
        public string? Reference { get; set; }

        public string? Destination { get; set; }
        public string? FileName { get; set; }
        public string? BatchId { get; set; }
        public DateTimeOffset? SentAt { get; set; }
        public string? SentBy { get; set; }

        /* The contract's export status: EXPORTED, ACKNOWLEDGED, FAILED. */
        public string ExportState { get; set; } = string.Empty;

        public string? DestinationOrderId { get; set; }
        public string? ResponseReason { get; set; }
        public DateTimeOffset? RespondedAt { get; set; }
        public string? RespondedBy { get; set; }

        /* Shipments the destination reported, as a JSON array (contract shape). */
        public string? ShipmentsJson { get; set; }

        public bool IsOverdue { get; set; }
        public string? OrderStatus { get; set; }
        public bool CanReopen { get; set; }
    }

    /* A person records the destination's answer for a sent order. */
    public sealed class SentOrderResponseRequest
    {
        public string? OrderId { get; set; }
        public string? Channel { get; set; }

        /* ACKNOWLEDGED or FAILED. */
        public string? State { get; set; }

        public string? DestinationOrderId { get; set; }
        public string? Reason { get; set; }
    }

    public sealed class ReopenOrderRequestV2
    {
        public string? OrderId { get; set; }
        public string? Channel { get; set; }
        public string? Reason { get; set; }
    }

    public sealed class ProcessConsumerOrdersRequest
    {
        public System.Collections.Generic.List<string> OrderIds { get; set; } = new();
    }
}
