// src/app/services/rebate-desk.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type Rail = 'IR' | 'PP';

export const REBATE_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'vendorSku', label: 'Vendor SKU / item #', required: true },
  { key: 'upc', label: 'UPC' },
  { key: 'proCode', label: 'PRO code' },
  { key: 'description', label: 'Description' },
  { key: 'reimbursement', label: 'Reimbursement (vendor share)', required: true },
  { key: 'instantRebate', label: 'Instant rebate' },
  { key: 'mapPrice', label: 'MAP' },
  { key: 'proPad', label: 'PRO pad ($ per unit)' },
  { key: 'startDate', label: 'Start date', required: true },
  { key: 'endDate', label: 'End date', required: true },
  { key: 'rebateType', label: 'Rebate type' },
  { key: 'stackProduct', label: 'Stack product' },
  { key: 'notes', label: 'Notes' }
];

export interface MappingProposal {
  sheets: string[];
  sheetName: string;
  headerRow: number;
  headers: string[];
  sample: string[][];
  dataRows: number;
  mapping: { [field: string]: number | null };
  source: 'TEMPLATE' | 'AI' | 'ALIAS';
  templateId?: number | null;
  fingerprint: string;
  note?: string | null;
  suggestedExpireOn?: string | null;
  vendorSharePct?: number | null;
  padPct?: number | null;
  defaultRebateType?: number | null;
  catalogPrefix?: string | null;
  fileStartDate?: string | null;
  fileEndDate?: string | null;
}

export interface Problem { code: string; message: string; }

export interface Paged<T = any> { total: number; rows: T[]; }

export interface UploadDetail { upload: any; rows: any[]; }

/* The Rebate Desk API (api/rebatedesk). Rows come back with camelCase keys. */
@Injectable({ providedIn: 'root' })
export class RebateDeskService {
  private base = 'api/rebatedesk';

  constructor(private api: ApiService) {}

  private q(params: { [k: string]: any }): string {
    const p = new URLSearchParams();
    Object.keys(params).forEach(k => {
      const v = params[k];
      if (v !== null && v !== undefined && v !== '') p.set(k, String(v));
    });
    const s = p.toString();
    return s ? `?${s}` : '';
  }

  /* ---- look-ups ---- */
  overview(): Observable<any> { return this.api.get(`${this.base}/overview`); }
  vendors(rail: Rail): Observable<any[]> { return this.api.get(`${this.base}/vendors${this.q({ rail })}`); }
  types(): Observable<any[]> { return this.api.get(`${this.base}/types`); }
  proCodes(q: string): Observable<any[]> { return this.api.get(`${this.base}/procodes${this.q({ q })}`); }

  /* ---- uploads ---- */
  upload(vendorId: number, file: File): Observable<{ uploadId: number; proposal: MappingProposal }> {
    const form = new FormData();
    form.append('vendorId', String(vendorId));
    form.append('file', file, file.name);
    return this.api.postMultipartJson(`${this.base}/uploads`, form);
  }
  uploads(status?: string): Observable<any[]> { return this.api.get(`${this.base}/uploads${this.q({ status })}`); }
  getUpload(id: number): Observable<UploadDetail> { return this.api.get(`${this.base}/uploads/${id}`); }
  proposal(id: number, sheetName: string, headerRow: number): Observable<MappingProposal> {
    return this.api.post(`${this.base}/uploads/${id}/proposal`, { sheetName, headerRow });
  }
  applyMapping(id: number, body: any): Observable<UploadDetail> { return this.api.post(`${this.base}/uploads/${id}/mapping`, body); }
  load(id: number, rowIds?: number[]): Observable<any> { return this.api.post(`${this.base}/uploads/${id}/load`, { rowIds: rowIds ?? [] }); }
  cancelUpload(id: number, reason: string): Observable<any> { return this.api.post(`${this.base}/uploads/${id}/cancel`, { reason }); }
  uploadFile(id: number): Observable<{ url: string }> { return this.api.get(`${this.base}/uploads/${id}/file`); }
  createMissingProducts(id: number, rowIds?: number[]): Observable<{ created: number }> {
    return this.api.post(`${this.base}/uploads/${id}/create-products`, { rowIds: rowIds ?? [] });
  }
  vendorTerms(vendorId: number): Observable<any> { return this.api.get(`${this.base}/vendors/${vendorId}/terms`); }
  saveVendorTerms(vendorId: number, body: any): Observable<any> { return this.api.put(`${this.base}/vendors/${vendorId}/terms`, body); }

