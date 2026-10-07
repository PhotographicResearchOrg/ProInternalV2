using ProInternal.Models.Orders;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Services.OrderIntegration.Adapters.Outbox
{
    /*
     * What was sent and what came back: the two export tables,
     * plus reopening an order and reading a consumer order for the
     * contract.
     */
    public interface IOrderOutboxDataAccess
    {
        Task SetChannelAsync(Guid batchId, string channel, CancellationToken cancellationToken);

        /* Marks every order written in the batch as sent (status 5) and audits it. */
        Task<int> MarkSentAsync(Guid batchId, string? actionBy, string actionSource, CancellationToken cancellationToken);

        Task<List<SentOrderDto>> GetSentAsync(int days, int overdueHours, CancellationToken cancellationToken);

        Task<OrderEditResponse> SetResponseAsync(
            string? channel, int orderId, string state,
            string? destinationOrderId, string? reason,
            string? actionBy, string actionSource,
            CancellationToken cancellationToken);

        Task<OrderEditResponse> ReopenAsync(
            string? channel, int orderId, string reason,
            string actionBy, string actionSource,
            CancellationToken cancellationToken);

        /*
         * Records a fulfillment system's response on the send it answers.
         * The reference is matched to a sent order by the procedure.
         */
        Task<OrderResponseApplied> ApplyResponseAsync(
            string destination,
            string orderRef,
            string? channel,
            string? state,
            string? destinationOrderId,
            string? reason,
            string? shipmentsJson,
            string actionType,
            string? messageJson,
            string actionBy,
            string actionSource,
            CancellationToken cancellationToken);

        /* Null when the consumer order does not exist. */
        Task<ConsumerOrderSource?> GetConsumerOrderSourceAsync(int orderId, CancellationToken cancellationToken);
    }

    /* The outcome of applying one response. */
    public sealed class OrderResponseApplied
    {
        public bool Success { get; set; }

        /* APPLIED, INVALID_RESPONSE, ORDER_NOT_FOUND, ORDER_AMBIGUOUS */
        public string Code { get; set; } = string.Empty;

        public string Message { get; set; } = string.Empty;
        public string? Channel { get; set; }
        public string? OrderId { get; set; }
    }

    /* A consumer order as stored, before it is built as a contract order. */
    public sealed class ConsumerOrderSource
    {
        public int OrderConsumerId { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTime OrderDate { get; set; }

        public string? Email { get; set; }
        public string? BillingFirstName { get; set; }
        public string? BillingLastName { get; set; }
        public string? BillingAddress1 { get; set; }
        public string? BillingAddress2 { get; set; }
        public string? BillingCity { get; set; }
        public string? BillingState { get; set; }
        public string? BillingZip { get; set; }
        public string? BillingCountry { get; set; }
        public string? BillingPhone { get; set; }

        public string? ShippingFirstName { get; set; }
        public string? ShippingLastName { get; set; }
        public string? ShippingAddress1 { get; set; }
        public string? ShippingAddress2 { get; set; }
        public string? ShippingCity { get; set; }
        public string? ShippingState { get; set; }
        public string? ShippingZip { get; set; }
        public string? ShippingCountry { get; set; }
        public string? ShippingPhone { get; set; }

        public decimal ShippingTotal { get; set; }
        public decimal TaxTotal { get; set; }
        public decimal DiscountTotal { get; set; }
        public string? PromoCode { get; set; }

        public string? PaypalInvoiceNumber { get; set; }
        public string? ShopifyOrderId { get; set; }
        public string? OnlineOrderNumber { get; set; }
        public long? InboxId { get; set; }
        public string? StoreId { get; set; }

        public int? LegacyOrderStatusId { get; set; }
        public string? IntegrationOrderStatus { get; set; }
        public string? IntegrationApprovalStatus { get; set; }
        public string? ShippingMethod { get; set; }
        public string? ExportState { get; set; }

        public List<ConsumerOrderSourceLine> Lines { get; set; } = new();
    }

    public sealed class ConsumerOrderSourceLine
    {
        public int OrderItemConsumerId { get; set; }
        public string? Sku { get; set; }
        public string? ProductName { get; set; }
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
    }
}
