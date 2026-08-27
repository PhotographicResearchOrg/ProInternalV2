using ProInternal.Models.OrderIntegration;
using ProInternal.Models.OrderIntegration.Shopify;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;


namespace ProInternal.Services.OrderIntegration.Adapters.Inbound.Shopify
{
    public sealed class ShopifyOrderAdapter : IShopifyOrderAdapter
    {
        //Set Default currecny
        private const string DefaultCurrency = "USD";
        private const string FulfillmentGroupId = "SHOPIFY-PRIMARY";
        //For PO box Rejection
        private static readonly Regex PoBoxPattern = new(@"\b(?:P(?:OST)?\.?\s*O(?:FFICE)?\.?\s*(?:BOX|B(?:IN)?))\b",RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);
        public ShopifyOrderMappingResult Map(ShopifyWebhookEnvelope envelope,ShopifyOrderPayload payload)
        {
            //Error out if bad data
            ArgumentNullException.ThrowIfNull(envelope);
            ArgumentNullException.ThrowIfNull(payload);

            var errors = new List<InboundOrderError>();

            //transport wrapper check
            ValidateEnvelope(envelope, errors);
            ValidatePayload(payload, errors);

            //Remove Space --> Go to Upper
            //Uses global variable for default --> USD. 
            var currency = NormalizeCurrency(payload.Currency);

            var billingSource =payload.BillingAddress ?? payload.ShippingAddress;
            var shippingSource = payload.ShippingAddress;

            var billingAddress = MapAddress(billingSource,payload.Email ?? payload.ContactEmail,"billing_address",errors);

            Address? shippingAddress = null;


            if (shippingSource is not null)
            {
                shippingAddress = MapAddress(shippingSource,payload.Email ?? payload.ContactEmail,"shipping_address",errors);
            }

            var items = MapItems(payload.LineItems,currency,errors);
            var shippingTotal = CalculateShippingTotal(payload.ShippingLines,currency,errors);
            
            var order = new CanonicalOrder
            {
                Metadata = new OrderMetadata
                {
                    OrderId = payload.Id.ToString(CultureInfo.InvariantCulture),
                    OrderNumber =payload.Name ?? payload.OrderNumber?.ToString(CultureInfo.InvariantCulture),
                    CreatedAt = payload.CreatedAt,
                    UpdatedAt = payload.UpdatedAt
                },
                Source = new OrderSource
                {
                    Channel = SourceChannel.SHOPIFY,
                    ChannelOrderId = payload.Id.ToString(CultureInfo.InvariantCulture),
                    StoreId = envelope.ShopDomain
                },
                Customer = MapCustomer(payload),
                Addresses = new OrderAddresses
                {
                    Billing = billingAddress,
                    Shipping = shippingAddress
                },
                Order = new OrderDetails
                {
                    Status = MapOrderStatus(payload),
                    OrderDate = DateOnly.FromDateTime(payload.CreatedAt.UtcDateTime),
                    Currency = currency,
                    TaxInclusive = payload.TaxesIncluded,
                    Notes = NullIfWhiteSpace(payload.Note),
                    PaymentTerms = null
                },
                Pricing = new OrderPricing
                {
                    Subtotal = CreateMoney(payload.SubtotalPrice,currency, "subtotal_price", errors),
                    DiscountTotal = CreateMoney(payload.TotalDiscounts,currency,"total_discounts",errors),
                    ShippingTotal = shippingTotal,
                    TaxTotal = CreateMoney(payload.TotalTax, currency,"total_tax",errors),
                    GrandTotal = CreateRequiredMoney(payload.TotalPrice,currency, "total_price",errors),
                    OrderDiscounts = []
                },
                Items = items,
                Fulfillment = new Fulfillment
                {
                    FulfillmentGroups =
                    [
                        new FulfillmentGroup
                        {
                            GroupId = FulfillmentGroupId,
                            FulfillmentType =shippingAddress is null? FulfillmentType.PICKUP: FulfillmentType.WAREHOUSE,
                            Status = MapFulfillmentStatus(payload.FulfillmentStatus),
                            ShipTo = shippingAddress,
                            ShippingMethod = GetShippingMethod(payload.ShippingLines),
                            Shipments = []
                        }
                    ]
                },

                /*
                 * Shopify's orders/create webhook does not provide the
                 * complete transaction collection. Do not manufacture
                 * payment records from financial_status alone.
                 */

                Payments = [],

                Workflow = new OrderWorkflow
                {
                    ApprovalStatus = ApprovalStatus.NOT_REQUIRED,
                    ExportStatus =ExportStatus.NOT_EXPORTED,
                    Holds = []
                },
                References = BuildReferences(envelope,payload),
                Extensions = new OrderExtensions(),
                Audit = new OrderAudit
                {
                    CreatedBy = "SHOPIFY",
                    Events =
                    [
                        new OrderAuditEvent
                        {
                            Event = "SHOPIFY_ORDER_RECEIVED",
                            At = DateTimeOffset.UtcNow,
                            Actor = envelope.ShopDomain,
                            Detail =$"Webhook {envelope.WebhookId}"
                        }
                    ]
                }
            };

            return new ShopifyOrderMappingResult(order,errors);
        }



