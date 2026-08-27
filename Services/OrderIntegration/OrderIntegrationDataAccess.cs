using Dapper;
using Microsoft.Extensions.Configuration;
using Microsoft.PowerBI.Api.Models;
using ProInternal.Helpers;
using ProInternal.Models.OrderIntegration;
using Spire.Pdf.Graphics;
using System;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.Linq;
using System.Net;
using ProInternal.Models.OrderIntegration.Shopify;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;


namespace ProInternal.Services.OrderIntegration
{
    public class OrderIntegrationDataAccess: BaseDataAccess, IOrderIntegrationDataAccess
    {
        public OrderIntegrationDataAccess(IConfiguration config,AwsSecretHelper helper): base(config,helper,"ProConnectionString")
        {
        }

    private static readonly JsonSerializerOptions IntegrationJsonOptions = new()
    {
        DefaultIgnoreCondition =
        JsonIgnoreCondition.WhenWritingNull
    };

        public async Task<InboundOrderResult>ImportShopifyOrderAsync(
                ShopifyWebhookEnvelope envelope,
                CanonicalOrder order,
                IReadOnlyList<InboundOrderError> errors,
                int orderStatusId,
                CancellationToken cancellationToken)
        {

            ArgumentNullException.ThrowIfNull(envelope);
            ArgumentNullException.ThrowIfNull(order);
            ArgumentNullException.ThrowIfNull(errors);

            var channelOrderId =order.Source.ChannelOrderId ??order.Metadata.OrderId;

            if (string.IsNullOrWhiteSpace(channelOrderId))
            {
                throw new InvalidOperationException( "SHOPIFY_ORDER_ID_MISSING: " + "The canonical order does not contain a channel order ID.");
            }

            var canonicalJson =JsonSerializer.Serialize(order,IntegrationJsonOptions);

            string? errorsJson = null;

            if (errors.Count > 0)
            {
                errorsJson =JsonSerializer.Serialize(errors,IntegrationJsonOptions);
            }

            DateTimeOffset? triggeredAt = null;

            if (!string.IsNullOrWhiteSpace(
                    envelope.TriggeredAt) &&
                DateTimeOffset.TryParse(
                    envelope.TriggeredAt,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.RoundtripKind,
                    out var parsedTriggeredAt))
            {
                triggeredAt =
                    parsedTriggeredAt;
            }

            using var conn =
                GetConnection();

            var command =
                new CommandDefinition(
                    "dbo.PIV2_ShopifyOrderConsumer_Import",
                    new
                    {
                        WebhookId =
                            envelope.WebhookId,

                        EventId =
                            envelope.EventId,

                        Topic =
                            envelope.Topic,

                        ShopDomain =
                            envelope.ShopDomain,

                        ChannelOrderId =
                            channelOrderId,

                        ApiVersion =
                            envelope.ApiVersion,

                        TriggeredAt =
                            triggeredAt,

                        PayloadJson =
                            envelope.PayloadJson,

                        CanonicalJson =
                            canonicalJson,

                        ErrorsJson =
                            errorsJson,

                        OrderStatusId =
                            orderStatusId
                    },
                    commandType:
                        CommandType.StoredProcedure,
                    cancellationToken:
                        cancellationToken);

            var result =
                await conn.QuerySingleAsync<
                    ShopifyOrderImportRow>(
                        command);

            return new InboundOrderResult
            {
                Status =
                    result.ResultStatus,

                OrderId =
                    result.OrderConsumerId.ToString(
                        CultureInfo.InvariantCulture),

                ChannelOrderId =
                    channelOrderId,

                Errors =
                    errors.ToList()
            };
        }



        private sealed class ShopifyOrderImportRow
        {
            public int OrderConsumerId { get; init; }

            public string ResultStatus { get; init; } =
                string.Empty;

            public int OrderStatusId { get; init; }
        }

