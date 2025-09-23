using Microsoft.AspNetCore.Mvc;
using ProInternal.Services;
using ProInternal.Models.Accounting;
using static System.Runtime.InteropServices.JavaScript.JSType;
using ProInternal.Models.Shared;
using ProInternal.Models.EditProduct;
using ProInternal.Models.Dashboard;
using ProInternal.Models.Exclusions;
using ProInternal.Models.Products;
using System.ComponentModel.Design;
using ProInternal.Models;
using Microsoft.Data.SqlClient;
using System.Data;
using System.Globalization;
using ProInternal.Models.InstantRebates;
using OfficeOpenXml;

namespace ProInternal.Controllers
{

    [ApiController]
    [Route("api/[controller]")]
    public class RebateIrController : ControllerBase
    {


        private IProDataAccess _prodataAccess;
        private IDRADataAccess _dradataAccess;
        private INukeDataAccess _nukedataAccess;
        public RebateIrController(IProDataAccess proDataAccess, IDRADataAccess DRADataAccess, INukeDataAccess nukedataAccess)
        {
            _prodataAccess = proDataAccess;
            _dradataAccess = DRADataAccess;
            _nukedataAccess = nukedataAccess;
        }




        private int FindCol(ExcelWorksheet ws, int headerRow, params string[][] headerAliases)
        {
            if (ws.Dimension == null) return 0;
            int firstCol = ws.Dimension.Start.Column;
            int lastCol = ws.Dimension.End.Column;

            for (int c = firstCol; c <= lastCol; c++)
            {
                var h = ws.Cells[headerRow, c].Text?.Trim();
                if (string.IsNullOrEmpty(h)) continue;

                foreach (var set in headerAliases)
                {
                    foreach (var name in set)
                    {
                        if (string.Equals(h, name, StringComparison.OrdinalIgnoreCase))
                            return c;
                    }
                }
            }
            return 0;
        }




        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadIRFile(
               [FromForm(Name = "file")] IFormFile file,
               [FromForm(Name = "expireDate")] string expireDate)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            if (!DateTimeOffset.TryParse(expireDate, out var exp))
                return BadRequest("Invalid expireDate. Expect yyyy-MM-dd or ISO.");

            var rows = await ProcessIRUploadAsync(file, exp.UtcDateTime);
            return Ok(rows); // JSON body (your client parses it from Blob)
        }






