using ProInternal.Models.OrderIntegration;
using ProInternal.Models.OrderIntegration.Shopify;
namespace ProInternal.Services.OrderIntegration;

public interface IOrderIntegrationDataAccess
{
    //For my PRO orders
    CanonicalOrder? GetCanonicalOrder(string orderId);

    //Shopify
    Task<InboundOrderResult>ImportShopifyOrderAsync(
           ShopifyWebhookEnvelope envelope,
           CanonicalOrder order,
           IReadOnlyList<InboundOrderError> errors,
           int orderStatusId,
           CancellationToken cancellationToken);

}
