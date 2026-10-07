using ProInternal.Models.OrderIntegration;
using ProInternal.Models.OrderIntegration.Shopify;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Xml;
using System.Xml.Linq;

/*
 * Everything for reading a file-based inbound order, in one file.
 *
 *   1. PosOrderAdapter        POS ORDER XML -> contract order
 *   2. InboundLookup          PRO's own data for one order (account,
 *                             ship-to, products), loaded in one call
 *                             by OrderInboxDataAccess
 *   3. InboundOrderBuilder    the checks every file-based channel shares
 *
 * Parts 2 and 3 are not POS-specific. The EDI 850 adapter uses them
 * as they are.
 */

namespace ProInternal.Services.OrderIntegration.Adapters.Inbound.Pos
{
    /*
     * POS ORDER XML -> canonical order.
     *
     *   <ORDER>
     *     <TimeDate>10-02-26 08:19:52</TimeDate>
     *     <ProMember>8379</ProMember>          ("8379-2" = alternate ship-to 2)
     *     <PODate>10-02-26</PODate>
     *     <PONumber>709055</PONumber>
     *     <Detail> Product / Quantity / Cost / Description ... </Detail>
     *              (one Detail can hold many lines)
     *     <OrderTotal>112.23</OrderTotal>
     *   </ORDER>
     *
     * The adapter only translates and reports. It never writes to SQL.
     */
    public sealed class PosOrderAdapter : IPosOrderAdapter
    {
        private const string FulfillmentGroupId = "POS-PRIMARY";

        private static readonly string[] DateFormats = ["MM-dd-yy", "M-d-yy", "MM/dd/yy", "M/d/yy", "MM-dd-yyyy", "M/d/yyyy"];
        private static readonly string[] TimeFormats = ["MM-dd-yy HH:mm:ss", "M-d-yy H:mm:ss", "MM/dd/yy HH:mm:ss", "M/d/yy H:mm:ss"];

        private readonly IOrderInboxDataAccess _data;

        public PosOrderAdapter(IOrderInboxDataAccess data)
        {
            _data = data;
        }

        public PosOrderMappingResult Map(string fileName, string xml)
        {
            ArgumentNullException.ThrowIfNull(fileName);
            ArgumentNullException.ThrowIfNull(xml);

            var errors = new List<InboundOrderError>();

            XElement? root;

            try
            {
                root = XDocument.Parse(xml).Root;
            }
            catch (XmlException ex)
            {
                InboundOrderBuilder.AddError(errors, "INVALID_XML", "file",
                    $"The POS file is not valid XML: {ex.Message}");

                return new PosOrderMappingResult(null, errors);
            }

            if (root is null || !string.Equals(root.Name.LocalName, "ORDER", StringComparison.OrdinalIgnoreCase))
            {
                InboundOrderBuilder.AddError(errors, "INVALID_XML", "ORDER",
                    "The POS file does not contain an ORDER element.");

                return new PosOrderMappingResult(null, errors);
            }

            var proMember = Text(root, "ProMember");
            var poNumber = Text(root, "PONumber");
            var poDateText = Text(root, "PODate");
            var timeDateText = Text(root, "TimeDate");
            var orderTotalText = Text(root, "OrderTotal");

            if (proMember is null)
            {
                InboundOrderBuilder.AddError(errors, "MISSING_CUSTOMER", "ProMember",
                    "ProMember is required.");
            }

            if (poNumber is null)
            {
                InboundOrderBuilder.AddError(errors, "MISSING_PO_NUMBER", "PONumber",
                    "PONumber is required.");
            }

            /*
             * "8379"    -> account 8379, default ship-to
             * "8379-12" -> account 8379, alternate ship-to 12
             * The whole suffix is used, not just its first character.
             */
            var account = proMember ?? string.Empty;
            string? shipToCode = null;
            var dash = account.IndexOf('-');

            if (dash >= 0)
            {
                shipToCode = InboundOrderBuilder.NullIfWhiteSpace(account[(dash + 1)..]);
                account = account[..dash].Trim();
            }

            var orderDate = ParseOrderDate(poDateText, errors);
            var createdAt = ParseCreatedAt(timeDateText, orderDate);

            var statedTotal = InboundOrderBuilder.ParseDecimal(orderTotalText);

            if (orderTotalText is not null && statedTotal is null)
            {
                InboundOrderBuilder.AddError(errors, "INVALID_MONEY", "OrderTotal",
                    $"'{orderTotalText}' is not a valid order total.");
            }

            var lines = ReadLines(root);

            var references = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["posSourceFile"] = fileName
            };

