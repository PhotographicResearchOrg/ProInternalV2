using ProInternal.Models.OrderIntegration;
using ProInternal.Models.OrderIntegration.Shopify;
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
    }
}