        //Validation 
        private static void ValidateEnvelope(ShopifyWebhookEnvelope envelope,List<InboundOrderError> errors)
        {
            if (string.IsNullOrWhiteSpace(envelope.WebhookId))
            {
                AddError( errors,"MISSING_WEBHOOK_ID","webhookId","Shopify webhook ID is required.");
            }
            if (string.IsNullOrWhiteSpace(envelope.ShopDomain))
            {
                AddError(errors,"MISSING_SHOP_DOMAIN","shopDomain","Shopify shop domain is required.");
            }
            if (!string.Equals( envelope.Topic,"orders/create",StringComparison.OrdinalIgnoreCase))
            {
                AddError(errors,"INVALID_TOPIC","topic","Expected Shopify topic orders/create.");
            }
        }

        private static void ValidatePayload(ShopifyOrderPayload payload,List<InboundOrderError> errors)
        {
            if (payload.Id <= 0)
            {
                AddError( errors,"MISSING_ORDER_ID","payload.id","Shopify order ID is required.");
            }

            if (payload.CreatedAt == default)
            {
                AddError(errors,"MISSING_CREATED_AT","payload.created_at","Shopify order creation date is required.");
            }

            if (string.IsNullOrWhiteSpace(payload.Currency))
            {
                AddError(errors, "MISSING_CURRENCY","payload.currency","Shopify order currency is missing; USD was used.");
            }

            if (payload.BillingAddress is null && payload.ShippingAddress is null)
            {
                AddError(errors,"MISSING_ADDRESS","payload.billing_address","The order has neither a billing nor shipping address.");
            }

            if (payload.LineItems.Count == 0)
            {
                AddError(errors,"NO_ORDER_ITEMS","payload.line_items","The Shopify order contains no line items.");
            }

            if (string.IsNullOrWhiteSpace(payload.TotalPrice))
            {
                AddError( errors, "MISSING_TOTAL_PRICE","payload.total_price","Shopify order total is required.");
            }
        }


        private static OrderCustomer MapCustomer(ShopifyOrderPayload payload)
        {
            var customer = payload.Customer;
            var customerId =customer?.Id > 0? customer.Id.ToString(CultureInfo.InvariantCulture): $"GUEST-{payload.Id}";
            var name = JoinName(customer?.FirstName,customer?.LastName);

            if (string.IsNullOrWhiteSpace(name))
            {
                name =payload.BillingAddress?.Name ?? payload.ShippingAddress?.Name;
            }

            return new OrderCustomer
            {
                CustomerId = customerId,

                Name = NullIfWhiteSpace(name),

                Email = NullIfWhiteSpace(
                    customer?.Email ??
                    payload.Email ??
                    payload.ContactEmail),

                Phone = NullIfWhiteSpace(
                    customer?.Phone ??
                    payload.Phone ??
                    payload.BillingAddress?.Phone ??
                    payload.ShippingAddress?.Phone),

                PoNumber = NullIfWhiteSpace(payload.PoNumber)
            };
        }

