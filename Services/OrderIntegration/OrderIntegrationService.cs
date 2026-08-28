using ProInternal.Models.OrderIntegration;
using ProInternal.Services.OrderIntegration
    .Adapters.Outbound.Computyme;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ProInternal.Services.OrderIntegration;

public sealed class OrderIntegrationService
{
    private const string ComputymeDestination ="COMPUTYME";
    private static readonly SemaphoreSlim ComputymeFileLock = new(1, 1);

    private static readonly JsonSerializerOptions
        IntegrationJsonOptions =
            new(JsonSerializerDefaults.Web)
            {
                DefaultIgnoreCondition =
                    JsonIgnoreCondition.WhenWritingNull
            };

    private readonly IOrderIntegrationDataAccess _dataAccess;
    private readonly IOrderSchemaValidator _schemaValidator;
    private readonly IComputymeOrderAdapter  _computymeAdapter;
    private readonly ILogger<OrderIntegrationService>  _logger;
    private readonly string _computymeOutputPath;

    public OrderIntegrationService(
        IOrderIntegrationDataAccess dataAccess,
        IOrderSchemaValidator schemaValidator,
        IComputymeOrderAdapter computymeAdapter,
        IConfiguration configuration,
        ILogger<OrderIntegrationService> logger)
    {
        _dataAccess = dataAccess;
        _schemaValidator = schemaValidator;
        _computymeAdapter = computymeAdapter;
        _logger = logger;

        _computymeOutputPath =
            configuration[
                "OrderIntegration:Computyme:OutputPath"]
            ?? throw new InvalidOperationException(
                "Missing OrderIntegration:Computyme:OutputPath");
    }

    public async Task<OrderExportResult>
        ExportToComputymeAsync(IReadOnlyCollection<string> orderIds,string? generatedBy,CancellationToken cancellationToken)
    {
        if (orderIds.Count == 0)
        {
            throw new ArgumentException( "At least one order ID is required.", nameof(orderIds));
        }

        var batchId = Guid.NewGuid();
        var fileName = Path.GetFileName( _computymeOutputPath);
        if (string.IsNullOrWhiteSpace(fileName))
        {
            throw new InvalidOperationException("The Computyme output filename is invalid.");
        }

        var errors = new Dictionary<string, List<string>>(  StringComparer.OrdinalIgnoreCase);
        var records =new List<OrderExportRecord>();
        foreach (var orderId in orderIds.Distinct())
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (!int.TryParse(
                    orderId,
                    out var numericOrderId))
            {
                errors[orderId] =
                [
                    "A numeric OrderId is required."
                ];

                continue;
            }

            CanonicalOrder? order;

            try
            {
                order = _dataAccess.GetCanonicalOrder( orderId);
            }
            catch (Exception ex)
            {
                var orderErrors =
                    new List<string>
                    {
                        ex.Message
                    };

                errors[orderId] = orderErrors;

                records.Add(
                    CreateFailedRecord(
                        numericOrderId,
                        canonicalJson: null,
                        orderErrors));

                continue;
            }

            if (order is null)
            {
                var orderErrors =
                    new List<string>
                    {
                        "The order was not found."
                    };
                errors[orderId] = orderErrors;
                records.Add(CreateFailedRecord(numericOrderId,canonicalJson: null,orderErrors));

                continue;
            }

            var canonicalJson =
                JsonSerializer.Serialize(order,IntegrationJsonOptions);

            var schemaValidation = _schemaValidator.Validate(order);

            if (!schemaValidation.IsValid)
            {
                var orderErrors =schemaValidation.Errors.ToList();

                errors[orderId] = orderErrors;

                records.Add(
                    CreateFailedRecord(
                        numericOrderId,
                        canonicalJson,
                        orderErrors));

                continue;
            }

            try
            {
                var adapterOutput =
                    _computymeAdapter.Map(order);

                records.Add(
                    new OrderExportRecord(
                        numericOrderId,
                        canonicalJson,
                        adapterOutput,
                        ExportStatus: "GENERATED",
                        ErrorsJson: null));
            }
            catch (InvalidOperationException ex)
            {
                var orderErrors =
                    new List<string>
                    {
                        ex.Message
                    };
                errors[orderId] = orderErrors;
                records.Add(CreateFailedRecord(  numericOrderId, canonicalJson, orderErrors));
            }
        }

