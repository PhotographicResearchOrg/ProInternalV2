using ProInternal.Models.OrderIntegration;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.Json;

namespace ProInternal.Services.OrderIntegration
{
    /*
     * Turns an inbox row into what the Order Toolbench shows.
     *
     * A held order is held because something about it is wrong, so
     * nothing here may assume the stored JSON is complete or even
     * readable. Every value is optional; a record that cannot be read
     * at all is still listed, with its errors and its raw document.
     */
    public static class OrderInboxReviewMapper
    {
        public static OrderInboxReviewItem ToItem(OrderInboxRow row)
        {
            var item = new OrderInboxReviewItem();
            Fill(item, row, detail: null);
            return item;
        }

        public static OrderInboxReviewDetail ToDetail(OrderInboxRow row)
        {
            var detail = new OrderInboxReviewDetail
            {
                RawDocument = row.RawDocument
            };

            Fill(detail, row, detail);
            return detail;
        }

        private static void Fill(
            OrderInboxReviewItem item,
            OrderInboxRow row,
            OrderInboxReviewDetail? detail)
        {
            item.InboxId = row.InboxId;
            item.Channel = row.Channel;
            item.StoreId = row.StoreId;
            item.ChannelOrderId = row.ChannelOrderId;
            item.State = row.State;
            item.ReceivedAt = row.ReceivedAt;
            item.LastAttemptAt = row.LastAttemptAt;
            item.AttemptCount = row.AttemptCount;
            item.TargetTable = row.TargetTable;
            item.TargetOrderId = row.TargetOrderId;
            item.ReviewedBy = row.ReviewedBy;
            item.ReviewedAt = row.ReviewedAt;
            item.ReviewNote = row.ReviewNote;
            item.Problems = ReadProblems(row.ErrorsJson);

            if (string.IsNullOrWhiteSpace(row.CanonicalJson))
            {
                return;
            }

            try
            {
                using var doc = JsonDocument.Parse(row.CanonicalJson);
                var root = doc.RootElement;

                if (root.ValueKind != JsonValueKind.Object)
                {
                    return;
                }

                item.OrderNumber = Text(root, "metadata", "orderNumber");
                item.CustomerName = Text(root, "customer", "name");
                item.CustomerEmail = Text(root, "customer", "email");
                item.Total = Amount(Find(root, "pricing", "grandTotal"));
                item.Currency =
                    Text(root, "pricing", "grandTotal", "currency") ??
                    Text(root, "order", "currency");

                var items = Find(root, "items");

                if (items is { ValueKind: JsonValueKind.Array })
                {
                    item.ItemCount = items.Value.GetArrayLength();

                    if (detail is not null)
                    {
                        foreach (var line in items.Value.EnumerateArray())
                        {
                            if (line.ValueKind != JsonValueKind.Object)
                            {
                                continue;
                            }

                            detail.Lines.Add(new OrderInboxLine
                            {
                                LineId = Text(line, "lineId"),
                                Sku = Text(line, "sku"),
                                ProductName = Text(line, "productName"),
                                Quantity = Number(Find(line, "quantity")),
                                UnitPrice = Amount(Find(line, "unitPrice")),
                                LineTotal = Amount(Find(line, "lineTotal"))
                            });
                        }
                    }
                }

                if (detail is not null)
                {
                    var shipTo = Find(root, "addresses", "shipping");

                    if (shipTo is { ValueKind: JsonValueKind.Object })
                    {
                        var a = shipTo.Value;

                        detail.ShipTo = new OrderInboxAddress
                        {
                            Name = Text(a, "name"),
                            Attention = Text(a, "attention"),
                            Line1 = Text(a, "line1"),
                            Line2 = Text(a, "line2"),
                            City = Text(a, "city"),
                            Region = Text(a, "region"),
                            PostalCode = Text(a, "postalCode"),
                            Country = Text(a, "country"),
                            Phone = Text(a, "phone"),
                            Email = Text(a, "email")
                        };
                    }
                }
            }
            catch (JsonException)
            {
                /* Unreadable canonical copy: the row is still listed. */
            }
        }

        private static List<OrderInboxProblem> ReadProblems(string? errorsJson)
        {
            var problems = new List<OrderInboxProblem>();

            if (string.IsNullOrWhiteSpace(errorsJson))
            {
                return problems;
            }

            try
            {
                using var doc = JsonDocument.Parse(errorsJson);

                if (doc.RootElement.ValueKind != JsonValueKind.Array)
                {
                    return problems;
                }

                foreach (var error in doc.RootElement.EnumerateArray())
                {
                    if (error.ValueKind != JsonValueKind.Object)
                    {
                        continue;
                    }

                    problems.Add(new OrderInboxProblem
                    {
                        Code = Text(error, "code") ?? "UNKNOWN",
                        Field = Text(error, "field"),
                        Message = Text(error, "message")
                    });
                }
            }
            catch (JsonException)
            {
                problems.Add(new OrderInboxProblem
                {
                    Code = "UNREADABLE_ERRORS",
                    Message = errorsJson
                });
            }

            return problems;
        }

        /* Walks a path of property names. Null when any step is missing. */
        private static JsonElement? Find(JsonElement element, params string[] path)
        {
            var current = element;

            foreach (var name in path)
            {
                if (current.ValueKind != JsonValueKind.Object ||
                    !current.TryGetProperty(name, out var next))
                {
                    return null;
                }

                current = next;
            }

            return current;
        }

        private static string? Text(JsonElement element, params string[] path)
        {
            var found = Find(element, path);

            if (found is null)
            {
                return null;
            }

            return found.Value.ValueKind switch
            {
                JsonValueKind.String => found.Value.GetString(),
                JsonValueKind.Number => found.Value.GetRawText(),
                _ => null
            };
        }

        /* A money object { amount, currency }; amount may be text or a number. */
        private static decimal? Amount(JsonElement? money)
        {
            if (money is not { ValueKind: JsonValueKind.Object })
            {
                return null;
            }

            return Number(Find(money.Value, "amount"));
        }

        private static decimal? Number(JsonElement? value)
        {
            if (value is null)
            {
                return null;
            }

            if (value.Value.ValueKind == JsonValueKind.Number &&
                value.Value.TryGetDecimal(out var number))
            {
                return number;
            }

            if (value.Value.ValueKind == JsonValueKind.String &&
                decimal.TryParse(
                    value.Value.GetString(),
                    NumberStyles.Number,
                    CultureInfo.InvariantCulture,
                    out var parsed))
            {
                return parsed;
            }

            return null;
        }
    }
}
