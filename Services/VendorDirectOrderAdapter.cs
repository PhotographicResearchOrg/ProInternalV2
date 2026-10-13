using ProInternal.Models.OrderIntegration;
using System.Globalization;
using System.Text;
using System.Text.Json;

namespace ProInternal.Services.OrderIntegration.Adapters.Outbound.VendorDirect;

/*
 * Contract order -> the file a direct ship vendor receives.
 *
 * The order passed in holds one vendor's lines only.
 *
 *   StandardRows  PRO's standard layout: one row per line, 25 columns,
 *                 the same file the legacy drop ship job sent.
 *   EdiFile       the per-order file dropped in the EDI pickup folder
 *                 (Tiffen): no header, every value in quotes.
 *
 * Values keep the legacy format on purpose, so a vendor sees no
 * change: commas are removed from values, and Order Date is the time
 * the file was built.
 */
public static class VendorDirectOrderAdapter
{
    public const string StandardHeader =
        "PRO PO,Bill To,Bill To Address,Bill To City,Bill To State,Bill To Zip," +
        "Account Number,Account Name,Order Date,Ship To First Name,Ship To Last Name," +
        "Ship To Address 1,Ship To Address 2,Ship To City,Ship To State,Ship To Zip," +
        "Member PO,Order Total,Quantity,Cost,PRO Code,Catalog Number,Product," +
        "Ship Instructions,ShipTo";

    private const string NoAccount = "DS";

    public static string StandardRows(
        CanonicalOrder order,
        VendorDirectSettings vendor,
        VendorBillTo billTo,
        DateTime builtAt)
    {
        var lines = ReadLines(order, vendor);
        var shipTo = ShipTo(order);

        /* The legacy file carried the buyer's email only for the EDI vendor. */
        var shipInstructions = vendor.IsEdi ? Clean(shipTo.Email) : string.Empty;

        var rows = new StringBuilder();

        foreach (var line in lines)
        {
            rows.Append(string.Join(
                ",",
                Clean(order.Metadata.OrderId),
                Clean(billTo.Name),
                CleanKeepSpaces(billTo.Address),
                Clean(billTo.City),
                Clean(billTo.State),
                Clean(billTo.Zip),
                AccountNumber(order),
                AccountName(order),
                LegacyDate(builtAt),
                Clean(shipTo.FirstName),
                Clean(shipTo.LastName),
                Clean(shipTo.Line1),
                Clean(shipTo.Line2),
                Clean(shipTo.City),
                Clean(shipTo.Region),
                Clean(shipTo.PostalCode),
                Clean(order.Customer.PoNumber),
                " ",
                line.Quantity,
                line.Cost,
                Clean(line.Sku),
                Clean(line.CatalogNumber),
                CleanProduct(line.ProductName),
                shipInstructions.Length == 0 ? " " : shipInstructions,
                Clean(Reference(order, "shipToAddressId"))));

            rows.Append("\r\n");
        }

        return rows.ToString();
    }

    public static string EdiFile(
        CanonicalOrder order,
        VendorDirectSettings vendor,
        VendorBillTo billTo,
        DateTime builtAt)
    {
        var lines = ReadLines(order, vendor);
        var shipTo = ShipTo(order);
        var vendorId = vendor.VendorId.ToString(CultureInfo.InvariantCulture);

        /* Account name, then the account number with Computyme's two-digit ship-to. */
        var suffix = ("00" + (Reference(order, "computymeShipTo") ?? "00")).Trim();
        suffix = suffix[^2..];

        var shipName = $"{AccountName(order)} ({AccountNumber(order)}{suffix})";

        var file = new StringBuilder();

        foreach (var line in lines)
        {
            file.Append(string.Join(
                ",",
                Quote("PO"),
                Quote(Clean(order.Metadata.OrderId)),
                Quote(vendorId),
                Quote(vendorId),
                Quote(LegacyDate(builtAt)),
                Quote(string.Empty),
                Quote(string.Empty),
                Quote(string.Empty),
                Quote(Clean(line.CatalogNumber)),
                Quote(Clean(line.Upc)),
                Quote(CleanProduct(line.ProductName)),
                Quote(line.Quantity),
                Quote(line.Cost),
                Quote(Clean(billTo.Name)),
                Quote(CleanKeepSpaces(billTo.Address)),
                Quote($"{Clean(billTo.City)}, {Clean(billTo.State)} {Clean(billTo.Zip)}"),
                Quote(shipName),
                Quote(Clean(shipTo.Line1)),
                Quote(Clean(shipTo.Line2)),
                Quote($"{Clean(shipTo.City)}, {Clean(shipTo.Region)} {Clean(shipTo.PostalCode)}"),
                Quote(Clean(order.Customer.PoNumber))));

            file.Append("\r\n");
        }

        return file.ToString();
    }

