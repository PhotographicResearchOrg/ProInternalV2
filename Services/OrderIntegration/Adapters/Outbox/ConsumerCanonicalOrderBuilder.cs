using ProInternal.Models.OrderIntegration;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace ProInternal.Services.OrderIntegration.Adapters.Outbox
{
    /*
     * Builds a consumer order (OrderConsumer / OrderItemConsumer) as a
     * contract order, the consumer counterpart of GetCanonicalOrder for
     * warehouse orders. Anything leaving PRO for a consumer order is
     * mapped from this, never from the tables.
     *
     * A problem that stops the order being built is raised as an
     * InvalidOperationException with the reason, the same way the
     * warehouse builder reports one.
     */
    public static class ConsumerCanonicalOrderBuilder
    {
        public const string FulfillmentGroupId = "CONSUMER-PRIMARY";
        private const string Currency = "USD";

        public static CanonicalOrder Build(ConsumerOrderSource source)
        {
            ArgumentNullException.ThrowIfNull(source);

            if (source.Lines.Count == 0)
            {
                throw new InvalidOperationException(
                    "NO_ORDER_ITEMS: the order has no lines.");
            }

            var orderId = source.OrderConsumerId.ToString(CultureInfo.InvariantCulture);

            var shipTo = BuildAddress(
                source.ShippingFirstName, source.ShippingLastName,
                source.ShippingAddress1, source.ShippingAddress2,
                source.ShippingCity, source.ShippingState,
                source.ShippingZip, source.ShippingCountry,
                source.ShippingPhone, source.Email,
                "SHIPPING_ADDRESS_INCOMPLETE");

            var billing = BuildAddress(
                source.BillingFirstName, source.BillingLastName,
                source.BillingAddress1, source.BillingAddress2,
                source.BillingCity, source.BillingState,
                source.BillingZip, source.BillingCountry,
                source.BillingPhone, source.Email,
                "BILLING_ADDRESS_INCOMPLETE");

            var items = source.Lines
                .Select(line => new CanonicalOrderItem
                {
                    LineId = line.OrderItemConsumerId.ToString(CultureInfo.InvariantCulture),
                    LineType = LineType.STANDARD,
                    Sku = Clean(line.Sku),
                    ProductName = Clean(line.ProductName),
                    Quantity = line.Quantity,
                    UnitOfMeasure = "EA",
                    UnitPrice = ToMoney(line.UnitPrice),
                    LineTotal = ToMoney(line.UnitPrice * line.Quantity),
                    FulfillmentGroupId = FulfillmentGroupId,
                    References = new Dictionary<string, string>
                    {
                        ["proOrderItemConsumerId"] =
                            line.OrderItemConsumerId.ToString(CultureInfo.InvariantCulture)
                    }
                })
                .ToList();

            var subtotal = source.Lines.Sum(line => line.UnitPrice * line.Quantity);

            var grandTotal =
                subtotal + source.ShippingTotal + source.TaxTotal - source.DiscountTotal;

            var isShopify = !string.IsNullOrWhiteSpace(source.ShopifyOrderId);

            var references = new Dictionary<string, string>
            {
                ["proOrderConsumerId"] = orderId
            };

            AddReference(references, "shopifyOrderId", source.ShopifyOrderId);
            AddReference(references, "paypalInvoiceNumber", source.PaypalInvoiceNumber);
            AddReference(references, "onlineOrderNumber", source.OnlineOrderNumber);

            if (source.InboxId is not null)
            {
                references["proInboxId"] =
                    source.InboxId.Value.ToString(CultureInfo.InvariantCulture);
            }

            return new CanonicalOrder
            {
                Metadata = new OrderMetadata
                {
                    OrderId = orderId,
                    OrderNumber = Clean(source.OnlineOrderNumber),
                    CreatedAt = source.CreatedAt
                },

                Source = new OrderSource
                {
                    /* A consumer order that did not come from Shopify
                     * was keyed or taken on the old consumer site. */
                    Channel = isShopify ? SourceChannel.SHOPIFY : SourceChannel.MANUAL,
                    ChannelOrderId = Clean(source.ShopifyOrderId)
                        ?? Clean(source.PaypalInvoiceNumber),
                    StoreId = Clean(source.StoreId)
                },

                Customer = new OrderCustomer
                {
                    /* A consumer is identified by email. */
                    CustomerId = Require(source.Email, "MISSING_EMAIL", "The order has no email."),
                    Name = FullName(source.BillingFirstName, source.BillingLastName),
                    Email = Clean(source.Email),
                    Phone = Clean(source.BillingPhone) ?? Clean(source.ShippingPhone)
                },

                Addresses = new OrderAddresses
                {
                    Billing = billing,
                    Shipping = shipTo
                },

                Order = new OrderDetails
                {
                    Status = ParseEnum<OrderStatus>(
                        source.IntegrationOrderStatus, "ORDER_STATUS_MAPPING_MISSING"),
                    OrderDate = DateOnly.FromDateTime(source.OrderDate),
                    Currency = Currency,
                    TaxInclusive = false
                },

                Pricing = new OrderPricing
                {
                    Subtotal = ToMoney(subtotal),
                    DiscountTotal = ToMoney(source.DiscountTotal),
                    ShippingTotal = ToMoney(source.ShippingTotal),
                    TaxTotal = ToMoney(source.TaxTotal),
                    GrandTotal = ToMoney(grandTotal)
                },

                Items = items,

                Fulfillment = new Fulfillment
                {
                    FulfillmentGroups =
                    [
                        new FulfillmentGroup
                        {
                            GroupId = FulfillmentGroupId,
                            FulfillmentType = FulfillmentType.WAREHOUSE,
                            Status = FulfillmentStatus.PENDING,
                            ShipTo = shipTo,
                            ShippingMethod = Clean(source.ShippingMethod)
                        }
                    ]
                },

                Workflow = new OrderWorkflow
                {
                    ApprovalStatus = ParseEnum<ApprovalStatus>(
                        source.IntegrationApprovalStatus, "APPROVAL_STATUS_MAPPING_MISSING"),
                    ExportStatus = ParseEnum<ExportStatus>(
                        source.ExportState ?? nameof(ExportStatus.NOT_EXPORTED),
                        "EXPORT_STATUS_INVALID")
                },

                References = references,

                Audit = new OrderAudit
                {
                    CreatedBy = isShopify ? "SHOPIFY" : "CONSUMER"
                }
            };
        }

        private static Address BuildAddress(
            string? firstName, string? lastName,
            string? line1, string? line2,
            string? city, string? region,
            string? postalCode, string? country,
            string? phone, string? email,
            string errorCode)
        {
            return new Address
            {
                FirstName = Clean(firstName),
                LastName = Clean(lastName),
                Name = FullName(firstName, lastName),
                Line1 = Require(line1, errorCode, "Address line 1 is missing."),
                Line2 = Clean(line2),
                City = Require(city, errorCode, "City is missing."),
                Region = Clean(region),
                PostalCode = Clean(postalCode),
                /* Older consumer orders were US only and left this blank. */
                Country = Clean(country) ?? "US",
                Phone = Clean(phone),
                Email = Clean(email)
            };
        }

        private static string? FullName(string? firstName, string? lastName)
        {
            return Clean($"{firstName} {lastName}");
        }

        private static string? Clean(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        private static string Require(string? value, string errorCode, string message)
        {
            return Clean(value)
                ?? throw new InvalidOperationException($"{errorCode}: {message}");
        }

        private static void AddReference(
            Dictionary<string, string> references, string key, string? value)
        {
            var clean = Clean(value);

            if (clean is not null)
                references[key] = clean;
        }

        private static TEnum ParseEnum<TEnum>(string? value, string errorCode)
            where TEnum : struct, Enum
        {
            if (Enum.TryParse<TEnum>(value, false, out var parsed))
                return parsed;

            throw new InvalidOperationException(
                $"{errorCode}: '{value}' is not a contract value.");
        }

        private static Money ToMoney(decimal amount)
        {
            return new Money
            {
                Amount = amount.ToString("0.00##", CultureInfo.InvariantCulture),
                Currency = Currency
            };
        }
    }
}
