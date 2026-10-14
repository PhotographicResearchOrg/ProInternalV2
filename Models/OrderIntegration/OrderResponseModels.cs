using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ProInternal.Models.OrderIntegration;

/*
 * The contract's order response (responses/order-response.schema.json):
 * the message a fulfillment system sends back about an order it was
 * sent. One message is about one order.
 *
 * Property names and enum values are the contract's. A message with a
 * value outside the contract, or with a property the contract does not
 * define, is refused.
 */
public sealed class OrderResponseMessage
{
    [JsonPropertyName("schemaVersion")]
    public required string SchemaVersion { get; init; }

    [JsonPropertyName("responseType")]
    public required ResponseType ResponseType { get; init; }

    [JsonPropertyName("orderRef")]
    public required OrderResponseRef OrderRef { get; init; }

    [JsonPropertyName("respondedAt")]
    public required DateTimeOffset RespondedAt { get; init; }

    [JsonPropertyName("messageId")]
    public string? MessageId { get; init; }

    [JsonPropertyName("acknowledgement")]
    public OrderResponseAcknowledgement? Acknowledgement { get; init; }

    [JsonPropertyName("fulfillment")]
    public OrderResponseFulfillment? Fulfillment { get; init; }

    [JsonPropertyName("statusUpdate")]
    public OrderResponseStatusUpdate? StatusUpdate { get; init; }

    [JsonPropertyName("exceptions")]
    public List<OrderResponseException>? Exceptions { get; init; }

    [JsonPropertyName("references")]
    public Dictionary<string, string?>? References { get; init; }

    [JsonPropertyName("extensions")]
    public Dictionary<string, JsonElement>? Extensions { get; init; }
}

public sealed class OrderResponseRef
{
    /* The order reference. PRO's order id, or the number the order was sent under. */
    [JsonPropertyName("orderId")]
    public required string OrderId { get; init; }

    [JsonPropertyName("orderNumber")]
    public string? OrderNumber { get; init; }

    /* The fulfillment system's own order number for this order. */
    [JsonPropertyName("fulfillmentOrderId")]
    public string? FulfillmentOrderId { get; init; }
}

public sealed class OrderResponseAcknowledgement
{
    [JsonPropertyName("ackResult")]
    public required AckResult AckResult { get; init; }

    [JsonPropertyName("rejectReason")]
    public RejectReason? RejectReason { get; init; }

    [JsonPropertyName("message")]
    public string? Message { get; init; }
}

public sealed class OrderResponseFulfillment
{
    [JsonPropertyName("fulfillmentGroupId")]
    public string? FulfillmentGroupId { get; init; }

    [JsonPropertyName("shipments")]
    public List<OrderResponseShipment>? Shipments { get; init; }

    [JsonPropertyName("lines")]
    public List<OrderResponseLine>? Lines { get; init; }
}

public sealed class OrderResponseShipment
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
    public List<OrderResponseShippedItem>? ShippedItems { get; init; }

    [JsonPropertyName("freightCost")]
    public Money? FreightCost { get; init; }
}

public sealed class OrderResponseShippedItem
{
    [JsonPropertyName("lineId")]
    public required string LineId { get; init; }

    [JsonPropertyName("quantity")]
    public required decimal Quantity { get; init; }
}

public sealed class OrderResponseLine
{
    [JsonPropertyName("lineId")]
    public required string LineId { get; init; }

    [JsonPropertyName("status")]
    public required LineResponseStatus Status { get; init; }

    [JsonPropertyName("quantityShipped")]
    public decimal? QuantityShipped { get; init; }

    [JsonPropertyName("quantityBackordered")]
    public decimal? QuantityBackordered { get; init; }

    [JsonPropertyName("expectedDate")]
    public string? ExpectedDate { get; init; }

    [JsonPropertyName("note")]
    public string? Note { get; init; }
}

public sealed class OrderResponseStatusUpdate
{
    [JsonPropertyName("status")]
    public required OrderStatus Status { get; init; }

    [JsonPropertyName("note")]
    public string? Note { get; init; }
}

public sealed class OrderResponseException
{
    [JsonPropertyName("severity")]
    public required ExceptionSeverity Severity { get; init; }

    [JsonPropertyName("code")]
    public string? Code { get; init; }

    [JsonPropertyName("message")]
    public required string Message { get; init; }

    [JsonPropertyName("lineId")]
    public string? LineId { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ResponseType
{
    ACKNOWLEDGEMENT,
    FULFILLMENT_UPDATE,
    STATUS_UPDATE,
    EXCEPTION
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AckResult
{
    ACCEPTED,
    ACCEPTED_WITH_CHANGES,
    REJECTED
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum RejectReason
{
    INVALID_PAYLOAD,
    UNKNOWN_CUSTOMER,
    UNKNOWN_ITEM,
    DUPLICATE_ORDER,
    PRICING_MISMATCH,
    CREDIT_DECLINED,
    OTHER
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum LineResponseStatus
{
    ACCEPTED,
    SHIPPED,
    PARTIALLY_SHIPPED,
    BACKORDERED,
    SHORT_SHIPPED,
    CANCELLED,
    REJECTED
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ExceptionSeverity
{
    INFO,
    WARNING,
    ERROR
}

/* What the API answers. */
public sealed class OrderResponseResult
{
    /* APPLIED, INVALID_RESPONSE, ORDER_NOT_FOUND, ORDER_AMBIGUOUS */
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("orderId")]
    public string? OrderId { get; set; }

    [JsonPropertyName("channel")]
    public string? Channel { get; set; }

    [JsonPropertyName("errors")]
    public List<string> Errors { get; set; } = new();
}