        public CanonicalOrder? GetCanonicalOrder(string orderId)
        {
            if (!int.TryParse(orderId, out var numericOrderId))
            {
                throw new InvalidOperationException(
                    "ORDER_ID_INVALID: A numeric OrderId is required."
                );
            }

            using var conn = GetConnection();

            using var results = conn.QueryMultiple("dbo.PIV2_OrderIntegration_GetOrder",
                new
                {
                    OrderId = numericOrderId
                },
                commandType: CommandType.StoredProcedure
            );

            var header =results.ReadFirstOrDefault<OrderHeaderRow>();

            if (header == null)
                return null;

            var billingAddresses =results.Read<OrderAddressRow>().ToList();

            var shippingAddress =results.ReadFirstOrDefault<OrderAddressRow>();

            var sections =results.Read<OrderSectionRow>().ToList();

            var sourceItems =results.Read<OrderItemRow>().ToList();

            ValidateSourceData(
                header,
                billingAddresses,
                shippingAddress,
                sections,
                sourceItems
            );

            return BuildCanonicalOrder(
                header,
                billingAddresses.Single(),
                shippingAddress!,
                sections.Single(),
                sourceItems
            );
        }

        private static void ValidateSourceData(
            OrderHeaderRow header,
            List<OrderAddressRow> billingAddresses,
            OrderAddressRow? shippingAddress,
            List<OrderSectionRow> sections,
            List<OrderItemRow> items
        )
        {
            RequireValue(
                header.SourceChannel,
                "SOURCE_CHANNEL_MISSING"
            );

            RequireValue(
                header.CustomerId,
                "CUSTOMER_ID_MISSING"
            );

            RequireValue(
                header.IntegrationOrderStatus,
                "ORDER_STATUS_MAPPING_MISSING"
            );

            RequireValue(
                header.IntegrationApprovalStatus,
                "APPROVAL_STATUS_MAPPING_MISSING"
            );

            RequireValue(
                header.IntegrationExportStatus,
                "EXPORT_STATUS_MAPPING_MISSING"
            );

            if (billingAddresses.Count == 0)
            {
                throw new InvalidOperationException(
                    "BILLING_ADDRESS_MISSING: " +
                    "No active billing address was found."
                );
            }

            if (billingAddresses.Count > 1)
            {
                throw new InvalidOperationException(
                    "BILLING_ADDRESS_AMBIGUOUS: " +
                    "More than one active billing address was found."
                );
            }

            ValidateAddress(
                billingAddresses.Single(),
                "BILLING"
            );

            if (shippingAddress == null)
            {
                throw new InvalidOperationException(
                    "SHIPPING_ADDRESS_MISSING: " +
                    "The order does not have a shipping address."
                );
            }

            ValidateAddress(
                shippingAddress,
                "SHIPPING"
            );

            if (sections.Count == 0)
            {
                throw new InvalidOperationException(
                    "ORDER_SECTION_MISSING: " +
                    "The order does not contain an order section."
                );
            }

            if (sections.Count > 1)
            {
                throw new InvalidOperationException(
                    "MULTIPLE_ORDER_SECTIONS_UNSUPPORTED: " +
                    "Canonical orders require one PO and one " +
                    "set of terms per OrderId."
                );
            }

            if (items.Count == 0)
            {
                throw new InvalidOperationException(
                    "ORDER_ITEMS_MISSING: " +
                    "The order does not contain any items."
                );
            }

            foreach (var item in items)
            {
                if (item.Quantity <= 0)
                {
                    throw new InvalidOperationException(
                        $"ITEM_QUANTITY_INVALID: Order item " +
                        $"{item.OrderItemId} has an invalid quantity."
                    );
                }

                if (item.DropShipQuantity < 0 ||
                    item.DropShipQuantity > item.Quantity)
                {
                    throw new InvalidOperationException(
                        $"DROPSHIP_QUANTITY_INVALID: Order item " +
                        $"{item.OrderItemId} has an invalid " +
                        $"dropship quantity."
                    );
                }

                RequireValue(
                    item.Sku,
                    $"ITEM_SKU_MISSING: Order item " +
                    $"{item.OrderItemId}"
                );
            }
        }

