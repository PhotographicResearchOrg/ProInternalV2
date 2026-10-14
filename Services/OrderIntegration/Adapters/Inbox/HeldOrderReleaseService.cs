using ProInternal.Models.OrderIntegration;
using ProInternal.Models.OrderIntegration.Shopify;
using ProInternal.Models.Orders;
using ProInternal.Services.OrderIntegration.Adapters.Inbound;
using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using ProInternal.Services.OrderIntegration.Adapters.Core;

namespace ProInternal.Services.OrderIntegration
{
    /*
     * Fix a held order and release it.
     *
     * 1. The corrections are applied to the held contract order. The
     *    document as received is never changed.
     * 2. What changed is saved and audited.
     * 3. The order is checked again: every line has a product code,
     *    the order passes the contract, and the import accepts it.
     *    For a POS or EDI order the account, its addresses and the
     *    products are also read again from PRO's own data.
     * 4. If it passes it is imported and leaves Needs Review. If not,
     *    it stays held and shows the new reasons.
     */
    public sealed class HeldOrderReleaseService
    {
        private const string ShopifyChannel = "SHOPIFY";
        private const string OrderConsumerTable = "OrderConsumer";
        private const string OrdersTable = "Orders";
        private const string ActionSource = "Order Toolbench";

        /* Raised by PIV2_ShopifyOrderConsumer_Import when it refuses an order. */
        private const int ImportBusinessErrorFirst = 50001;
        private const int ImportBusinessErrorLast = 50013;

        private readonly IOrderInboxDataAccess _inbox;
        private readonly IOrderIntegrationDataAccess _dataAccess;
        private readonly IOrderSchemaValidator _schemaValidator;
        private readonly OrderIntegrationService _integration;
        private readonly IOrdersDataAccess _orders;

        public HeldOrderReleaseService(
            IOrderInboxDataAccess inbox,
            IOrderIntegrationDataAccess dataAccess,
            IOrderSchemaValidator schemaValidator,
            OrderIntegrationService integration,
            IOrdersDataAccess orders)
        {
            _inbox = inbox;
            _dataAccess = dataAccess;
            _schemaValidator = schemaValidator;
            _integration = integration;
            _orders = orders;
        }

