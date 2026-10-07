using ProInternal.Models.OrderIntegration;
using ProInternal.Models.OrderIntegration.Shopify;
using ProInternal.Services.OrderIntegration.Adapters.Inbound;
using ProInternal.Services.OrderIntegration.Adapters.Inbound.Edi;
using ProInternal.Services.OrderIntegration.Adapters.Inbound.Pos;
using ProInternal.Services.OrderIntegration.Adapters.Outbound.Computyme;
using ProInternal.Services.OrderIntegration.Adapters.Core;
using System.Data.Common;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Xml;
using System.Xml.Linq;

namespace ProInternal.Services.OrderIntegration;

/*
 * Orders going out (the Computyme file) and order files coming in
 * (POS and EDI 850).
 */
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

    /* Inbound order files */
    private readonly IOrderInboxDataAccess _inbox;
    private readonly IPosOrderAdapter _posAdapter;
    private readonly IEdiPurchaseOrderAdapter _ediAdapter;
    private readonly IConfiguration _configuration;

    public OrderIntegrationService(
        IOrderIntegrationDataAccess dataAccess,
        IOrderSchemaValidator schemaValidator,
        IComputymeOrderAdapter computymeAdapter,
        IOrderInboxDataAccess inbox,
        IPosOrderAdapter posAdapter,
        IEdiPurchaseOrderAdapter ediAdapter,
        IConfiguration configuration,
        ILogger<OrderIntegrationService> logger)
    {
        _dataAccess = dataAccess;
        _schemaValidator = schemaValidator;
        _computymeAdapter = computymeAdapter;
        _inbox = inbox;
        _posAdapter = posAdapter;
        _ediAdapter = ediAdapter;
        _configuration = configuration;
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

    /* ==================================================================
       Order files coming in: POS (XML) and EDI 850 (pipe file)

       For each file in the channel's folder:
         1. Save each order to the inbox.
         2. Turn it into a contract order and check it.
         3. Clean: write it to Orders as an open order.
            Fixable problem: hold it in Needs Review.
            Unreadable or already ordered: record it as rejected.
         4. Move the file to the archive folder.

       Nothing is dropped and nothing is guessed. A file is moved only
       after every order in it has been recorded; if the database
       cannot be reached the run stops and the file stays put.

       Settings (OrderIntegration):
         Pos:SourcePath / Pos:ArchivePath     *.xml files
         Edi:SourcePath / Edi:ArchivePath     files whose name starts 850
         Edi:Partners:{account}               OrderUserId (required),
                                              ShippingNote, ApplySpecials
       ================================================================== */

    public const string PosChannel = "POS";
    public const string EdiChannel = "EDI";

    private const string InboundOrdersTable = "Orders";

    /* Raised by PIV2_InboundOrder_Import when it refuses an order. */
    private const int ImportRefusalFirst = 50021;
    private const int ImportRefusalLast = 50027;
    private const int ImportDuplicateOrder = 50022;

    /* The button and the scheduler must not run the same channel at once. */
    private static readonly SemaphoreSlim PosImportLock = new(1, 1);
    private static readonly SemaphoreSlim EdiImportLock = new(1, 1);

    /* True for the channels that arrive as files and become dealer orders. */
    public static bool IsFileChannel(string? channel)
    {
        return string.Equals(channel, PosChannel, StringComparison.OrdinalIgnoreCase)
            || string.Equals(channel, EdiChannel, StringComparison.OrdinalIgnoreCase);
    }

    public Task<OrderImportSummary> ImportPosFolderAsync(
        string actionBy,
        CancellationToken cancellationToken)
    {
        return ImportFolderAsync(PosChannel, "Pos", "*.xml", PosImportLock, actionBy, cancellationToken);
    }

    public Task<OrderImportSummary> ImportEdiFolderAsync(
        string actionBy,
        CancellationToken cancellationToken)
    {
        /* 810 invoices arrive in the same folder and are left alone. */
        return ImportFolderAsync(EdiChannel, "Edi", "850*", EdiImportLock, actionBy, cancellationToken);
    }

    /* ---- the folder ---- */

    private async Task<OrderImportSummary> ImportFolderAsync(
        string channel,
        string settingsKey,
        string filePattern,
        SemaphoreSlim importLock,
        string actionBy,
        CancellationToken cancellationToken)
    {
        var summary = new OrderImportSummary { Channel = channel };

        var source = _configuration[$"OrderIntegration:{settingsKey}:SourcePath"];
        var archive = _configuration[$"OrderIntegration:{settingsKey}:ArchivePath"];

        if (string.IsNullOrWhiteSpace(source) || string.IsNullOrWhiteSpace(archive))
        {
            return ImportFailed(summary,
                $"OrderIntegration:{settingsKey}:SourcePath and ArchivePath are not set.");
        }

        if (!Directory.Exists(source))
            return ImportFailed(summary, $"The {channel} folder '{source}' cannot be reached.");

        if (!await importLock.WaitAsync(0, cancellationToken))
            return ImportFailed(summary, $"A {channel} import is already running. Try again in a moment.");

        try
        {
            Directory.CreateDirectory(archive);

            var files = Directory
                .GetFiles(source, filePattern)
                .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
                .ToList();

            summary.Files = files.Count;

            var handled = 0;

            foreach (var path in files)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var fileName = Path.GetFileName(path);
                List<OrderImportFileResult> results;

                try
                {
                    if (channel == EdiChannel)
                    {
                        results = await ProcessEdiFileAsync(path, actionBy, cancellationToken);
                    }
                    else
                    {
                        results = new List<OrderImportFileResult>
                        {
                            await ProcessPosFileAsync(path, actionBy, cancellationToken)
                        };
                    }

                    /* Every order in the file is on record. Done with the file. */
                    ArchiveInboundFile(path, archive, results);
                }
                catch (DbException ex)
                {
                    /*
                     * The database, not the order. Stop here; this file
                     * and every one after it stay in the folder. Orders
                     * already recorded from this file are recognised as
                     * already received on the next run.
                     */
                    _logger.LogError(ex,
                        "{Channel} import stopped at {File}: the order database could not be used.",
                        channel,
                        fileName);

                    summary.Success = false;
                    summary.Skipped += summary.Files - handled;
                    summary.Message =
                        "The order database could not be reached. " +
                        $"{summary.Files - handled} file(s) were left in the folder for the next run.";

                    return summary;
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    /* Usually a file that is still being written. */
                    _logger.LogWarning(ex,
                        "{Channel} file {File} could not be read and was left for the next run.",
                        channel,
                        fileName);

                    results =
                    [
                        new OrderImportFileResult
                        {
                            FileName = fileName,
                            Status = "SKIPPED",
                            Problems = { "The file could not be read. It will be tried again on the next run." }
                        }
                    ];
                }

                handled++;
                summary.Results.AddRange(results);

                foreach (var result in results)
                {
                    switch (result.Status)
                    {
                        case "IMPORTED": summary.Imported++; break;
                        case "NEEDS_REVIEW": summary.NeedsReview++; break;
                        case "REJECTED": summary.Rejected++; break;
                        case "DUPLICATE": summary.Duplicates++; break;
                        default: summary.Skipped++; break;
                    }
                }
            }

            summary.Message = summary.Files == 0
                ? $"No {channel} files were waiting."
                : $"{summary.Files} file(s): {summary.Imported} imported, " +
                  $"{summary.NeedsReview} need review, {summary.Rejected} rejected, " +
                  $"{summary.Duplicates} already received, {summary.Skipped} skipped.";

            return summary;
        }
        finally
        {
            importLock.Release();
        }
    }

    /* ---- POS: one XML file is one order ---- */

    private async Task<OrderImportFileResult> ProcessPosFileAsync(
        string path,
        string actionBy,
        CancellationToken cancellationToken)
    {
        var fileName = Path.GetFileName(path);
        var xml = await File.ReadAllTextAsync(path, cancellationToken);

        /* Read the two keys without trusting the file. Never throws. */
        var (account, poNumber) = TryReadPosKeys(xml);

        var result = new OrderImportFileResult
        {
            FileName = fileName,
            Account = account,
            PoNumber = poNumber
        };

        /* Save first. */
        var receipt = await _inbox.ReceiveAsync(
            PosChannel,
            account,
            poNumber,
            fileName,
            xml,
            new { fileName, receivedBy = actionBy },
            cancellationToken);

        result.InboxId = receipt.InboxId;

        if (AlreadyFinished(receipt, result))
            return result;

        var mapping = _posAdapter.Map(fileName, xml);

        if (mapping.Order is null)
        {
            await HoldInboundAsync(result, OrderInboxState.Rejected, null, mapping.Errors, cancellationToken);
            return result;
        }

        await FinishInboundAsync(result, mapping.Order, mapping.Errors, actionBy, cancellationToken);
        return result;
    }

    /* ---- EDI: one 850 file can hold several orders ---- */

    private async Task<List<OrderImportFileResult>> ProcessEdiFileAsync(
        string path,
        string actionBy,
        CancellationToken cancellationToken)
    {
        var fileName = Path.GetFileName(path);
        var lines = await File.ReadAllLinesAsync(path, cancellationToken);
        var results = new List<OrderImportFileResult>();

        var mapping = _ediAdapter.Map(fileName, lines);

        /*
         * Rows that belong to no order (unreadable, or no PO), or a file
         * with no orders at all, are recorded once against the file.
         */
        var fileErrors = mapping.FileErrors.ToList();

        if (mapping.Orders.Count == 0 && fileErrors.Count == 0)
        {
            fileErrors.Add(InboundError("EMPTY_FILE", "file", "The file contains no order rows."));
        }

        if (fileErrors.Count > 0)
        {
            var result = new OrderImportFileResult { FileName = fileName };

            var receipt = await _inbox.ReceiveAsync(
                EdiChannel,
                storeId: null,
                channelOrderId: null,
                fileName,
                string.Join(Environment.NewLine, lines),
                new { fileName, receivedBy = actionBy },
                cancellationToken);

            result.InboxId = receipt.InboxId;

            if (!AlreadyFinished(receipt, result))
            {
                await HoldInboundAsync(result, OrderInboxState.Rejected, null, fileErrors, cancellationToken);
            }

            results.Add(result);
        }

        foreach (var mapped in mapping.Orders)
        {
            var result = new OrderImportFileResult
            {
                FileName = fileName,
                Account = mapped.Partner,
                PoNumber = mapped.PoNumber
            };

            var receipt = await _inbox.ReceiveAsync(
                EdiChannel,
                mapped.Partner,
                mapped.PoNumber,
                $"{fileName}#{mapped.Partner}#{mapped.PoNumber}",
                mapped.RawRows,
                new { fileName, receivedBy = actionBy },
                cancellationToken);

            result.InboxId = receipt.InboxId;

            if (!AlreadyFinished(receipt, result))
            {
                await FinishInboundAsync(result, mapped.Order, mapped.Errors, actionBy, cancellationToken);
            }

            results.Add(result);
        }

        return results;
    }

    /* ---- one order ---- */

    /*
     * Already handled on an earlier run (the same file again, or the
     * same account and PO in a new file). A record still RECEIVED was
     * interrupted, so it is processed again.
     */
    private static bool AlreadyFinished(OrderInboxReceipt receipt, OrderImportFileResult result)
    {
        if (!receipt.IsDuplicate ||
            string.Equals(receipt.State, OrderInboxState.Received, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        result.Status = "DUPLICATE";
        result.OrderId = receipt.TargetOrderId;
        result.Problems.Add($"Already received as inbox record {receipt.InboxId} ({receipt.State}).");

        return true;
    }

    /* Check the contract order, then import it or hold it. */
    private async Task FinishInboundAsync(
        OrderImportFileResult result,
        CanonicalOrder order,
        IReadOnlyList<InboundOrderError> mappingErrors,
        string actionBy,
        CancellationToken cancellationToken)
    {
        var errors = mappingErrors.ToList();
        var validation = _schemaValidator.Validate(order);

        if (!validation.IsValid)
        {
            errors.AddRange(
                validation.Errors.Select(
                    message => InboundError("CANONICAL_SCHEMA_INVALID", null, message)));
        }

        if (errors.Count > 0)
        {
            await HoldInboundAsync(result, OrderInboxState.NeedsReview, order, errors, cancellationToken);
            return;
        }

        var attempt = await TryImportInboundOrderAsync(
            result.InboxId!.Value, order, actionBy, cancellationToken);

        if (attempt.Refused is not null)
        {
            await HoldInboundAsync(
                result,
                attempt.IsDuplicate ? OrderInboxState.Rejected : OrderInboxState.NeedsReview,
                order,
                [attempt.Refused],
                cancellationToken);

            return;
        }

        await _inbox.SetResultAsync(
            result.InboxId!.Value,
            OrderInboxState.Ready,
            order,
            Array.Empty<InboundOrderError>(),
            InboundOrdersTable,
            attempt.OrderId,
            cancellationToken);

        result.Status = "IMPORTED";
        result.OrderId = attempt.OrderId;
        result.PriceDifferences = attempt.PriceDifferences;
    }

    /*
     * Writes the order. A refusal that is about THIS order (unknown
     * account, no user to place it under, unknown product, PO already
     * ordered) comes back as Refused. Anything else is a database
     * problem and is thrown.
     *
     * An EDI order also needs its trading partner's settings:
     *   OrderIntegration:Edi:Partners:{account}:OrderUserId
     *                                          :ShippingNote
     *                                          :ApplySpecials
     */
    public async Task<InboundImportAttempt> TryImportInboundOrderAsync(
        long inboxId,
        CanonicalOrder order,
        string actionBy,
        CancellationToken cancellationToken)
    {
        int? orderUserId = null;
        string? shippingNote = null;
        var applySpecials = false;

        if (order.Source.Channel == SourceChannel.EDI)
        {
            var partner = _configuration.GetSection(
                $"OrderIntegration:Edi:Partners:{order.Customer.CustomerId}");

            if (int.TryParse(partner["OrderUserId"], out var userId) && userId > 0)
                orderUserId = userId;

            shippingNote = string.IsNullOrWhiteSpace(partner["ShippingNote"])
                ? null
                : partner["ShippingNote"]!.Trim();

            applySpecials = bool.TryParse(partner["ApplySpecials"], out var specials) && specials;
        }

        try
        {
            var imported = await _inbox.ImportInboundOrderAsync(
                inboxId, order, orderUserId, shippingNote, applySpecials, actionBy, cancellationToken);

            return new InboundImportAttempt(imported.OrderId, imported.PriceDifferences, null, false);
        }
        catch (DbException ex) when (IsImportRefusal(ex))
        {
            var number = SqlErrorNumber(ex);

            return new InboundImportAttempt(
                null,
                0,
                InboundError(ImportRefusalCode(number), null, ex.Message),
                number == ImportDuplicateOrder);
        }
    }

    /*
     * Used when a held POS or EDI order is released. The account, its
     * addresses and the products are PRO's own data, so they are read
     * again here: whatever was fixed in the account or the product
     * list since the order arrived is picked up. The held order is
     * updated in place and whatever is still wrong is returned.
     */
    public List<InboundOrderError> RefreshInboundOrder(JsonObject root, string channel)
    {
        var errors = new List<InboundOrderError>();
        var isEdi = string.Equals(channel, EdiChannel, StringComparison.OrdinalIgnoreCase);

        var customerNode = root["customer"] as JsonObject;
        var account = JsonText(customerNode, "customerId");

        var references = root["references"] as JsonObject;

        if (references is null)
        {
            references = new JsonObject();
            root["references"] = references;
        }

        var items = (root["items"] as JsonArray)?.OfType<JsonObject>().ToList() ?? [];

        /* A bundle's products are worked out again at import. */
        var orderedItems = items
            .Where(item => !string.Equals(
                JsonText(item, "lineType"), "BUNDLE_COMPONENT", StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (account is null)
        {
            errors.Add(InboundError("MISSING_CUSTOMER", "customer.customerId",
                "The order does not identify a customer account."));

            return errors;
        }

        var lookup = _inbox.LoadInboundLookup(
            isEdi ? EdiChannel : PosChannel,
            account,
            isEdi ? null : PosShipToCode(JsonText(references, "proShipTo")),
            orderedItems
                .Select(item => JsonText(item, "sku"))
                .Where(sku => sku is not null)
                .Select(sku => sku!)
                .ToList());

        references.Remove("shipToAddressId");

        if (lookup.Customer is null)
        {
            errors.Add(InboundError("UNKNOWN_CUSTOMER", "customer.customerId",
                $"Account '{account}' was not found."));
        }
        else
        {
            if (customerNode is not null &&
                JsonText(customerNode, "name") is null &&
                lookup.Customer.Name is not null)
            {
                customerNode["name"] = lookup.Customer.Name;
            }

            var addresses = root["addresses"] as JsonObject;

            if (addresses is null)
            {
                addresses = new JsonObject();
                root["addresses"] = addresses;
            }

            if (lookup.Customer.BillingAddress is null)
            {
                errors.Add(InboundError("BILLING_ADDRESS_NOT_FOUND", "customer.customerId",
                    $"Account {account} has no active billing address."));
            }
            else
            {
                addresses["billing"] = ToNode(lookup.Customer.BillingAddress);
            }

            if (lookup.ShipTo is null || lookup.ShipToAddressId is null)
            {
                /* For EDI the ship-to is the billing address, reported above. */
                if (!isEdi)
                {
                    errors.Add(InboundError("SHIP_TO_NOT_FOUND", "fulfillment.fulfillmentGroups[0].shipTo",
                        $"No ship-to address was found for account {account}."));
                }
            }
            else
            {
                references["shipToAddressId"] = lookup.ShipToAddressId.Value.ToString();

                /*
                 * A dropship address that someone has entered stays as
                 * entered. The order is first written with the account's
                 * own address and the entered one is applied right after.
                 */
                if (!DropShipAddressEntered(root))
                {
                    addresses["shipping"] = ToNode(lookup.ShipTo);

                    if (root["fulfillment"] is JsonObject fulfillment &&
                        fulfillment["fulfillmentGroups"] is JsonArray groups)
                    {
                        foreach (var group in groups.OfType<JsonObject>())
                            group["shipTo"] = ToNode(lookup.ShipTo);
                    }
                }
            }
        }

        foreach (var item in orderedItems)
        {
            var index = items.IndexOf(item);
            var sku = JsonText(item, "sku");

            /* A line with no code at all is reported by the release itself. */
            if (sku is null)
                continue;

            var product = lookup.FindProduct(sku);

            if (product is null)
            {
                errors.Add(InboundError("UNKNOWN_ITEM", $"items[{index}].sku",
                    $"Product code '{sku}' was not found."));
            }
            else if (!product.IsForSale)
            {
                errors.Add(InboundError("ITEM_NOT_FOR_SALE", $"items[{index}].sku",
                    $"Product '{product.ProductCode}' is not for sale."));
            }
            else if (!string.Equals(sku, product.ProductCode, StringComparison.OrdinalIgnoreCase))
            {
                /* Entered by catalog number: store PRO's product code. */
                item["sku"] = product.ProductCode;
            }
        }

        /* Nothing left to fix: the order is no longer on hold. */
        if (errors.Count == 0)
        {
            if (root["order"] is JsonObject orderNode)
                orderNode["status"] = "OPEN";

            if (root["workflow"] is JsonObject workflow)
                workflow["holds"] = new JsonArray();
        }

        return errors;
    }

    /* ---- dropship ---- */

    /* True when the held order is a partner's dropship. */
    public static bool IsDropShip(JsonObject root)
    {
        return string.Equals(
            JsonText(root["references"] as JsonObject, InboundOrderBuilder.DropShipKey),
            "true",
            StringComparison.OrdinalIgnoreCase);
    }

    /* True once someone has entered the dropship address. */
    public static bool DropShipAddressEntered(JsonObject root)
    {
        return IsDropShip(root) &&
               string.Equals(
                   JsonText(root["references"] as JsonObject, InboundOrderBuilder.DropShipAddressEnteredKey),
                   "true",
                   StringComparison.OrdinalIgnoreCase);
    }

    public static void MarkDropShipAddressEntered(JsonObject root)
    {
        if (root["references"] is JsonObject references)
            references[InboundOrderBuilder.DropShipAddressEnteredKey] = "true";
    }

    public static string DropShipMessage(JsonObject root)
    {
        return InboundOrderBuilder.DropShipMessage(
            JsonText(root["references"] as JsonObject, InboundOrderBuilder.DropShipNameKey));
    }

    /* ---- helpers ---- */

    private async Task HoldInboundAsync(
        OrderImportFileResult result,
        string state,
        CanonicalOrder? order,
        IReadOnlyList<InboundOrderError> errors,
        CancellationToken cancellationToken)
    {
        await _inbox.SetResultAsync(
            result.InboxId!.Value,
            state,
            order,
            errors,
            targetTable: null,
            targetOrderId: null,
            cancellationToken);

        result.Status = state;
        result.Problems.AddRange(errors.Select(error => $"{error.Code}: {error.Message}"));

        _logger.LogWarning(
            "Order file {File} (account {Account}, PO {PoNumber}) is held as inbox record {InboxId} in state {State}: {Errors}",
            result.FileName,
            result.Account,
            result.PoNumber,
            result.InboxId,
            state,
            string.Join(" | ", result.Problems));
    }

    /*
     * Every order in the file is in the inbox by now. If the file
     * cannot be moved it stays in the folder; the next run sees its
     * orders were already received and tries the move again.
     */
    private void ArchiveInboundFile(
        string path,
        string archive,
        List<OrderImportFileResult> results)
    {
        try
        {
            File.Move(path, Path.Combine(archive, Path.GetFileName(path)), overwrite: true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            _logger.LogWarning(ex,
                "Order file {File} was handled but could not be moved to {Archive}.",
                Path.GetFileName(path),
                archive);

            foreach (var result in results)
                result.Problems.Add("The file was handled but could not be moved to the archive folder.");
        }
    }

    private static (string? Account, string? PoNumber) TryReadPosKeys(string xml)
    {
        try
        {
            var root = XDocument.Parse(xml).Root;

            if (root is null)
                return (null, null);

            var account = ElementText(root, "ProMember");
            var dash = account?.IndexOf('-') ?? -1;

            if (account is not null && dash >= 0)
                account = account[..dash].Trim();

            return (string.IsNullOrWhiteSpace(account) ? null : account, ElementText(root, "PONumber"));
        }
        catch (XmlException)
        {
            return (null, null);
        }
    }

    private static string? ElementText(XElement parent, string name)
    {
        var text = parent.Elements()
            .FirstOrDefault(e => string.Equals(e.Name.LocalName, name, StringComparison.OrdinalIgnoreCase))
            ?.Value;

        return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
    }

    /* "7980-2" -> "2"; "7980" -> null. */
    private static string? PosShipToCode(string? proShipTo)
    {
        if (string.IsNullOrWhiteSpace(proShipTo))
            return null;

        var dash = proShipTo.IndexOf('-');

        if (dash < 0)
            return null;

        var code = proShipTo[(dash + 1)..].Trim();

        return code.Length == 0 ? null : code;
    }

    private static JsonNode? ToNode(Address address)
    {
        return JsonSerializer.SerializeToNode(address, IntegrationJsonOptions);
    }

    private static string? JsonText(JsonObject? node, string name)
    {
        return node is not null &&
               node[name] is JsonValue value &&
               value.TryGetValue<string>(out var text) &&
               !string.IsNullOrWhiteSpace(text)
            ? text.Trim()
            : null;
    }

    private static OrderImportSummary ImportFailed(OrderImportSummary summary, string message)
    {
        summary.Success = false;
        summary.Message = message;
        return summary;
    }

    private static InboundOrderError InboundError(string code, string? field, string message)
    {
        return new InboundOrderError
        {
            Code = code,
            Field = field,
            Message = message
        };
    }

    /* The SQL error number, whichever SQL client library raised it. */
    private static int SqlErrorNumber(DbException ex)
    {
        return ex.GetType().GetProperty("Number")?.GetValue(ex) is int number
            ? number
            : 0;
    }

    private static bool IsImportRefusal(DbException ex)
    {
        var number = SqlErrorNumber(ex);

        return number >= ImportRefusalFirst &&
               number <= ImportRefusalLast;
    }

    private static string ImportRefusalCode(int number)
    {
        return number switch
        {
            50021 => "UNKNOWN_CUSTOMER",
            50022 => "DUPLICATE_ORDER",
            50023 => "SHIP_TO_NOT_FOUND",
            50024 => "INVALID_LINES",
            50025 => "UNKNOWN_ITEM",
            50026 => "NO_ORDER_USER",
            50027 => "VALUE_TOO_LONG",
            _ => "IMPORT_REFUSED"
        };
    }
}

/* The result of trying to write one inbound order to Orders. */
public sealed record InboundImportAttempt(
    int? OrderId,
    int PriceDifferences,
    InboundOrderError? Refused,
    bool IsDuplicate);
