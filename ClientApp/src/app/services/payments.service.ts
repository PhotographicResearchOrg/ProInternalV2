import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import {
  StatCard, MemberGross, InvoiceRow, AccountSnapshot, AccountSetting,
  CustomFieldDef, PaymentOverride, BillRun, RunExclusion, HistoryRunDetail,
  ReconException, ReportPaths, AuditEntry, PaymentRail
} from '../models/accounting/payment-administration';

// ============================================================================
// PaymentDataService (v2)
// ----------------------------------------------------------------------------
// Standalone service used only by PaymentAdministrationComponent. Does not
// touch the existing app DataService — safe to drop in without risk to any
// other module. Every method throws until a real endpoint exists; the
// component's error handler falls back to demo data + a toast. Uncomment
// the http.* line and delete the throwError once the .NET endpoint is live.
// ============================================================================

@Injectable({ providedIn: 'root' })
export class PaymentDataService {

  private readonly baseUrl = '/api/payment';

  constructor(private http: HttpClient) { }

  getDashboardStats(): Observable<{ cards: StatCard[]; priorWeekCount: number }> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<{ cards: StatCard[]; priorWeekCount: number }>(`${this.baseUrl}/dashboard-stats`);
  }

  getMemberGross(): Observable<MemberGross[]> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<MemberGross[]>(`${this.baseUrl}/members/gross`);
  }

  getAccountSnapshot(accountId: string): Observable<AccountSnapshot> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<AccountSnapshot>(`${this.baseUrl}/accounts/${accountId}/snapshot`);
  }

  getInvoicesForAccount(accountId: string): Observable<InvoiceRow[]> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<InvoiceRow[]>(`${this.baseUrl}/accounts/${accountId}/invoices`);
  }

  getInvoiceAudit(invoiceId: string): Observable<AuditEntry[]> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<AuditEntry[]>(`${this.baseUrl}/invoices/${invoiceId}/audit`);
  }

  emailInvoice(invoiceId: string): Observable<void> {
    return throwError(() => new Error('not wired'));
    // return this.http.post<void>(`${this.baseUrl}/invoices/${invoiceId}/email`, {});
  }

  getRailInvoices(rail: PaymentRail): Observable<InvoiceRow[]> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<InvoiceRow[]>(`${this.baseUrl}/invoices?rail=${rail}`);
  }

  exportRailReport(rail: PaymentRail, format: 'pdf' | 'excel'): Observable<Blob> {
    return throwError(() => new Error('not wired'));
    // return this.http.get(`${this.baseUrl}/invoices/export?rail=${rail}&format=${format}`, { responseType: 'blob' });
  }

  savePaymentOverride(payload: Partial<PaymentOverride>): Observable<void> {
    return throwError(() => new Error('not wired'));
    // return this.http.post<void>(`${this.baseUrl}/overrides`, payload);
  }

  getBillRuns(scope: 'open' | 'history'): Observable<BillRun[]> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<BillRun[]>(`${this.baseUrl}/runs?scope=${scope}`);
  }

  getBillRunDetail(runId: string): Observable<BillRun> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<BillRun>(`${this.baseUrl}/runs/${runId}`);
  }

  buildBillRun(billDate: Date): Observable<BillRun> {
    return throwError(() => new Error('not wired'));
    // return this.http.post<BillRun>(`${this.baseUrl}/runs`, { billDate });
  }

  getRunAudit(runId: string): Observable<AuditEntry[]> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<AuditEntry[]>(`${this.baseUrl}/runs/${runId}/audit`);
  }

  runBulkAction(runId: string, request: { action: string; rail: PaymentRail; accountIds: string[]; invoiceId?: string }): Observable<{ message: string }> {
    return throwError(() => new Error('not wired'));
    // return this.http.post<{ message: string }>(`${this.baseUrl}/runs/${runId}/bulk-action`, request);
  }

  setRailPaidDate(runId: string, rail: PaymentRail, paidDate: Date): Observable<void> {
    return throwError(() => new Error('not wired'));
    // return this.http.post<void>(`${this.baseUrl}/runs/${runId}/paid-date`, { rail, paidDate });
  }

  getRunExclusions(runId: string): Observable<RunExclusion[]> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<RunExclusion[]>(`${this.baseUrl}/runs/${runId}/exclusions`);
  }

  excludeFromRun(runId: string, request: { type: 'Account' | 'Invoice'; targetId: string; reason: string }): Observable<void> {
    return throwError(() => new Error('not wired'));
    // return this.http.post<void>(`${this.baseUrl}/runs/${runId}/exclude`, request);
  }

  includeInRun(runId: string, targetId: string): Observable<void> {
    return throwError(() => new Error('not wired'));
    // return this.http.post<void>(`${this.baseUrl}/runs/${runId}/include`, { targetId });
  }

  searchOpenInvoices(term: string): Observable<InvoiceRow[]> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<InvoiceRow[]>(`${this.baseUrl}/invoices/search?term=${encodeURIComponent(term)}`);
  }

  addInvoiceToRun(runId: string, invoiceIds: string[], reason: string): Observable<void> {
    return throwError(() => new Error('not wired'));
    // return this.http.post<void>(`${this.baseUrl}/runs/${runId}/add-invoices`, { invoiceIds, reason });
  }

  submitBillRun(runId: string): Observable<void> {
    return throwError(() => new Error('not wired'));
    // return this.http.post<void>(`${this.baseUrl}/runs/${runId}/submit`, {});
  }

  getHistoryRunDetail(runId: string): Observable<HistoryRunDetail> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<HistoryRunDetail>(`${this.baseUrl}/runs/${runId}/history-detail`);
  }

  exportRunInvoices(runId: string, format: 'pdf' | 'excel'): Observable<Blob> {
    return throwError(() => new Error('not wired'));
    // return this.http.get(`${this.baseUrl}/runs/${runId}/invoices/export?format=${format}`, { responseType: 'blob' });
  }

  getReconStatus(runId: string): Observable<{ attempted: number; posted: number; exceptions: ReconException[] }> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<{ attempted: number; posted: number; exceptions: ReconException[] }>(`${this.baseUrl}/runs/${runId}/recon`);
  }

  reprocessException(runId: string, invoiceId: string): Observable<void> {
    return throwError(() => new Error('not wired'));
    // return this.http.post<void>(`${this.baseUrl}/runs/${runId}/recon/${invoiceId}/reprocess`, {});
  }

  downloadReconReport(runId: string, kind: 'source' | 'destination' | 'consolidated'): Observable<Blob> {
    return throwError(() => new Error('not wired'));
    // return this.http.get(`${this.baseUrl}/runs/${runId}/recon/report/${kind}`, { responseType: 'blob' });
  }

  getReportPaths(): Observable<ReportPaths> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<ReportPaths>(`${this.baseUrl}/settings/report-paths`);
  }

  saveReportPaths(paths: ReportPaths): Observable<void> {
    return throwError(() => new Error('not wired'));
    // return this.http.post<void>(`${this.baseUrl}/settings/report-paths`, paths);
  }

  getAccountSettings(): Observable<AccountSetting[]> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<AccountSetting[]>(`${this.baseUrl}/account-settings`);
  }

  saveAccountSetting(setting: AccountSetting): Observable<void> {
    return throwError(() => new Error('not wired'));
    // return this.http.post<void>(`${this.baseUrl}/account-settings/${setting.accountId}`, setting);
  }

  getCustomFieldDefs(): Observable<CustomFieldDef[]> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<CustomFieldDef[]>(`${this.baseUrl}/custom-fields`);
  }

  getAuditFeed(): Observable<AuditEntry[]> {
    return throwError(() => new Error('not wired'));
    // return this.http.get<AuditEntry[]>(`${this.baseUrl}/audit`);
  }
}
