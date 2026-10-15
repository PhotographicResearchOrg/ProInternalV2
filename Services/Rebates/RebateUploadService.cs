using Microsoft.AspNetCore.Http;
using ProInternal.Models.Rebates;
using ProInternal.Services.Files;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Services.Rebates
{
    /*
     * The upload interview:
     *   1 the file is stored unchanged in the S3 file library (REBATE_SOURCE / vendor)
     *   2 the header row is found and fingerprinted (the header names, in order)
     *   3 the mapping comes from the vendor's saved template for that layout;
     *     otherwise the AI proposes one; otherwise the header names alone
     *   4 a person confirms or changes it; the confirmed mapping becomes the
     *     vendor's template for next time
     *   5 every row is checked; rows with any problem go to purgatory
     */
    public sealed class RebateUploadService
    {
        public const string FileCategory = "REBATE_SOURCE";

        private readonly IRebateDeskDataAccess _data;
        private readonly IFileLibrary _files;
        private readonly IRebateAiMapper _ai;

        public RebateUploadService(IRebateDeskDataAccess data, IFileLibrary files, IRebateAiMapper ai)
        {
            _data = data;
            _files = files;
            _ai = ai;
        }

        public async Task<(int UploadId, RebateMappingProposal Proposal)> StartAsync(
            int vendorId, IFormFile file, string actor, CancellationToken cancellationToken)
        {
            if (file == null || file.Length == 0)
                throw new RebateFileException("Choose a file to upload.");
            if (file.Length > 25 * 1024 * 1024)
                throw new RebateFileException("The file is larger than 25 MB.");

            await using var buffer = new MemoryStream();
            await file.CopyToAsync(buffer, cancellationToken);

            /* Read it before storing anything, so an unreadable file leaves nothing behind. */
            buffer.Position = 0;
            var sheets = RebateWorkbookReader.Read(buffer, file.FileName);

            buffer.Position = 0;
            var stored = await _files.StoreAsync(buffer, FileCategory, vendorId.ToString(), file.FileName,
                string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType, actor,
                "Vendor rebate file");

            var created = await _data.QueryAsync("piv2.Rebate_CreateUpload", new
            {
                VendorId = vendorId,
                FileId = stored.FileId,
                FileName = file.FileName,
                FileSha256 = stored.Sha256,
                Actor = actor
            });
            var uploadId = created[0].Get<int>("uploadId");

            var proposal = await ProposeAsync(vendorId, sheets, null, null, cancellationToken);
            return (uploadId, proposal);
        }

        /* Again for a different sheet or header row, e.g. when the person corrects the detected one. */
        public async Task<RebateMappingProposal> ProposeAsync(int uploadId, RebateProposalRequest request, CancellationToken cancellationToken)
        {
            var (vendorId, fileId, fileName, _) = await UploadFileAsync(uploadId);
            var sheets = await ReadStoredAsync(fileId, fileName);
            return await ProposeAsync(vendorId, sheets, request.SheetName, request.HeaderRow, cancellationToken);
        }

        public async Task<List<List<RebateRow>>> ApplyMappingAsync(int uploadId, RebateMappingRequest request, string actor)
        {
            var (vendorId, fileId, fileName, _) = await UploadFileAsync(uploadId);
            var sheets = await ReadStoredAsync(fileId, fileName);
            var sheet = sheets.FirstOrDefault(s => s.Name == request.SheetName)
                        ?? throw new RebateFileException("That sheet is not in the file.");

            var headers = RebateWorkbookReader.Headers(sheet, request.HeaderRow);
            if (headers.Count == 0)
                throw new RebateFileException("The header row is empty. Pick the row that holds the column names.");

            var mapping = RebateFields.All.ToDictionary(f => f,
                f => request.Mapping.TryGetValue(f, out var c) && c is int col && col >= 0 && col < headers.Count ? (int?)col : null);

            var used = mapping.Values.Where(v => v.HasValue).GroupBy(v => v).FirstOrDefault(g => g.Count() > 1);
            if (used != null)
                throw new RebateFileException($"Column {RebateWorkbookReader.ColumnLetter(used.Key!.Value)} is mapped to two fields.");
            if (mapping[RebateFields.ProCode] == null && mapping[RebateFields.Description] == null)
                throw new RebateFileException("Map the PRO code column (or at least the description) so rows can be matched to products.");
            if (mapping[RebateFields.Reimbursement] == null)
                throw new RebateFileException("Map the reimbursement column.");

            var types = await _data.QueryAsync("piv2.Rebate_Types");
            var typeLookup = RebateWorkbookReader.TypeLookup(types.Select(t => (t.Get<int>("rebateTypeId"), t.Get<string>("name") ?? "")));

            var rows = RebateWorkbookReader.Apply(sheet, request.HeaderRow, mapping, typeLookup);
            if (rows.Count == 0)
                throw new RebateFileException("No rows under the header have values in the mapped columns.");

            if (mapping[RebateFields.RebateType] == null && request.DefaultRebateType == null)
                throw new RebateFileException("The file has no rebate type column; choose the rebate type for all rows.");

            var fingerprint = RebateWorkbookReader.Fingerprint(headers);
            var source = request.Edited ? "MANUAL" : request.ProposalSource;
            int? templateId = request.ProposalSource == "TEMPLATE" && !request.Edited ? request.TemplateId : null;

            if (templateId == null)
            {
                var saved = await _data.QueryAsync("piv2.Rebate_SaveTemplate", new
                {
                    VendorId = vendorId,
                    Fingerprint = fingerprint,
                    SheetName = sheet.Name,
                    HeaderRow = request.HeaderRow,
                    Headers = JsonSerializer.Serialize(headers),
                    Mapping = JsonSerializer.Serialize(mapping),
                    Source = source == "TEMPLATE" ? "MANUAL" : source,
                    Actor = actor
                });
                templateId = saved[0].Get<int>("templateId");
            }

            /* Dates as plain yyyy-MM-dd for OPENJSON's date columns. */
            var json = JsonSerializer.Serialize(rows.Select(r => new
            {
                r.SourceRow, r.Raw, r.ProCode, r.Description, r.InstantRebate, r.Reimbursement, r.MapPrice,
                StartDate = r.StartDate?.ToString("yyyy-MM-dd"),
                EndDate = r.EndDate?.ToString("yyyy-MM-dd"),
                r.StackProduct, r.RebateType, r.Notes
            }), new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                DictionaryKeyPolicy = null
            });

            return await _data.QuerySetsAsync("piv2.Rebate_SetMapping", new
            {
                UploadId = uploadId,
                SheetName = sheet.Name,
                HeaderRow = request.HeaderRow,
                Fingerprint = fingerprint,
                TemplateId = templateId,
                MappingSource = source,
                DefaultRebateType = request.DefaultRebateType,
                ExpireOn = request.ExpireOn?.Date,
                StartActive = request.StartActive,
                Rows = json,
                Actor = actor
            });
        }

        /* ---------------- helpers ---------------- */

        private async Task<RebateMappingProposal> ProposeAsync(
            int vendorId, List<RebateSheet> sheets, string? sheetName, int? headerRow, CancellationToken cancellationToken)
        {
            var sheet = (sheetName == null ? null : sheets.FirstOrDefault(s => s.Name == sheetName))
                        ?? sheets.OrderByDescending(s => s.Rows.Count(r => r.Any(c => RebateWorkbookReader.Text(c).Length > 0))).First();

            var row = headerRow is int h && h >= 1 && h <= sheet.Rows.Count ? h : RebateWorkbookReader.DetectHeaderRow(sheet);
            var headers = RebateWorkbookReader.Headers(sheet, row);
            var fingerprint = RebateWorkbookReader.Fingerprint(headers);

            var dataRows = RebateWorkbookReader.DataRows(sheet, row).ToList();
            var sample = dataRows.Take(8)
                .Select(r => Enumerable.Range(0, headers.Count).Select(i => i < r.Cells.Length ? RebateWorkbookReader.Text(r.Cells[i]) : "").ToList())
                .ToList();

            var proposal = new RebateMappingProposal
            {
                Sheets = sheets.Select(s => s.Name).ToList(),
                SheetName = sheet.Name,
                HeaderRow = row,
                Headers = headers,
                Sample = sample,
                DataRows = dataRows.Count,
                Fingerprint = fingerprint
            };

            var template = (await _data.QueryAsync("piv2.Rebate_FindTemplate", new { VendorId = vendorId, Fingerprint = fingerprint })).FirstOrDefault();
            if (template != null && template.Get<JsonElement>("mapping") is { ValueKind: JsonValueKind.Object } saved)
            {
                proposal.Mapping = RebateFields.All.ToDictionary(f => f,
                    f => saved.TryGetProperty(f, out var v) && v.ValueKind == JsonValueKind.Number && v.GetInt32() < headers.Count ? (int?)v.GetInt32() : null);
                proposal.Source = "TEMPLATE";
                proposal.TemplateId = template.Get<int>("templateId");
                proposal.Note = $"Saved layout for this vendor, used {template.Get<int>("timesUsed")} time(s).";
            }
            else
            {
                var vendorName = (await _data.QueryAsync("piv2.Rebate_Vendors", new { Rail = "IR" }))
                    .FirstOrDefault(v => v.Get<int>("vendorId") == vendorId)?.Get<string>("vendorName") ?? "";
                var ai = headers.Count > 0 ? await _ai.ProposeAsync(headers, sample, vendorName, cancellationToken) : null;
                var alias = RebateColumnAliases.Propose(headers);

                if (ai is { } answer && answer.Mapping.Values.Any(v => v.HasValue))
                {
                    /* The header names fill what the AI left empty, if that column is free. */
                    foreach (var f in RebateFields.All)
                        if (answer.Mapping[f] == null && alias[f] is int col && !answer.Mapping.Values.Contains(col))
                            answer.Mapping[f] = col;
                    proposal.Mapping = answer.Mapping;
                    proposal.Source = "AI";
                    proposal.Note = string.IsNullOrWhiteSpace(answer.Note) ? "Proposed by AI from the headers and sample rows." : answer.Note;
                }
                else
                {
                    proposal.Mapping = alias;
                    proposal.Source = "ALIAS";
                    proposal.Note = "Matched on header names. Check every column.";
                }
            }

            proposal.SuggestedExpireOn = RebateWorkbookReader.SuggestExpireOn(sheet, row, proposal.Mapping);
            return proposal;
        }

        private async Task<(int VendorId, long FileId, string FileName, string Status)> UploadFileAsync(int uploadId)
        {
            var sets = await _data.QuerySetsAsync("piv2.Rebate_GetUpload", new { UploadId = uploadId });
            var head = sets.FirstOrDefault()?.FirstOrDefault() ?? throw new RebateFileException("That upload does not exist.");
            return (head.Get<int>("vendorId"), head.Get<long>("fileId"), head.Get<string>("fileName") ?? "", head.Get<string>("status") ?? "");
        }

        private async Task<List<RebateSheet>> ReadStoredAsync(long fileId, string fileName)
        {
            await using var stream = await _files.OpenAsync(fileId);
            await using var copy = new MemoryStream();
            await stream.CopyToAsync(copy);
            copy.Position = 0;
            return RebateWorkbookReader.Read(copy, fileName);
        }
    }
}
