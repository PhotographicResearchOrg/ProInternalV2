using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ProInternal.Models.OrderIntegration.Shopify
{
    public sealed class ShopifyOrderPayload
    {
        [JsonPropertyName("id")]
        public long Id { get; init; }

        [JsonPropertyName("admin_graphql_api_id")]
        public string? AdminGraphqlApiId { get; init; }

        [JsonPropertyName("name")]
        public string? Name { get; init; }

        [JsonPropertyName("order_number")]
        public long? OrderNumber { get; init; }

        [JsonPropertyName("confirmation_number")]
        public string? ConfirmationNumber { get; init; }

        [JsonPropertyName("created_at")]
        public DateTimeOffset CreatedAt { get; init; }

        [JsonPropertyName("updated_at")]
        public DateTimeOffset? UpdatedAt { get; init; }

        [JsonPropertyName("processed_at")]
        public DateTimeOffset? ProcessedAt { get; init; }

        [JsonPropertyName("currency")]
        public string? Currency { get; init; }

        [JsonPropertyName("email")]
        public string? Email { get; init; }

        [JsonPropertyName("contact_email")]
        public string? ContactEmail { get; init; }

        [JsonPropertyName("phone")]
        public string? Phone { get; init; }

        [JsonPropertyName("note")]
        public string? Note { get; init; }

        [JsonPropertyName("po_number")]
        public string? PoNumber { get; init; }

        [JsonPropertyName("financial_status")]
        public string? FinancialStatus { get; init; }

        [JsonPropertyName("fulfillment_status")]
        public string? FulfillmentStatus { get; init; }

        [JsonPropertyName("cancelled_at")]
        public DateTimeOffset? CancelledAt { get; init; }

        [JsonPropertyName("cancel_reason")]
        public string? CancelReason { get; init; }

        [JsonPropertyName("taxes_included")]
        public bool TaxesIncluded { get; init; }

        [JsonPropertyName("subtotal_price")]
        public string? SubtotalPrice { get; init; }

        [JsonPropertyName("total_discounts")]
        public string? TotalDiscounts { get; init; }

        [JsonPropertyName("total_tax")]
        public string? TotalTax { get; init; }

        [JsonPropertyName("total_price")]
        public string? TotalPrice { get; init; }

        [JsonPropertyName("billing_address")]
        public ShopifyAddress? BillingAddress { get; init; }

        [JsonPropertyName("shipping_address")]
        public ShopifyAddress? ShippingAddress { get; init; }

        [JsonPropertyName("customer")]
        public ShopifyCustomer? Customer { get; init; }

        [JsonPropertyName("line_items")]
        public List<ShopifyLineItem> LineItems { get; init; } = [];

        [JsonPropertyName("shipping_lines")]
        public List<ShopifyShippingLine> ShippingLines { get; init; } = [];

        [JsonPropertyName("payment_gateway_names")]
        public List<string> PaymentGatewayNames { get; init; } = [];

        [JsonPropertyName("tags")]
        public string? Tags { get; init; }
    }

    public sealed class ShopifyCustomer
    {
        [JsonPropertyName("id")]
        public long Id { get; init; }

        [JsonPropertyName("first_name")]
        public string? FirstName { get; init; }

        [JsonPropertyName("last_name")]
        public string? LastName { get; init; }

        [JsonPropertyName("email")]
        public string? Email { get; init; }

        [JsonPropertyName("phone")]
        public string? Phone { get; init; }
    }

    public sealed class ShopifyAddress
    {
        [JsonPropertyName("first_name")]
        public string? FirstName { get; init; }

        [JsonPropertyName("last_name")]
        public string? LastName { get; init; }

        [JsonPropertyName("name")]
        public string? Name { get; init; }

        [JsonPropertyName("company")]
        public string? Company { get; init; }

        [JsonPropertyName("address1")]
        public string? Address1 { get; init; }

        [JsonPropertyName("address2")]
        public string? Address2 { get; init; }

        [JsonPropertyName("city")]
        public string? City { get; init; }

        [JsonPropertyName("province")]
        public string? Province { get; init; }

        [JsonPropertyName("province_code")]
        public string? ProvinceCode { get; init; }

        [JsonPropertyName("zip")]
        public string? PostalCode { get; init; }

        [JsonPropertyName("country")]
        public string? Country { get; init; }

        [JsonPropertyName("country_code")]
        public string? CountryCode { get; init; }

        [JsonPropertyName("phone")]
        public string? Phone { get; init; }
    }

    public sealed class ShopifyLineItem
    {
        [JsonPropertyName("id")]
        public long Id { get; init; }

        [JsonPropertyName("admin_graphql_api_id")]
        public string? AdminGraphqlApiId { get; init; }

        [JsonPropertyName("product_id")]
        public long? ProductId { get; init; }

        [JsonPropertyName("variant_id")]
        public long? VariantId { get; init; }

        [JsonPropertyName("sku")]
        public string? Sku { get; init; }

        [JsonPropertyName("name")]
        public string? Name { get; init; }

        [JsonPropertyName("title")]
        public string? Title { get; init; }

        [JsonPropertyName("variant_title")]
        public string? VariantTitle { get; init; }

        [JsonPropertyName("quantity")]
        public decimal Quantity { get; init; }

        [JsonPropertyName("price")]
        public string? Price { get; init; }

        [JsonPropertyName("total_discount")]
        public string? TotalDiscount { get; init; }

        [JsonPropertyName("requires_shipping")]
        public bool RequiresShipping { get; init; }

        [JsonPropertyName("gift_card")]
        public bool GiftCard { get; init; }

        [JsonPropertyName("fulfillment_service")]
        public string? FulfillmentService { get; init; }

        [JsonPropertyName("fulfillment_status")]
        public string? FulfillmentStatus { get; init; }

        [JsonPropertyName("discount_allocations")]
        public List<ShopifyDiscountAllocation> DiscountAllocations
        { get; init; } = [];
    }

    public sealed class ShopifyDiscountAllocation
    {
        [JsonPropertyName("amount")]
        public string? Amount { get; init; }

        [JsonPropertyName("discount_application_index")]
        public int DiscountApplicationIndex { get; init; }
    }

    public sealed class ShopifyShippingLine
    {
        [JsonPropertyName("id")]
        public long Id { get; init; }

        [JsonPropertyName("title")]
        public string? Title { get; init; }

        [JsonPropertyName("code")]
        public string? Code { get; init; }

        [JsonPropertyName("price")]
        public string? Price { get; init; }

        [JsonPropertyName("discounted_price")]
        public string? DiscountedPrice { get; init; }

        [JsonPropertyName("source")]
        public string? Source { get; init; }
    }
}