using Dapper;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers;
using ProInternal.Models.OrderIntegration;
using ProInternal.Models.OrderIntegration.Shopify;
using ProInternal.Services.OrderIntegration.Adapters.Inbound;

using ProInternal.Services.OrderIntegration.Adapters.Inbox;

using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using ProInternal.Services.OrderIntegration.Adapters.Core;
namespace ProInternal.Services.OrderIntegration
{
    public class OrderInboxDataAccess : BaseDataAccess, IOrderInboxDataAccess
    {
        public OrderInboxDataAccess(IConfiguration config, AwsSecretHelper helper)
            : base(config, helper, "ProConnectionString")
        {
        }

        private static readonly JsonSerializerOptions IntegrationJsonOptions =
            new(JsonSerializerDefaults.Web)
            {
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
            };

        public async Task<OrderInboxReceipt> ReceiveAsync(
            string channel,
            string? storeId,
            string? channelOrderId,
            string? documentId,
            string? rawDocument,
            object? metadata,
            CancellationToken cancellationToken)
        {
            string? metadataJson = null;

            if (metadata is not null)
            {
                metadataJson = JsonSerializer.Serialize(metadata, IntegrationJsonOptions);
            }

            using var conn = GetConnection();

            var command = new CommandDefinition(
                "dbo.PIV2_OrderInbox_Receive",
                new
                {
                    Channel = channel,
                    StoreId = storeId,
                    ChannelOrderId = channelOrderId,
                    DocumentId = documentId,
                    RawDocument = rawDocument ?? string.Empty,
                    MetadataJson = metadataJson
                },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken);

            return await conn.QuerySingleAsync<OrderInboxReceipt>(command);
        }

        public async Task SetResultAsync(
            long inboxId,
            string state,
            CanonicalOrder? order,
            IReadOnlyCollection<InboundOrderError> errors,
            string? targetTable,
            int? targetOrderId,
            CancellationToken cancellationToken)
        {
            string? canonicalJson = null;

            if (order is not null)
            {
                canonicalJson = JsonSerializer.Serialize(order, IntegrationJsonOptions);
            }

            string? errorsJson = null;

            if (errors is not null && errors.Count > 0)
            {
                errorsJson = JsonSerializer.Serialize(errors, IntegrationJsonOptions);
            }

            using var conn = GetConnection();

            var command = new CommandDefinition(
                "dbo.PIV2_OrderInbox_SetResult",
                new
                {
                    InboxId = inboxId,
                    State = state,
                    CanonicalJson = canonicalJson,
                    ErrorsJson = errorsJson,
                    TargetTable = targetTable,
                    TargetOrderId = targetOrderId
                },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken);

            await conn.ExecuteAsync(command);
        }

        public async Task<List<OrderInboxReviewItem>> GetReviewAsync(
            bool includeRejected,
            CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            var command = new CommandDefinition(
                "dbo.PIV2_OrderInbox_GetReview",
                new { IncludeRejected = includeRejected },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken);

            var rows = await conn.QueryAsync<OrderInboxRow>(command);

            return rows
                .Select(OrderInboxReviewMapper.ToItem)
                .ToList();
        }

        public async Task<OrderInboxReviewDetail?> GetReviewDetailAsync(
            long inboxId,
            CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            var command = new CommandDefinition(
                "dbo.PIV2_OrderInbox_GetById",
                new { InboxId = inboxId },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken);

            var row = await conn.QuerySingleOrDefaultAsync<OrderInboxRow>(command);

            return row is null
                ? null
                : OrderInboxReviewMapper.ToDetail(row);
        }

        public async Task<OrderInboxActionResponse> RejectAsync(
            long inboxId,
            string reason,
            string actionBy,
            CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            var command = new CommandDefinition(
                "dbo.PIV2_OrderInbox_Reject",
                new
                {
                    InboxId = inboxId,
                    Reason = reason,
                    ActionBy = actionBy
                },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken);

            return await conn.QuerySingleAsync<OrderInboxActionResponse>(command);
        }

        public async Task<OrderInboxRow?> GetRowAsync(
            long inboxId,
            CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            var command = new CommandDefinition(
                "dbo.PIV2_OrderInbox_GetById",
                new { InboxId = inboxId },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken);

            return await conn.QuerySingleOrDefaultAsync<OrderInboxRow>(command);
        }

        public async Task<OrderInboxActionResponse> SaveEditAsync(
            long inboxId,
            string canonicalJson,
            string? actionData,
            string actionBy,
            string actionSource,
            CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            var command = new CommandDefinition(
                "dbo.PIV2_OrderInbox_SaveEdit",
                new
                {
                    InboxId = inboxId,
                    CanonicalJson = canonicalJson,
                    ActionData = actionData,
                    ActionBy = actionBy,
                    ActionSource = actionSource
                },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken);

            return await conn.QuerySingleAsync<OrderInboxActionResponse>(command);
        }

        public async Task AuditAsync(
            long inboxId,
            string actionType,
            string? reason,
            string? actionData,
            string actionBy,
            string actionSource,
            int? orderConsumerId,
            CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            var command = new CommandDefinition(
                "dbo.PIV2_OrderInbox_Audit",
                new
                {
                    InboxId = inboxId,
                    ActionType = actionType,
                    Reason = reason,
                    ActionData = actionData,
                    ActionBy = actionBy,
                    ActionSource = actionSource,
                    OrderConsumerId = orderConsumerId
                },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken);

            await conn.ExecuteAsync(command);
        }

