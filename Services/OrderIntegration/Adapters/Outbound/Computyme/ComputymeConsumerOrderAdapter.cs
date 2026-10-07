using ProInternal.Models.OrderIntegration;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace ProInternal.Services.OrderIntegration.Adapters.Outbound.Computyme;

/*
 * Contract order -> the Computyme consumer order block.
 *
 * The layout is the one the legacy consumer screen wrote:
 *
 *    1  channel order number (PayPal invoice / Shopify order id)
 *    2  consumer account, e.g. 9995*CO
 *    3  processing date, MM/dd/yy
 *    4  shipping notes (blank)
 *    5  PO number = PRO consumer order id
 *    6  order discount (blank)
 *    7  future-dated order (blank)
 *    8  order total = lines + shipping
 *    9  First|Last|Address1|Address2|City|State|Zip|Phone|Email
 *   10  blank
 *   then, per line: quantity / price / product code / product name
 *   ENDOFINVOICE
 *
 * Differences from the legacy writer, all deliberate:
 *   - shipping is added to the total once, not once per line
 *   - an order is not skipped because its postal code is not numeric
 *   - a line with no product code stops that order with a reason
 */
public static class ComputymeConsumerOrderAdapter
{
    public static string Map(CanonicalOrder order, string consumerAccount)
    {
        ArgumentNullException.ThrowIfNull(order);

        if (string.IsNullOrWhiteSpace(consumerAccount))
        {
            throw new InvalidOperationException(
                "The Computyme consumer account is not configured.");
        }

        var shipTo =
            order.Fulfillment.FulfillmentGroups.FirstOrDefault()?.ShipTo
            ?? order.Addresses.Shipping;

        var errors = new List<string>();

        if (shipTo is null)
            errors.Add("The order has no shipping address.");

        if (order.Items.Count == 0)
            errors.Add("The order has no lines.");

        var lines = new List<(decimal Quantity, decimal Price, string Sku, string Name)>();

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

            if (item.UnitPrice is null || !TryParse(item.UnitPrice, out var price))
            {
                errors.Add($"Line {item.LineId} does not have a valid price.");
                continue;
            }

            lines.Add((item.Quantity, price, item.Sku.Trim(), item.ProductName ?? string.Empty));
        }

        var shipping = 0m;

        if (order.Pricing.ShippingTotal is not null &&
            !TryParse(order.Pricing.ShippingTotal, out shipping))
        {
            errors.Add("The shipping total is not a valid amount.");
        }

        if (errors.Count > 0)
        {
            throw new InvalidOperationException(
                "The order cannot be exported to Computyme: " + string.Join(" ", errors));
        }

        var orderTotal = lines.Sum(line => line.Price * line.Quantity) + shipping;

        var channelOrderNumber =
            Reference(order, "paypalInvoiceNumber")
            ?? order.Source.ChannelOrderId
            ?? order.Metadata.OrderId;

        var output = new List<string>
        {
            CleanLine(channelOrderNumber),
            CleanLine(consumerAccount),
            DateTime.Today.ToString("MM/dd/yy", CultureInfo.InvariantCulture),
            string.Empty,
            CleanLine(order.Metadata.OrderId),
            string.Empty,
            string.Empty,
            Amount(orderTotal),
            string.Join(
                "|",
                CleanField(shipTo!.FirstName),
                CleanField(shipTo.LastName),
                CleanField(shipTo.Line1),
                CleanField(shipTo.Line2),
                CleanField(shipTo.City),
                CleanField(shipTo.Region),
                CleanField(shipTo.PostalCode),
                CleanField(shipTo.Phone),
                CleanField(shipTo.Email ?? order.Customer.Email)),
            string.Empty
        };

        foreach (var line in lines)
        {
            output.Add(line.Quantity.ToString("0", CultureInfo.InvariantCulture));
            output.Add(Amount(line.Price));
            output.Add(CleanLine(line.Sku));
            output.Add(CleanLine(line.Name));
        }

        output.Add("ENDOFINVOICE");

        return string.Join(Environment.NewLine, output) + Environment.NewLine;
    }

    private static string? Reference(CanonicalOrder order, string key)
    {
        return order.References.TryGetValue(key, out var value) &&
               !string.IsNullOrWhiteSpace(value)
            ? value
            : null;
    }

    private static bool TryParse(Money money, out decimal value)
    {
        return decimal.TryParse(
            money.Amount,
            NumberStyles.Number,
            CultureInfo.InvariantCulture,
            out value);
    }

    private static string Amount(decimal value)
    {
        return value.ToString("0.00", CultureInfo.InvariantCulture);
    }

    private static string CleanLine(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : value.Replace("\r", " ").Replace("\n", " ").Trim();
    }

    private static string CleanField(string? value)
    {
        return CleanLine(value).Replace("|", " ");
    }
}
