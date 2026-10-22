import * as XLSX from 'xlsx';

export interface ExportSheet { name: string; rows: Record<string, unknown>[]; }

/** Every Vendor Desk list exports to Excel: one workbook, one sheet per list, columns as shown on screen. */
export function exportWorkbook(fileName: string, sheets: ExportSheet[]): void {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ '': 'Nothing to export' }]);
    const cols = Object.keys(s.rows[0] || { '': '' });
    ws['!cols'] = cols.map(c => ({
      wch: Math.min(60, Math.max(c.length, ...s.rows.slice(0, 200).map(r => String(r[c] ?? '').length)) + 2)
    }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.substring(0, 31));
  }
  const stamp = new Date().toISOString().substring(0, 10);
  XLSX.writeFile(wb, `${fileName}_${stamp}.xlsx`);
}