        private static CanonicalOrder BuildCanonicalOrder(
            OrderHeaderRow header,
            OrderAddressRow billingRow,
            OrderAddressRow shippingRow,
            OrderSectionRow section,
            List<OrderItemRow> sourceItems
        )
        {
            var currency = string.IsNullOrWhiteSpace(header.Currency)
                ? "USD"
                : header.Currency.Trim().ToUpperInvariant();

            var orderStatus = ParseEnum<OrderStatus>(
                header.IntegrationOrderStatus!,
                "ORDER_STATUS_MAPPING_INVALID"
            );

            var approvalStatus = ParseEnum<ApprovalStatus>(
                header.IntegrationApprovalStatus!,
                "APPROVAL_STATUS_MAPPING_INVALID"
            );

            var exportStatus = ParseEnum<ExportStatus>(header.IntegrationExportStatus!,"EXPORT_STATUS_MAPPING_INVALID");

            var sourceChannel = ParseEnum<SourceChannel>(header.SourceChannel!,"SOURCE_CHANNEL_INVALID");

            var billingAddress = BuildAddress(
                billingRow,
                header.CustomerName,
                header.CustomerPhone,
                header.CustomerEmail
            );

            var shippingAddress = BuildAddress(
                shippingRow,
                header.CustomerName,
                null,
                null
            );

            var items = new List<CanonicalOrderItem>();

            foreach (var sourceItem in sourceItems)
            {
                var warehouseQuantity =
                    sourceItem.Quantity -
                    sourceItem.DropShipQuantity;

                if (warehouseQuantity > 0)
                {
                    items.Add(
                        BuildItem(
                            sourceItem,
                            warehouseQuantity,
                            sourceItem.DropShipQuantity > 0
                                ? $"{sourceItem.OrderItemId}:WAREHOUSE"
                                : sourceItem.OrderItemId.ToString(),
                            "FG-WAREHOUSE",
                            currency
                        )
                    );
                }

                if (sourceItem.DropShipQuantity > 0)
                {
                    items.Add(
                        BuildItem(
                            sourceItem,
                            sourceItem.DropShipQuantity,
                            warehouseQuantity > 0
                                ? $"{sourceItem.OrderItemId}:DROPSHIP"
                                : sourceItem.OrderItemId.ToString(),
                            "FG-DROPSHIP",
                            currency
                        )
                    );
                }
            }

            var fulfillmentGroups =
                BuildFulfillmentGroups(
                    items,
                    shippingAddress,
                    header.ShippingMethod,
                    orderStatus
                );

            var subtotal =
                items.Sum(x => ParseAmount(x.LineTotal));

            var discountTotal =
                items
                    .SelectMany(x => x.LineDiscounts)
                    .Sum(x => ParseAmount(x.Amount));

            var shippingTotal = header.ShippingTotal;

            var grandTotal =
                subtotal + shippingTotal;

            return new CanonicalOrder
            {
                Metadata = new OrderMetadata
                {
                    OrderId = header.OrderId,
                    OrderNumber = header.OrderId,
                    CreatedAt = header.CreatedAt
                },

                Source = new OrderSource
                {
                    Channel = sourceChannel,
                    ChannelOrderId = header.OrderId
                },

                Customer = new OrderCustomer
                {
                    CustomerId = header.CustomerId!,
                    Name = header.CustomerName,
                    Email = header.CustomerEmail,
                    Phone = header.CustomerPhone,
                    PoNumber =
                        !string.IsNullOrWhiteSpace(section.PoNumber)
                            ? section.PoNumber
                            : header.PoNumber
                },

                Addresses = new OrderAddresses
                {
                    Billing = billingAddress,
                    Shipping = shippingAddress
                },

                Order = new OrderDetails
                {
                    Status = orderStatus,
                    OrderDate = DateOnly.FromDateTime(
                        header.OrderDate
                    ),
                    Currency = currency,
                    TaxInclusive = header.TaxInclusive,
                    Notes = null,

                    // We have added the contract location.
                    // Actual terms mapping comes next.
                    PaymentTerms = null
                },

                Pricing = new OrderPricing
                {
                    Subtotal = CreateMoney(
                        subtotal,
                        currency
                    ),
                    DiscountTotal = CreateMoney(
                        discountTotal,
                        currency
                    ),
                    ShippingTotal = CreateMoney(
                        shippingTotal,
                        currency
                    ),
                    GrandTotal = CreateMoney(
                        grandTotal,
                        currency
                    )
                },

                Items = items,

                Fulfillment = new Fulfillment
                {
                    FulfillmentGroups =
                        fulfillmentGroups
                },

                Workflow = new OrderWorkflow
                {
                    ApprovalStatus = approvalStatus,
                    ExportStatus = exportStatus
                },

                References = new Dictionary<string, string>
                {
                    ["proOrderId"] = header.OrderId,
                    ["proOrderSectionId"] =
                        section.OrderSectionId.ToString()
                }
            };
        }