        private static Address MapAddress(ShopifyAddress? source,string? email,string fieldPrefix,List<InboundOrderError> errors)
        {
            if (source is null)
            {
                return new Address
                {
                    FirstName = null,
                    LastName = null,
                    Name = null,
                    Attention = null,
                    Line1 = string.Empty,
                    City = string.Empty,
                    Country = string.Empty,
                    Email = NullIfWhiteSpace(email)
                };
            }

            /*
             * A PO Box is allowed as a billing address, but never as the
             * shipping destination.
             */
            if (
                    string.Equals( fieldPrefix,"shipping_address",StringComparison.OrdinalIgnoreCase) 
                    &&
                    ContainsPoBox(source.Address1,source.Address2)
                )
                {
                    AddError(errors,"PO_BOX_NOT_ALLOWED",$"{fieldPrefix}.address1","Orders cannot be shipped to a PO Box.");
                }

             RequireAddressValue(source.Address1,$"{fieldPrefix}.address1","Address line 1 is required.",errors);

             RequireAddressValue(source.City, $"{fieldPrefix}.city", "City is required.", errors);

             var country =source.CountryCode ?? source.Country;

             RequireAddressValue(country,$"{fieldPrefix}.country","Country is required.",errors);

             var contactName = source.Name ?? JoinName( source.FirstName, source.LastName);

            return new Address
            {
                FirstName = NullIfWhiteSpace(source.FirstName),
                LastName = NullIfWhiteSpace(source.LastName),
                Name = NullIfWhiteSpace(source.Company ?? contactName),
                Attention = !string.IsNullOrWhiteSpace(source.Company) ? NullIfWhiteSpace(contactName) : null,
                Line1 =source.Address1?.Trim() ?? string.Empty,
                Line2 =NullIfWhiteSpace(source.Address2),
                City =source.City?.Trim() ??  string.Empty,
                Region = NullIfWhiteSpace( source.ProvinceCode ?? source.Province),
                PostalCode =NullIfWhiteSpace(source.PostalCode),
                Country =country?.Trim() ??string.Empty,
                Phone =  NullIfWhiteSpace(source.Phone),
                Email =NullIfWhiteSpace(email),
                Residential = null
            };
        }

        private static List<CanonicalOrderItem> MapItems(IReadOnlyList<ShopifyLineItem> sourceItems,string currency, List<InboundOrderError> errors)
        {
            var items =
                new List<CanonicalOrderItem>(
                    sourceItems.Count);

            for (var index = 0;
                 index < sourceItems.Count;
                 index++)
            {
                var source = sourceItems[index];
                var prefix = $"line_items[{index}]";

                if (source.Id <= 0)
                {
                    AddError(
                        errors,
                        "MISSING_LINE_ID",
                        $"{prefix}.id",
                        "Shopify line ID is required.");
                }

                if (string.IsNullOrWhiteSpace(source.Sku))
                {
                    AddError(
                        errors,
                        "MISSING_SKU",
                        $"{prefix}.sku",
                        "SKU is required for order reconciliation.");
                }

                if (source.Quantity <= 0)
                {
                    AddError(
                        errors,
                        "INVALID_QUANTITY",
                        $"{prefix}.quantity",
                        "Quantity must be greater than zero.");
                }

                var unitPrice = ParseAmount(
                    source.Price,
                    $"{prefix}.price",
                    errors);

                var totalDiscount =
                    ParseOptionalAmount(
                        source.TotalDiscount,
                        $"{prefix}.total_discount",
                        errors) ?? 0m;

                var calculatedLineTotal =
                    (unitPrice * source.Quantity) -
                    totalDiscount;

                if (calculatedLineTotal < 0)
                {
                    AddError(
                        errors,
                        "INVALID_LINE_TOTAL",
                        prefix,
                        "Calculated line total cannot be negative.");

                    calculatedLineTotal = 0m;
                }

                var discounts =
                    MapLineDiscounts(
                        source,
                        currency,
                        prefix,
                        errors);

                items.Add(
                    new CanonicalOrderItem
                    {
                        LineId =
                            source.Id.ToString(
                                CultureInfo.InvariantCulture),

                        LineType = source.GiftCard
                            ? LineType.PROMOTIONAL
                            : LineType.STANDARD,

                        Sku = NullIfWhiteSpace(source.Sku),

                        ProductName = NullIfWhiteSpace(
                            source.Name ??
                            source.Title),

                        Quantity = source.Quantity,

                        UnitOfMeasure = "EA",

                        UnitPrice = MoneyFromDecimal(
                            unitPrice,
                            currency),

                        LineDiscounts = discounts,

                        LineTotal = MoneyFromDecimal(
                            calculatedLineTotal,
                            currency),

                        FulfillmentGroupId =
                            source.RequiresShipping
                                ? FulfillmentGroupId
                                : null,

                        References =
                            BuildLineReferences(source)
                    });
            }

            return items;
        }

