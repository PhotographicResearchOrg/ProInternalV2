using ProInternal.Models.OrderIntegration;
using ProInternal.Models.OrderIntegration.Shopify;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace ProInternal.Services.OrderIntegration.Adapters.Inbound.Edi
{
    /*
     * EDI 850 (incoming purchase order) pipe file -> canonical orders.
     *
     * This adapter is for 850 files only. An 810 uses the same column
     * layout but is an invoice, not an order, and must not be sent here.
     *
     * Columns (0-based), one row per line item, header row first:
     *    0 document number      (equals the PO on an 850)
     *    1 trading partner      (the CUSTOMER's account, e.g. 5822 = B&H)
     *    2 location code        (the partner's own code, e.g. NJF; kept
     *                            for reference, not used to pick an address)
     *    3 date
     *    4 comments
     *    5 PO number
     *    6 order discount
     *    7 future dated
     *    8 order total
     *    9 (blank)
     *   10 quantity
     *   11 price
     *   12 extended price
     *   13 product code         (PRO product code or catalog number)
     *   14 product description
     *   15 shipping carrier     16 shipping cost   17 handling charge
     *   18 ship-to code         19 tracking number 20 name   21 type
     *
     * Columns 15-21 are optional; older files stop at 14.
     */
    public sealed class EdiPurchaseOrderAdapter : IEdiPurchaseOrderAdapter
    {
        private const string FulfillmentGroupId = "EDI-PRIMARY";
        private const int RequiredColumns = 15;

        private static readonly string[] DateFormats = ["M/d/yyyy", "MM/dd/yyyy", "M/d/yy", "MM/dd/yy", "yyyyMMdd", "yyyy-MM-dd"];

        private readonly IOrderInboxDataAccess _data;

        public EdiPurchaseOrderAdapter(IOrderInboxDataAccess data)
        {
            _data = data;
        }

        public EdiPurchaseOrderMappingResult Map(string fileName, IReadOnlyList<string> lines)
        {
            ArgumentNullException.ThrowIfNull(fileName);
            ArgumentNullException.ThrowIfNull(lines);

            var fileErrors = new List<InboundOrderError>();
            var rows = new List<EdiRow>();

            /*
             * Files are named by transaction set (810_..., 850_...). An
             * invoice has the same columns as a purchase order, so it
             * would map without complaint. Refuse it by name instead.
             */
            var name = System.IO.Path.GetFileName(fileName);

            if (name.StartsWith("810", StringComparison.OrdinalIgnoreCase))
            {
                InboundOrderBuilder.AddError(fileErrors, "WRONG_DOCUMENT_TYPE", "file",
                    $"'{name}' is an 810 invoice, not an 850 purchase order.");

                return new EdiPurchaseOrderMappingResult([], fileErrors);
            }

            /* Row 1 is the header. Row numbers in errors match the file. */
            for (var index = 1; index < lines.Count; index++)
            {
                var text = lines[index];

                if (string.IsNullOrWhiteSpace(text))
                    continue;

                var rowNumber = index + 1;
                var cells = SplitRow(text);

                if (cells is null || cells.Count < RequiredColumns)
                {
                    InboundOrderBuilder.AddError(fileErrors, "MALFORMED_ROW", $"row[{rowNumber}]",
                        $"Row {rowNumber} could not be read as {RequiredColumns} or more columns: {text}");
                    continue;
                }

                var row = new EdiRow(rowNumber, cells, text);

                if (row.PoNumber is null)
                {
                    InboundOrderBuilder.AddError(fileErrors, "MISSING_PO_NUMBER", $"row[{rowNumber}].po",
                        $"Row {rowNumber} has no PO number: {text}");
                    continue;
                }

                rows.Add(row);
            }

            /* One order per trading partner + PO, in file order. */
            var orders = rows
                .GroupBy(r => (Partner: r.Partner ?? string.Empty, Po: r.PoNumber!), PartnerPoComparer.Instance)
                .Select(group => MapOrder(fileName, lines[0], group.ToList()))
                .ToList();

            return new EdiPurchaseOrderMappingResult(orders, fileErrors);
        }

        private EdiMappedOrder MapOrder(string fileName, string headerRow, List<EdiRow> rows)
        {
            var errors = new List<InboundOrderError>();
            var first = rows[0];

            var partner = first.Partner ?? string.Empty;
            var poNumber = first.PoNumber!;

            /*
             * Header values repeat on every row. If they disagree inside
             * one PO, say so instead of silently taking the first.
             */
            RequireSame(rows, r => r.DateText, "date", errors);
            RequireSame(rows, r => r.TotalText, "orderTotal", errors);

            var orderDate = ParseOrderDate(first, errors);
            var statedTotal = InboundOrderBuilder.ParseDecimal(first.TotalText);

            if (first.TotalText is not null && statedTotal is null)
            {
                InboundOrderBuilder.AddError(errors, "INVALID_MONEY", $"row[{first.RowNumber}].orderTotal",
                    $"'{first.TotalText}' is not a valid order total.");
            }

            var lines = rows
                .Select(r => new InboundSourceLine(
                    $"row[{r.RowNumber}]",
                    r.ProductCode,
                    r.QuantityText,
                    r.PriceText,
                    r.Description))
                .ToList();

            var references = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["ediSourceFile"] = fileName,
                ["ediTransactionSet"] = "850",
                ["ediPoNumber"] = poNumber
            };

            if (first.DocumentNumber is not null) references["ediDocumentNumber"] = first.DocumentNumber;
            if (first.Partner is not null) references["ediTradingPartner"] = first.Partner;
            if (first.ShipToCode is not null) references["ediShipToCode"] = first.ShipToCode;

            /*
             * Dropship: the partner's customer is the recipient and the
             * file has only a name, no address. Hold it for the address.
             */
            var isDropShip =
                string.Equals(first.OrderType, "Dropship", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(first.ShipToCode, "DROP", StringComparison.OrdinalIgnoreCase);

            if (isDropShip)
            {
                references[InboundOrderBuilder.DropShipKey] = "true";

                if (first.Name is not null)
                    references[InboundOrderBuilder.DropShipNameKey] = first.Name;

                InboundOrderBuilder.AddError(
                    errors,
                    InboundOrderBuilder.DropShipAddressNeeded,
                    "fulfillment.fulfillmentGroups[0].shipTo",
                    InboundOrderBuilder.DropShipMessage(first.Name));
            }

            var edi = new Dictionary<string, JsonElement>();

            AddExtension(edi, "orderDiscount", first.Discount);
            AddExtension(edi, "futureDated", first.FutureDated);
            AddExtension(edi, "shippingCarrier", first.Carrier);
            AddExtension(edi, "shippingCost", first.ShippingCost);
            AddExtension(edi, "handlingCharge", first.HandlingCharge);
            AddExtension(edi, "partnerName", first.Name);
            AddExtension(edi, "orderType", first.OrderType);

            var draft = new InboundOrderDraft
            {
                Channel = SourceChannel.EDI,
                OrderId = $"EDI-{partner}-{poNumber}",
                OrderNumber = poNumber,
                ChannelOrderId = poNumber,
                StoreId = InboundOrderBuilder.NullIfWhiteSpace(partner),
                AccountNumber = partner,

                /*
                 * An EDI order ships to the account's billing address,
                 * as the old EDI script did. The partner's location
                 * code is kept in references.ediShipToCode only.
                 */
                ShipToIsBilling = true,
                FallbackCustomerName = isDropShip ? null : first.Name,
                PoNumber = poNumber,
                CreatedAt = DateTimeOffset.UtcNow,
                OrderDate = orderDate,
                Notes = first.Comments,
                TermsCode = first.Discount,
                StatedTotal = statedTotal,

                /*
                 * A total that does not match its lines is logged on the
                 * order at import. It does not hold the order: nobody
                 * could correct it here.
                 */
                CheckTotal = false,
                Lines = lines,
                References = references,
                Extensions = new OrderExtensions { Edi = edi.Count > 0 ? edi : null },
                GroupId = FulfillmentGroupId,
                CreatedBy = "EDI",
                ReceivedEvent = "EDI_850_RECEIVED",
                ReceivedDetail = fileName
            };

            /* One call for the account, its address and every product. */
            var lookup = _data.LoadInboundLookup(
                "EDI",
                partner,
                null,
                InboundOrderBuilder.ProductCodes(lines));

            if (lookup.ShipToAddressId is not null)
            {
                references["shipToAddressId"] =
                    lookup.ShipToAddressId.Value.ToString(CultureInfo.InvariantCulture);
            }

            var order = InboundOrderBuilder.Build(draft, lookup, errors);

            var rawRows = string.Join(
                Environment.NewLine,
                new[] { headerRow }.Concat(rows.Select(r => r.Raw)));

            return new EdiMappedOrder(partner, poNumber, rawRows, order, errors);
        }

        private static DateOnly ParseOrderDate(EdiRow row, List<InboundOrderError> errors)
        {
            if (DateOnly.TryParseExact(row.DateText, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                return date;
            }

            InboundOrderBuilder.AddError(errors, "INVALID_DATE", $"row[{row.RowNumber}].date",
                row.DateText is null
                    ? "The order date is missing."
                    : $"'{row.DateText}' is not a valid order date.");

            return DateOnly.FromDateTime(DateTime.Today);
        }

        private static void RequireSame(
            List<EdiRow> rows,
            Func<EdiRow, string?> selector,
            string field,
            List<InboundOrderError> errors)
        {
            var values = rows
                .Select(selector)
                .Select(v => v ?? string.Empty)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (values.Count > 1)
            {
                InboundOrderBuilder.AddError(errors, "INCONSISTENT_HEADER", field,
                    $"Rows of the same PO disagree on {field}: " +
                    string.Join(" / ", values.Select(v => v.Length == 0 ? "(blank)" : v)));
            }
        }

        private static void AddExtension(Dictionary<string, JsonElement> target, string key, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                target[key] = JsonSerializer.SerializeToElement(value.Trim());
            }
        }

        /*
         * Splits on '|'. A field wrapped in double quotes may contain
         * pipes, and a doubled quote inside it is one literal quote:
         *   "GEAR BAG - 48""/120CM"  ->  GEAR BAG - 48"/120CM
         * Returns null when a quoted field is never closed.
         */
        internal static List<string>? SplitRow(string line)
        {
            var cells = new List<string>();
            var current = new StringBuilder();
            var quoted = false;
            var index = 0;

            while (index < line.Length)
            {
                var ch = line[index];

                if (quoted)
                {
                    if (ch == '"')
                    {
                        if (index + 1 < line.Length && line[index + 1] == '"')
                        {
                            current.Append('"');
                            index += 2;
                            continue;
                        }

                        quoted = false;
                        index++;
                        continue;
                    }

                    current.Append(ch);
                    index++;
                    continue;
                }

                if (ch == '"' && current.Length == 0)
                {
                    quoted = true;
                    index++;
                    continue;
                }

                if (ch == '|')
                {
                    cells.Add(current.ToString());
                    current.Clear();
                    index++;
                    continue;
                }

                current.Append(ch);
                index++;
            }

            if (quoted)
                return null;

            cells.Add(current.ToString());

            return cells;
        }

        private sealed class EdiRow
        {
            private readonly List<string> _cells;

            public EdiRow(int rowNumber, List<string> cells, string raw)
            {
                RowNumber = rowNumber;
                _cells = cells;
                Raw = raw;
            }

            public int RowNumber { get; }

            /* The row exactly as it arrived. */
            public string Raw { get; }

            public string? DocumentNumber => Cell(0);
            public string? Partner => Cell(1);
            public string? LocationCode => Cell(2);
            public string? DateText => Cell(3);
            public string? Comments => Cell(4);
            public string? PoNumber => Cell(5);
            public string? Discount => Cell(6);
            public string? FutureDated => Cell(7);
            public string? TotalText => Cell(8);
            public string? QuantityText => Cell(10);
            public string? PriceText => Cell(11);
            public string? ProductCode => Cell(13);
            public string? Description => Cell(14);
            public string? Carrier => Cell(15);
            public string? ShippingCost => Cell(16);
            public string? HandlingCharge => Cell(17);
            public string? Name => Cell(20);
            public string? OrderType => Cell(21);

            /* The explicit ship-to column wins; else the location code. */
            public string? ShipToCode => Cell(18) ?? LocationCode;

            private string? Cell(int index)
            {
                return index < _cells.Count
                    ? InboundOrderBuilder.NullIfWhiteSpace(_cells[index])
                    : null;
            }
        }

        private sealed class PartnerPoComparer : IEqualityComparer<(string Partner, string Po)>
        {
            public static readonly PartnerPoComparer Instance = new();

            public bool Equals((string Partner, string Po) x, (string Partner, string Po) y)
            {
                return string.Equals(x.Partner, y.Partner, StringComparison.OrdinalIgnoreCase)
                    && string.Equals(x.Po, y.Po, StringComparison.OrdinalIgnoreCase);
            }

            public int GetHashCode((string Partner, string Po) obj)
            {
                return HashCode.Combine(
                    StringComparer.OrdinalIgnoreCase.GetHashCode(obj.Partner),
                    StringComparer.OrdinalIgnoreCase.GetHashCode(obj.Po));
            }
        }
    }
}