        public async Task<HeldOrderReleaseResult> ReleaseAsync(
            HeldOrderReleaseRequest request,
            string actionBy,
            CancellationToken cancellationToken)
        {
            var row = await _inbox.GetRowAsync(request.InboxId, cancellationToken);

            if (row is null)
                return NotReleased("The inbox record was not found.");

            if (row.State != OrderInboxState.NeedsReview &&
                row.State != OrderInboxState.Received)
            {
                return NotReleased(
                    "This order is no longer waiting for review. Refresh the list.");
            }

            /* POS and EDI orders become dealer orders (the Orders table). */
            var isDealerOrder = OrderIntegrationService.IsFileChannel(row.Channel);

            if (!isDealerOrder &&
                !string.Equals(row.Channel, ShopifyChannel, StringComparison.OrdinalIgnoreCase))
            {
                return NotReleased(
                    $"Releasing a {row.Channel} order from here is not available yet.");
            }

            if (string.IsNullOrWhiteSpace(row.CanonicalJson) ||
                string.IsNullOrWhiteSpace(row.ChannelOrderId))
            {
                return NotReleased(
                    "This order could not be read when it arrived, so there is nothing to correct here. Reject it and re-send it from the channel.");
            }

            JsonObject root;

            try
            {
                root = JsonNode.Parse(row.CanonicalJson) as JsonObject
                    ?? throw new JsonException("The held order is not a JSON object.");
            }
            catch (JsonException)
            {
                return NotReleased(
                    "The held order could not be read. Reject it and re-send it from the channel.");
            }

            /* 1. Apply the corrections. */
            var changes = new List<Dictionary<string, string?>>();

            var productProblem = await ApplyLineEditsAsync(
                root, request.Lines, changes, cancellationToken);

            if (productProblem is not null)
                return NotReleased(productProblem);

            var lookupErrors = new List<InboundOrderError>();

            if (isDealerOrder)
            {
                /*
                 * A dealer's addresses come from the account, so they are
                 * not typed in here. The account, its addresses and the
                 * products are read again; anything fixed since the order
                 * arrived is picked up.
                 */
                lookupErrors = _integration.RefreshInboundOrder(root, row.Channel);

                /*
                 * The one exception: a dropship. The file gives only the
                 * recipient's name, so the address is typed in here.
                 */
                if (OrderIntegrationService.IsDropShip(root))
                {
                    if (HasFullAddress(request.ShipTo))
                    {
                        SetDropShipAddress(root, request.ShipTo!, changes);
                        OrderIntegrationService.MarkDropShipAddressEntered(root);
                    }

                    if (!OrderIntegrationService.DropShipAddressEntered(root))
                    {
                        lookupErrors.Add(Error(
                            InboundOrderBuilder.DropShipAddressNeeded,
                            "fulfillment.fulfillmentGroups[0].shipTo",
                            OrderIntegrationService.DropShipMessage(root)));
                    }
                }
            }
            else
            {
                ApplyShipTo(root, request.ShipTo, changes);
                ApplyEmail(root, request.Email, changes);
            }

            var canonicalJson = root.ToJsonString();

            /* 2. Save and audit, when something changed. */
            if (changes.Count > 0)
            {
                var saved = await _inbox.SaveEditAsync(
                    request.InboxId,
                    canonicalJson,
                    JsonSerializer.Serialize(changes),
                    actionBy,
                    ActionSource,
                    cancellationToken);

                if (!saved.Success)
                    return NotReleased(saved.Message);
            }

            /* 3. Check it again. */
            CanonicalOrder? order;

            try
            {
                order = JsonSerializer.Deserialize<CanonicalOrder>(canonicalJson);
            }
            catch (JsonException ex)
            {
                return await HoldAsync(
                    request.InboxId,
                    null,
                    [Error("CANONICAL_UNREADABLE", null, ex.Message)],
                    cancellationToken);
            }

            if (order is null)
            {
                return await HoldAsync(
                    request.InboxId,
                    null,
                    [Error("CANONICAL_UNREADABLE", null, "The held order is empty.")],
                    cancellationToken);
            }

            var errors = new List<InboundOrderError>(lookupErrors);

            for (var index = 0; index < order.Items.Count; index++)
            {
                if (string.IsNullOrWhiteSpace(order.Items[index].Sku))
                {
                    errors.Add(Error(
                        "MISSING_SKU",
                        $"items[{index}].sku",
                        $"Line {index + 1} ({order.Items[index].ProductName}) has no product code."));
                }
            }

            var validation = _schemaValidator.Validate(order);

            if (!validation.IsValid)
            {
                errors.AddRange(
                    validation.Errors.Select(
                        message => Error("CANONICAL_SCHEMA_INVALID", null, message)));
            }

            if (errors.Count > 0)
                return await HoldAsync(request.InboxId, order, errors, cancellationToken);

            /* 4. Import. */
            if (isDealerOrder)
            {
                var dropShipAddress = OrderIntegrationService.DropShipAddressEntered(root)
                    ? (root["addresses"] as JsonObject)?["shipping"] as JsonObject
                    : null;

                return await ReleaseDealerOrderAsync(
                    request.InboxId, order, dropShipAddress, actionBy, cancellationToken);
            }

            InboundOrderResult imported;

            try
            {
                imported = await _dataAccess.ImportShopifyOrderAsync(
                    request.InboxId,
                    row.ChannelOrderId,
                    order,
                    orderStatusId: 1,
                    cancellationToken);
            }
            catch (DbException ex) when (IsImportBusinessError(ex))
            {
                return await HoldAsync(
                    request.InboxId,
                    order,
                    [Error(ImportErrorCode(ex), null, ex.Message)],
                    cancellationToken);
            }

            int? orderConsumerId =
                int.TryParse(imported.OrderId, out var parsedId) ? parsedId : null;

            await _inbox.SetResultAsync(
                request.InboxId,
                OrderInboxState.Ready,
                order,
                Array.Empty<InboundOrderError>(),
                OrderConsumerTable,
                orderConsumerId,
                cancellationToken);

            await _inbox.AuditAsync(
                request.InboxId,
                "Held Order Released",
                orderConsumerId is null
                    ? "Released from Needs Review."
                    : $"Released from Needs Review as consumer order {orderConsumerId}.",
                actionData: null,
                actionBy,
                ActionSource,
                orderConsumerId,
                cancellationToken);

            return new HeldOrderReleaseResult
            {
                Released = true,
                OrderId = orderConsumerId,
                Message = orderConsumerId is null
                    ? "The order was released."
                    : $"Released as consumer order {orderConsumerId}."
            };
        }