    /*
     * What PRO pays the vendor for one unit.
     *
     *   Bought on a special: the special price the dealer was charged,
     *   with nothing taken off.
     *   Otherwise: the vendor's base price less the vendor's percentage.
     */
    public static decimal UnitCost(CanonicalOrderItem item, VendorDirectSettings vendor)
    {
        var charged = Price(item, "actualUnitPrice");

        if (charged is null && item.LineTotal is not null && item.Quantity > 0)
        {
            charged = decimal.Parse(item.LineTotal.Amount, CultureInfo.InvariantCulture) / item.Quantity;
        }

        var onSpecial = item.References is not null && item.References.ContainsKey("proSpecialId");

        if (onSpecial && charged is not null)
            return Math.Round(charged.Value, 2, MidpointRounding.AwayFromZero);

        var costBase = string.IsNullOrWhiteSpace(vendor.CostBase)
            ? "MEMBER_PRICE"
            : vendor.CostBase.Trim().ToUpperInvariant();

        var (basePrice, label) = costBase switch
        {
            "MEMBER_PRICE" => (charged, "member price"),
            "CARTON_PRICE" => (Price(item, "cartonPrice"), "member carton price"),
            "MAP" => (Price(item, "map"), "MAP"),
            "CONSUMER_RETAIL" => (Price(item, "consumerRetail"), "consumer retail price"),
            "DISTRIBUTOR_COST" => (Price(item, "distributorCost"), "distributor cost"),
            _ => throw new InvalidOperationException(
                $"Vendor {vendor.Name} has an unknown cost base '{vendor.CostBase}'.")
        };

        if (basePrice is null || basePrice <= 0)
        {
            throw new InvalidOperationException(
                $"Product {item.Sku} has no {label}, so the vendor cost cannot be worked out.");
        }

        var percentOff = vendor.CostPercent ?? 0m;

        return Math.Round(
            basePrice.Value * (1m - (percentOff / 100m)),
            2,
            MidpointRounding.AwayFromZero);
    }

    /* ---- helpers ---- */

    private sealed record VendorLine(
        string Quantity,
        string Cost,
        string? Sku,
        string? CatalogNumber,
        string? Upc,
        string? ProductName);

