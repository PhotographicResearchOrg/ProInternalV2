using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ProInternal.Models.OrderIntegration;

public sealed class CanonicalOrder
{
    [JsonPropertyName("schemaVersion")]
    public string SchemaVersion { get; init; } = "1.0";

    [JsonPropertyName("metadata")]
    public required OrderMetadata Metadata { get; init; }

    [JsonPropertyName("source")]
    public required OrderSource Source { get; init; }

    [JsonPropertyName("customer")]
    public required OrderCustomer Customer { get; init; }

    [JsonPropertyName("addresses")]
    public required OrderAddresses Addresses { get; init; }

    [JsonPropertyName("order")]
    public required OrderDetails Order { get; init; }

    [JsonPropertyName("pricing")]
    public required OrderPricing Pricing { get; init; }

    [JsonPropertyName("items")]
    public required List<CanonicalOrderItem> Items { get; init; }

    [JsonPropertyName("fulfillment")]
    public required Fulfillment Fulfillment { get; init; }

    [JsonPropertyName("payments")]
    public List<OrderPayment> Payments { get; init; } = new();

    [JsonPropertyName("workflow")]
    public required OrderWorkflow Workflow { get; init; }

    [JsonPropertyName("references")]
    public Dictionary<string, string> References { get; init; } = new();

    [JsonPropertyName("extensions")]
    public OrderExtensions Extensions { get; init; } = new();

    [JsonPropertyName("audit")]
    public OrderAudit Audit { get; init; } = new();
}

public sealed class OrderMetadata
{
    [JsonPropertyName("orderId")]
    public required string OrderId { get; init; }

    [JsonPropertyName("orderNumber")]
    public string? OrderNumber { get; init; }

    [JsonPropertyName("createdAt")]
    public required DateTimeOffset CreatedAt { get; init; }

    [JsonPropertyName("updatedAt")]
    public DateTimeOffset? UpdatedAt { get; init; }
}

public sealed class OrderSource
{
    [JsonPropertyName("channel")]
    public required SourceChannel Channel { get; init; }

    [JsonPropertyName("channelOrderId")]
    public string? ChannelOrderId { get; init; }

    [JsonPropertyName("storeId")]
    public string? StoreId { get; init; }
}

public sealed class OrderCustomer
{
    [JsonPropertyName("customerId")]
    public required string CustomerId { get; init; }

    [JsonPropertyName("name")]
    public string? Name { get; init; }

    [JsonPropertyName("email")]
    public string? Email { get; init; }

    [JsonPropertyName("phone")]
    public string? Phone { get; init; }

    [JsonPropertyName("pricingTier")]
    public string? PricingTier { get; init; }

    [JsonPropertyName("poNumber")]
    public string? PoNumber { get; init; }
}

public sealed class OrderAddresses
{
    [JsonPropertyName("billing")]
    public required Address Billing { get; init; }

    [JsonPropertyName("shipping")]
    public Address? Shipping { get; init; }
}

public sealed class OrderDetails
{
    [JsonPropertyName("status")]
    public required OrderStatus Status { get; init; }

    [JsonPropertyName("orderDate")]
    public required DateOnly OrderDate { get; init; }

    [JsonPropertyName("currency")]
    public string Currency { get; init; } = "USD";

    [JsonPropertyName("taxInclusive")]
    public bool TaxInclusive { get; init; }

    [JsonPropertyName("notes")]
    public string? Notes { get; init; }

    [JsonPropertyName("paymentTerms")]
    public PaymentTerms? PaymentTerms { get; init; }
}

public sealed class PaymentTerms
{
    [JsonPropertyName("code")]
    public string? Code { get; init; }

    [JsonPropertyName("netDays")]
    public int? NetDays { get; init; }

    [JsonPropertyName("dueDate")]
    public DateOnly? DueDate { get; init; }
}

public sealed class OrderPricing
{
    [JsonPropertyName("subtotal")]
    public Money? Subtotal { get; init; }

    [JsonPropertyName("discountTotal")]
    public Money? DiscountTotal { get; init; }

    [JsonPropertyName("shippingTotal")]
    public Money? ShippingTotal { get; init; }

    [JsonPropertyName("taxTotal")]
    public Money? TaxTotal { get; init; }

    [JsonPropertyName("grandTotal")]
    public required Money GrandTotal { get; init; }

    [JsonPropertyName("orderDiscounts")]
    public List<LineDiscount> OrderDiscounts { get; init; } = new();
}

public sealed class CanonicalOrderItem
{
    [JsonPropertyName("lineId")]
    public required string LineId { get; init; }