            if (poNumber is not null) references["posOrderNumber"] = poNumber;
            if (proMember is not null) references["proMember"] = account;
            if (proMember is not null) references["proShipTo"] = proMember;

            var pos = new Dictionary<string, JsonElement>();

            if (timeDateText is not null) pos["timeDate"] = JsonSerializer.SerializeToElement(timeDateText);
            if (orderTotalText is not null) pos["orderTotal"] = JsonSerializer.SerializeToElement(orderTotalText);

            var extensions = new OrderExtensions();

            if (pos.Count > 0)
            {
                extensions.AdditionalNamespaces["pos"] = JsonSerializer.SerializeToElement(pos);
            }

            var draft = new InboundOrderDraft
            {
                Channel = SourceChannel.POS,
                OrderId = $"POS-{account}-{poNumber}",
                OrderNumber = poNumber,
                ChannelOrderId = poNumber ?? string.Empty,
                StoreId = InboundOrderBuilder.NullIfWhiteSpace(account),
                AccountNumber = account,
                ShipToCode = shipToCode,
                PoNumber = poNumber,
                CreatedAt = createdAt,
                OrderDate = orderDate,
                Notes = Text(root, "SpecialInstructions"),
                TermsCode = Text(root, "Terms"),
                StatedTotal = statedTotal,

                /*
                 * A POS OrderTotal can include charges that are not on a
                 * Detail line (the sample totals 112.23 on a 97.61 line),
                 * so the two are not compared.
                 */
                CheckTotal = false,

                Lines = lines,
                References = references,
                Extensions = extensions,
                GroupId = FulfillmentGroupId,
                CreatedBy = "POS",
                ReceivedEvent = "POS_ORDER_RECEIVED",
                ReceivedDetail = fileName
            };

            /* One call for the account, the ship-to and every product. */
            var lookup = _data.LoadInboundLookup(
                "POS",
                account,
                shipToCode,
                InboundOrderBuilder.ProductCodes(lines));

            if (lookup.ShipToAddressId is not null)
            {
                references["shipToAddressId"] =
                    lookup.ShipToAddressId.Value.ToString(CultureInfo.InvariantCulture);
            }

            var order = InboundOrderBuilder.Build(draft, lookup, errors);

            return new PosOrderMappingResult(order, errors);
        }

        /*
         * Every line is returned, complete or not. A line with an empty
         * Cost or Description is still a line; the builder reports what
         * is missing instead of skipping it.
         *
         * Files come three ways: one Detail per line, one Detail holding
         * every line, or no Detail at all. In all three the fields are in
         * order, so they are read as one list. A Product starts a new
         * line, and so does any field the open line already has.
         */
        private static List<InboundSourceLine> ReadLines(XElement root)
        {
            var lines = new List<InboundSourceLine>();

            var fields = root.Elements()
                .SelectMany(element =>
                    string.Equals(element.Name.LocalName, "Detail", StringComparison.OrdinalIgnoreCase)
                        ? element.Elements()
                        : new[] { element });

            string? product = null, quantity = null, cost = null, description = null;
            var open = false;

            void Close()
            {
                if (!open) return;

                lines.Add(new InboundSourceLine($"Detail[{lines.Count}]", product, quantity, cost, description));
                product = quantity = cost = description = null;
                open = false;
            }

            foreach (var element in fields)
            {
                var value = InboundOrderBuilder.NullIfWhiteSpace(element.Value);

                switch (element.Name.LocalName.ToLowerInvariant())
                {
                    case "product":
                        Close();
                        product = value;
                        open = true;
                        break;
                    case "quantity":
                        if (quantity is not null) Close();
                        quantity = value;
                        open = true;
                        break;
                    case "cost":
                        if (cost is not null) Close();
                        cost = value;
                        open = true;
                        break;
                    case "description":
                        if (description is not null) Close();
                        description = value;
                        open = true;
                        break;
                }
            }

            Close();

            return lines;
        }

