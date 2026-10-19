import { Observable, firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';

/* Excel downloads for the Rebate Desk lists. */

export type XKind = 'text' | 'money' | 'number' | 'date' | 'datetime';
export interface XCol { header: string; value: (r: any) => any; kind?: XKind; width?: number; }

/* Shorthands for column lists. */
export const col = (header: string, field: string | ((r: any) => any), kind: XKind = 'text', width?: number): XCol =>
  ({ header, value: typeof field === 'string' ? (r: any) => r?.[field] : field, kind, width });

const MONEY = '$#,##0.00';
const DATE = 'mm/dd/yyyy';
const DATETIME = 'mm/dd/yyyy h:mm AM/PM';

function cellValue(v: any, kind: XKind): any {
  if (v === null || v === undefined || v === '') return null;
  if (kind === 'money' || kind === 'number') {
    const n = typeof v === 'number' ? v : Number(v);
    return isNaN(n) ? String(v) : n;
  }
  if (kind === 'date' || kind === 'datetime') {
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? String(v) : d;
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.map(x => (typeof x === 'object' ? x?.message ?? JSON.stringify(x) : x)).join('; ');
  return v;
}

/* One sheet per entry; the file is named "<name> <yyyy-mm-dd>.xlsx". */
export function downloadXlsx(name: string, sheets: { name: string; cols: XCol[]; rows: any[] }[]): void {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const aoa: any[][] = [s.cols.map(c => c.header)];
    for (const r of s.rows) aoa.push(s.cols.map(c => cellValue(c.value(r), c.kind ?? 'text')));
    const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });

    s.cols.forEach((c, ci) => {
      const fmt = c.kind === 'money' ? MONEY : c.kind === 'date' ? DATE : c.kind === 'datetime' ? DATETIME : null;
      if (!fmt) return;
      for (let ri = 1; ri < aoa.length; ri++) {
        const cell = ws[XLSX.utils.encode_cell({ r: ri, c: ci })];
        if (cell && (cell.t === 'n' || cell.t === 'd')) cell.z = fmt;
      }
    });
    ws['!cols'] = s.cols.map((c, ci) => ({
      wch: c.width ?? Math.min(60, Math.max(c.header.length + 2, ...aoa.slice(1, 200).map(r => String(r[ci] ?? '').length + 1),
        c.kind === 'date' ? 11 : c.kind === 'datetime' ? 19 : 8))
    }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, aoa.length - 1), c: s.cols.length - 1 } }) };
    XLSX.utils.book_append_sheet(wb, ws, s.name.replace(/[\\/?*[\]:]/g, ' ').substring(0, 31) || 'Sheet1');
  }
  const day = new Date().toISOString().substring(0, 10);
  XLSX.writeFile(wb, `${name.replace(/[\\/:*?"<>|]+/g, ' ').trim()} ${day}.xlsx`);
}

/* Every row of a paged list (same filters as on screen), page by page. */
export async function fetchAllPages(load: (page: number, pageSize: number) => Observable<{ rows: any[]; total: number }>,
                                    pageSize = 200, cap = 50000): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; ; page++) {
    const r = await firstValueFrom(load(page, pageSize));
    const rows = r?.rows ?? [];
    all.push(...rows);
    if (!rows.length || all.length >= (r?.total ?? 0) || all.length >= cap) break;
  }
  return all;
}

/* ---- the column lists, shared by every screen that shows the same rows ---- */

export const IR_PROGRAM_COLS: XCol[] = [
  col('Program #', 'programId', 'number'), col('Batch', 'batchId', 'number'), col('Product #', 'modelId', 'number'),
  col('Product', 'description', 'text', 40), col('PRO code', r => r.proCodeText ?? r.proCode), col('Vendor', 'vendorName'),
  col('Type', 'irTypeName'), col('Start', 'startDate', 'date'), col('End', 'endDate', 'date'), col('Claims until', 'expireOn', 'date'),
  col('Instant rebate', 'instantRebate', 'money'), col('Member amount', 'reimbursement', 'money'),
  col('Vendor share', r => r.vendorShare ?? r.reimbursement, 'money'), col('PRO pad', r => r.proPad ?? 0, 'money'),
  col('MAP', 'mapPrice', 'money'), col('State', r => (r.isLive ? 'ON' : 'OFF')), col('Entered', 'enteredAt', 'datetime')
];

export const PP_PROGRAM_COLS: XCol[] = [
  col('Program #', 'programId', 'number'), col('Product #', 'modelId', 'number'), col('Product', 'description', 'text', 40),
  col('PRO code', 'proCodeText'), col('Vendor', 'vendorName'), col('Program date', 'programDate', 'date'),
  col('Credit', 'amount', 'money'), col('New invoice cost', 'newInvoiceCost', 'money'), col('New MAP', 'mapPrice', 'money'),
  col('EZPay', 'ezPay', 'money'), col('State', r => (r.isLive ? 'ON' : 'OFF'))
];

export const UPLOAD_ROW_COLS: XCol[] = [
  col('Upload', 'uploadId', 'number'), col('Vendor', 'vendorName'), col('File', 'fileName'), col('File row', 'sourceRow', 'number'),
  col('Status', 'status'), col('Description', 'description', 'text', 40), col('Vendor SKU', 'vendorSku'), col('UPC', 'upc'),
  col('PRO code(s) entered', 'proCode'), col('PRO product(s) found', 'productCode'), col('PRO product name', 'productName', 'text', 40),
  col('Rebate product name', 'proposedName', 'text', 40), col('Rebate product', r => r.modelDescription ?? r.modelId),
  col('Stack', r => r.stackCodes ?? r.stackProduct), col('Instant rebate', 'instantRebate', 'money'),
  col('Vendor share', 'reimbursement', 'money'), col('PRO pad', 'proPad', 'money'),
  col('Member amount', r => r.memberAmount ?? ((+r.reimbursement || 0) + (+r.proPad || 0)), 'money'),
  col('MAP', 'mapPrice', 'money'), col('Start', 'startDate', 'date'), col('End', 'endDate', 'date'),
  col('Rebate type', r => r.rebateTypeName ?? r.rebateType ?? r.defaultRebateType), col('Notes', 'notes'),
  col('Problems', r => problemsText(r.problems), 'text', 60), col('Skip reason', 'skipReason')
];

export const CLAIM_COLS: XCol[] = [
  col('Claim', 'orderId', 'number'), col('Member', 'memberId', 'number'), col('Vendor', 'vendorName'),
  col('Submitted', 'claimDate', 'date'), col('Lines', 'lines', 'number'), col('Units', 'units', 'number'),
  col('Amount', 'amount', 'money'), col('State', r => CLAIM_STATES[r.bucket] ?? r.bucket), col('Decided', 'decidedAt', 'datetime'), col('Decided by', 'decidedBy'),
  col('Debit memo', 'debitMemo'), col('Member invoice', 'invoiced'), col('Memo', 'memo')
];

/* What each claim state is called on screen and in exports. Credits post to the GL through the accounting system. */
export const CLAIM_STATES: { [bucket: string]: string } = {
  SUBMITTED: 'Not decided', SUPPORT: 'Needs support', APPROVED: 'Approved, not posted',
  SENT: 'Posted to GL', NOT_IN_AR: 'Posted, not in AR', DECLINED: 'Declined'
};

export function problemsText(p: any): string {
  if (!p) return '';
  let list = p;
  if (typeof p === 'string') { try { list = JSON.parse(p); } catch { return p; } }
  return Array.isArray(list) ? list.map((x: any) => x?.message ?? x?.code ?? String(x)).join('; ') : String(list);
}