    [JsonPropertyName("lineType")]
    public required LineType LineType { get; init; }

    [JsonPropertyName("parentLineId")]
    public string? ParentLineId { get; init; }

    [JsonPropertyName("sku")]
    public string? Sku { get; init; }

    [JsonPropertyName("productName")]
    public string? ProductName { get; init; }

    [JsonPropertyName("quantity")]
    public required decimal Quantity { get; init; }

    [JsonPropertyName("unitOfMeasure")]
    public string? UnitOfMeasure { get; init; }

    [JsonPropertyName("unitPrice")]
    public Money? UnitPrice { get; init; }

    [JsonPropertyName("lineDiscounts")]
    public List<LineDiscount> LineDiscounts { get; init; } = new();

    [JsonPropertyName("lineTotal")]
    public Money? LineTotal { get; init; }

    [JsonPropertyName("fulfillmentGroupId")]
    public string? FulfillmentGroupId { get; init; }

    [JsonPropertyName("references")]
    public Dictionary<string, string>? References { get; init; }

    [JsonPropertyName("extensions")]
    public Dictionary<string, JsonElement> Extensions { get; init; } = new();
}

public sealed class LineDiscount
{
    [JsonPropertyName("discountType")]
    public required DiscountType DiscountType { get; init; }

    [JsonPropertyName("code")]
    public string? Code { get; init; }

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("amount")]
    public required Money Amount { get; init; }
}

public sealed class Fulfillment
{
    [JsonPropertyName("fulfillmentGroups")]
    public required List<FulfillmentGroup> FulfillmentGroups { get; init; }
}

public sealed class FulfillmentGroup
{
    [JsonPropertyName("groupId")]
    public required string GroupId { get; init; }

    [JsonPropertyName("fulfillmentType")]
    public required FulfillmentType FulfillmentType { get; init; }

    [JsonPropertyName("status")]
    public required FulfillmentStatus Status { get; init; }

    [JsonPropertyName("shipTo")]
    public Address? ShipTo { get; init; }

    [JsonPropertyName("warehouseId")]
    public string? WarehouseId { get; init; }

    [JsonPropertyName("vendorId")]
    public string? VendorId { get; init; }

    [JsonPropertyName("requestedShipDate")]
    public DateOnly? RequestedShipDate { get; init; }

    [JsonPropertyName("shippingMethod")]
    public string? ShippingMethod { get; init; }

    [JsonPropertyName("shipments")]
    public List<Shipment> Shipments { get; init; } = new();

    [JsonPropertyName("extensions")]
    public Dictionary<string, JsonElement> Extensions { get; init; } = new();
}

public sealed class Shipment
{
    [JsonPropertyName("shipmentId")]
    public required string ShipmentId { get; init; }

    [JsonPropertyName("carrier")]
    public string? Carrier { get; init; }

    [JsonPropertyName("trackingNumber")]
    public string? TrackingNumber { get; init; }

    [JsonPropertyName("shippedAt")]
    public DateTimeOffset? ShippedAt { get; init; }

    [JsonPropertyName("shippedItems")]
    public List<ShippedItem> ShippedItems { get; init; } = new();

    [JsonPropertyName("freightCost")]
    public Money? FreightCost { get; init; }
}

public sealed class ShippedItem
{
    [JsonPropertyName("lineId")]
    public required string LineId { get; init; }

    [JsonPropertyName("quantity")]
    public required decimal Quantity { get; init; }
}

public sealed class OrderPayment
{
    [JsonPropertyName("paymentId")]
    public required string PaymentId { get; init; }

    [JsonPropertyName("method")]
    public required PaymentMethod Method { get; init; }

    [JsonPropertyName("status")]
    public required PaymentStatus Status { get; init; }

    [JsonPropertyName("amount")]
    public required Money Amount { get; init; }

    [JsonPropertyName("processedAt")]
    public DateTimeOffset? ProcessedAt { get; init; }

    [JsonPropertyName("reference")]
    public string? Reference { get; init; }
}

public sealed class OrderWorkflow
{
    [JsonPropertyName("approvalStatus")]
    public required ApprovalStatus ApprovalStatus { get; init; }

    [JsonPropertyName("exportStatus")]
    public required ExportStatus ExportStatus { get; init; }

    [JsonPropertyName("holds")]
    public List<OrderHold> Holds { get; init; } = new();
}

public sealed class OrderHold
{
    [JsonPropertyName("holdType")]
    public required HoldType HoldType { get; init; }

    [JsonPropertyName("reason")]
    public string? Reason { get; init; }