        private static List<LineDiscount> MapLineDiscounts(
            ShopifyLineItem source,
            string currency,
            string fieldPrefix,
            List<InboundOrderError> errors)
        {
            var discounts = new List<LineDiscount>();

            for (var index = 0;
                 index < source.DiscountAllocations.Count;
                 index++)
            {
                var allocation =
                    source.DiscountAllocations[index];

                var amount = ParseAmount(
                    allocation.Amount,
                    $"{fieldPrefix}.discount_allocations[{index}].amount",
                    errors);

                discounts.Add(
                    new LineDiscount
                    {
                        DiscountType =
                            DiscountType.FIXED_AMOUNT,

                        Description =
                            "Shopify discount allocation",

                        Amount = MoneyFromDecimal(
                            amount,
                            currency)
                    });
            }

            /*
             * Some Shopify payloads provide total_discount but omit
             * discount_allocations. Preserve the known total.
             */
            if (discounts.Count == 0)
            {
                var totalDiscount =
                    ParseOptionalAmount(
                        source.TotalDiscount,
                        $"{fieldPrefix}.total_discount",
                        errors);

                if (totalDiscount > 0)
                {
                    discounts.Add(
                        new LineDiscount
                        {
                            DiscountType =
                                DiscountType.FIXED_AMOUNT,

                            Description =
                                "Shopify line discount",

                            Amount = MoneyFromDecimal(
                                totalDiscount.Value,
                                currency)
                        });
                }
            }

            return discounts;
        }

        private static Money CalculateShippingTotal(
            IReadOnlyList<ShopifyShippingLine> lines,
            string currency,
            List<InboundOrderError> errors)
        {
            decimal total = 0m;

            for (var index = 0;
                 index < lines.Count;
                 index++)
            {
                var line = lines[index];

                var amount =
                    line.DiscountedPrice ??
                    line.Price;

                total += ParseAmount(
                    amount,
                    $"shipping_lines[{index}].price",
                    errors);
            }

            return MoneyFromDecimal(total, currency);
        }

        private static string? GetShippingMethod(
            IReadOnlyList<ShopifyShippingLine> lines)
        {
            var values = lines
                .Select(x =>
                    NullIfWhiteSpace(
                        x.Code ??
                        x.Title))
                .Where(x => x is not null)
                .Distinct(StringComparer.OrdinalIgnoreCase);

            return NullIfWhiteSpace(
                string.Join(", ", values));
        }

        private static OrderStatus MapOrderStatus(ShopifyOrderPayload payload)
        {
            if (payload.CancelledAt is not null)
                return OrderStatus.CANCELLED;

            return payload.FulfillmentStatus?
                .Trim()
                .ToLowerInvariant() switch
            {
                "fulfilled" =>
                    OrderStatus.FULFILLED,

                "partial" =>
                    OrderStatus.PARTIALLY_FULFILLED,

                "restocked" =>
                    OrderStatus.CANCELLED,

                _ =>
                    OrderStatus.OPEN
            };
        }

        private static FulfillmentStatus MapFulfillmentStatus(
            string? status)
        {
            return status?
                .Trim()
                .ToLowerInvariant() switch
            {
                "fulfilled" =>
                    FulfillmentStatus.SHIPPED,

                "partial" =>
                    FulfillmentStatus.ALLOCATED,

                "restocked" =>
                    FulfillmentStatus.CANCELLED,

                _ =>
                    FulfillmentStatus.PENDING
            };
        }