  /* ---- purgatory ---- */
  purgatory(vendorId?: number | null): Observable<any[]> { return this.api.get(`${this.base}/purgatory${this.q({ vendorId })}`); }
  updateRow(rowId: number, body: any): Observable<any> { return this.api.put(`${this.base}/rows/${rowId}`, body); }
  getRow(rowId: number): Observable<any> { return this.api.get(`${this.base}/rows/${rowId}`); }
  rowOptions(rowId: number): Observable<any[]> { return this.api.get(`${this.base}/rows/${rowId}/options`); }
  pickModel(rowId: number, modelId: number | null): Observable<any> { return this.api.post(`${this.base}/rows/${rowId}/model`, { modelId }); }
  skipRow(rowId: number, reason: string): Observable<any> { return this.api.post(`${this.base}/rows/${rowId}/skip`, { reason }); }
  restoreRow(rowId: number): Observable<any> { return this.api.post(`${this.base}/rows/${rowId}/restore`, {}); }
  skipRows(rowIds: number[], reason: string): Observable<any> { return this.api.post(`${this.base}/rows/skip`, { rowIds, reason }); }
  allowOverlap(rowIds: number[], reason: string): Observable<any> { return this.api.post(`${this.base}/rows/allow-overlap`, { rowIds, reason }); }

  /* ---- templates ---- */
  templates(vendorId?: number | null): Observable<any[]> { return this.api.get(`${this.base}/templates${this.q({ vendorId })}`); }
  retireTemplate(id: number, reason: string): Observable<any> { return this.api.post(`${this.base}/templates/${id}/retire`, { reason }); }

  /* ---- batches ---- */
  batches(f: any): Observable<Paged> { return this.api.get(`${this.base}/batches${this.q(f)}`); }
  batchPrograms(id: number): Observable<any[]> { return this.api.get(`${this.base}/batches/${id}/programs`); }
  setBatchActive(id: number, active: boolean, reason: string): Observable<any> { return this.api.post(`${this.base}/batches/${id}/active`, { active, reason }); }
  changeBatchDates(id: number, body: any): Observable<any> { return this.api.post(`${this.base}/batches/${id}/dates`, body); }

  /* ---- programs ---- */
  programs(rail: Rail, f: any): Observable<Paged> {
    return this.api.get(`${this.base}/${rail === 'PP' ? 'pp/programs' : 'programs'}${this.q(f)}`);
  }
  addPrograms(body: any): Observable<any> { return this.api.post(`${this.base}/programs`, body); }
  changeAmounts(id: number, body: any): Observable<any> { return this.api.put(`${this.base}/programs/${id}/amounts`, body); }
  changeProgramDates(id: number, body: any): Observable<any> { return this.api.put(`${this.base}/programs/${id}/dates`, body); }
  setProgramActive(rail: Rail, id: number, active: boolean, reason: string): Observable<any> {
    return this.api.post(`${this.base}/${rail === 'PP' ? 'pp/programs' : 'programs'}/${id}/active`, { active, reason });
  }
  addPriceProtection(body: any): Observable<any> { return this.api.post(`${this.base}/pp/programs`, body); }
  changePriceProtection(id: number, body: any): Observable<any> { return this.api.put(`${this.base}/pp/programs/${id}`, body); }

  /* ---- products ---- */
  products(rail: Rail, f: any): Observable<Paged> { return this.api.get(`${this.base}/products${this.q({ rail, ...f })}`); }
  product(id: number): Observable<{ product: any; proCodes: any[]; stacks: any[]; programs: any[] }> {
    return this.api.get(`${this.base}/products/${id}`);
  }
  addProduct(body: any): Observable<{ modelId: number; unknownProCodes?: string }> { return this.api.post(`${this.base}/products`, body); }
  changeProduct(id: number, body: any): Observable<{ modelId: number; unknownProCodes?: string }> { return this.api.put(`${this.base}/products/${id}`, body); }
  setProductActive(id: number, active: boolean, reason: string): Observable<any> { return this.api.post(`${this.base}/products/${id}/active`, { active, reason }); }
  setStacks(id: number, stackModelIds: number[], reason: string): Observable<any> { return this.api.put(`${this.base}/products/${id}/stacks`, { stackModelIds, reason }); }

