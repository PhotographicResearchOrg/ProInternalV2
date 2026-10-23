import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { utils as XLSXUtils, writeFile as XLSXWriteFile } from 'xlsx';
import { DataService } from 'src/app/services/data.service';
import { HomePin, stablePin } from 'src/app/services/home-pin.service';
import { downloadCsv, CsvColumn } from 'src/app/services/csv.service';
import { Account } from 'src/app/models/Dashboard/Account';
import { Products } from 'src/app/models/Dashboard/Products';
import { MapViolation } from 'src/app/models/Dashboard/MapViolation';

type ViolationFilter = 'all' | 'active' | 'ending' | 'expired';
interface ViolationRow extends MapViolation { end: Date | null; active: boolean; indefinite: boolean; daysLeft: number | null; }

/** MAP violations desk: report a dealer selling below MAP and review what's been submitted.
 *  Same APIs as the old dashboard drawers (API/Product/submitMapViolation, getAllMapViolations). */
@Component({
  selector: 'app-map-violations',
  templateUrl: './map-violations.component.html',
  styleUrls: ['../../MemberManagement/member-desk/member-desk.component.scss', './map-violations.component.scss'],
  providers: [MessageService]
})
export class MapViolationsComponent implements OnInit {
  readonly pin: HomePin = stablePin({ id: 'map-violations', label: 'MAP violations', sub: 'Management', icon: 'pi pi-exclamation-triangle', route: '/map-violations', metric: 'map.violations' });
  readonly penaltyOptions = [
    { label: '30 days', value: 30 }, { label: '45 days', value: 45 }, { label: '60 days', value: 60 }, { label: 'Indefinite', value: 9999 }
  ];
  static readonly INDEFINITE = 9999;

  rows: ViolationRow[] = [];
  loading = true;
  filter: ViolationFilter = 'active';
  search = '';

  accounts: Account[] = [];
  accountMatches: Account[] = [];
  productMatches: Products[] = [];
  account: Account | null = null;
  product: Products | null = null;
  penalty: number | null = 30;
  submitting = false;
  touched = false;
  /** what was just submitted, and the member's violations that came back */
  lastSubmit: { account: Account; product: Products; penalty: number; at: Date; existing: MapViolation[] } | null = null;

  constructor(private data: DataService, private toast: MessageService) {}

  ngOnInit(): void {
    this.load();
    this.data.getAccounts().subscribe({ next: (a: any) => this.accounts = a || [], error: () => this.accounts = [] });
  }

  load(): void {
    this.loading = true;
    this.data.getAllMapViolations().subscribe({
      next: r => { this.rows = (r || []).map(v => this.toRow(v)); this.loading = false; },
      error: () => { this.rows = []; this.loading = false; this.toast.add({ severity: 'error', summary: 'MAP violations', detail: 'Could not load violations' }); }
    });
  }

  private toRow(v: MapViolation): ViolationRow {
    const indefinite = v.penaltyDays >= MapViolationsComponent.INDEFINITE;
    let end: Date | null = v.endDate ? new Date(v.endDate) : null;
    if (!end && v.submittedOn && !indefinite) { end = new Date(v.submittedOn); end.setDate(end.getDate() + (v.penaltyDays || 0)); }
    const active = indefinite || (!!end && end > new Date());
    const daysLeft = end && !indefinite ? Math.ceil((end.getTime() - Date.now()) / 86400000) : null;
    return { ...v, end, active, indefinite, daysLeft };
  }

  // ------------------------------------------------------------ list
  count(f: ViolationFilter): number { return this.rows.filter(r => this.matches(r, f)).length; }
  private matches(r: ViolationRow, f: ViolationFilter): boolean {
    switch (f) {
      case 'active': return r.active;
      case 'ending': return r.active && r.daysLeft !== null && r.daysLeft <= 7;
      case 'expired': return !r.active;
      default: return true;
    }
  }
  get shown(): ViolationRow[] {
    const q = this.search.trim().toLowerCase();
    return this.rows
      .filter(r => this.matches(r, this.filter))
      .filter(r => !q || [r.accountName, r.accountNumber, r.productCode].some(x => (x || '').toString().toLowerCase().includes(q)))
      .sort((a, b) => (b.submittedOn ? +new Date(b.submittedOn) : 0) - (a.submittedOn ? +new Date(a.submittedOn) : 0));
  }
  get membersActive(): number { return new Set(this.rows.filter(r => r.active).map(r => r.accountNumber)).size; }