    private static List<VendorLine> ReadLines(CanonicalOrder order, VendorDirectSettings vendor)
    {
        var errors = new List<string>();
        var lines = new List<VendorLine>();

        if (order.Items.Count == 0)
            errors.Add("There are no lines to send.");

        foreach (var item in order.Items)
        {
            if (item.Quantity <= 0 || item.Quantity != decimal.Truncate(item.Quantity))
            {
                errors.Add($"Line {item.LineId} must have a whole-number quantity of 1 or more.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(item.Sku))
            {
                errors.Add($"Line {item.LineId} does not have a product code.");
                continue;
            }

            decimal cost;

            try
            {
                cost = UnitCost(item, vendor);
            }
            catch (InvalidOperationException ex)
            {
                errors.Add(ex.Message);
                continue;
            }

            string? catalogNumber = null;
            string? upc = null;

            item.References?.TryGetValue("vendorCatalogNumber", out catalogNumber);
            item.References?.TryGetValue("upc", out upc);

            lines.Add(new VendorLine(
                item.Quantity.ToString("0", CultureInfo.InvariantCulture),
                cost.ToString("0.##", CultureInfo.InvariantCulture),
                item.Sku,
                catalogNumber,
                upc,
                item.ProductName));
        }

        if (errors.Count > 0)
        {
            throw new InvalidOperationException(
                $"The order cannot be sent to {vendor.Name}: " + string.Join(" ", errors));
        }

        return lines;
    }

    private static Address ShipTo(CanonicalOrder order)
    {
        return order.Fulfillment.FulfillmentGroups.FirstOrDefault()?.ShipTo
            ?? order.Addresses.Shipping
            ?? throw new InvalidOperationException("The order has no shipping address.");
    }

    private static string AccountNumber(CanonicalOrder order)
    {
        var account = Clean(order.Customer.CustomerId);
        return account.Length == 0 ? NoAccount : account;
    }

    private static string AccountName(CanonicalOrder order)
    {
        var name = Clean(order.Customer.Name);
        return name.Length == 0 ? NoAccount : name;
    }

    private static decimal? Price(CanonicalOrderItem item, string name)
    {
        return item.Extensions.TryGetValue("vendorDirect", out var data) &&
               data.ValueKind == JsonValueKind.Object &&
               data.TryGetProperty(name, out var value) &&
               value.ValueKind == JsonValueKind.Number
            ? value.GetDecimal()
            : null;
    }

    private static string? Reference(CanonicalOrder order, string key)
    {
        return order.References.TryGetValue(key, out var value) &&
               !string.IsNullOrWhiteSpace(value)
            ? value.Trim()
            : null;
    }

    /* "Oct  6 2026  6:00PM": how the legacy job wrote a date. */
    private static string LegacyDate(DateTime value)
    {
        var hour = value.Hour % 12 == 0 ? 12 : value.Hour % 12;

        return string.Create(
            CultureInfo.InvariantCulture,
            $"{value:MMM} {value.Day,2} {value:yyyy} {hour,2}:{value:mm}{value:tt}");
    }

    private static string Clean(string? value)
    {
        return CleanKeepSpaces(value).Trim();
    }

    /* The legacy bill-to address ends with a space; keep what is configured. */
    private static string CleanKeepSpaces(string? value)
    {
        return string.IsNullOrEmpty(value)
            ? string.Empty
            : value
                .Replace(",", string.Empty)
                .Replace("\r", " ")
                .Replace("\n", " ");
    }

    private static string CleanProduct(string? value)
    {
        return string.IsNullOrEmpty(value)
            ? string.Empty
            : value
                .Replace("\"", string.Empty)
                .Replace(",", string.Empty)
                .Replace("\r", string.Empty)
                .Replace("\n", string.Empty)
                .Trim();
    }

    private static string Quote(string value)
    {
        return "\"" + value.Replace("\"", string.Empty) + "\"";
    }
}

/* One vendor's direct ship settings, read from the Vendor table. */
public sealed class VendorDirectSettings
{
    public int VendorId { get; init; }
    public string? Name { get; init; }
    public bool Enabled { get; init; }
    public string? Method { get; init; }
    public string? EmailTo { get; init; }
    public string? EmailCc { get; init; }
    public string? Destination { get; init; }
    public string? Password { get; init; }
    public string? CostBase { get; init; }
    public decimal? CostPercent { get; init; }

    public bool IsEdi =>
        string.Equals(Method?.Trim(), "EDI", StringComparison.OrdinalIgnoreCase);
}

/* PRO's bill-to, from OrderIntegration:VendorDirect:BillTo. */
public sealed record VendorBillTo(
    string? Name,
    string? Address,
    string? City,
    string? State,
    string? Zip);

/* ---- Toolbench: the Direct Vendor Ship tab and its settings ---- */

/* One order's lines for one vendor, with how far each side has got. */
public sealed class VendorDirectOrderRow
{
    public string OrderId { get; set; } = string.Empty;
    public string? Destination { get; set; }
    public int? VendorId { get; set; }
    public string? VendorName { get; set; }
    public bool VendorEnabled { get; set; }
    public string? VendorMethod { get; set; }
    public int OpenLines { get; set; }
    public int SentLines { get; set; }
    public int OpenUnits { get; set; }
    public decimal OpenValue { get; set; }
    public int WarehouseOpenLines { get; set; }
    public int WarehouseSentLines { get; set; }
    public string? CustomerName { get; set; }
    public string? AccountNumber { get; set; }
    public string? PoNumber { get; set; }
    public DateTime EnteredDate { get; set; }
    public string? OrderStatus { get; set; }
    public int OrderStatusId { get; set; }
    public string? OrderType { get; set; }
    public bool AutoHold { get; set; }
    public bool HoldOverride { get; set; }
    public string? CreditStatus { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
}

/* Which side one order line belongs to, and whether it has gone. */
public sealed class OrderLineSide
{
    public int OrderItemId { get; set; }
    public string? Destination { get; set; }
    public bool IsDirectVendorShip { get; set; }
    public int OrderItemStatusId { get; set; }
    public int? VendorId { get; set; }
    public string? VendorName { get; set; }
}

/* A vendor's settings as the settings screen reads and saves them. */
public sealed class VendorDirectVendor
{
    public int VendorId { get; set; }
    public string? Name { get; set; }
    public bool Enabled { get; set; }
    public string? Method { get; set; }
    public string? EmailTo { get; set; }
    public string? EmailCc { get; set; }
    public string? Destination { get; set; }

    /* Never sent to the screen. On save, empty keeps the stored one. */
    public string? Password { get; set; }
    public bool HasPassword { get; set; }

    public string? CostBase { get; set; }
    public decimal? CostPercent { get; set; }
    public string? Brands { get; set; }
}

public sealed class VendorDirectBrand
{
    public int BrandId { get; set; }
    public string? BrandName { get; set; }
    public int? VendorId { get; set; }
    public string? VendorName { get; set; }
    public bool AllItems { get; set; }

    /* The old "stocked in the warehouse" flag, shown so it can be cleaned up. */
    public string? Wh { get; set; }
}

/* The order parts picked on the Direct Vendor Ship tab. */
public sealed class VendorDirectProcessRequest
{
    public List<VendorDirectPartRef>? Parts { get; set; }
}

public sealed class VendorDirectPartRef
{
    public string? OrderId { get; set; }
    public int VendorId { get; set; }
}

public sealed record VendorDirectResult(bool Success, string Message);

