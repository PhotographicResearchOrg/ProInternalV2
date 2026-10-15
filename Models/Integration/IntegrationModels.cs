using System;
using System.Collections.Generic;

namespace ProInternal.Models.Integration
{
    /* Domains and statuses as stored; kept as strings so the desk can show them as-is. */
    public static class IntegrationDomains
    {
        public const string Product = "PRODUCT";
        public const string Category = "CATEGORY";
        public const string Member = "MEMBER";
        public const string Vendor = "VENDOR";
        public const string Rebate = "REBATE";
        public const string PurchaseOrder = "PURCHASE_ORDER";
        public const string PaymentRun = "PAYMENT_RUN";
        public const string Gl = "GL";
    }

    public static class IntegrationStatus
    {
        public const string Queued = "QUEUED";
        public const string Sent = "SENT";
        public const string Acknowledged = "ACKNOWLEDGED";
        public const string Rejected = "REJECTED";
        public const string Failed = "FAILED";
        public const string Overdue = "OVERDUE";
        public const string Superseded = "SUPERSEDED";
        public const string Cancelled = "CANCELLED";
    }

    /* What a desk hands the outbox when it saves. */
    public sealed class IntegrationEnqueueRequest
    {
        public string Domain { get; set; } = "";
        public string EntityId { get; set; } = "";
        public string? EntityLabel { get; set; }
        public string Destination { get; set; } = "";
        public string Operation { get; set; } = "UPSERT";
        public string ContractVersion { get; set; } = "1.0";
        public string Payload { get; set; } = "";
        public string CreatedBy { get; set; } = "";
    }

    public sealed class IntegrationEnqueued
    {
        public long MessageId { get; set; }
        public Guid CorrelationId { get; set; }
    }

    /* A message claimed by the dispatcher for sending. */
    public sealed class IntegrationOutgoing
    {
        public long MessageId { get; set; }
        public Guid CorrelationId { get; set; }
        public string Domain { get; set; } = "";
        public string EntityId { get; set; } = "";
        public string Destination { get; set; } = "";
        public string Operation { get; set; } = "";
        public string ContractVersion { get; set; } = "";
        public string Payload { get; set; } = "";
        public int Attempts { get; set; }
    }

    public sealed class IntegrationSendResult
    {
        public bool Delivered { get; init; }
        public string? Error { get; init; }

        public static IntegrationSendResult Ok() => new() { Delivered = true };
        public static IntegrationSendResult Fail(string error) => new() { Delivered = false, Error = error };
    }

    public sealed class IntegrationSummaryRow
    {
        public string Domain { get; set; } = "";
        public string Destination { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public bool IsActive { get; set; }
        public int Queued { get; set; }
        public int AwaitingAnswer { get; set; }
        public int Overdue { get; set; }
        public int Rejected { get; set; }
        public int Failed { get; set; }
        public int AcknowledgedToday { get; set; }
    }

    public sealed class IntegrationMessageRow
    {
        public long MessageId { get; set; }
        public Guid CorrelationId { get; set; }
        public string Domain { get; set; } = "";
        public string EntityId { get; set; } = "";
        public string? EntityLabel { get; set; }
        public string Destination { get; set; } = "";
        public string Operation { get; set; } = "";
        public string Status { get; set; } = "";
        public int Attempts { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = "";
        public DateTime? SentAt { get; set; }
        public DateTime? DueBy { get; set; }
        public DateTime? RespondedAt { get; set; }
        public string? ExternalId { get; set; }
        public string? LastError { get; set; }
        public int TotalRows { get; set; }
    }

    public sealed class IntegrationMessageDetail
    {
        public long MessageId { get; set; }
        public Guid CorrelationId { get; set; }
        public string Domain { get; set; } = "";
        public string EntityId { get; set; } = "";
        public string? EntityLabel { get; set; }
        public string Destination { get; set; } = "";
        public string Operation { get; set; } = "";
        public string ContractVersion { get; set; } = "";
        public string Payload { get; set; } = "";
        public string PayloadSha256 { get; set; } = "";
        public string Status { get; set; } = "";
        public int Attempts { get; set; }
        public DateTime? NextAttemptAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = "";
        public DateTime? SentAt { get; set; }
        public DateTime? DueBy { get; set; }
        public DateTime? RespondedAt { get; set; }
        public string? ExternalId { get; set; }
        public string? LastError { get; set; }

        public List<IntegrationResponseRow> Responses { get; set; } = new();
        public List<IntegrationEventRow> Events { get; set; } = new();
    }

    public sealed class IntegrationResponseRow
    {
        public long ResponseId { get; set; }
        public string ResponseType { get; set; } = "";
        public string? Result { get; set; }
        public string? ReasonCode { get; set; }
        public string? Message { get; set; }
        public string? ExternalId { get; set; }
        public DateTime RespondedAt { get; set; }
        public DateTime ReceivedAt { get; set; }
        public string Body { get; set; } = "";
    }

    public sealed class IntegrationEventRow
    {
        public long EventId { get; set; }
        public string EventType { get; set; } = "";
        public string Actor { get; set; } = "";
        public string? Reason { get; set; }
        public DateTime At { get; set; }
    }

    /* The answer a receiving system posts (Schemas/Integration/v1.0/integration-response.schema.json). */
    public sealed class IntegrationResponseDocument
    {
        public string SchemaVersion { get; set; } = "";
        public Guid CorrelationId { get; set; }
        public string ResponseType { get; set; } = "";
        public string? Result { get; set; }
        public string? ReasonCode { get; set; }
        public string? Message { get; set; }
        public string? ExternalId { get; set; }
        public DateTimeOffset RespondedAt { get; set; }
    }

    public sealed class IntegrationResponseApplied
    {
        public string Outcome { get; set; } = "";   // APPLIED, DUPLICATE, NOT_FOUND
        public long? MessageId { get; set; }
        public string? Status { get; set; }
    }

    public sealed class IntegrationActionRequest
    {
        public string Reason { get; set; } = "";
    }

    public sealed class FileLibraryEntry
    {
        public long FileId { get; set; }
        public string Category { get; set; } = "";
        public string OwnerKey { get; set; } = "";
        public string FileName { get; set; } = "";
        public string ContentType { get; set; } = "";
        public long SizeBytes { get; set; }
        public string Sha256 { get; set; } = "";
        public string Bucket { get; set; } = "";
        public string S3Key { get; set; } = "";
        public string UploadedBy { get; set; } = "";
        public DateTime UploadedAt { get; set; }
        public string? Notes { get; set; }

        /* True when this exact content was already stored for the owner. */
        public bool IsDuplicate { get; set; }
    }
}