        /* A POS or EDI order becomes a dealer order in the Orders table. */
        private async Task<HeldOrderReleaseResult> ReleaseDealerOrderAsync(
            long inboxId,
            CanonicalOrder order,
            JsonObject? dropShipAddress,
            string actionBy,
            CancellationToken cancellationToken)
        {
            var attempt = await _integration.TryImportInboundOrderAsync(
                inboxId, order, actionBy, cancellationToken);

            if (attempt.Refused is not null)
                return await HoldAsync(inboxId, order, [attempt.Refused], cancellationToken);

            await _inbox.SetResultAsync(
                inboxId,
                OrderInboxState.Ready,
                order,
                Array.Empty<InboundOrderError>(),
                OrdersTable,
                attempt.OrderId,
                cancellationToken);

            await _inbox.AuditAsync(
                inboxId,
                "Held Order Released",
                $"Released from Needs Review as order {attempt.OrderId}.",
                actionData: null,
                actionBy,
                ActionSource,
                orderConsumerId: null,
                cancellationToken);

            var message = attempt.PriceDifferences > 0
                ? $"Released as order {attempt.OrderId}. {attempt.PriceDifferences} line(s) were repriced to the PRO price; see the order audit."
                : $"Released as order {attempt.OrderId}.";

            /*
             * Dropship: the order now exists with the account's own
             * address. Put the entered address on it the same way the
             * Change Address / Dropship option on the Warehouse tab does.
             */
            if (dropShipAddress is not null && attempt.OrderId is not null)
            {
                var addressSet = false;
                string? addressProblem = null;

                try
                {
                    var response = _orders.UpdateShipTo(new UpdateOrderShipToRequest
                    {
                        OrderId = attempt.OrderId.Value.ToString(),
                        Mode = "DROPSHIP",
                        FirstName = Text(dropShipAddress, "firstName"),
                        LastName = Text(dropShipAddress, "lastName"),
                        Address1 = Text(dropShipAddress, "line1"),
                        Address2 = Text(dropShipAddress, "line2"),
                        City = Text(dropShipAddress, "city"),
                        State = Text(dropShipAddress, "region"),
                        PostalCode = Text(dropShipAddress, "postalCode"),
                        Country = Text(dropShipAddress, "country"),
                        Phone = Text(dropShipAddress, "phone"),
                        ActionBy = actionBy,
                        ActionSource = ActionSource
                    });

                    addressSet = response.Success;
                    addressProblem = response.Message;
                }
                catch (DbException ex)
                {
                    addressProblem = ex.Message;
                }

                message += addressSet
                    ? " The dropship address was set."
                    : $" THE DROPSHIP ADDRESS WAS NOT SET ({addressProblem}). Set it on the Warehouse tab with Change Address before processing this order.";
            }

            return new HeldOrderReleaseResult
            {
                Released = true,
                OrderId = attempt.OrderId,
                Message = message
            };
        }