        private static DateOnly ParseOrderDate(string? value, List<InboundOrderError> errors)
        {
            if (DateOnly.TryParseExact(value, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                return date;
            }

            InboundOrderBuilder.AddError(errors, "INVALID_DATE", "PODate",
                value is null
                    ? "PODate is required."
                    : $"'{value}' is not a valid PO date.");

            return DateOnly.FromDateTime(DateTime.Today);
        }

        /*
         * TimeDate carries no time zone. It is read as the server's local
         * time, the same assumption the legacy import made with GETDATE().
         */
        private static DateTimeOffset ParseCreatedAt(string? value, DateOnly orderDate)
        {
            if (DateTime.TryParseExact(value, TimeFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var local))
            {
                return new DateTimeOffset(local, TimeZoneInfo.Local.GetUtcOffset(local));
            }

            var midnight = orderDate.ToDateTime(TimeOnly.MinValue);

            return new DateTimeOffset(midnight, TimeZoneInfo.Local.GetUtcOffset(midnight));
        }

        private static string? Text(XElement parent, string name)
        {
            var element = parent.Elements()
                .FirstOrDefault(e => string.Equals(e.Name.LocalName, name, StringComparison.OrdinalIgnoreCase));

            return InboundOrderBuilder.NullIfWhiteSpace(element?.Value);
        }
    }

    /*
     * Order is null only when the file cannot be read as a POS order at
     * all (not XML, or no ORDER element). In every other case the order
     * is returned, with Errors listing what needs review.
     */
    public sealed record PosOrderMappingResult(CanonicalOrder? Order, IReadOnlyList<InboundOrderError> Errors)
    {
        public bool IsValid => Order is not null && Errors.Count == 0;

        public bool NeedsReview => Order is not null && Errors.Count > 0;
    }
}

namespace ProInternal.Services.OrderIntegration.Adapters.Inbound
{
    /*
     * Everything an inbound adapter needs to know about PRO's own data.
     *
     * Adapters never query SQL directly. They ask this interface, so the
     * same adapter can be tested with a fake lookup and so the lookup
     * rules (how a product code or a ship-to code is matched) live in
     * one place for POS, EDI and any later channel.
     *
     * A null return always means "not found". The adapter turns that
     * into an error on the order; it never guesses and never drops data.
     */
    public interface IInboundOrderLookup
    {
        /* Roster.AccountNumber, e.g. "8379" or "5822". */
        InboundCustomer? FindCustomer(string accountNumber);

        /*
         * shipToCode null/empty = the account's default ship-to.
         * Otherwise the alternate ship-to code as received:
         *   POS  "8379-2"  -> shipToCode "2"   (AddressShipToMap.ComputymeShipTo)
         * EDI does not use a code: it ships to the billing address.
         */
        Address? FindShipTo(string accountNumber, string? shipToCode);

        /*
         * Matches Product.ProductCode OR Product.CAT_NO OR Bundle.BundleCode,
         * the same rule the legacy EDI script uses. Returns the product
         * even when it is not for sale, so the adapter can say why.
         */
        InboundProduct? FindProduct(string code);
    }

    public sealed record InboundCustomer(
        string AccountNumber,
        string? Name,
        string? Email,
        string? Phone,
        Address? BillingAddress);

    public sealed record InboundProduct(
        string ProductCode,
        string? Name,
        bool IsForSale,
        /* PRO's price for this customer, when the lookup can supply it.
         * Null switches the price comparison off for this line. */
        decimal? UnitPrice,
        IReadOnlyList<InboundBundleComponent> BundleComponents)
    {
        public bool IsBundle => BundleComponents.Count > 0;
    }