        private static CanonicalOrderItem BuildItem(
            OrderItemRow source,
            decimal quantity,
            string lineId,
            string fulfillmentGroupId,
            string currency
        )
        {
            var lineTotal =
                source.ActualUnitPrice * quantity;

            var discountPerUnit =
                Math.Max(
                    0,
                    source.RegularUnitPrice -
                    source.ActualUnitPrice
                );

            var discounts = new List<LineDiscount>();

            if (discountPerUnit > 0)
            {
                discounts.Add(
                    new LineDiscount
                    {
                        DiscountType =
                            DiscountType.FIXED_AMOUNT,

                        Description =
                            "Regular price to sale price adjustment",

                        Amount = CreateMoney(
                            discountPerUnit * quantity,
                            currency
                        )
                    }
                );
            }

            return new CanonicalOrderItem
            {        
                LineId = lineId,
                LineType = ProInternal.Models.OrderIntegration.LineType.STANDARD,
                Sku = source.Sku,
                ProductName = source.ProductName,
                Quantity = quantity,
                UnitOfMeasure = "EA",

                UnitPrice = CreateMoney(
                    source.RegularUnitPrice,
                    currency
                ),

                LineDiscounts = discounts,

                LineTotal = CreateMoney(
                    lineTotal,
                    currency
                ),

                FulfillmentGroupId =
                    fulfillmentGroupId,

                References = new Dictionary<string, string>
                {
                    ["proOrderItemId"] =
                        source.OrderItemId.ToString(),

                    ["proOrderSectionId"] =
                        source.OrderSectionId.ToString()
                }
            };
        }

        private static List<FulfillmentGroup>
            BuildFulfillmentGroups(
                List<CanonicalOrderItem> items,
                Address shippingAddress,
                string? shippingMethod,
                OrderStatus orderStatus
            )
        {
            var groups = new List<FulfillmentGroup>();

            var fulfillmentStatus =
                MapFulfillmentStatus(orderStatus);

            if (items.Any(
                x => x.FulfillmentGroupId ==
                     "FG-WAREHOUSE"))
            {
                groups.Add(
                    new FulfillmentGroup
                    {
                        GroupId = "FG-WAREHOUSE",
                        FulfillmentType =
                            FulfillmentType.WAREHOUSE,
                        Status = fulfillmentStatus,
                        ShipTo = shippingAddress,
                        ShippingMethod = shippingMethod
                    }
                );
            }

            if (items.Any(
                x => x.FulfillmentGroupId ==
                     "FG-DROPSHIP"))
            {
                groups.Add(
                    new FulfillmentGroup
                    {
                        GroupId = "FG-DROPSHIP",
                        FulfillmentType =
                            FulfillmentType.DROPSHIP,
                        Status = fulfillmentStatus,
                        ShipTo = shippingAddress,
                        ShippingMethod = shippingMethod
                    }
                );
            }

            return groups;
        }

        private static FulfillmentStatus MapFulfillmentStatus(OrderStatus status)
        {
            return status switch
            {
                OrderStatus.FULFILLED =>FulfillmentStatus.SHIPPED,
                OrderStatus.INVOICED =>FulfillmentStatus.SHIPPED,
                OrderStatus.CLOSED =>FulfillmentStatus.DELIVERED,
                OrderStatus.CANCELLED =>FulfillmentStatus.CANCELLED, _ => FulfillmentStatus.PENDING
            };
        }

     private static Address BuildAddress(OrderAddressRow source,string? fallbackName,string? phone,string? email)
        {
            return new Address
            {
                FirstName =source.FirstName,
                LastName =source.LastName,
                Name = !string.IsNullOrWhiteSpace(source.Name)? source.Name: fallbackName,
                Line1 =source.Address1!,
                Line2 =source.Address2,
                City =source.City!,
                Region =source.State,
                PostalCode =source.PostalCode,
                Country =source.Country!.Trim().ToUpperInvariant(),
                Phone =phone,
                Email =email
            };
        }