        /*
         * The entered address replaces the ship-to outright. Nothing of
         * the account's own address is kept, so a field left blank is
         * blank on the order.
         */
        private static void SetDropShipAddress(
            JsonObject root,
            HeldOrderShipToEdit edit,
            List<Dictionary<string, string?>> changes)
        {
            JsonObject Build()
            {
                var address = new JsonObject();

                void Put(string name, string? value)
                {
                    if (!string.IsNullOrWhiteSpace(value))
                        address[name] = value.Trim();
                }

                var fullName = $"{edit.FirstName?.Trim()} {edit.LastName?.Trim()}".Trim();

                Put("name", fullName);
                Put("firstName", edit.FirstName);
                Put("lastName", edit.LastName);
                Put("line1", edit.Line1);
                Put("line2", edit.Line2);
                Put("city", edit.City);
                Put("region", edit.Region);
                Put("postalCode", edit.PostalCode);
                Put("country", string.IsNullOrWhiteSpace(edit.Country) ? "US" : edit.Country);
                Put("phone", edit.Phone);

                return address;
            }

            if (root["addresses"] is not JsonObject addresses)
            {
                addresses = new JsonObject();
                root["addresses"] = addresses;
            }

            addresses["shipping"] = Build();

            if (root["fulfillment"] is JsonObject fulfillment &&
                fulfillment["fulfillmentGroups"] is JsonArray groups)
            {
                foreach (var group in groups.OfType<JsonObject>())
                    group["shipTo"] = Build();
            }

            changes.Add(Change(
                "dropship ship-to",
                null,
                string.Join(", ", new[]
                {
                    $"{edit.FirstName?.Trim()} {edit.LastName?.Trim()}".Trim(),
                    edit.Line1?.Trim(),
                    edit.Line2?.Trim(),
                    edit.City?.Trim(),
                    $"{edit.Region?.Trim()} {edit.PostalCode?.Trim()}".Trim()
                }.Where(part => !string.IsNullOrWhiteSpace(part)))));
        }

        /* A dropship address needs at least a street, city, state and zip. */
        private static bool HasFullAddress(HeldOrderShipToEdit? edit)
        {
            return edit is not null
                && !string.IsNullOrWhiteSpace(edit.Line1)
                && !string.IsNullOrWhiteSpace(edit.City)
                && !string.IsNullOrWhiteSpace(edit.Region)
                && !string.IsNullOrWhiteSpace(edit.PostalCode);
        }

        /* ---- corrections ---- */

