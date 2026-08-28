using ProInternal.Models.OrderIntegration;
using System.Globalization;
using System.Text.Json;



namespace ProInternal.Services.OrderIntegration.Adapters.Outbound.Computyme;

public  class ComputymeOrderAdapter : IComputymeOrderAdapter
{
    public string Map(CanonicalOrder order)
    {
        ArgumentNullException.ThrowIfNull(order);

        ValidateOrder(order);
        
        var fulfillmentGroup =order.Fulfillment.FulfillmentGroups.FirstOrDefault();
        var isDropShip =fulfillmentGroup?.FulfillmentType ==FulfillmentType.DROPSHIP;
        var orderSectionId =GetReference(order, "orderSectionId")?? order.Metadata.OrderNumber ?? order.Metadata.OrderId;
        var submittedBy =GetComputymeExtension(order,"submittedBy");
        var firstLine =string.IsNullOrWhiteSpace(submittedBy)? orderSectionId : $"{orderSectionId}*{submittedBy}";
        var alternateShipTo =GetComputymeExtension(order,"shipToCode");
        string customerLine;

        if (!string.IsNullOrWhiteSpace(alternateShipTo))
        {
            customerLine = $"{order.Customer.CustomerId}-{alternateShipTo}";
        }
        else if (isDropShip)
        {
            customerLine =$"{order.Customer.CustomerId}*DS";
        }
        else
        {
            customerLine =order.Customer.CustomerId;
        }

        var lines = new List<string>
        {
            CleanLine(firstLine),
            CleanLine(customerLine),

            // Existing Computyme format uses the processing date.
            DateTime.Today.ToString("MM/dd/yy",CultureInfo.InvariantCulture),
            BuildShippingInstructions(order,fulfillmentGroup),
            CleanLine(order.Customer.PoNumber),
            GetComputymeExtension(order,"orderDiscount") ?? string.Empty,
            BuildTermsLine(order),
            BuildOrderTotalsLine(order),
            isDropShip? BuildDropShipAddress(order,fulfillmentGroup): BuildTrackingEmailLine(order),
            // Reserved future-shipment line.
            string.Empty
        };

        foreach (var item in ConsolidateItems(order.Items))
        {
            lines.Add(FormatQuantity(item.Quantity));
            lines.Add(item.UnitPrice.ToString("0.00",CultureInfo.InvariantCulture));
            lines.Add(CleanLine(item.Sku));
            lines.Add(CleanLine(item.ProductName));
        }
        lines.Add("ENDOFINVOICE");
        return string.Join(Environment.NewLine,lines) + Environment.NewLine;
    }