        private static Dictionary<string, string>
            BuildReferences(
                ShopifyWebhookEnvelope envelope,
                ShopifyOrderPayload payload)
        {
            var references =
                new Dictionary<string, string>(
                    StringComparer.OrdinalIgnoreCase)
                {
                    ["shopifyWebhookId"] =
                        envelope.WebhookId,

                    ["shopifyOrderId"] =
                        payload.Id.ToString(
                            CultureInfo.InvariantCulture),

                    ["shopDomain"] =
                        envelope.ShopDomain
                };

            AddReference(
                references,
                "shopifyEventId",
                envelope.EventId);

            AddReference(
                references,
                "shopifyApiVersion",
                envelope.ApiVersion);

            AddReference(
                references,
                "shopifyOrderGid",
                payload.AdminGraphqlApiId);

            AddReference(
                references,
                "shopifyConfirmationNumber",
                payload.ConfirmationNumber);

            return references;
        }

        private static Dictionary<string, string>
            BuildLineReferences(
                ShopifyLineItem item)
        {
            var references =
                new Dictionary<string, string>(
                    StringComparer.OrdinalIgnoreCase);

            AddReference(
                references,
                "shopifyLineGid",
                item.AdminGraphqlApiId);

            if (item.ProductId is not null)
            {
                references["shopifyProductId"] =
                    item.ProductId.Value.ToString(
                        CultureInfo.InvariantCulture);
            }

            if (item.VariantId is not null)
            {
                references["shopifyVariantId"] =
                    item.VariantId.Value.ToString(
                        CultureInfo.InvariantCulture);
            }

            return references;
        }

        private static Money? CreateMoney(
            string? value,
            string currency,
            string field,
            List<InboundOrderError> errors)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            return MoneyFromDecimal(
                ParseAmount(value, field, errors),
                currency);
        }

        private static Money CreateRequiredMoney(
            string? value,
            string currency,
            string field,
            List<InboundOrderError> errors)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return MoneyFromDecimal(
                    0m,
                    currency);
            }

            return MoneyFromDecimal(
                ParseAmount(
                    value,
                    field,
                    errors),
                currency);
        }



        private static decimal ParseAmount(
            string? value,
            string field,
            List<InboundOrderError> errors)
        {
            if (decimal.TryParse(
                    value,
                    NumberStyles.Number,
                    CultureInfo.InvariantCulture,
                    out var amount))
            {
                return amount;
            }

            AddError(
                errors,
                "INVALID_MONEY",
                field,
                $"'{value}' is not a valid monetary amount.");

            return 0m;
        }

        private static decimal? ParseOptionalAmount(
            string? value,
            string field,
            List<InboundOrderError> errors)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            return ParseAmount(value, field, errors);
        }

        private static Money MoneyFromDecimal(
            decimal amount,
            string currency)
        {
            return new Money
            {
                Amount = amount.ToString(
                    "0.00####",
                    CultureInfo.InvariantCulture),

                Currency = currency
            };
        }

        private static string NormalizeCurrency(string? currency)
        {
            return string.IsNullOrWhiteSpace(currency) ? DefaultCurrency: currency.Trim().ToUpperInvariant();
        }


        private static string? JoinName(
            string? firstName,
            string? lastName)
        {
            return NullIfWhiteSpace(
                string.Join(
                    " ",
                    new[]
                    {
                        firstName?.Trim(),
                        lastName?.Trim()
                    }
                    .Where(x =>
                        !string.IsNullOrWhiteSpace(x))));
        }

        private static void RequireAddressValue(string? value,string field,string message,List<InboundOrderError> errors)
        {
            if (!string.IsNullOrWhiteSpace(value))
                return;

            AddError(errors,"MISSING_ADDRESS_FIELD",field,message);
        }

        private static void AddReference(
            IDictionary<string, string> references,
            string key,
            string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                references[key] = value.Trim();
            }
        }

        private static string? NullIfWhiteSpace(
            string? value)
        {
            return string.IsNullOrWhiteSpace(value)
                ? null
                : value.Trim();
        }

        private static void AddError(
            ICollection<InboundOrderError> errors,
            string code,
            string field,
            string message)
        {
            errors.Add(
                new InboundOrderError
                {
                    Code = code,
                    Field = field,
                    Message = message
                });
        }


        private static bool ContainsPoBox(
    string? address1,
    string? address2)
        {
            return
                (!string.IsNullOrWhiteSpace(address1) &&
                 PoBoxPattern.IsMatch(address1)) ||
                (!string.IsNullOrWhiteSpace(address2) &&
                 PoBoxPattern.IsMatch(address2));
        }


    }
}