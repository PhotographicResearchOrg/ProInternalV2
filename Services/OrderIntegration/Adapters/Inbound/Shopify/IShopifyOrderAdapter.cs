using ProInternal.Models.OrderIntegration;
using ProInternal.Models.OrderIntegration.Shopify;
using System.Collections.Generic;

namespace ProInternal.Services.OrderIntegration.Adapters.Inbound.Shopify
{

    public interface IShopifyOrderAdapter
    {
           ShopifyOrderMappingResult Map(ShopifyWebhookEnvelope envelope,ShopifyOrderPayload payload);
    }

    public sealed record ShopifyOrderMappingResult(CanonicalOrder? Order,IReadOnlyList<InboundOrderError> Errors)
    {
        public bool IsValid => Order is not null && Errors.Count == 0;
    }

}