    private static void ValidateOrder(CanonicalOrder order)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(order.Metadata.OrderId))
        {
            errors.Add("Computyme requires an order ID.");
        }

        if (string.IsNullOrWhiteSpace(order.Customer.CustomerId))
        {
            errors.Add("Computyme requires a customer account number.");
        }

        if (order.Items.Count == 0)
        {
            errors.Add("Computyme requires at least one order item.");
        }

        foreach (var item in order.Items)
        {
            if (item.Quantity <= 0)
            {
                errors.Add($"Line {item.LineId} has an invalid quantity.");
            }

            if (item.Quantity !=decimal.Truncate(item.Quantity))
            {
                errors.Add($"Line {item.LineId} must have a whole-number quantity.");
            }

            if (string.IsNullOrWhiteSpace(item.Sku))
            {
                errors.Add($"Line {item.LineId} does not have a SKU.");
            }

            if (item.UnitPrice is null ||!TryParseMoney(item.UnitPrice,out _))
            {
                errors.Add($"Line {item.LineId} does not have a valid unit price.");
            }
        }

        if (errors.Count > 0)
        {
            throw new InvalidOperationException("The order cannot be exported to Computyme: " + string.Join(" ", errors));
        }
    }

    private static List<ComputymeItem>
        ConsolidateItems(IEnumerable<CanonicalOrderItem> items)
    {
        /*
         * Computyme cannot receive the same SKU more than once
         * at different prices. Duplicate SKUs are consolidated
         * using a weighted-average price.
         */

        return items
            .Where(item => item.Quantity > 0)
            .GroupBy(
                item => item.Sku!.Trim(),
                StringComparer.OrdinalIgnoreCase)
            .Select(
                group =>
                {
                    var quantity = group.Sum(item => item.Quantity);

                    var extendedTotal =
                        group.Sum(
                            item =>
                            {
                                TryParseMoney(item.UnitPrice!,out var price);
                                return price * item.Quantity;
                            });

                    var unitPrice = Math.Round(extendedTotal / quantity,2, MidpointRounding.AwayFromZero);

                    var productName =
                        group
                            .Select(item =>
                                item.ProductName)
                            .FirstOrDefault(name =>
                                !string.IsNullOrWhiteSpace(name))
                        ?? string.Empty;

                    return new ComputymeItem(
                        group.Key,
                        productName,
                        quantity,
                        unitPrice);
                }).ToList();
    }

    private static string BuildOrderTotalsLine(CanonicalOrder order)
    {
        /*
         * The legacy gross value was the sum of the item retail
         * values, not grand total including freight and tax.
         */
        decimal gross = 0;
        decimal quantity = 0;

        foreach (var item in order.Items)
        {
            TryParseMoney(
                item.UnitPrice!,
                out var unitPrice);

            gross += unitPrice * item.Quantity;
            quantity += item.Quantity;
        }

        return
            gross.ToString("0.00",CultureInfo.InvariantCulture) + "|" + FormatQuantity(quantity);
    }

    private static string BuildShippingInstructions(CanonicalOrder order,FulfillmentGroup? fulfillmentGroup)
    {
        var configuredInstructions = GetComputymeExtension(order,"shippingInstructions");

        if (!string.IsNullOrWhiteSpace(configuredInstructions))
        {
            return CleanLine(configuredInstructions);
        }

        if (!string.IsNullOrWhiteSpace(order.Order.Notes))
        {
            return CleanLine(order.Order.Notes);
        }

        var shippingMethod =fulfillmentGroup?.ShippingMethod;

        if (string.Equals(shippingMethod,"1",StringComparison.OrdinalIgnoreCase))
        {
            return "GROUND";
        }

        return CleanLine(shippingMethod);
    }

    private static string BuildTermsLine(CanonicalOrder order)
    {
        var terms = order.Order.PaymentTerms;

        if (!string.IsNullOrWhiteSpace(
                terms?.Code))
        {
            return CleanLine(terms.Code);
        }

        if (terms?.DueDate is not null)
        {
            return terms.DueDate.Value.ToString("MM/dd/yy", CultureInfo.InvariantCulture);
        }

        return string.Empty;
    }

    private static string BuildTrackingEmailLine(
        CanonicalOrder order)
    {
        var trackingEmails =
            GetComputymeExtension(order,"trackingEmails");

        if (!string.IsNullOrWhiteSpace(
                trackingEmails))
        {
            return CleanLine(trackingEmails);
        }

        return CleanLine(order.Customer.Email);
    }

    private static string BuildDropShipAddress(CanonicalOrder order,FulfillmentGroup? fulfillmentGroup)
    {
        var address = fulfillmentGroup?.ShipTo ?? order.Addresses.Shipping;

        if (address is null)
        {
            throw new InvalidOperationException( "Computyme requires a shipping address " + "for a drop-ship order.");
        }

        return string.Join(
            "|",
            CleanField(address.FirstName),
            CleanField(address.LastName),
            CleanField(address.Line1),
            CleanField(address.Line2),
            CleanField(address.City),
            CleanField(address.Region),
            CleanField(address.PostalCode),
            CleanField(
                address.Email ??
                order.Customer.Email));
    }

    private static string? GetReference(CanonicalOrder order,string key)
    {
        return order.References.TryGetValue(
            key,
            out var value)
                && !string.IsNullOrWhiteSpace(value)
                    ? value.Trim()
                    : null;
    }

    private static string? GetComputymeExtension( CanonicalOrder order, string key)
    {
        var extensions = order.Extensions.Computyme;

        if (extensions is null ||
            !extensions.TryGetValue(
                key,
                out var value))
        {
            return null;
        }

        if (value.ValueKind == JsonValueKind.String)
        {
            return value.GetString()?.Trim();
        }

        return value.ValueKind switch
        {
            JsonValueKind.Null => null,
            JsonValueKind.Undefined => null,
            _ => value.ToString().Trim()
        };
    }

    private static bool TryParseMoney( Money money, out decimal value)
    {
        return decimal.TryParse(
            money.Amount,
            NumberStyles.Number,
            CultureInfo.InvariantCulture,
            out value);
    }

    private static string FormatQuantity( decimal quantity)
    {
        return quantity.ToString(
            "0",
            CultureInfo.InvariantCulture);
    }

    private static string CleanLine( string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : value
                .Replace("\r", " ")
                .Replace("\n", " ")
                .Trim();
    }

    private static string CleanField(
        string? value)
    {
        return CleanLine(value)
            .Replace("|", " ");
    }

    private sealed record ComputymeItem(string Sku,string ProductName,decimal Quantity,decimal UnitPrice);
}