using Dapper;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers;
using ProInternal.Models.Orders;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Services.OrderIntegration.Adapters.Outbox
{
    public class OrderOutboxDataAccess : BaseDataAccess, IOrderOutboxDataAccess
    {
        public OrderOutboxDataAccess(IConfiguration config, AwsSecretHelper helper)
            : base(config, helper, "ProConnectionString")
        {
        }

        public async Task SetChannelAsync(
            Guid batchId, string channel, CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            await conn.ExecuteAsync(new CommandDefinition(
                "dbo.PIV2_OrderIntegrationExport_SetChannel",
                new { BatchId = batchId, Channel = channel },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));
        }

        public async Task<int> MarkSentAsync(
            Guid batchId, string? actionBy, string actionSource,
            CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            return await conn.QuerySingleAsync<int>(new CommandDefinition(
                "dbo.PIV2_OrderIntegrationExport_MarkSent",
                new { BatchId = batchId, ActionBy = actionBy, ActionSource = actionSource },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));
        }

        public async Task<List<SentOrderDto>> GetSentAsync(
            int days, int overdueHours, CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            var rows = await conn.QueryAsync<SentOrderDto>(new CommandDefinition(
                "dbo.PIV2_Orders_GetSent",
                new { Days = days, OverdueHours = overdueHours },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));

            return rows.ToList();
        }

        public async Task<OrderEditResponse> SetResponseAsync(
            string? channel, int orderId, string state,
            string? destinationOrderId, string? reason,
            string? actionBy, string actionSource,
            CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            return await conn.QuerySingleAsync<OrderEditResponse>(new CommandDefinition(
                "dbo.PIV2_OrderIntegrationExport_SetResponse",
                new
                {
                    Channel = channel,
                    OrderId = orderId,
                    State = state,
                    DestinationOrderId = destinationOrderId,
                    Reason = reason,
                    ActionBy = actionBy,
                    ActionSource = actionSource
                },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));
        }

        public async Task<OrderEditResponse> ReopenAsync(
            string? channel, int orderId, string reason,
            string actionBy, string actionSource,
            CancellationToken cancellationToken)
        {
            var procedure = IsConsumer(channel)
                ? "dbo.PIV2_Orders_ReopenConsumer"
                : "dbo.PIV2_Orders_Reopen";

            using var conn = GetConnection();

            return await conn.QuerySingleAsync<OrderEditResponse>(new CommandDefinition(
                procedure,
                new
                {
                    OrderId = orderId,
                    Reason = reason,
                    ActionBy = actionBy,
                    ActionSource = actionSource
                },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));
        }

        public async Task<OrderResponseApplied> ApplyResponseAsync(
            string destination,
            string orderRef,
            string? channel,
            string? state,
            string? destinationOrderId,
            string? reason,
            string? shipmentsJson,
            string actionType,
            string? messageJson,
            string actionBy,
            string actionSource,
            CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            return await conn.QuerySingleAsync<OrderResponseApplied>(new CommandDefinition(
                "dbo.PIV2_OrderIntegrationExport_ApplyResponse",
                new
                {
                    Destination = destination,
                    OrderRef = orderRef,
                    Channel = channel,
                    State = state,
                    DestinationOrderId = destinationOrderId,
                    Reason = reason,
                    ShipmentsJson = shipmentsJson,
                    ActionType = actionType,
                    MessageJson = messageJson,
                    ActionBy = actionBy,
                    ActionSource = actionSource
                },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));
        }

        public async Task<ConsumerOrderSource?> GetConsumerOrderSourceAsync(
            int orderId, CancellationToken cancellationToken)
        {
            using var conn = GetConnection();

            using var results = await conn.QueryMultipleAsync(new CommandDefinition(
                "dbo.PIV2_OrderIntegration_GetConsumerOrder",
                new { OrderId = orderId },
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));

            var order = await results.ReadFirstOrDefaultAsync<ConsumerOrderSource>();

            if (order is null)
                return null;

            order.Lines = (await results.ReadAsync<ConsumerOrderSourceLine>()).ToList();

            return order;
        }

        public static bool IsConsumer(string? channel)
        {
            return string.Equals(
                channel?.Trim(),
                "consumer",
                StringComparison.OrdinalIgnoreCase);
        }
    }
}
