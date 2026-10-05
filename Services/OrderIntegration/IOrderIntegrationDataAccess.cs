using ProInternal.Models.OrderIntegration;
using ProInternal.Models.OrderIntegration.Shopify;
namespace ProInternal.Services.OrderIntegration;

public interface IOrderIntegrationDataAccess
{
    //For my PRO orders
    CanonicalOrder? GetCanonicalOrder(string orderId);

    //Shopify: writes one order from the order inbox into OrderConsumer
    Task<InboundOrderResult> ImportShopifyOrderAsync(
        long inboxId,
        string channelOrderId,
        CanonicalOrder order,
        int orderStatusId,
        CancellationToken cancellationToken);

    Task<long> SaveExportAsync(OrderExportBatch batch, CancellationToken cancellationToken);
    Task SetExportStatusAsync(Guid batchId, string exportStatus, string? errorsJson, CancellationToken cancellationToken);

}