    [JsonPropertyName("placedAt")]
    public DateTimeOffset? PlacedAt { get; init; }
}

public sealed class OrderAudit
{
    [JsonPropertyName("createdBy")]
    public string? CreatedBy { get; init; }

    [JsonPropertyName("updatedBy")]
    public string? UpdatedBy { get; init; }

    [JsonPropertyName("riskScore")]
    public decimal? RiskScore { get; init; }

    [JsonPropertyName("events")]
    public List<OrderAuditEvent> Events { get; init; } = new();
}

public sealed class OrderAuditEvent
{
    [JsonPropertyName("event")]
    public required string Event { get; init; }

    [JsonPropertyName("at")]
    public required DateTimeOffset At { get; init; }

    [JsonPropertyName("actor")]
    public string? Actor { get; init; }

    [JsonPropertyName("detail")]
    public string? Detail { get; init; }
}

public sealed class OrderExtensions
{
    [JsonPropertyName("shopify")]
    public Dictionary<string, JsonElement>? Shopify { get; init; }

    [JsonPropertyName("edi")]
    public Dictionary<string, JsonElement>? Edi { get; init; }

    [JsonPropertyName("computyme")]
    public Dictionary<string, JsonElement>? Computyme { get; init; }

    [JsonPropertyName("future")]
    public Dictionary<string, JsonElement>? Future { get; init; }

    [JsonExtensionData]
    public Dictionary<string, JsonElement> AdditionalNamespaces { get; init; } = new();
}

public sealed class Address
{

    [JsonPropertyName("firstName")]
    public string? FirstName { get; init; }

    [JsonPropertyName("lastName")]
    public string? LastName { get; init; }

    [JsonPropertyName("name")]
    public string? Name { get; init; }

    [JsonPropertyName("attention")]
    public string? Attention { get; init; }

    [JsonPropertyName("line1")]
    public required string Line1 { get; init; }

    [JsonPropertyName("line2")]
    public string? Line2 { get; init; }

    [JsonPropertyName("city")]
    public required string City { get; init; }

    [JsonPropertyName("region")]
    public string? Region { get; init; }

    [JsonPropertyName("postalCode")]
    public string? PostalCode { get; init; }

    [JsonPropertyName("country")]
    public required string Country { get; init; }

    [JsonPropertyName("phone")]
    public string? Phone { get; init; }

    [JsonPropertyName("email")]
    public string? Email { get; init; }

    [JsonPropertyName("residential")]
    public bool? Residential { get; init; }
}

public sealed class Money
{
    [JsonPropertyName("amount")]
    public required string Amount { get; init; }

    [JsonPropertyName("currency")]
    public required string Currency { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SourceChannel
{
    B2B_WEB,
    POS,
    SHOPIFY,
    EDI,
    AMAZON,
    PHONE,
    MANUAL
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrderStatus
{
    DRAFT,
    OPEN,
    ON_HOLD,
    CONFIRMED,
    PARTIALLY_FULFILLED,
    FULFILLED,
    INVOICED,
    CLOSED,
    CANCELLED
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum FulfillmentType
{
    WAREHOUSE,
    DROPSHIP,
    PICKUP,
    HYBRID
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum FulfillmentStatus
{
    PENDING,
    ALLOCATED,
    PICKING,
    PACKED,
    SHIPPED,
    DELIVERED,
    CANCELLED,
    BACKORDERED
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum LineType
{
    STANDARD,
    BUNDLE_PARENT,
    BUNDLE_COMPONENT,
    SUPPLEMENTAL_SHIPPING,
    PROMOTIONAL
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PaymentMethod
{
    CREDIT_CARD,
    ACH,
    WIRE,
    TERMS_NET,
    ON_ACCOUNT,
    GIFT_CARD,
    OTHER
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PaymentStatus
{
    PENDING,
    AUTHORIZED,
    CAPTURED,
    PARTIALLY_REFUNDED,
    REFUNDED,
    FAILED,
    VOIDED
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum DiscountType
{
    PERCENT,
    FIXED_AMOUNT,
    TIER_PRICE,
    PROMO_CODE,
    CONTRACT_PRICE
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AddressType
{
    BILLING,
    SHIPPING
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ApprovalStatus
{
    NOT_REQUIRED,
    PENDING,
    APPROVED,
    REJECTED
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum HoldType
{
    CREDIT,
    FRAUD_REVIEW,
    INVENTORY,
    PRICING_REVIEW,
    MANUAL,
    COMPLIANCE
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ExportStatus
{
    NOT_EXPORTED,
    QUEUED,
    EXPORTED,
    ACKNOWLEDGED,
    FAILED
}