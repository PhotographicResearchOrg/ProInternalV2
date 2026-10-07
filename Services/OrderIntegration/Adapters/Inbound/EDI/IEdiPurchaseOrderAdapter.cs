using ProInternal.Models.OrderIntegration;
using ProInternal.Models.OrderIntegration.Shopify;
using System.Collections.Generic;

namespace ProInternal.Services.OrderIntegration.Adapters.Inbound.Edi
{
    public interface IEdiPurchaseOrderAdapter
    {
        /*
         * fileName: the 850 file name, kept for traceability.
         * lines:    every line of the file, header row included.
         *
         * One file can hold several purchase orders; each becomes its
         * own canonical order.
         */
        EdiPurchaseOrderMappingResult Map(string fileName, IReadOnlyList<string> lines);
    }

    /*
     * Partner:  the trading partner's account number (5822 = B&H).
     * RawRows:  the header row plus this order's rows, exactly as they
     *           arrived. Saved on the inbox record.
     */
    public sealed record EdiMappedOrder(
        string Partner,
        string PoNumber,
        string RawRows,
        CanonicalOrder Order,
        IReadOnlyList<InboundOrderError> Errors)
    {
        public bool IsValid => Errors.Count == 0;

        public bool NeedsReview => Errors.Count > 0;
    }

    /*
     * FileErrors are problems that belong to the file, not to one order:
     * a row that cannot be split into columns, or a row with no PO.
     * Those rows are reported with their row number and never dropped
     * silently.
     */
    public sealed record EdiPurchaseOrderMappingResult(
        IReadOnlyList<EdiMappedOrder> Orders,
        IReadOnlyList<InboundOrderError> FileErrors);
}
