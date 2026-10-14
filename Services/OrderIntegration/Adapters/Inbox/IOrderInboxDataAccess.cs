using ProInternal.Models.OrderIntegration;
using ProInternal.Models.OrderIntegration.Shopify;
using ProInternal.Services.OrderIntegration.Adapters.Inbound;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Services.OrderIntegration
{
    public interface IOrderInboxDataAccess
    {
        /*
         * Saves one inbound document. Call this first, before parsing.
         * A duplicate is not saved again; the existing record is returned.
         */
        Task<OrderInboxReceipt> ReceiveAsync(
            string channel,
            string? storeId,
            string? channelOrderId,
            string? documentId,
            string? rawDocument,
            object? metadata,
            CancellationToken cancellationToken);

        /* Records what happened to an inbox record after processing. */
        Task SetResultAsync(
            long inboxId,
            string state,
            CanonicalOrder? order,
            IReadOnlyCollection<InboundOrderError> errors,
            string? targetTable,
            int? targetOrderId,
            CancellationToken cancellationToken);

        /* The Needs Review list. Rejected records only when asked for. */
        Task<List<OrderInboxReviewItem>> GetReviewAsync(
            bool includeRejected,
            CancellationToken cancellationToken);

        /* One held order in full. Null when the record does not exist. */
        Task<OrderInboxReviewDetail?> GetReviewDetailAsync(
            long inboxId,
            CancellationToken cancellationToken);

        /* Rejects an order that is still waiting for review. */
        Task<OrderInboxActionResponse> RejectAsync(
            long inboxId,
            string reason,
            string actionBy,
            CancellationToken cancellationToken);

        /* One inbox record as stored. Null when it does not exist. */
        Task<OrderInboxRow?> GetRowAsync(
            long inboxId,
            CancellationToken cancellationToken);

        /* Saves the corrected contract order on a held record and audits the change. */
        Task<OrderInboxActionResponse> SaveEditAsync(
            long inboxId,
            string canonicalJson,
            string? actionData,
            string actionBy,
            string actionSource,
            CancellationToken cancellationToken);

        /* Writes one audit row against a held order. */
        Task AuditAsync(
            long inboxId,
            string actionType,
            string? reason,
            string? actionData,
            string actionBy,
            string actionSource,
            int? orderConsumerId,
            CancellationToken cancellationToken);

        Task<List<ProductLookupDto>> SearchProductsAsync(
            string term,
            CancellationToken cancellationToken);

        /*
         * PRO's own data for one inbound POS or EDI order, in one call:
         * the account and its billing address, where it ships, and
         * every product code on the order.
         */
        InboundLookup LoadInboundLookup(
            string channel,
            string accountNumber,
            string? shipToCode,
            IReadOnlyCollection<string> productCodes);

        /*
         * Writes a POS or EDI contract order to Orders. The last three
         * values come from the trading partner's settings and are used
         * for EDI only.
         */
        Task<InboundOrderImported> ImportInboundOrderAsync(
            long inboxId,
            CanonicalOrder order,
            int? orderUserId,
            string? shippingNote,
            bool applySpecials,
            string actionBy,
            CancellationToken cancellationToken);
    }
}