    public sealed record InboundBundleComponent(
        string ProductCode,
        string? Name,
        decimal QuantityPerBundle);

    /*
     * PRO's data for ONE inbound order, as PIV2_InboundOrder_Lookup
     * returned it. Loaded once, then asked in memory.
     */
    public sealed class InboundLookup : IInboundOrderLookup
    {
        private readonly Dictionary<string, InboundProduct> _products;

        public InboundLookup(
            InboundCustomer? customer,
            Address? shipTo,
            int? shipToAddressId,
            Dictionary<string, InboundProduct> products)
        {
            Customer = customer;
            ShipTo = shipTo;
            ShipToAddressId = shipToAddressId;
            _products = products;
        }

        /* Null = the account was not found. */
        public InboundCustomer? Customer { get; }

        /* Null = no ship-to address was found. */
        public Address? ShipTo { get; }

        /* Orders.ShipToAddressId for this order. */
        public int? ShipToAddressId { get; }

        public InboundCustomer? FindCustomer(string accountNumber) => Customer;

        public Address? FindShipTo(string accountNumber, string? shipToCode) => ShipTo;

        public InboundProduct? FindProduct(string code)
        {
            return !string.IsNullOrWhiteSpace(code) && _products.TryGetValue(code.Trim(), out var product)
                ? product
                : null;
        }
    }

    /*
     * One source line as it arrived, before any lookup. Values stay as
     * text so that a bad quantity or price is reported, not lost.
     */
    internal sealed record InboundSourceLine(
        string FieldPrefix,
        string? Code,
        string? QuantityText,
        string? PriceText,
        string? Description);

    /* The header of one inbound order, already parsed by its adapter. */
    internal sealed class InboundOrderDraft
    {
        public required SourceChannel Channel { get; init; }
        public required string OrderId { get; init; }
        public string? OrderNumber { get; init; }
        public required string ChannelOrderId { get; init; }
        public string? StoreId { get; init; }

        public required string AccountNumber { get; init; }
        public string? ShipToCode { get; init; }

        /* True when the order ships to the account's billing address (EDI). */
        public bool ShipToIsBilling { get; init; }

        public string? FallbackCustomerName { get; init; }
        public string? PoNumber { get; init; }

        public required DateTimeOffset CreatedAt { get; init; }
        public required DateOnly OrderDate { get; init; }
        public string? Notes { get; init; }
        public string? TermsCode { get; init; }

        /* The total printed on the source document, if any. */
        public decimal? StatedTotal { get; init; }

        /* True when the stated total must equal the sum of the lines. */
        public bool CheckTotal { get; init; }

        public required IReadOnlyList<InboundSourceLine> Lines { get; init; }
        public required Dictionary<string, string> References { get; init; }
        public required OrderExtensions Extensions { get; init; }

        public required string GroupId { get; init; }
        public required string CreatedBy { get; init; }
        public required string ReceivedEvent { get; init; }
        public string? ReceivedDetail { get; init; }
    }

    /*
     * Shared by every file-based inbound adapter (POS, EDI 850).
     *
     * Rules, identical for all channels:
     *   - Nothing is dropped. A line that cannot be resolved stays on the
     *     order with the code as received and an error against it.
     *   - Every problem is an InboundOrderError with a code, a field and
     *     a message. The review screen works from that list.
     *   - An order with any error is returned ON_HOLD with a MANUAL hold.
     *     It still carries everything that was received.
     */
    internal static class InboundOrderBuilder
    {
        public const string Currency = "USD";
        private const decimal TotalTolerance = 0.01m;

        /*
         * A dropship order: the partner wants it sent to their own
         * customer, and the file gives only that person's name. It is
         * held until someone enters the address. These are the keys in
         * the order's references that track it.
         */
        public const string DropShipKey = "dropShip";
        public const string DropShipNameKey = "dropShipName";
        public const string DropShipAddressEnteredKey = "dropShipAddressEntered";
        public const string DropShipAddressNeeded = "DROPSHIP_ADDRESS_NEEDED";