        private static void ValidateAddress(OrderAddressRow address,string addressRole)
        {
            RequireValue(address.Address1,$"{addressRole}_ADDRESS_LINE1_MISSING");
            RequireValue(address.City,$"{addressRole}_ADDRESS_CITY_MISSING");
            RequireValue(address.Country,$"{addressRole}_ADDRESS_COUNTRY_MISSING");
        }

        private static void RequireValue(string? value,string errorCode)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new InvalidOperationException($"{errorCode}: A required source value is missing.");
            }
        }

        private static TEnum ParseEnum<TEnum>(
            string value,
            string errorCode
        )
            where TEnum : struct, Enum
        {
            if (Enum.TryParse<TEnum>(
                value,
                false,
                out var parsed
            ))
            {
                return parsed;
            }

            throw new InvalidOperationException(
                $"{errorCode}: '{value}' is not supported."
            );
        }

        private static Money CreateMoney(
            decimal amount,
            string currency
        )
        {
            return new Money
            {
                Amount = amount.ToString(
                    "0.00##",
                    CultureInfo.InvariantCulture
                ),
                Currency = currency
            };
        }

        private static decimal ParseAmount(
            Money? money
        )
        {
            if (money == null)
                return 0;

            return decimal.Parse(
                money.Amount,
                CultureInfo.InvariantCulture
            );
        }

        private sealed class OrderHeaderRow
        {
            public string OrderId { get; init; } = "";
            public DateTimeOffset CreatedAt { get; init; }
            public DateTime OrderDate { get; init; }

            public string? SourceChannel { get; init; }

            public string? CustomerId { get; init; }
            public string? CustomerName { get; init; }
            public string? CustomerEmail { get; init; }
            public string? CustomerPhone { get; init; }

            public string? PoNumber { get; init; }

            public int LegacyOrderStatusId { get; init; }
            public string? LegacyOrderStatusName { get; init; }

            public string? IntegrationOrderStatus { get; init; }
            public string? IntegrationApprovalStatus { get; init; }
            public string? IntegrationExportStatus { get; init; }

            public int OrderTypeId { get; init; }
            public string? OrderTypeName { get; init; }

            public decimal ShippingTotal { get; init; }
            public string Currency { get; init; } = "USD";
            public bool TaxInclusive { get; init; }

            public bool AutoHold { get; init; }
            public bool HoldOverride { get; init; }
            public DateTime? ApprovedDate { get; init; }

            public int? ShippingMethodCode { get; init; }
            public string? ShippingMethod { get; init; }
        }

        private sealed class OrderAddressRow
        {
            public int AddressId { get; init; }
            public string? Name { get; init; }

            public string? FirstName { get; init; }
            public string? LastName { get; init; }

            public string? Address1 { get; init; }
            public string? Address2 { get; init; }
            public string? City { get; init; }
            public string? State { get; init; }
            public string? PostalCode { get; init; }
            public string? Country { get; init; }

            public bool? IsPrimary { get; init; }
        }

        private sealed class OrderSectionRow
        {
            public int OrderSectionId { get; init; }
            public int OrderId { get; init; }
            public int? SpecialId { get; init; }
            public string? PoNumber { get; init; }
            public int ThresholdMet { get; init; }
            public bool Consolidated { get; init; }
            public bool Terms { get; init; }
        }

        private sealed class OrderItemRow
        {
            public int OrderItemId { get; init; }
            public int OrderId { get; init; }
            public int OrderSectionId { get; init; }
            public int ProductId { get; init; }

            public string? Sku { get; init; }
            public string? ProductName { get; init; }

            public decimal Quantity { get; init; }
            public decimal DropShipQuantity { get; init; }

            public decimal RegularUnitPrice { get; init; }
            public decimal ActualUnitPrice { get; init; }
            public decimal LineTotal { get; init; }
            public decimal LineDiscountTotal { get; init; }

            public int OrderItemStatusId { get; init; }
            public int? SpecialId { get; init; }
            public int? OrderBundleId { get; init; }
            public int? SortID { get; init; }
        }
    }
}