        private async Task<string?> ApplyLineEditsAsync(
            JsonObject root,
            List<HeldOrderLineEdit> edits,
            List<Dictionary<string, string?>> changes,
            CancellationToken cancellationToken)
        {
            if (edits.Count == 0 || root["items"] is not JsonArray items)
                return null;

            var removedAny = false;

            foreach (var edit in edits)
            {
                var wanted = edit.Sku?.Trim();

                if (string.IsNullOrEmpty(edit.LineId) ||
                    (!edit.Remove && string.IsNullOrEmpty(wanted)))
                {
                    continue;
                }

                var item = items
                    .OfType<JsonObject>()
                    .FirstOrDefault(candidate =>
                        string.Equals(Text(candidate, "lineId"), edit.LineId, StringComparison.Ordinal));

                if (item is null)
                    return $"Line {edit.LineId} is not on this order.";

                if (edit.Remove)
                {
                    /* The line, and a bundle's products listed under it. */
                    var leaving = items
                        .OfType<JsonObject>()
                        .Where(candidate =>
                            ReferenceEquals(candidate, item) ||
                            string.Equals(Text(candidate, "parentLineId"), edit.LineId, StringComparison.Ordinal))
                        .ToList();

                    changes.Add(Change(
                        $"line {edit.LineId} ({Text(item, "productName")}, code {Text(item, "sku") ?? "none"}, quantity {item["quantity"]})",
                        "on the order",
                        "removed"));

                    foreach (var gone in leaving)
                        items.Remove(gone);

                    removedAny = true;
                    continue;
                }

                var current = Text(item, "sku");

                if (string.Equals(current, wanted, StringComparison.OrdinalIgnoreCase))
                    continue;

                /* The code must be a real PRO product, exactly. */
                var matches = await _inbox.SearchProductsAsync(wanted, cancellationToken);

                var product = matches.FirstOrDefault(candidate =>
                    string.Equals(candidate.ProductCode?.Trim(), wanted, StringComparison.OrdinalIgnoreCase));

                if (product is null)
                    return $"'{wanted}' is not a PRO product code.";

                item["sku"] = product.ProductCode.Trim();

                changes.Add(Change(
                    $"line {edit.LineId} ({Text(item, "productName")}) product",
                    current,
                    product.ProductCode.Trim()));
            }

            if (removedAny)
            {
                var remaining = items.OfType<JsonObject>().ToList();

                if (remaining.Count == 0)
                    return "An order needs at least one line. Reject the order instead of removing every line.";

                /* Keep the subtotal in step with the lines that are left. */
                if (root["pricing"] is JsonObject pricing &&
                    pricing["subtotal"] is JsonObject subtotal)
                {
                    var total = 0m;

                    foreach (var line in remaining)
                    {
                        if (line["lineTotal"] is JsonObject lineTotal &&
                            decimal.TryParse(
                                Text(lineTotal, "amount"),
                                System.Globalization.NumberStyles.Number,
                                System.Globalization.CultureInfo.InvariantCulture,
                                out var amount))
                        {
                            total += amount;
                        }
                    }

                    subtotal["amount"] = total.ToString(
                        "0.00##", System.Globalization.CultureInfo.InvariantCulture);
                }
            }

            return null;
        }

        private static void ApplyShipTo(
            JsonObject root,
            HeldOrderShipToEdit? edit,
            List<Dictionary<string, string?>> changes)
        {
            if (edit is null)
                return;

            /* The ship-to appears on the order and on each fulfillment group. */
            var targets = new List<JsonObject>();

            if (root["addresses"] is JsonObject addresses)
            {
                if (addresses["shipping"] is JsonObject existing)
                {
                    targets.Add(existing);
                }
                else
                {
                    var created = new JsonObject();
                    addresses["shipping"] = created;
                    targets.Add(created);
                }
            }

            if (root["fulfillment"] is JsonObject fulfillment &&
                fulfillment["fulfillmentGroups"] is JsonArray groups)
            {
                foreach (var group in groups.OfType<JsonObject>())
                {
                    if (group["shipTo"] is JsonObject shipTo)
                        targets.Add(shipTo);
                }
            }

            if (targets.Count == 0)
                return;

            var fields = new (string Name, string? Value)[]
            {
                ("firstName", edit.FirstName),
                ("lastName", edit.LastName),
                ("line1", edit.Line1),
                ("line2", edit.Line2),
                ("city", edit.City),
                ("region", edit.Region),
                ("postalCode", edit.PostalCode),
                ("country", edit.Country),
                ("phone", edit.Phone)
            };

            var first = targets[0];
            var nameChanged = false;

            foreach (var (name, value) in fields)
            {
                /* null = not sent, leave it. Empty = clear it. */
                if (value is null)
                    continue;

                var wanted = value.Trim();
                var current = Text(first, name);

                if (string.Equals(current ?? string.Empty, wanted, StringComparison.Ordinal))
                    continue;

                changes.Add(Change($"ship-to {name}", current, wanted));

                nameChanged |= name is "firstName" or "lastName";

                foreach (var target in targets)
                {
                    if (wanted.Length == 0)
                        target.Remove(name);
                    else
                        target[name] = wanted;
                }
            }

            if (!nameChanged)
                return;

            /* Keep the label name in step with the person's name. */
            var fullName =
                $"{Text(first, "firstName")} {Text(first, "lastName")}".Trim();

            if (fullName.Length == 0)
                return;

            foreach (var target in targets)
                target["attention"] = fullName;
        }