        public async Task<List<ProductLookupDto>> SearchProductsAsync(
            string term,
            CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            var command = new CommandDefinition(
                "dbo.PIV2_Products_Search",
                new { Term = term },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken);

            var products = await conn.QueryAsync<ProductLookupDto>(command);

            return products.ToList();
        }

        /* ---- inbound POS and EDI orders (11_InboundOrders.sql) ---- */

        public InboundLookup LoadInboundLookup(
            string channel,
            string accountNumber,
            string? shipToCode,
            IReadOnlyCollection<string> productCodes)
        {
            using var conn = GetConnection();

            using var results = conn.QueryMultiple(
                "dbo.PIV2_InboundOrder_Lookup",
                new
                {
                    Channel = channel,
                    AccountNumber = accountNumber,
                    ShipToCode = string.IsNullOrWhiteSpace(shipToCode) ? null : shipToCode.Trim(),
                    CodesJson = JsonSerializer.Serialize(productCodes)
                },
                commandType: CommandType.StoredProcedure);

            var account = results.ReadFirstOrDefault<InboundAccountRow>();
            var shipTo = results.ReadFirstOrDefault<InboundAddressRow>();
            var productRows = results.Read<InboundProductRow>().ToList();
            var componentRows = results.Read<InboundComponentRow>().ToList();

            InboundCustomer? customer = null;

            if (account is not null)
            {
                customer = new InboundCustomer(
                    Clean(account.AccountNumber) ?? accountNumber.Trim(),
                    Clean(account.Name),
                    Clean(account.Email),
                    Clean(account.Phone),
                    account.AddressId is null
                        ? null
                        : ToAddress(account, Clean(account.AddressName) ?? Clean(account.Name)));
            }

            var products = new Dictionary<string, InboundProduct>(StringComparer.OrdinalIgnoreCase);

            foreach (var row in productRows)
            {
                if (string.IsNullOrWhiteSpace(row.Code) || string.IsNullOrWhiteSpace(row.ProductCode))
                    continue;

                var components = componentRows
                    .Where(c => string.Equals(c.BundleCode, row.Code, StringComparison.OrdinalIgnoreCase)
                             && !string.IsNullOrWhiteSpace(c.ProductCode))
                    .Select(c => new InboundBundleComponent(c.ProductCode!.Trim(), Clean(c.Name), 1m))
                    .ToList();

                products[row.Code.Trim()] = new InboundProduct(
                    row.ProductCode.Trim(),
                    Clean(row.Name),
                    row.IsForSale,

                    /*
                     * No price here on purpose. PRO's price depends on the
                     * channel, the account and the quantity, so the import
                     * works it out and records any difference in the audit.
                     */
                    null,

                    components);
            }

            return new InboundLookup(
                customer,
                shipTo is null ? null : ToAddress(shipTo, Clean(shipTo.AddressName)),
                shipTo?.AddressId,
                products);
        }

        public async Task<InboundOrderImported> ImportInboundOrderAsync(
            long inboxId,
            CanonicalOrder order,
            int? orderUserId,
            string? shippingNote,
            bool applySpecials,
            string actionBy,
            CancellationToken cancellationToken)
        {
            ArgumentNullException.ThrowIfNull(order);

            var canonicalJson = JsonSerializer.Serialize(order, IntegrationJsonOptions);

            using var conn = GetConnection();

            var command = new CommandDefinition(
                "dbo.PIV2_InboundOrder_Import",
                new
                {
                    InboxId = inboxId,
                    CanonicalJson = canonicalJson,
                    OrderUserId = orderUserId,
                    ShippingNote = shippingNote,
                    ApplySpecials = applySpecials,
                    ActionBy = actionBy
                },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken);

            return await conn.QuerySingleAsync<InboundOrderImported>(command);
        }

        private static Address ToAddress(InboundAddressRow row, string? name)
        {
            return new Address
            {
                Name = name,
                Line1 = row.Address1 ?? string.Empty,
                Line2 = Clean(row.Address2),
                City = row.City ?? string.Empty,
                Region = Clean(row.State),
                PostalCode = Clean(row.Zip),
                Country = Clean(row.Country) ?? "US"
            };
        }

        private static string? Clean(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        private class InboundAddressRow
        {
            public int? AddressId { get; set; }
            public string? AddressName { get; set; }
            public string? Address1 { get; set; }
            public string? Address2 { get; set; }
            public string? City { get; set; }
            public string? State { get; set; }
            public string? Zip { get; set; }
            public string? Country { get; set; }
        }

        private sealed class InboundAccountRow : InboundAddressRow
        {
            public string? AccountNumber { get; set; }
            public string? Name { get; set; }
            public string? Email { get; set; }
            public string? Phone { get; set; }
        }

        private sealed class InboundProductRow
        {
            public string? Code { get; set; }
            public string? ProductCode { get; set; }
            public string? Name { get; set; }
            public bool IsForSale { get; set; }
            public bool IsBundle { get; set; }
        }

        private sealed class InboundComponentRow
        {
            public string? BundleCode { get; set; }
            public string? ProductCode { get; set; }
            public string? Name { get; set; }
        }
    }
}