        public static string DropShipMessage(string? name)
        {
            return string.IsNullOrWhiteSpace(name)
                ? "This is a dropship order. Enter the ship-to address, then release it."
                : $"This is a dropship order for {name.Trim()}. Enter the ship-to address, then release it.";
        }

        public static CanonicalOrder Build(
            InboundOrderDraft draft,
            IInboundOrderLookup lookup,
            List<InboundOrderError> errors)
        {
            var customer = ResolveCustomer(draft, lookup, errors);
            var billing = customer?.BillingAddress ?? EmptyAddress();

            if (customer is not null && customer.BillingAddress is null)
            {
                AddError(errors, "BILLING_ADDRESS_NOT_FOUND", "customer.customerId",
                    $"Account {draft.AccountNumber} has no active billing address.");
            }

            var shipTo = ResolveShipTo(draft, customer, lookup, errors);

            var items = BuildItems(draft, lookup, errors, out var subtotal);

            if (items.Count == 0)
            {
                AddError(errors, "NO_ORDER_ITEMS", "items",
                    "The order contains no lines.");
            }

            if (draft.CheckTotal &&
                draft.StatedTotal is not null &&
                Math.Abs(draft.StatedTotal.Value - subtotal) > TotalTolerance)
            {
                AddError(errors, "TOTAL_MISMATCH", "pricing.grandTotal",
                    $"Document total {Format(draft.StatedTotal.Value)} does not equal " +
                    $"the sum of the lines {Format(subtotal)}.");
            }

            var needsReview = errors.Count > 0;
            var now = DateTimeOffset.UtcNow;
            var holds = new List<OrderHold>();

            if (needsReview)
            {
                holds.Add(new OrderHold
                {
                    HoldType = HoldType.MANUAL,
                    Reason = "NEEDS_REVIEW: " + string.Join(", ",
                        errors.Select(e => e.Code).Distinct(StringComparer.Ordinal)),
                    PlacedAt = now
                });
            }

            return new CanonicalOrder
            {
                Metadata = new OrderMetadata
                {
                    OrderId = draft.OrderId,
                    OrderNumber = draft.OrderNumber,
                    CreatedAt = draft.CreatedAt
                },
                Source = new OrderSource
                {
                    Channel = draft.Channel,
                    ChannelOrderId = draft.ChannelOrderId,
                    StoreId = draft.StoreId
                },
                Customer = new OrderCustomer
                {
                    CustomerId = draft.AccountNumber,
                    Name = NullIfWhiteSpace(customer?.Name ?? draft.FallbackCustomerName),
                    Email = NullIfWhiteSpace(customer?.Email),
                    Phone = NullIfWhiteSpace(customer?.Phone),
                    PoNumber = NullIfWhiteSpace(draft.PoNumber)
                },
                Addresses = new OrderAddresses
                {
                    Billing = billing,
                    Shipping = shipTo
                },
                Order = new OrderDetails
                {
                    Status = needsReview ? OrderStatus.ON_HOLD : OrderStatus.OPEN,
                    OrderDate = draft.OrderDate,
                    Currency = Currency,
                    TaxInclusive = false,
                    Notes = NullIfWhiteSpace(draft.Notes),
                    PaymentTerms = string.IsNullOrWhiteSpace(draft.TermsCode)
                        ? null
                        : new PaymentTerms { Code = draft.TermsCode.Trim() }
                },
                Pricing = new OrderPricing
                {
                    Subtotal = ToMoney(subtotal),
                    GrandTotal = ToMoney(draft.StatedTotal ?? subtotal),
                    OrderDiscounts = []
                },
                Items = items,
                Fulfillment = new Fulfillment
                {
                    FulfillmentGroups =
                    [
                        new FulfillmentGroup
                        {
                            GroupId = draft.GroupId,
                            FulfillmentType = FulfillmentType.WAREHOUSE,
                            Status = FulfillmentStatus.PENDING,
                            ShipTo = shipTo,
                            Shipments = []
                        }
                    ]
                },
                Payments = [],
                Workflow = new OrderWorkflow
                {
                    ApprovalStatus = ApprovalStatus.NOT_REQUIRED,
                    ExportStatus = ExportStatus.NOT_EXPORTED,
                    Holds = holds
                },
                References = draft.References,
                Extensions = draft.Extensions,
                Audit = new OrderAudit
                {
                    CreatedBy = draft.CreatedBy,
                    Events =
                    [
                        new OrderAuditEvent
                        {
                            Event = draft.ReceivedEvent,
                            At = now,
                            Actor = draft.CreatedBy,
                            Detail = draft.ReceivedDetail
                        }
                    ]
                }
            };
        }