        private static void ApplyEmail(
            JsonObject root,
            string? email,
            List<Dictionary<string, string?>> changes)
        {
            var wanted = email?.Trim();

            if (string.IsNullOrEmpty(wanted) || root["customer"] is not JsonObject customer)
                return;

            var current = Text(customer, "email");

            if (string.Equals(current, wanted, StringComparison.OrdinalIgnoreCase))
                return;

            customer["email"] = wanted;
            changes.Add(Change("customer email", current, wanted));

            /* Addresses that carried the old email follow it. */
            if (root["addresses"] is JsonObject addresses)
            {
                foreach (var key in new[] { "billing", "shipping" })
                {
                    if (addresses[key] is JsonObject address &&
                        (Text(address, "email") is null ||
                         string.Equals(Text(address, "email"), current, StringComparison.OrdinalIgnoreCase)))
                    {
                        address["email"] = wanted;
                    }
                }
            }

            if (root["fulfillment"] is JsonObject fulfillment &&
                fulfillment["fulfillmentGroups"] is JsonArray groups)
            {
                foreach (var group in groups.OfType<JsonObject>())
                {
                    if (group["shipTo"] is JsonObject shipTo &&
                        string.Equals(Text(shipTo, "email"), current, StringComparison.OrdinalIgnoreCase))
                    {
                        shipTo["email"] = wanted;
                    }
                }
            }
        }

        /* ---- outcomes ---- */

        private async Task<HeldOrderReleaseResult> HoldAsync(
            long inboxId,
            CanonicalOrder? order,
            List<InboundOrderError> errors,
            CancellationToken cancellationToken)
        {
            await _inbox.SetResultAsync(
                inboxId,
                OrderInboxState.NeedsReview,
                order,
                errors,
                null,
                null,
                cancellationToken);

            return new HeldOrderReleaseResult
            {
                Released = false,
                Message = "Your changes were saved, but the order still cannot be released.",
                Problems = errors
                    .Select(error => new OrderInboxProblem
                    {
                        Code = error.Code ?? "UNKNOWN",
                        Field = error.Field,
                        Message = error.Message
                    })
                    .ToList()
            };
        }

        private static HeldOrderReleaseResult NotReleased(string message)
        {
            return new HeldOrderReleaseResult
            {
                Released = false,
                Message = message
            };
        }

        /* ---- helpers ---- */

        private static string? Text(JsonObject node, string name)
        {
            return node[name] is JsonValue value && value.TryGetValue<string>(out var text)
                ? text
                : null;
        }

        private static Dictionary<string, string?> Change(
            string field, string? from, string? to)
        {
            return new Dictionary<string, string?>
            {
                ["field"] = field,
                ["from"] = from,
                ["to"] = to
            };
        }

        private static InboundOrderError Error(string code, string? field, string message)
        {
            return new InboundOrderError
            {
                Code = code,
                Field = field,
                Message = message
            };
        }

        private static int SqlErrorNumber(DbException ex)
        {
            return ex.GetType().GetProperty("Number")?.GetValue(ex) is int number
                ? number
                : 0;
        }

        private static bool IsImportBusinessError(DbException ex)
        {
            var number = SqlErrorNumber(ex);

            return number >= ImportBusinessErrorFirst &&
                   number <= ImportBusinessErrorLast;
        }

        private static string ImportErrorCode(DbException ex)
        {
            return SqlErrorNumber(ex) switch
            {
                50008 => "MISSING_EMAIL",
                50009 => "BILLING_ADDRESS_INCOMPLETE",
                50010 => "SHIPPING_ADDRESS_INCOMPLETE",
                50011 => "INVALID_CREATED_DATE",
                50012 => "NO_ORDER_ITEMS",
                50013 => "UNKNOWN_ITEM",
                _ => "IMPORT_REFUSED"
            };
        }
    }
}
