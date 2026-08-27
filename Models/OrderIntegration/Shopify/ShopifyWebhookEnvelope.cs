using System.Collections.Generic;

namespace ProInternal.Models.OrderIntegration.Shopify
{
    public sealed class ShopifyWebhookEnvelope
    {
        public required string WebhookId { get; init; }
        public string? EventId { get; init; }
        public required string Topic { get; init; }
        public required string ShopDomain { get; init; }
        public string? ApiVersion { get; init; }
        public string? TriggeredAt { get; init; }
        public required string PayloadJson { get; init; }
    }

    public sealed class InboundOrderResult
    {
        public required string Status { get; init; }
        public string? OrderId { get; init; }
        public string? ChannelOrderId { get; init; }
        public List<InboundOrderError> Errors { get; init; } = [];
    }

    public sealed class InboundOrderError
    {
        public string? Code { get; init; }
        public string? Field { get; init; }
        public required string Message { get; init; }
    }
}