  /* ---- vendors and liability ---- */
  liability(rail: Rail, vendorId?: number | null, from?: string, to?: string, months?: number): Observable<{ vendors: any[]; products: any[]; openClaims: any[] }> {
    return this.api.get(`${this.base}/liability${this.q({ rail, vendorId, from, to, months })}`);
  }

  /* ---- claims (accounting) ---- */
  claims(rail: Rail, f: any): Observable<Paged> { return this.api.get(`${this.base}/claims${this.q({ rail, ...f })}`); }
  claim(rail: Rail, orderId: number): Observable<{ decisions: any[]; lines: any[]; arCredits: any[]; history: any[]; proof?: { name: string; url: string }[] }> {
    return this.api.get(`${this.base}/claims/${rail}/${orderId}`);
  }
  resendCredit(rail: Rail, orderId: number, reason: string): Observable<any> {
    return this.api.post(`${this.base}/claims/${rail}/${orderId}/resend`, { reason });
  }
  /* Needs support (status 3) back into the approval queue. */
  resubmit(rail: Rail, orderId: number, reason: string): Observable<any> {
    return this.api.post(`${this.base}/claims/${rail}/${orderId}/resubmit`, { reason });
  }
  recreateInvoice(rail: Rail, orderId: number, reason: string): Observable<{ invoiceNumber: string; fileId: number; sharePath?: string; total: number }> {
    return this.api.post(`${this.base}/claims/${rail}/${orderId}/invoice`, { reason });
  }
  reprint(rail: Rail, orderId: number): Observable<Blob> { return this.api.getBlob(`${this.base}/claims/${rail}/${orderId}/invoice`); }
  debitMemoCandidates(rail: Rail, vendorIds: number[], from: string, to: string): Observable<{ lines: any[]; emailTo?: string; letter: string }> {
    return this.api.get(`${this.base}/debitmemos/candidates${this.q({ rail, vendorIds: vendorIds.join(','), from, to })}`);
  }
  createDebitMemo(form: FormData): Observable<{ debitMemoId: number; claims: number; total: number; emailed: boolean; emailError?: string }> {
    return this.api.postMultipartJson(`${this.base}/debitmemos`, form);
  }
  /* Test run: emailed to the test address only; nothing stamped. */
  testDebitMemo(form: FormData): Observable<any> { return this.api.postMultipartJson(`${this.base}/debitmemos/test`, form); }
  debitMemos(rail: Rail, q?: string, months?: number): Observable<any[]> { return this.api.get(`${this.base}/debitmemos${this.q({ rail, q, months })}`); }
  debitMemoCsv(id: number): Observable<Blob> { return this.api.getBlob(`${this.base}/debitmemos/${id}/csv`); }

  /* ---- investigate ---- */
  investigateFind(q: string): Observable<any[]> { return this.api.get(`${this.base}/investigate/find${this.q({ q })}`); }
  investigateClaimants(f: { modelId?: number | null; vendorId?: number | null; months: number }): Observable<{ members: any[]; about: any }> {
    return this.api.get(`${this.base}/investigate/claimants${this.q(f)}`);
  }
  investigateMember(memberId: number, modelIds: number[] | null, months: number):
    Observable<{ products: any[]; months: any[]; claims: any[]; purchases: any[]; about: any }> {
    return this.api.get(`${this.base}/investigate/member/${memberId}${this.q({ modelIds: modelIds?.length ? modelIds.join(',') : null, months })}`);
  }

  /* ---- history ---- */
  history(f: any): Observable<any[]> { return this.api.get(`${this.base}/history${this.q(f)}`); }
}

/* The message from a 400 the desk API returned, or a generic one. */
export function apiMessage(err: any, fallback = 'Something went wrong. Try again.'): string {
  return err?.error?.message || (typeof err?.error === 'string' ? err.error : '') || fallback;
}

/* Saves a downloaded file in the browser. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function isoDate(d: any): string {
  if (!d) return '';
  const s = String(d);
  return s.length >= 10 ? s.substring(0, 10) : s;
}