        private static InboundCustomer? ResolveCustomer(
            InboundOrderDraft draft,
            IInboundOrderLookup lookup,
            List<InboundOrderError> errors)
        {
            if (string.IsNullOrWhiteSpace(draft.AccountNumber))
            {
                AddError(errors, "MISSING_CUSTOMER", "customer.customerId",
                    "The order does not identify a customer account.");
                return null;
            }

            var customer = lookup.FindCustomer(draft.AccountNumber);

            if (customer is null)
            {
                AddError(errors, "UNKNOWN_CUSTOMER", "customer.customerId",
                    $"Account '{draft.AccountNumber}' was not found.");
            }

            return customer;
        }

        private static Address? ResolveShipTo(
            InboundOrderDraft draft,
            InboundCustomer? customer,
            IInboundOrderLookup lookup,
            List<InboundOrderError> errors)
        {
            if (customer is null)
                return null;

            /* A missing billing address has already been reported. */
            if (draft.ShipToIsBilling)
                return customer.BillingAddress;

            var shipTo = lookup.FindShipTo(customer.AccountNumber, NullIfWhiteSpace(draft.ShipToCode));

            if (shipTo is null)
            {
                AddError(errors, "SHIP_TO_NOT_FOUND", "fulfillment.fulfillmentGroups[0].shipTo",
                    string.IsNullOrWhiteSpace(draft.ShipToCode)
                        ? $"Account {customer.AccountNumber} has no default ship-to address."
                        : $"Ship-to '{draft.ShipToCode}' was not found for account {customer.AccountNumber}.");
            }

            return shipTo;
        }

