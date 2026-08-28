namespace ProInternal.Models.OrderIntegration
{
    public  record OrderExportRecord(
       int OrderId,
       string? CanonicalJson,
       string? AdapterOutput,
       string ExportStatus,
       string? ErrorsJson);

    public  record OrderExportBatch(
        Guid BatchId,
        string Destination,
        string FileName,
        string OutputPath,
        string ExportStatus,
        string? GeneratedBy,
        string? FileContent,
        string? FileHash,
        string? ErrorsJson,
        IReadOnlyList<OrderExportRecord> Orders);
}
    public  record OrderExportResult(
        bool Success,
        string Message,
        Guid BatchId,
        string? FileName,
        int ProcessedCount,
        Dictionary<string, List<string>> Errors);