        if (records.Count == 0)
        {
            return new OrderExportResult(
                false,
                "The Computyme file was not generated.",
                batchId,
                FileName: null,
                ProcessedCount: 0,
                errors);
        }

        /*
         * All-or-nothing:
         * if one selected order fails, no file is written.
         */
        if (errors.Count > 0)
        {
            var failedBatchRecords =
                records
                    .Select(
                        record =>
                            record.ExportStatus == "GENERATED"
                                ? record with
                                {
                                    ExportStatus =
                                        "NOT_WRITTEN"
                                }
                                : record)
                    .ToList();

            var errorsJson =
                JsonSerializer.Serialize(
                    errors,
                    IntegrationJsonOptions);

            await _dataAccess.SaveExportAsync(
                new OrderExportBatch(
                    batchId,
                    ComputymeDestination,
                    fileName,
                    _computymeOutputPath,
                    ExportStatus: "FAILED",
                    generatedBy,
                    FileContent: null,
                    FileHash: null,
                    ErrorsJson: errorsJson,
                    Orders: failedBatchRecords),
                cancellationToken);

            return new OrderExportResult(
                false,
                "The Computyme file was not generated.",
                batchId,
                FileName: null,
                ProcessedCount: 0,
                errors);
        }

        var fileContent =string.Concat(records.Select(record =>record.AdapterOutput));
        var encoding = new UTF8Encoding(  encoderShouldEmitUTF8Identifier: false);
        var fileBytes = encoding.GetBytes(fileContent);
        var fileHash = Convert.ToHexString( SHA256.HashData(fileBytes));

        /*
         * Preserve the order snapshots and exact file before trying
         * to write to the external share.
         */
        await _dataAccess.SaveExportAsync(
            new OrderExportBatch(
                batchId,
                ComputymeDestination,
                fileName,
                _computymeOutputPath,
                ExportStatus: "GENERATED",
                generatedBy,
                FileContent: fileContent,
                FileHash: fileHash,
                ErrorsJson: null,
                Orders: records),
            cancellationToken);

        await ComputymeFileLock.WaitAsync(cancellationToken);

        var directory = Path.GetDirectoryName( _computymeOutputPath);

        if (string.IsNullOrWhiteSpace(directory))
        {
            ComputymeFileLock.Release();

            throw new InvalidOperationException(
                "The Computyme output directory is invalid.");
        }

        var temporaryPath =Path.Combine( directory,$"{fileName}.{batchId:N}.tmp");

        try
        {
            await File.WriteAllBytesAsync(temporaryPath,fileBytes,cancellationToken);

            /*
             * Preserve the existing behavior:
             * each completed batch replaces order.txt.
             */
            File.Move( temporaryPath, _computymeOutputPath, overwrite: true);

            await _dataAccess.SetExportStatusAsync(
                batchId,
                "WRITTEN",
                errorsJson: null,
                cancellationToken);

            return new OrderExportResult(
                true,
                "The Computyme order file was generated successfully.",
                batchId,
                fileName,
                records.Count,
                errors);
        }
        catch (Exception ex)
        {
          

            var fileErrors =
                new Dictionary<string, List<string>>
                {
                    ["FILE"] =["The Computyme output file could not be written."]
                };

            var errorsJson =
                JsonSerializer.Serialize(fileErrors,IntegrationJsonOptions);

            await _dataAccess.SetExportStatusAsync(
                batchId,
                "FAILED",
                errorsJson,
                cancellationToken);

            return new OrderExportResult(
                false,
                "The Computyme output file could not be written.",
                batchId,
                FileName: null,
                ProcessedCount: 0,
                fileErrors);
        }
        finally
        {
            ComputymeFileLock.Release();

            if (File.Exists(temporaryPath))
            {
                try
                {
                    File.Delete(temporaryPath);
                }
                catch
                {
                    // Leave failed temporary cleanup to maintenance.
                }
            }
        }
    }

    private static OrderExportRecord
        CreateFailedRecord(
            int orderId,
            string? canonicalJson,
            List<string> errors)
    {
        return new OrderExportRecord(
            orderId,
            canonicalJson,
            AdapterOutput: null,
            ExportStatus: "FAILED",
            ErrorsJson: JsonSerializer.Serialize(errors,IntegrationJsonOptions));
    }
}