        private static List<CanonicalOrderItem> BuildItems(
            InboundOrderDraft draft,
            IInboundOrderLookup lookup,
            List<InboundOrderError> errors,
            out decimal subtotal)
        {
            var items = new List<CanonicalOrderItem>(draft.Lines.Count);
            subtotal = 0m;
            var lineNumber = 0;

            foreach (var source in draft.Lines)
            {
                var code = NullIfWhiteSpace(source.Code);

                if (code is null)
                {
                    AddError(errors, "MISSING_SKU", $"{source.FieldPrefix}.product",
                        "The line has no product code.");
                }

                var quantity = ParseDecimal(source.QuantityText);

                if (quantity is null || quantity <= 0)
                {
                    AddError(errors, "INVALID_QUANTITY", $"{source.FieldPrefix}.quantity",
                        $"'{source.QuantityText}' is not a quantity greater than zero.");
                }

                var price = ParseDecimal(source.PriceText);

                if (price is null)
                {
                    AddError(errors, "INVALID_MONEY", $"{source.FieldPrefix}.price",
                        $"'{source.PriceText}' is not a valid price.");
                }

                var product = code is null ? null : lookup.FindProduct(code);

                if (code is not null && product is null)
                {
                    AddError(errors, "UNKNOWN_ITEM", $"{source.FieldPrefix}.product",
                        $"Product code '{code}' was not found.");
                }
                else if (product is not null && !product.IsForSale)
                {
                    AddError(errors, "ITEM_NOT_FOR_SALE", $"{source.FieldPrefix}.product",
                        $"Product '{product.ProductCode}' is not for sale.");
                }

                if (product?.UnitPrice is not null &&
                    price is not null &&
                    product.UnitPrice.Value != price.Value)
                {
                    AddError(errors, "PRICE_MISMATCH", $"{source.FieldPrefix}.price",
                        $"Price on the order is {Format(price.Value)}; " +
                        $"PRO price for '{product.ProductCode}' is {Format(product.UnitPrice.Value)}.");
                }

                var lineQuantity = quantity ?? 0m;
                var linePrice = price ?? 0m;
                var lineTotal = lineQuantity * linePrice;
                subtotal += lineTotal;

                var lineId = NextLineId(ref lineNumber);
                var references = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

                /* Keep the code exactly as the sender wrote it. */
                if (code is not null &&
                    product is not null &&
                    !string.Equals(code, product.ProductCode, StringComparison.OrdinalIgnoreCase))
                {
                    references["sourceProductCode"] = code;
                }

                items.Add(new CanonicalOrderItem
                {
                    LineId = lineId,
                    LineType = product is { IsBundle: true }
                        ? LineType.BUNDLE_PARENT
                        : LineType.STANDARD,
                    Sku = product?.ProductCode ?? code,
                    ProductName = NullIfWhiteSpace(product?.Name ?? source.Description),
                    Quantity = lineQuantity,
                    UnitOfMeasure = "EA",
                    UnitPrice = ToMoney(linePrice),
                    LineTotal = ToMoney(lineTotal),
                    FulfillmentGroupId = draft.GroupId,
                    References = references
                });

                if (product is not { IsBundle: true })
                    continue;

                /* The parent carries the price; components ship at zero. */
                foreach (var component in product.BundleComponents)
                {
                    items.Add(new CanonicalOrderItem
                    {
                        LineId = NextLineId(ref lineNumber),
                        LineType = LineType.BUNDLE_COMPONENT,
                        ParentLineId = lineId,
                        Sku = component.ProductCode,
                        ProductName = NullIfWhiteSpace(component.Name),
                        Quantity = lineQuantity * component.QuantityPerBundle,
                        UnitOfMeasure = "EA",
                        UnitPrice = ToMoney(0m),
                        LineTotal = ToMoney(0m),
                        FulfillmentGroupId = draft.GroupId,
                        References = new Dictionary<string, string>()
                    });
                }
            }

            return items;
        }

        /* The distinct product codes on the order, for the lookup. */
        public static List<string> ProductCodes(IEnumerable<InboundSourceLine> lines)
        {
            return lines
                .Select(line => NullIfWhiteSpace(line.Code))
                .Where(code => code is not null)
                .Select(code => code!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private static string NextLineId(ref int lineNumber)
        {
            lineNumber++;
            return "L-" + lineNumber.ToString("0000", CultureInfo.InvariantCulture);
        }

        public static decimal? ParseDecimal(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            return decimal.TryParse(
                value.Trim(),
                NumberStyles.Number,
                CultureInfo.InvariantCulture,
                out var parsed)
                    ? parsed
                    : null;
        }

        public static Money ToMoney(decimal amount)
        {
            return new Money
            {
                Amount = amount.ToString("0.00##", CultureInfo.InvariantCulture),
                Currency = Currency
            };
        }

        private static string Format(decimal amount)
        {
            return amount.ToString("0.00##", CultureInfo.InvariantCulture);
        }

        /*
         * Same convention as the Shopify adapter: when an address cannot
         * be supplied, the required fields are empty and an error says
         * why. The order then fails schema validation and waits in review.
         */
        private static Address EmptyAddress()
        {
            return new Address
            {
                Line1 = string.Empty,
                City = string.Empty,
                Country = string.Empty
            };
        }

        public static string? NullIfWhiteSpace(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        public static void AddError(
            ICollection<InboundOrderError> errors,
            string code,
            string field,
            string message)
        {
            errors.Add(new InboundOrderError
            {
                Code = code,
                Field = field,
                Message = message
            });
        }
    }
}
