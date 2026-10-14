using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ProInternal.Models.OrderIntegration;
using ProInternal.Services.OrderIntegration.Adapters.Core;
using ProInternal.Services.OrderIntegration.Adapters.Outbound.Computyme;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Services.OrderIntegration.Adapters.Outbox;

/*
 * Sends consumer orders to Computyme.
 *
 * Each order is built as a contract order, validated against the
 * contract, then mapped by the Computyme consumer adapter. Nothing is
 * written from the order tables directly.
 *
 * Good orders go; bad orders are kicked out and reported. One bad
 * order does not stop the file.
 *
 * Settings (appsettings):
 *   OrderIntegration:Computyme:ConsumerOutputPath   full path of the file
 *   OrderIntegration:Computyme:ConsumerAccount      default 9995*CO
 *
 * The file is replaced on each run, as the legacy consumer screen did.
 */
public sealed class ConsumerOrderExportService
{
    private const string Destination = "COMPUTYME";
    private const string ConsumerChannel = "consumer";
    private const string ActionSource = "Order Toolbench";

    private static readonly SemaphoreSlim FileLock = new(1, 1);

    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web)
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

    private readonly IOrderIntegrationDataAccess _exports;
    private readonly IOrderOutboxDataAccess _outbox;
    private readonly IOrderSchemaValidator _schemaValidator;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ConsumerOrderExportService> _logger;

    public ConsumerOrderExportService(
        IOrderIntegrationDataAccess exports,
        IOrderOutboxDataAccess outbox,
        IOrderSchemaValidator schemaValidator,
        IConfiguration configuration,
        ILogger<ConsumerOrderExportService> logger)
    {
        _exports = exports;
        _outbox = outbox;
        _schemaValidator = schemaValidator;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<OrderExportResult> ExportToComputymeAsync(
        IReadOnlyCollection<string> orderIds,
        string? generatedBy,
        CancellationToken cancellationToken)
    {
        var batchId = Guid.NewGuid();
        var errors = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

        var outputPath =
            _configuration["OrderIntegration:Computyme:ConsumerOutputPath"];

        var account =
            _configuration["OrderIntegration:Computyme:ConsumerAccount"];

        if (string.IsNullOrWhiteSpace(account))
            account = "9995*CO";

        var fileName = string.IsNullOrWhiteSpace(outputPath)
            ? null
            : Path.GetFileName(outputPath);

        var directory = string.IsNullOrWhiteSpace(outputPath)
            ? null
            : Path.GetDirectoryName(outputPath);

        if (string.IsNullOrWhiteSpace(fileName) || string.IsNullOrWhiteSpace(directory))
        {
            errors["CONFIG"] =
            [
                "OrderIntegration:Computyme:ConsumerOutputPath is not set to a full file path."
            ];

            return new OrderExportResult(
                false,
                "The consumer order file location is not configured.",
                batchId,
                FileName: null,
                ProcessedCount: 0,
                errors);
        }

        var records = new List<OrderExportRecord>();

        foreach (var orderId in orderIds.Distinct())
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (!int.TryParse(orderId, out var numericOrderId))
            {
                errors[orderId] = ["A numeric OrderId is required."];
                continue;
            }

            string? canonicalJson = null;

            try
            {
                var source = await _outbox.GetConsumerOrderSourceAsync(
                    numericOrderId, cancellationToken);

                if (source is null)
                    throw new InvalidOperationException("The order was not found.");

                if (source.LegacyOrderStatusId is 2 or 5 or 15)
                {
                    throw new InvalidOperationException(
                        "The order is not open. Reopen it before sending it again.");
                }

                var order = ConsumerCanonicalOrderBuilder.Build(source);

                canonicalJson = JsonSerializer.Serialize(order, JsonOptions);

                var validation = _schemaValidator.Validate(order);

                if (!validation.IsValid)
                {
                    Fail(numericOrderId, canonicalJson, validation.Errors.ToList());
                    continue;
                }

                var output = ComputymeConsumerOrderAdapter.Map(order, account);

                records.Add(
                    new OrderExportRecord(
                        numericOrderId,
                        canonicalJson,
                        output,
                        ExportStatus: "GENERATED",
                        ErrorsJson: null));
            }
            catch (InvalidOperationException ex)
            {
                Fail(numericOrderId, canonicalJson, [ex.Message]);
            }
        }

        var good = records.Where(record => record.ExportStatus == "GENERATED").ToList();

        if (records.Count == 0)
        {
            return new OrderExportResult(
                false,
                "The consumer order file was not generated.",
                batchId,
                FileName: null,
                ProcessedCount: 0,
                errors);
        }

        if (good.Count == 0)
        {
            await _exports.SaveExportAsync(
                new OrderExportBatch(
                    batchId,
                    Destination,
                    fileName,
                    outputPath!,
                    ExportStatus: "FAILED",
                    generatedBy,
                    FileContent: null,
                    FileHash: null,
                    ErrorsJson: JsonSerializer.Serialize(errors, JsonOptions),
                    Orders: records),
                cancellationToken);

            await _outbox.SetChannelAsync(batchId, ConsumerChannel, cancellationToken);

            return new OrderExportResult(
                false,
                "No order could be sent. The consumer order file was not generated.",
                batchId,
                FileName: null,
                ProcessedCount: 0,
                errors);
        }

        var fileContent = string.Concat(good.Select(record => record.AdapterOutput));
        var fileBytes = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false)
            .GetBytes(fileContent);
        var fileHash = Convert.ToHexString(SHA256.HashData(fileBytes));

        /* Keep the exact file and each order's copy before touching the share. */
        await _exports.SaveExportAsync(
            new OrderExportBatch(
                batchId,
                Destination,
                fileName,
                outputPath!,
                ExportStatus: "GENERATED",
                generatedBy,
                FileContent: fileContent,
                FileHash: fileHash,
                ErrorsJson: errors.Count > 0
                    ? JsonSerializer.Serialize(errors, JsonOptions)
                    : null,
                Orders: records),
            cancellationToken);

        await _outbox.SetChannelAsync(batchId, ConsumerChannel, cancellationToken);

        var temporaryPath = Path.Combine(directory, $"{fileName}.{batchId:N}.tmp");

        await FileLock.WaitAsync(cancellationToken);

        try
        {
            await File.WriteAllBytesAsync(temporaryPath, fileBytes, cancellationToken);

            File.Move(temporaryPath, outputPath!, overwrite: true);

            await _exports.SetExportStatusAsync(
                batchId, "WRITTEN", errorsJson: null, cancellationToken);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            _logger.LogError(
                ex,
                "Consumer order file could not be written. Batch {BatchId}, path {Path}.",
                batchId,
                outputPath);

            errors["FILE"] = ["The consumer order file could not be written."];

            await _exports.SetExportStatusAsync(
                batchId,
                "FAILED",
                JsonSerializer.Serialize(errors, JsonOptions),
                cancellationToken);

            return new OrderExportResult(
                false,
                "The consumer order file could not be written. No order was marked as sent.",
                batchId,
                FileName: null,
                ProcessedCount: 0,
                errors);
        }
        finally
        {
            FileLock.Release();

            if (File.Exists(temporaryPath))
            {
                try
                {
                    File.Delete(temporaryPath);
                }
                catch (IOException)
                {
                    /* Leave failed temporary cleanup to maintenance. */
                }
            }
        }

        /* Only now, with the file written, are the orders marked sent. */
        await _outbox.MarkSentAsync(batchId, generatedBy, ActionSource, cancellationToken);

        var message = errors.Count == 0
            ? "The consumer order file was generated successfully."
            : $"The consumer order file was generated. {errors.Count} order(s) were left out; see the reasons.";

        return new OrderExportResult(
            true,
            message,
            batchId,
            fileName,
            good.Count,
            errors);

        void Fail(int id, string? json, List<string> reasons)
        {
            errors[id.ToString()] = reasons;

            records.Add(
                new OrderExportRecord(
                    id,
                    json,
                    AdapterOutput: null,
                    ExportStatus: "FAILED",
                    ErrorsJson: JsonSerializer.Serialize(reasons, JsonOptions)));
        }
    }
}
