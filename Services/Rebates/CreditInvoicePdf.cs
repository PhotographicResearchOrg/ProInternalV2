using PdfSharp.Drawing;
using PdfSharp.Fonts;
using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace ProInternal.Services.Rebates
{
    public sealed class CreditInvoiceLine
    {
        public string ProCode { get; set; } = "";
        public int Quantity { get; set; }
        public string Description { get; set; } = "";
        public decimal UnitPrice { get; set; }
        public decimal Extended { get; set; }
    }

    public sealed class CreditInvoiceData
    {
        public string InvoiceNumber { get; set; } = "";
        public string ClaimNumber { get; set; } = "";
        public string AccountNumber { get; set; } = "";
        public string Program { get; set; } = "";
        public string ProgramWeek { get; set; } = "";
        public string ProcessDate { get; set; } = "";
        public string PostedDate { get; set; } = "";
        public string Terms { get; set; } = "";
        public string ContactName { get; set; } = "";
        public string ContactPhone { get; set; } = "";
        public string ContactEmail { get; set; } = "";
        public string DebitMemo { get; set; } = "";
        public decimal Total { get; set; }
        public List<CreditInvoiceLine> Lines { get; set; } = new();
    }

    /*
     * Fills the credit invoice template (CreditTemplate.pdf for instant
     * rebates, CreditPriceTemplate.pdf for price protection) and flattens it:
     * the text is drawn where each form field sits, then the fields are
     * removed, so the member gets a plain PDF. Line items are drawn as rows:
     * a long description wraps and the next item starts below it, so the
     * columns always line up (the old program padded with blank lines).
     *
     * PDFsharp only (no licence, no watermark), as the rest of PIV2 uses.
     */
    public static class CreditInvoicePdf
    {
        private const string Family = "Arial";
        private static readonly CultureInfo Us = CultureInfo.GetCultureInfo("en-US");
        private static readonly object FontSetup = new();
        private static bool _fontsReady;

        public static byte[] Build(string templatePath, CreditInvoiceData data)
        {
            EnsureFonts();

            using var input = File.OpenRead(templatePath);
            using var doc = PdfReader.Open(input, PdfDocumentOpenMode.Modify);
            var page = doc.Pages[0];

            var fields = Fields(page);
            using (var gfx = XGraphics.FromPdfPage(page, XGraphicsPdfPageOptions.Append))
            {
                var pageHeight = page.Height.Point;

                void Text(string name, string? value)
                {
                    if (string.IsNullOrWhiteSpace(value) || !fields.TryGetValue(name, out var f)) return;
                    var font = new XFont(Family, f.FontSize);
                    var text = Fit(gfx, value.Trim(), font, f.Width);
                    var top = pageHeight - f.Y2 + Math.Max(0, (f.Height - f.FontSize * 1.15) / 2);
                    gfx.DrawString(text, font, XBrushes.Black, f.X1 + 2, top, XStringFormats.TopLeft);
                }

                Text("PROInvoice", data.InvoiceNumber);
                Text("Date", data.PostedDate);
                Text("InvoiceDue", data.Terms);
                Text("AccountNumber", data.AccountNumber);
                Text("ClaimNumber", data.ClaimNumber);
                Text("Program", data.Program);
                Text("ProgramWeek", data.ProgramWeek);
                Text("ProcessDate", data.ProcessDate);
                Text("ContactName", data.ContactName);
                Text("ContactPhone", data.ContactPhone);
                Text("ContactEmail", data.ContactEmail);
                Text("PO", data.DebitMemo);
                Text("Total", data.Total.ToString("C", Us));

                DrawLines(gfx, fields, pageHeight, data.Lines);
            }

            RemoveFields(doc, page);

            using var output = new MemoryStream();
            doc.Save(output, false);
            return output.ToArray();
        }

        /* ---------------- line items ---------------- */

        private static void DrawLines(XGraphics gfx, Dictionary<string, FieldBox> fields, double pageHeight, List<CreditInvoiceLine> lines)
        {
            if (!fields.TryGetValue("Description", out var desc)) return;
            fields.TryGetValue("Item", out var item);
            fields.TryGetValue("Quantity", out var qty);
            fields.TryGetValue("UnitPrice", out var unit);
            fields.TryGetValue("ExtPrice", out var ext);

            var font = new XFont(Family, desc.FontSize);
            var lineHeight = desc.FontSize * 1.25;
            var y = pageHeight - desc.Y2 + 2;
            var bottom = pageHeight - desc.Y1;

            foreach (var line in lines)
            {
                var wrapped = Wrap(gfx, line.Description ?? "", font, desc.Width - 4);
                if (y + lineHeight * Math.Max(1, wrapped.Count) > bottom)
                {
                    gfx.DrawString($"… and {lines.Count - lines.IndexOf(line)} more line(s)", font, XBrushes.Black, desc.X1 + 2, y, XStringFormats.TopLeft);
                    break;
                }

                if (item != null) gfx.DrawString(Fit(gfx, line.ProCode, font, item.Width), font, XBrushes.Black, item.X1 + 2, y, XStringFormats.TopLeft);
                if (qty != null) Right(gfx, line.Quantity.ToString(Us), font, qty, y);
                if (unit != null) Right(gfx, line.UnitPrice.ToString("C", Us), font, unit, y);
                if (ext != null) Right(gfx, line.Extended.ToString("C", Us), font, ext, y);

                foreach (var part in wrapped)
                {
                    gfx.DrawString(part, font, XBrushes.Black, desc.X1 + 2, y, XStringFormats.TopLeft);
                    y += lineHeight;
                }
                y += lineHeight * 0.4;
            }
        }

        private static void Right(XGraphics gfx, string text, XFont font, FieldBox box, double y)
        {
            var w = gfx.MeasureString(text, font).Width;
            gfx.DrawString(text, font, XBrushes.Black, box.X2 - 3 - w, y, XStringFormats.TopLeft);
        }

        private static List<string> Wrap(XGraphics gfx, string text, XFont font, double width)
        {
            var result = new List<string>();
            var current = "";
            foreach (var word in Regex.Split(text.Trim(), @"\s+").Where(w => w.Length > 0))
            {
                var attempt = current.Length == 0 ? word : current + " " + word;
                if (gfx.MeasureString(attempt, font).Width <= width || current.Length == 0)
                    current = attempt;
                else
                {
                    result.Add(current);
                    current = word;
                }
            }
            if (current.Length > 0) result.Add(current);
            return result.Select(r => Fit(gfx, r, font, width)).DefaultIfEmpty("").ToList();
        }

        private static string Fit(XGraphics gfx, string text, XFont font, double width)
        {
            if (gfx.MeasureString(text, font).Width <= width - 4) return text;
            var s = text;
            while (s.Length > 1 && gfx.MeasureString(s + "…", font).Width > width - 4) s = s[..^1];
            return s + "…";
        }

        /* ---------------- the template's form fields ---------------- */

        private sealed class FieldBox
        {
            public double X1, Y1, X2, Y2, FontSize;
            public double Width => X2 - X1;
            public double Height => Y2 - Y1;
        }

        private static Dictionary<string, FieldBox> Fields(PdfPage page)
        {
            var result = new Dictionary<string, FieldBox>(StringComparer.Ordinal);
            var annots = page.Elements.GetArray("/Annots");
            if (annots == null) return result;

            for (var i = 0; i < annots.Elements.Count; i++)
            {
                if (annots.Elements.GetDictionary(i) is not { } a) continue;
                if (a.Elements.GetName("/Subtype") != "/Widget") continue;
                var name = a.Elements.GetString("/T");
                if (string.IsNullOrEmpty(name) && a.Elements.GetDictionary("/Parent") is { } parent)
                    name = parent.Elements.GetString("/T");
                if (string.IsNullOrEmpty(name)) continue;

                var r = a.Elements.GetRectangle("/Rect");
                var da = a.Elements.GetString("/DA");
                var size = Regex.Match(da ?? "", @"([\d.]+)\s+Tf") is { Success: true } m
                           && double.TryParse(m.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var s) && s > 0 ? s : 9;

                result[name] = new FieldBox
                {
                    X1 = Math.Min(r.X1, r.X2), X2 = Math.Max(r.X1, r.X2),
                    Y1 = Math.Min(r.Y1, r.Y2), Y2 = Math.Max(r.Y1, r.Y2),
                    FontSize = size
                };
            }
            return result;
        }

        /* Flattening: the widgets and the authoring notes go; the form goes. Other annotations (lines) stay. */
        private static void RemoveFields(PdfDocument doc, PdfPage page)
        {
            var annots = page.Elements.GetArray("/Annots");
            if (annots != null)
            {
                for (var i = annots.Elements.Count - 1; i >= 0; i--)
                {
                    var subtype = annots.Elements.GetDictionary(i)?.Elements.GetName("/Subtype");
                    if (subtype is "/Widget" or "/Text" or "/Popup")
                        annots.Elements.RemoveAt(i);
                }
                if (annots.Elements.Count == 0)
                    page.Elements.Remove("/Annots");
            }
            doc.Internals.Catalog.Elements.Remove("/AcroForm");
        }

        private static void EnsureFonts()
        {
            if (_fontsReady) return;
            lock (FontSetup)
            {
                if (_fontsReady) return;
                try
                {
                    if (OperatingSystem.IsWindows() && GlobalFontSettings.FontResolver == null)
                        GlobalFontSettings.UseWindowsFontsUnderWindows = true;
                }
                catch (InvalidOperationException)
                {
                    /* Fonts were already set up elsewhere in the app. */
                }
                _fontsReady = true;
            }
        }
    }
}
