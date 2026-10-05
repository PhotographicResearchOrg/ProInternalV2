using Dapper;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers;
using ProInternal.Models.OrderIntegration;
using ProInternal.Models.OrderIntegration.Shopify;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

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
    }
}
