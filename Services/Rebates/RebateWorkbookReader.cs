using Spire.Xls;
using ProInternal.Models.Rebates;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace ProInternal.Services.Rebates
{
    /* One sheet of a vendor file: every cell as read (number, date or text). */
    public sealed class RebateSheet
    {
        public string Name { get; set; } = "";
        public List<object?[]> Rows { get; } = new();
    }

    /*
     * Reads vendor rebate files (.xlsx, .csv), finds the header row, and turns
     * rows into canonical values once a mapping is chosen. Nothing here touches
     * the database.
     */
    public static class RebateWorkbookReader
    {
        public const int MaxRows = 10000;
        public const int MaxColumns = 60;
        private const int HeaderScanRows = 25;

        public static List<RebateSheet> Read(Stream content, string fileName)
        {
            var ext = Path.GetExtension(fileName ?? "").ToLowerInvariant();
            if (ext == ".csv" || ext == ".txt")
                return new List<RebateSheet> { ReadCsv(content) };
            if (ext != ".xlsx" && ext != ".xlsm" && ext != ".xls")
                throw new RebateFileException("Upload an Excel file (.xlsx or .xls) or a .csv file.");

            var sheets = new List<RebateSheet>();
            try
            {
                /* Spire.XLS, licensed on the server. Reads .xls as well as .xlsx. */
                var workbook = new Workbook();
                workbook.LoadFromStream(content);
                foreach (Worksheet ws in workbook.Worksheets)
                {
                    if (ws.Visibility != WorksheetVisibility.Visible || ws.LastRow < 1 || ws.LastColumn < 1)
                        continue;

                    var sheet = new RebateSheet { Name = ws.Name };
                    var lastRow = Math.Min(ws.LastRow, MaxRows + HeaderScanRows);
                    var lastCol = Math.Min(ws.LastColumn, MaxColumns);

                    for (var r = 1; r <= lastRow; r++)
                    {
                        var cells = new object?[lastCol];
                        for (var c = 1; c <= lastCol; c++)
                            cells[c - 1] = CellValue(ws.Range[r, c]);
                        sheet.Rows.Add(cells);
                    }
                    sheets.Add(sheet);
                }
            }
            catch (RebateFileException)
            {
                throw;
            }
            catch (Exception ex)
            {
                throw new RebateFileException("This file could not be read as Excel: " + ex.Message);
            }

            if (sheets.Count == 0)
                throw new RebateFileException("The file has no sheets with data.");
            return sheets;
        }

        /* The cell's value as Excel shows it: a date for date cells, a number for numbers, formula results resolved. */
        private static object? CellValue(CellRange cell)
        {
            if (cell.HasFormula)
            {
                if (cell.HasFormulaDateTime) return cell.FormulaDateTime;
                if (cell.HasFormulaNumberValue) return cell.FormulaNumberValue;
                if (cell.HasFormulaBoolValue) return cell.FormulaBoolValue;
                return NullIfEmpty(cell.FormulaStringValue);
            }
            if (cell.IsBlank) return null;
            if (cell.HasDateTime) return cell.DateTimeValue;
            if (cell.HasNumber) return cell.NumberValue;
            if (cell.HasBoolean) return cell.BooleanValue;
            return NullIfEmpty(cell.Value);
        }

        private static string? NullIfEmpty(string? text) => string.IsNullOrEmpty(text) ? null : text;

        private static RebateSheet ReadCsv(Stream content)
        {
            var sheet = new RebateSheet { Name = "CSV" };
            using var reader = new StreamReader(content, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
            string? line;
            while ((line = reader.ReadLine()) != null && sheet.Rows.Count < MaxRows + HeaderScanRows)
                sheet.Rows.Add(SplitCsv(line).Take(MaxColumns).Cast<object?>().ToArray());
            return sheet;
        }

        private static List<string> SplitCsv(string line)
        {
            var cells = new List<string>();
            var sb = new StringBuilder();
            var quoted = false;
            for (var i = 0; i < line.Length; i++)
            {
                var ch = line[i];
                if (quoted)
                {
                    if (ch == '"' && i + 1 < line.Length && line[i + 1] == '"') { sb.Append('"'); i++; }
                    else if (ch == '"') quoted = false;
                    else sb.Append(ch);
                }
                else if (ch == '"') quoted = true;
                else if (ch == ',') { cells.Add(sb.ToString()); sb.Clear(); }
                else sb.Append(ch);
            }
            cells.Add(sb.ToString());
            return cells;
        }

        /* ---------------- header row ---------------- */

        /* The row in the first 25 with the most header-like cells; 1-based. */
        public static int DetectHeaderRow(RebateSheet sheet)
        {
            var best = 1;
            var bestScore = -1;
            for (var r = 0; r < Math.Min(sheet.Rows.Count, HeaderScanRows); r++)
            {
                var texts = sheet.Rows[r].Select(Text).Where(t => t.Length > 0).ToList();
                var words = texts.Count(t => !IsNumber(t) && !LooksLikeDate(t));
                if (words < 3)
                    continue;
                var hits = texts.Count(t => RebateColumnAliases.Match(t) != null);
                var score = words + hits * 3;
                if (score > bestScore)
                {
                    bestScore = score;
                    best = r + 1;
                }
            }
            return best;
        }

        public static List<string> Headers(RebateSheet sheet, int headerRow)
        {
            if (headerRow < 1 || headerRow > sheet.Rows.Count)
                return new List<string>();
            var row = sheet.Rows[headerRow - 1];
            var headers = row.Select(Text).ToList();
            /* Trim empty columns at the right. */
            while (headers.Count > 0 && headers[^1].Length == 0) headers.RemoveAt(headers.Count - 1);
            for (var i = 0; i < headers.Count; i++)
                if (headers[i].Length == 0) headers[i] = "Column " + ColumnLetter(i);
            return headers;
        }

        /* The same header names in the same order: the same layout, whatever the sheet is called this month. */
        public static string Fingerprint(IEnumerable<string> headers)
        {
            var normal = string.Join("|", headers.Select(Normalize));
            return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(normal))).ToLowerInvariant();
        }

        public static string Normalize(string? header) =>
            Regex.Replace((header ?? "").ToLowerInvariant(), "[^a-z0-9#]+", " ").Trim();

        public static IEnumerable<(int SourceRow, object?[] Cells)> DataRows(RebateSheet sheet, int headerRow)
        {
            for (var r = headerRow; r < sheet.Rows.Count && r < headerRow + MaxRows; r++)
            {
                var cells = sheet.Rows[r];
                if (cells.All(c => Text(c).Length == 0))
                    continue;
                yield return (r + 1, cells);
            }
        }

        public static string ColumnLetter(int index)
        {
            var n = index + 1;
            var s = "";
            while (n > 0) { var m = (n - 1) % 26; s = (char)('A' + m) + s; n = (n - 1) / 26; }
            return s;
        }

        /* ---------------- values ---------------- */

        public static string Text(object? value) => value switch
        {
            null => "",
            DateTime dt => dt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            double d when Math.Abs(d % 1) < 1e-9 && Math.Abs(d) < 1e15 => ((long)d).ToString(CultureInfo.InvariantCulture),
            double d => d.ToString(CultureInfo.InvariantCulture),
            _ => (value.ToString() ?? "").Trim()
        };

        private static bool IsNumber(string s) => decimal.TryParse(s.Replace("$", "").Replace(",", ""), NumberStyles.Any, CultureInfo.InvariantCulture, out _);
        private static bool LooksLikeDate(string s) => ParseDate(s).HasValue;

        public static decimal? ParseMoney(object? value)
        {
            switch (value)
            {
                case null: return null;
                case double d: return Math.Round((decimal)d, 2);
                case decimal m: return Math.Round(m, 2);
                case int i: return i;
            }
            var s = Text(value);
            if (s.Length == 0) return null;
            var negative = s.StartsWith("(") && s.EndsWith(")") || s.StartsWith("-");
            s = Regex.Replace(s, @"[^0-9.]", "");
            if (!decimal.TryParse(s, NumberStyles.Number, CultureInfo.InvariantCulture, out var v)) return null;
            return Math.Round(negative ? -v : v, 2);
        }

        private static readonly string[] DateFormats =
        {
            "M/d/yyyy", "MM/dd/yyyy", "M/d/yy", "MM/dd/yy", "yyyy-MM-dd", "yyyy/MM/dd", "M-d-yyyy", "M-d-yy",
            "d-MMM-yy", "d-MMM-yyyy", "dd-MMM-yy", "dd-MMM-yyyy", "MMM d, yyyy", "MMMM d, yyyy", "MMM d yyyy",
            "M/d/yyyy h:mm:ss tt", "M/d/yyyy H:mm", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-dd HH:mm:ss", "yyyyMMdd"
        };

        public static DateTime? ParseDate(object? value)
        {
            switch (value)
            {
                case null: return null;
                case DateTime dt: return dt.Date;
                case double d when d > 20000 && d < 80000: return DateTime.FromOADate(d).Date;
            }
            var s = Text(value);
            if (s.Length < 6) return null;
            if (DateTime.TryParseExact(s, DateFormats, CultureInfo.GetCultureInfo("en-US"), DateTimeStyles.AllowWhiteSpaces, out var parsed))
                return parsed.Date;
            if (double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var serial) && serial > 20000 && serial < 80000)
                return DateTime.FromOADate(serial).Date;
            return null;
        }

        /* A PRO code: digits only ("3780", 3780.0 → "3780"); anything else is kept as text for the checks to report. */
        public static string? ParseCode(object? value)
        {
            var s = Text(value);
            if (s.Length == 0) return null;
            if (Regex.IsMatch(s, @"^\d+\.0+$")) s = s[..s.IndexOf('.')];
            return s.Length > 50 ? s[..50] : s;
        }

        /* ---------------- applying a mapping ---------------- */

        public static List<RebateMappedRow> Apply(
            RebateSheet sheet, int headerRow, IReadOnlyDictionary<string, int?> mapping,
            IReadOnlyDictionary<string, int> rebateTypes)
        {
            var headers = Headers(sheet, headerRow);
            var rows = new List<RebateMappedRow>();

            object? Cell(object?[] cells, string field) =>
                mapping.TryGetValue(field, out var col) && col is int c && c >= 0 && c < cells.Length ? cells[c] : null;

            foreach (var (sourceRow, cells) in DataRows(sheet, headerRow))
            {
                var mapped = RebateFields.All.Any(f => Text(Cell(cells, f)).Length > 0);
                if (!mapped)
                    continue;

                var raw = new Dictionary<string, string?>();
                for (var i = 0; i < cells.Length && i < Math.Max(headers.Count, 1); i++)
                {
                    var t = Text(cells[i]);
                    if (t.Length > 0)
                        raw[i < headers.Count ? headers[i] : "Column " + ColumnLetter(i)] = t.Length > 500 ? t[..500] : t;
                }

                var row = new RebateMappedRow
                {
                    SourceRow = sourceRow,
                    Raw = raw,
                    ProCode = ParseCode(Cell(cells, RebateFields.ProCode)),
                    VendorSku = Limit(ParseCode(Cell(cells, RebateFields.VendorSku)) ?? "", 100),
                    Upc = ParseUpc(Cell(cells, RebateFields.Upc)),
                    Description = Limit(Text(Cell(cells, RebateFields.Description)), 400),
                    InstantRebate = ParseMoney(Cell(cells, RebateFields.InstantRebate)),
                    Reimbursement = ParseMoney(Cell(cells, RebateFields.Reimbursement)),
                    MapPrice = ParseMoney(Cell(cells, RebateFields.MapPrice)),
                    ProPad = ParseMoney(Cell(cells, RebateFields.ProPad)),
                    StartDate = ParseDate(Cell(cells, RebateFields.StartDate)),
                    EndDate = ParseDate(Cell(cells, RebateFields.EndDate)),
                    StackProduct = ParseCode(Cell(cells, RebateFields.StackProduct)),
                    RebateType = ParseType(Cell(cells, RebateFields.RebateType), rebateTypes),
                    Notes = Limit(Text(Cell(cells, RebateFields.Notes)), 1000)
                };

                /* A footer such as "Total" or "Grand total" with only an amount is not a program row. */
                if (row.ProCode == null && row.VendorSku == null && row.Upc == null && (row.Description == null || Regex.IsMatch(row.Description, @"^\s*(grand\s+|sub\s*)?totals?\b", RegexOptions.IgnoreCase)))
                    continue;

                rows.Add(row);
            }
            return rows;
        }

        /* Digits only; Excel often turns a UPC into a number. 8 to 14 digits, else null. */
        public static string? ParseUpc(object? value)
        {
            var s = value is double d ? ((long)Math.Round(d)).ToString(CultureInfo.InvariantCulture) : Text(value);
            s = Regex.Replace(s, @"\D", "");
            return s.Length is >= 8 and <= 14 ? s : null;
        }

                private static string? Limit(string s, int max) => s.Length == 0 ? null : s.Length > max ? s[..max] : s;

        /* Number, or a name/alias from RebateType. -1 means "the file says something PRO does not use". */
        public static int? ParseType(object? value, IReadOnlyDictionary<string, int> rebateTypes)
        {
            var s = Text(value);
            if (s.Length == 0) return null;
            if (int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id)) return id;
            return rebateTypes.TryGetValue(Normalize(s), out var t) ? t : -1;
        }

        /* Names from dbo.RebateType plus the usual ways vendors write them. */
        public static Dictionary<string, int> TypeLookup(IEnumerable<(int Id, string Name)> types)
        {
            var known = types.ToList();
            var lookup = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var (id, name) in known)
                lookup[Normalize(name)] = id;

            void Alias(int id, params string[] names)
            {
                if (known.All(t => t.Id != id)) return;
                foreach (var n in names) lookup.TryAdd(Normalize(n), id);
            }

            Alias(2, "ir", "instant rebate", "instant rebates", "instant savings", "instant");
            Alias(3, "titu", "trade in trade up", "trade in", "trade up", "trade-in/trade-up");
            Alias(4, "bundle", "bundles", "kit", "bundle savings");
            Alias(5, "coupon", "coupons", "mail in", "mir");
            Alias(6, "social", "social media", "social media offer");
            Alias(7, "fwp", "free with purchase", "free gift", "gwp", "gift with purchase");
            return lookup;
        }

        private static readonly Regex NumericDate = new(@"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b", RegexOptions.Compiled);
        private static readonly Regex DayMonthDate = new(
            @"\b(\d{1,2})(?:st|nd|rd|th)?\b\s*(?:of\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\b(?:,?\s+(\d{4}))?",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private static readonly Regex MonthDate = new(
            @"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

        /*
         * Program dates printed above the table, for files that have no date columns:
         *   1 a range written in one cell ("Prices Effective 5/24/26 - 6/21/26",
         *     "June 23 through June 30, 2026"), the first such cell from the top
         *   2 otherwise two date cells on one row (a "Promotional Period" from / to)
         * Other dates (an "updated" date, a claim deadline) are ignored. A month-day
         * without a year takes the year written next to it, else this year.
         */
        public static (DateTime? Start, DateTime? End) SuggestFileDates(RebateSheet sheet, int headerRow)
        {
            var rows = Math.Min(headerRow - 1, sheet.Rows.Count);

            for (var r = 0; r < rows; r++)
            {
                foreach (var cell in sheet.Rows[r])
                {
                    if (cell is DateTime) continue;
                    var dates = DatesIn(Text(cell));
                    if (dates.Count >= 2 && dates[1] >= dates[0] && (dates[1] - dates[0]).TotalDays <= 400)
                        return (dates[0], dates[1]);
                }
            }

            for (var r = 0; r < rows; r++)
            {
                /* Date cells, or cells holding nothing but a date. */
                var cells = sheet.Rows[r]
                    .Select(c => c is DateTime dt ? dt.Date : Text(c).Length is > 5 and < 12 ? ParseDate(c) : null)
                    .Where(d => d.HasValue).Select(d => d!.Value).Distinct().OrderBy(d => d).ToList();
                if (cells.Count == 2 && (cells[1] - cells[0]).TotalDays <= 400)
                    return (cells[0], cells[1]);
            }

            return (null, null);
        }

        /* The dates written in a piece of text, in order. */
        private static List<DateTime> DatesIn(string text)
        {
            var hits = new List<(int Pos, DateTime? Date, int Month, int Day)>();
            if (text.Length < 6) return new List<DateTime>();

            foreach (Match m in NumericDate.Matches(text))
                if (ParseDate(m.Value) is DateTime d) hits.Add((m.Index, d, 0, 0));

            foreach (Match m in MonthDate.Matches(text))
            {
                if (!DateTime.TryParseExact(m.Groups[1].Value[..3], "MMM", CultureInfo.InvariantCulture, DateTimeStyles.None, out var mon)) continue;
                if (!int.TryParse(m.Groups[2].Value, out var day) || day < 1 || day > 31) continue;
                DateTime? full = null;
                if (int.TryParse(m.Groups[3].Value, out var year) && year > 2000)
                    try { full = new DateTime(year, mon.Month, day); } catch (ArgumentOutOfRangeException) { }
                hits.Add((m.Index, full, mon.Month, day));
            }

            foreach (Match m in DayMonthDate.Matches(text))
            {
                if (hits.Any(h => Math.Abs(h.Pos - m.Index) < 3)) continue;
                if (!DateTime.TryParseExact(m.Groups[2].Value[..3], "MMM", CultureInfo.InvariantCulture, DateTimeStyles.None, out var mon)) continue;
                if (!int.TryParse(m.Groups[1].Value, out var day) || day < 1 || day > 31) continue;
                DateTime? full = null;
                if (int.TryParse(m.Groups[3].Value, out var year) && year > 2000)
                    try { full = new DateTime(year, mon.Month, day); } catch (ArgumentOutOfRangeException) { }
                hits.Add((m.Index, full, mon.Month, day));
            }

            var year0 = hits.FirstOrDefault(h => h.Date.HasValue).Date?.Year ?? DateTime.Today.Year;
            var result = new List<DateTime>();
            foreach (var h in hits.OrderBy(h => h.Pos))
            {
                if (h.Date is DateTime d) { result.Add(d); continue; }
                try { result.Add(new DateTime(year0, h.Month, h.Day)); } catch (ArgumentOutOfRangeException) { }
            }
            return result.Where(d => d.Year >= 2015 && d.Year <= DateTime.Today.Year + 2).ToList();
        }

        /* The latest end date + 60 days: how long members have to claim, as the legacy upload set it. */
        public static DateTime? SuggestExpireOn(RebateSheet sheet, int headerRow, IReadOnlyDictionary<string, int?> mapping)
        {
            if (!mapping.TryGetValue(RebateFields.EndDate, out var col) || col is not int c)
                return null;
            DateTime? latest = null;
            foreach (var (_, cells) in DataRows(sheet, headerRow))
            {
                if (c >= cells.Length) continue;
                var d = ParseDate(cells[c]);
                if (d.HasValue && (latest == null || d > latest)) latest = d;
            }
            return latest?.AddDays(60);
        }
    }

    public sealed class RebateFileException : Exception
    {
        public RebateFileException(string message) : base(message) { }
    }
}
