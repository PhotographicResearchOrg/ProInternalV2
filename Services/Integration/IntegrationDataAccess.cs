using Dapper;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers;
using ProInternal.Models.Integration;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace ProInternal.Services.Integration
{
    public interface IIntegrationDataAccess
    {
        Task<IntegrationEnqueued> EnqueueAsync(IntegrationEnqueueRequest request);
        Task<List<IntegrationOutgoing>> ClaimAsync(int take, int leaseSeconds);
        Task MarkSentAsync(long messageId);
        Task MarkFailedAsync(long messageId, string error);
        Task<int> MarkOverdueAsync();
        Task<IntegrationResponseApplied> ApplyResponseAsync(
            string destination, IntegrationResponseDocument response, string body);
        Task ResendAsync(long messageId, string actor, string reason);
        Task CancelAsync(long messageId, string actor, string reason);
        Task<List<IntegrationSummaryRow>> SummaryAsync();
        Task<List<IntegrationMessageRow>> SearchAsync(
            string? domain, string? destination, string? status, string? text, int page, int pageSize);
        Task<IntegrationMessageDetail?> GetAsync(long messageId);
    }

    /*
     * The outbox shared by every domain. Desks that already hold an open
     * transaction call IntegrationOutbox.Enqueue on that connection
     * instead, so the record and its message commit together.
     */
    public sealed class IntegrationDataAccess : BaseDataAccess, IIntegrationDataAccess
    {
        public IntegrationDataAccess(IConfiguration config, AwsSecretHelper helper)
            : base(config, helper, "ProConnectionString")
        {
        }

        public async Task<IntegrationEnqueued> EnqueueAsync(IntegrationEnqueueRequest request)
        {
            using var conn = GetConnection();
            return await IntegrationOutbox.EnqueueAsync(conn, null, request);
        }

        public async Task<List<IntegrationOutgoing>> ClaimAsync(int take, int leaseSeconds)
        {
            using var conn = GetConnection();
            var rows = await conn.QueryAsync<IntegrationOutgoing>(
                "dbo.PIV2_Integration_Claim",
                new { Take = take, LeaseSeconds = leaseSeconds },
                commandType: CommandType.StoredProcedure);
            return rows.ToList();
        }

        public async Task MarkSentAsync(long messageId)
        {
            using var conn = GetConnection();
            await conn.ExecuteAsync(
                "dbo.PIV2_Integration_MarkSent",
                new { MessageId = messageId },
                commandType: CommandType.StoredProcedure);
        }

        public async Task MarkFailedAsync(long messageId, string error)
        {
            using var conn = GetConnection();
            await conn.ExecuteAsync(
                "dbo.PIV2_Integration_MarkFailed",
                new { MessageId = messageId, Error = error },
                commandType: CommandType.StoredProcedure);
        }

        public async Task<int> MarkOverdueAsync()
        {
            using var conn = GetConnection();
            return await conn.ExecuteScalarAsync<int>(
                "dbo.PIV2_Integration_MarkOverdue",
                commandType: CommandType.StoredProcedure);
        }

        public async Task<IntegrationResponseApplied> ApplyResponseAsync(
            string destination, IntegrationResponseDocument response, string body)
        {
            using var conn = GetConnection();
            return await conn.QuerySingleAsync<IntegrationResponseApplied>(
                "dbo.PIV2_Integration_ApplyResponse",
                new
                {
                    Destination = destination,
                    response.CorrelationId,
                    response.ResponseType,
                    response.Result,
                    response.ReasonCode,
                    response.Message,
                    response.ExternalId,
                    RespondedAt = response.RespondedAt.UtcDateTime,
                    Body = body,
                    BodySha256 = IntegrationOutbox.Sha256Hex(body)
                },
                commandType: CommandType.StoredProcedure);
        }

        public async Task ResendAsync(long messageId, string actor, string reason)
        {
            using var conn = GetConnection();
            await conn.ExecuteAsync(
                "dbo.PIV2_Integration_Resend",
                new { MessageId = messageId, Actor = actor, Reason = reason },
                commandType: CommandType.StoredProcedure);
        }

        public async Task CancelAsync(long messageId, string actor, string reason)
        {
            using var conn = GetConnection();
            await conn.ExecuteAsync(
                "dbo.PIV2_Integration_Cancel",
                new { MessageId = messageId, Actor = actor, Reason = reason },
                commandType: CommandType.StoredProcedure);
        }

        public async Task<List<IntegrationSummaryRow>> SummaryAsync()
        {
            using var conn = GetConnection();
            var rows = await conn.QueryAsync<IntegrationSummaryRow>(
                "dbo.PIV2_Integration_Summary",
                commandType: CommandType.StoredProcedure);
            return rows.ToList();
        }

        public async Task<List<IntegrationMessageRow>> SearchAsync(
            string? domain, string? destination, string? status, string? text, int page, int pageSize)
        {
            using var conn = GetConnection();
            var rows = await conn.QueryAsync<IntegrationMessageRow>(
                "dbo.PIV2_Integration_Search",
                new
                {
                    Domain = Blank(domain),
                    Destination = Blank(destination),
                    Status = Blank(status),
                    Text = Blank(text),
                    Page = page,
                    PageSize = pageSize
                },
                commandType: CommandType.StoredProcedure);
            return rows.ToList();
        }

        public async Task<IntegrationMessageDetail?> GetAsync(long messageId)
        {
            using var conn = GetConnection();
            using var grid = await conn.QueryMultipleAsync(
                "dbo.PIV2_Integration_Get",
                new { MessageId = messageId },
                commandType: CommandType.StoredProcedure);

            var detail = await grid.ReadSingleOrDefaultAsync<IntegrationMessageDetail>();
            if (detail == null)
                return null;

            detail.Responses = (await grid.ReadAsync<IntegrationResponseRow>()).ToList();
            detail.Events = (await grid.ReadAsync<IntegrationEventRow>()).ToList();
            return detail;
        }

        private static string? Blank(string? value) =>
            string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    /* Enqueue inside a caller's transaction, and the hashing every desk shares. */
    public static class IntegrationOutbox
    {
        public static async Task<IntegrationEnqueued> EnqueueAsync(
            IDbConnection connection, IDbTransaction? transaction, IntegrationEnqueueRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);
            if (string.IsNullOrWhiteSpace(request.CreatedBy))
                throw new ArgumentException("CreatedBy is required: pass the signed-in user.", nameof(request));

            return await connection.QuerySingleAsync<IntegrationEnqueued>(
                "dbo.PIV2_Integration_Enqueue",
                new
                {
                    request.Domain,
                    request.EntityId,
                    request.EntityLabel,
                    request.Destination,
                    request.Operation,
                    request.ContractVersion,
                    request.Payload,
                    PayloadSha256 = Sha256Hex(request.Payload),
                    request.CreatedBy
                },
                transaction,
                commandType: CommandType.StoredProcedure);
        }

        public static string Sha256Hex(string text)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(text ?? ""));
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }
    }
}