  penaltyText(r: ViolationRow): string { return r.indefinite ? 'Indefinite' : `${r.penaltyDays} days`; }
  statusText(r: ViolationRow): string {
    if (!r.active) return 'Expired';
    if (r.indefinite) return 'Active · no end';
    return r.daysLeft !== null && r.daysLeft <= 7 ? `Ends in ${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'}` : 'Active';
  }
  statusClass(r: ViolationRow): string {
    if (!r.active) return '';
    return r.daysLeft !== null && r.daysLeft <= 7 ? 'status-exception' : 'status-hold';
  }

  // ------------------------------------------------------------ report form
  findAccount(e: { query: string }): void {
    const q = (e.query || '').toLowerCase();
    this.accountMatches = this.accounts.filter(a =>
      (a.accountName || '').toLowerCase().includes(q) || String(a.accountNumber).startsWith(q)).slice(0, 25)
      .map(a => new Account({ ...a, label: `${a.accountNumber} · ${a.accountName}` }));
  }
  findProduct(e: { query: string }): void {
    const q = (e.query || '').trim();
    if (!q) { this.productMatches = []; return; }
    this.data.getProducts(q).subscribe({
      next: (r: Products[]) => this.productMatches = (r || []).slice(0, 25)
        .map(p => Object.assign(new Products(), p, { label: `${p.productCode} · ${p.modelName}` }) as Products),
      error: () => this.productMatches = []
    });
  }
  get canSubmit(): boolean { return !!this.account?.accountNumber && !!this.product?.productCode && !!this.penalty && !this.submitting; }

  submit(): void {
    this.touched = true;
    if (!this.canSubmit) return;
    const account = this.account!, product = this.product!, penalty = this.penalty!;
    this.submitting = true;
    this.data.submitMapViolation({ accountNumber: String(account.accountNumber), productCode: product.productCode, penaltyDays: penalty }).subscribe({
      next: res => {
        this.submitting = false;
        this.lastSubmit = { account, product, penalty, at: new Date(), existing: res || [] };
        this.toast.add({ severity: 'success', summary: 'MAP violation reported', detail: `${account.accountName} · ${product.productCode}` });
        this.account = null; this.product = null; this.touched = false;
        this.load();
      },
      error: err => {
        this.submitting = false;
        this.toast.add({ severity: 'error', summary: 'Not submitted', detail: err?.error?.message || 'Submission failed' });
      }
    });
  }

  // ------------------------------------------------------------ downloads
  exportExcel(): void {
    const rows = this.shown.map(r => ({
      'Account #': r.accountNumber, 'Member': r.accountName || '', 'Product': r.productCode, 'Penalty': this.penaltyText(r),
      'Submitted': r.submittedOn ? new Date(r.submittedOn).toLocaleDateString() : '',
      'Ends': r.indefinite ? 'No end' : (r.end ? r.end.toLocaleDateString() : ''), 'Status': this.statusText(r)
    }));
    const wb = XLSXUtils.book_new();
    XLSXUtils.book_append_sheet(wb, rows.length ? XLSXUtils.json_to_sheet(rows) : XLSXUtils.aoa_to_sheet([['(none)']]), 'MAP violations');
    XLSXWriteFile(wb, `MapViolations_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  /** the old dashboard's refresh button: the member account list as CSV */
  downloadAccounts(): void {
    this.data.downloadCSV().subscribe(r => {
      const columns: CsvColumn[] = [{ key: 'accountNumber', title: 'Account Number' }, { key: 'accountName', title: 'Account Name' }];
      downloadCsv(r.toString(), columns, `Member_Accounts_${new Date().toISOString().slice(0, 10)}`);
    });
  }
}