        public async Task<List<RebateIRRowDto>> ProcessIRUploadAsync(IFormFile file, DateTime expireDate)
        {
            ExcelPackage.License.SetNonCommercialPersonal("Mark");

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            ms.Position = 0;

            using var package = new ExcelPackage(ms);
            var wb = package.Workbook;
            var sheet1 = wb.Worksheets
                .FirstOrDefault(ws => ws.Name.Equals("Sheet1", StringComparison.OrdinalIgnoreCase))
                ?? wb.Worksheets.FirstOrDefault();

            if (sheet1 == null || sheet1.Dimension == null)
                throw new InvalidOperationException("No data sheet found.");

            // Fixed columns
            const int COL_VENDOR = 1, COL_DESC = 2, COL_PROCODE = 3, COL_IR = 4, COL_REIMB = 5,
                      COL_MAP = 6, COL_START = 7, COL_END = 8, COL_STACKPROD = 9, COL_REBATETYPE = 10, COL_NOTES = 11;

            var result = new List<RebateIRRowDto>();
            int firstRow = sheet1.Dimension.Start.Row + 1;
            int lastRow = sheet1.Dimension.End.Row;

            var primaryDescCache = new Dictionary<int, string?>();
            var stackDescCache = new Dictionary<int, string?>();

            for (int r = firstRow; r <= lastRow; r++)
            {
                if (RowIsBlank(sheet1, r, COL_VENDOR, COL_NOTES)) continue;

                var vendor = ReadCellAsString(sheet1.Cells[r, COL_VENDOR]);
                var desc = ReadCellAsString(sheet1.Cells[r, COL_DESC]);
                var proCode = ReadCellAsString(sheet1.Cells[r, COL_PROCODE]);
                var stackRaw = ReadCellAsString(sheet1.Cells[r, COL_STACKPROD]);

                var dto = new RebateIRRowDto
                {
                    VendorBrand = vendor,
                    ProductDescription = desc,
                    ProCodePrimary = proCode,
                    InstantRebate = TryMoney(sheet1.Cells[r, COL_IR].Text),
                    MemberReimbursement = TryMoney(sheet1.Cells[r, COL_REIMB].Text),
                    MAP = TryMoney(sheet1.Cells[r, COL_MAP].Text),
                    StartDate = TryDate(sheet1.Cells[r, COL_START].Text),
                    EndDate = TryDate(sheet1.Cells[r, COL_END].Text),
                    RebateType = TryInt(sheet1.Cells[r, COL_REBATETYPE].Text) ?? 2,
                    Notes = ReadCellAsString(sheet1.Cells[r, COL_NOTES]),
                    // compat
                    ProductCode = proCode,
                    ModelName = desc,
                    IRDescription = desc,
                    // raw stack code(s) for UI
                    StackProductCode = stackRaw
                };

                // PRIMARY name via PRO code
                string? primaryFromLookup = null;
                if (!string.IsNullOrWhiteSpace(proCode) && int.TryParse(proCode, out var proInt))
                {
                    if (!primaryDescCache.TryGetValue(proInt, out primaryFromLookup))
                    {
                        primaryFromLookup = _prodataAccess.GetPrimaryProductDescriptionByProCode(proInt);
                        primaryDescCache[proInt] = primaryFromLookup;
                    }
                }
                var primary = Clean(primaryFromLookup ?? dto.ProductDescription);

                // STACK names via stack codes (supports multiple)
                var stackNames = ResolveStackNames(stackRaw, stackDescCache, _prodataAccess);
                dto.StackProduct = stackNames.Count > 0 ? string.Join(" + ", stackNames) : null;

                // WITH chain for multi-stack
                var withChain = stackNames.Count > 0 ? " WITH " + string.Join(" WITH ", stackNames) : string.Empty;

                // Proposed
                dto.ProposedModelName = (dto.RebateType ?? 2) switch
                {
                    2 => primary,                          // IR
                    3 => $"{primary} TRADE-IN TRADE-UP",   // TI/TU
                    4 => $"{primary}{withChain}",          // Bundle
                    5 => $"{primary} WITH COUPON CODE",
                    6 => $"{primary} WITH SOCIAL MEDIA",
                    7 => $"{primary}{withChain}",          // FWP
                    _ => primary
                };

                // Disposition + stack (legacy)
                if (!string.IsNullOrWhiteSpace(dto.ProductDescription))
                    dto.DispositionModelID = _nukedataAccess.GetDispositionModelId(dto.ProductDescription);
                if (dto.DispositionModelID == null && !string.IsNullOrWhiteSpace(dto.ProductCode))
                    dto.DispositionModelID = _nukedataAccess.GetDispositionModelId(dto.ProductCode);

                if (dto.DispositionModelID != null)
                {
                    dto.Stack ??= _nukedataAccess.GetStackForModel(dto.DispositionModelID.Value);
                    dto.Notes = string.IsNullOrWhiteSpace(dto.Notes)
                        ? $"{dto.DispositionModelID}: {dto.ProductDescription}"
                        : dto.Notes;
                }
                else
                {
                    dto.Notes ??= "No model match found";
                }

                // INSERT ONCE (after dto is fully built)
                dto.PreviewId = _nukedataAccess.InsertRebatePreviewRow(dto, expireDate);

                result.Add(dto);
            }

            return result;

            // helpers
            static string Clean(string? s)
                => string.IsNullOrWhiteSpace(s) ? string.Empty
                   : System.Text.RegularExpressions.Regex.Replace(s.Trim(), @"\s+", " ");

            static List<string> ResolveStackNames(string? rawCodes, Dictionary<int, string?> cache, IProDataAccess pro)
            {
                var raw = rawCodes?.Trim();
                if (string.IsNullOrWhiteSpace(raw)) return new();
                var m = System.Text.RegularExpressions.Regex.Matches(raw, @"\d+");
                if (m.Count == 0) return new();
                var parts = new List<string>();
                foreach (System.Text.RegularExpressions.Match mm in m)
                {
                    if (!int.TryParse(mm.Value, out var code)) continue;
                    if (!cache.TryGetValue(code, out var desc))
                    {
                        desc = pro.GetPrimaryProductDescriptionByProCode(code);
                        cache[code] = desc;
                    }
                    if (!string.IsNullOrWhiteSpace(desc)) parts.Add(Clean(desc));
                }
                return parts;
            }
        }






        public record ProposedNameUpdate(string ProposedModelName);

        [HttpPatch("preview/{id}/proposed")]
        public IActionResult UpdateProposed(int id, [FromBody] ProposedNameUpdate body)
        {
            if (string.IsNullOrWhiteSpace(body?.ProposedModelName))
                return BadRequest("ProposedModelName is required.");

            _nukedataAccess.UpdatePreviewProposedName(id, body.ProposedModelName.Trim());
            return NoContent();
        }


        [HttpPost("commit")]
        public IActionResult Commit([FromBody] CommitRequest body)
        {
            if (body == null || body.PreviewIds == null || body.PreviewIds.Count == 0)
                return BadRequest("No rows selected.");

            var result = _nukedataAccess.CommitRebateIRPreviewRows(body);
            return Ok(result);
        }



        private Dictionary<string, string> LoadNameMapSafe(ExcelWorksheet? sheet)
        {
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            if (sheet == null || sheet.Dimension == null)
                return map;

            int headerRow = sheet.Dimension.Start.Row;
            int lastRow = sheet.Dimension.End.Row;
            int firstCol = sheet.Dimension.Start.Column;
            int lastCol = sheet.Dimension.End.Column;

            int proposedCol = -1, existingCol = -1;
            for (int c = firstCol; c <= lastCol; c++)
            {
                var header = sheet.Cells[headerRow, c].Text?.Trim();
                if (header.Equals("Proposed", StringComparison.OrdinalIgnoreCase)) proposedCol = c;
                if (header.Equals("Existing", StringComparison.OrdinalIgnoreCase)) existingCol = c;
            }

            if (proposedCol == -1 || existingCol == -1)
            {
                proposedCol = firstCol;
                existingCol = Math.Min(firstCol + 1, lastCol);
            }

            for (int r = headerRow + 1; r <= lastRow; r++)
            {
                var existing = sheet.Cells[r, existingCol].Text?.Trim();
                var proposed = sheet.Cells[r, proposedCol].Text?.Trim();
                if (!string.IsNullOrWhiteSpace(existing) && !string.IsNullOrWhiteSpace(proposed))
                    map[existing] = proposed; // Existing => Proposed
            }

            return map;
        }


        // === helpers ===
        private static bool RowIsBlank(ExcelWorksheet ws, int row, int startCol, int endCol)
        {
            for (int c = startCol; c <= endCol; c++)
                if (!string.IsNullOrWhiteSpace(ws.Cells[row, c].Text)) return false;
            return true;
        }

        private static decimal? TryMoney(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return null;
            var s = input.Replace("$", "").Replace(",", "").Trim();
            return decimal.TryParse(s, NumberStyles.AllowDecimalPoint | NumberStyles.AllowLeadingSign,
                    CultureInfo.InvariantCulture, out var v)
                ? v : (decimal?)null;
        }

        private static DateTime? TryDate(string? input) =>
            DateTime.TryParse(input, out var d) ? d : (DateTime?)null;

        private static int? TryInt(string? input) =>
            int.TryParse(input, out var i) ? i : (int?)null;


        private static List<string> ResolveStackDescription(
      string? stackCodeRaw,
      Dictionary<int, string?> cache,
      IProDataAccess prodataAccess)
        {
            var raw = stackCodeRaw?.Trim();
            if (string.IsNullOrWhiteSpace(raw)) return new List<string>();

            var matches = System.Text.RegularExpressions.Regex.Matches(raw, @"\d+");
            if (matches.Count == 0) return new List<string>();

            var parts = new List<string>();
            foreach (System.Text.RegularExpressions.Match m in matches)
            {
                if (!int.TryParse(m.Value, out var code)) continue;

                if (!cache.TryGetValue(code, out var desc))
                {
                    desc = prodataAccess.GetPrimaryProductDescriptionByProCode(code);
                    cache[code] = desc;
                }
                if (!string.IsNullOrWhiteSpace(desc))
                    parts.Add(Clean(desc));
            }

            return parts;
        }


        private static string Clean(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return string.Empty;
            return System.Text.RegularExpressions.Regex.Replace(s.Trim(), @"\s+", " ");
        }
        private static string CombineWith(string primary, string keyword, string? stacked)
            => string.IsNullOrWhiteSpace(stacked) ? primary : $"{primary} {keyword} {Clean(stacked)}";


        private static string? ReadCellAsString(ExcelRangeBase cell)
        {
            if (cell == null) return null;

            var v = cell.Value;
            return v switch
            {
                null => null,
                string s => s.Trim(),
                double d => d.ToString("0.################", CultureInfo.InvariantCulture),
                decimal m => m.ToString("0.################", CultureInfo.InvariantCulture),
                float f => f.ToString("0.################", CultureInfo.InvariantCulture),
                int i => i.ToString(CultureInfo.InvariantCulture),
                long l => l.ToString(CultureInfo.InvariantCulture),
                DateTime dt => (cell.Text ?? dt.ToString("o", CultureInfo.InvariantCulture)).Trim(),
                _ => cell.Text?.Trim()
            };
        }


    }

}