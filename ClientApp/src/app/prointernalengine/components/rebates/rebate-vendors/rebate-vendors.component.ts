import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { Rail, RebateDeskService, apiMessage } from 'src/app/services/rebate-desk.service';
import { col, downloadXlsx } from '../shared/rebate-excel';
import { DEFAULT_MONTHS, windowStart } from '../shared/rebate-window.component';

/*
 * Vendors on one rail: products and programs rolled up from product to
 * vendor (and parent company), with claim liability:
 *   liability  approved claims with no debit memo, at the vendor's share
 *   pending    submitted, awaiting a decision; needs support (status 3) apart
 *   only claims in the window (last 12 months by default, 2 years, or all history)
 *   credited / reimbursed / declined in the chosen period
 */
/* Numbers added up when vendors are grouped by parent company. */
const SUMMED = ['productsActive', 'programsLive', 'programsCurrent', 'programsUpcoming', 'liability', 'liabilityClaims', 'unsentAmount',
  'pendingAmount', 'pendingClaims', 'supportAmount', 'supportClaims', 'creditedAmount', 'creditedClaims', 'reimbursedAmount', 'declinedAmount', 'declinedClaims', 'proPadAmount'];

@Component({
  selector: 'app-rebate-vendors',
  templateUrl: './rebate-vendors.component.html',
  styleUrls: ['../shared/rebate-desk.shared.scss']
})
export class RebateVendorsComponent implements OnChanges {
  @Input() rail: Rail = 'IR';
  @Output() showPrograms = new EventEmitter<{ vendorId?: number; modelId?: number }>();
  /* Bill this vendor: opens Debit memos with the vendor and dates filled in. */
  @Output() debitMemo = new EventEmitter<{ vendorId: number; from: string; to: string }>();

  chip: '' | 'LIABILITY' | 'PENDING' | 'LIVE' | 'OLD60' | 'OLD90' = '';

  from = new Date(new Date().getFullYear(), 0, 1).toISOString().substring(0, 10);
  to = new Date().toISOString().substring(0, 10);
  byParent = false;
  months = DEFAULT_MONTHS;

  /* A new window starts the period no earlier than the window. */
  setWindow(m: number): void {
    this.months = m;
    const start = windowStart(m);
    if (start && this.from < start) this.from = start;
    this.refresh();
    if (this.selected) this.open(this.selected);
  }
  q = '';
  onlyWithActivity = true;

  vendors: any[] = [];
  loading = false;
  error = '';

  selected: any = null;
  terms: any = null;
  termsSaved = '';
  types: any[] = [];
  termsBusy = false;
  termsNotice = '';
  products: any[] = [];
  openClaims: any[] = [];
  detailLoading = false;

  constructor(private desk: RebateDeskService) {
    this.desk.types().subscribe(t => (this.types = t));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rail']) { this.selected = null; this.refresh(); }
  }

  refresh(): void {
    this.loading = true;
    this.error = '';
    this.desk.liability(this.rail, null, this.from, this.to, this.months)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: r => (this.vendors = r.vendors), error: e => (this.error = apiMessage(e)) });
  }

  /* Vendors, or parent companies with their vendors' numbers added up. */
  get shown(): any[] {
    let list = this.vendors;
    if (this.onlyWithActivity)
      list = list.filter(v => v.programsLive || v.liability || v.pendingAmount || v.supportAmount || v.creditedAmount || v.productsActive);
    if (this.chip === 'LIABILITY') list = list.filter(v => v.liability > 0);
    if (this.chip === 'PENDING') list = list.filter(v => v.pendingAmount > 0);
    if (this.chip === 'LIVE') list = list.filter(v => v.programsLive > 0);
    if (this.chip === 'OLD60') list = list.filter(v => (this.daysOld(v.oldestUnreimbursed) ?? 0) > 60);
    if (this.chip === 'OLD90') list = list.filter(v => (this.daysOld(v.oldestUnreimbursed) ?? 0) > 90);
    if (this.q.trim()) {
      const q = this.q.trim().toLowerCase();
      list = list.filter(v => (v.vendorName || '').toLowerCase().includes(q) || (v.parentCompany || '').toLowerCase().includes(q));
    }
    if (!this.byParent) return list;
    const groups = new Map<string, any>();
    for (const v of list) {
      const key = v.parentCompany || v.vendorName;
      const g = groups.get(key) ?? {
        vendorName: key, parentCompany: null, members: [] as string[], isGroup: !!v.parentCompany,
        oldestUnreimbursed: null as string | null
      };
      for (const k of SUMMED) g[k] = (g[k] || 0) + (+v[k] || 0);
      g.members.push(v.vendorName);
      if (v.oldestUnreimbursed && (!g.oldestUnreimbursed || v.oldestUnreimbursed < g.oldestUnreimbursed)) g.oldestUnreimbursed = v.oldestUnreimbursed;
      if (!v.parentCompany) g.vendorId = v.vendorId;
      groups.set(key, g);
    }
    return [...groups.values()].sort((a, b) => b.liability - a.liability);
  }

  get totals(): any {
    const t = { liability: 0, pendingAmount: 0, supportAmount: 0, creditedAmount: 0, reimbursedAmount: 0, proPadAmount: 0, programsLive: 0 };
    for (const v of this.vendors) for (const k of Object.keys(t)) (t as any)[k] += +v[k] || 0;
    return t;
  }

  open(v: any): void {
    if (!v.vendorId || v.isGroup) { this.byParent = false; this.q = v.vendorName; return; }
    this.selected = v;
    this.detailLoading = true;
    this.terms = null;
    this.termsNotice = '';
    if (this.rail === 'IR')
      this.desk.vendorTerms(v.vendorId).subscribe({
        next: t => { this.terms = { ...t }; this.termsSaved = JSON.stringify(this.terms); },
        error: () => (this.terms = null)
      });
    this.desk.liability(this.rail, v.vendorId, this.from, this.to, this.months)
      .pipe(finalize(() => (this.detailLoading = false)))
      .subscribe({
        next: r => { this.products = r.products; this.openClaims = r.openClaims; },
        error: e => (this.error = apiMessage(e))
      });
  }

  get termsDirty(): boolean { return !!this.terms && JSON.stringify(this.terms) !== this.termsSaved; }

  discardTerms(): void { this.terms = JSON.parse(this.termsSaved); }

  saveTerms(): void {
    if (!this.selected || !this.terms) return;
    this.termsBusy = true;
    this.termsNotice = '';
    this.desk.saveVendorTerms(this.selected.vendorId, {
      catalogPrefix: this.terms.catalogPrefix, brandIds: this.terms.brandIds,
      vendorSharePct: this.terms.vendorSharePct === '' ? null : this.terms.vendorSharePct,
      comboPadPct: this.terms.comboPadPct === '' ? null : this.terms.comboPadPct,
      expireDays: this.terms.expireDays === '' ? null : this.terms.expireDays,
      defaultRebateType: this.terms.defaultRebateType, notes: this.terms.notes
    }).pipe(finalize(() => (this.termsBusy = false))).subscribe({
      next: () => { this.termsSaved = JSON.stringify(this.terms); this.termsNotice = 'Saved. The next upload for this vendor uses these terms.'; },
      error: e => (this.termsNotice = apiMessage(e))
    });
  }

  exportVendors(): void {
    const ir = this.rail === 'IR';
    const cols = [
      col('Vendor', 'vendorName'), col('Parent company', r => (r.isGroup ? r.members.join(', ') : r.parentCompany)),
      col('Active products', 'productsActive', 'number'), col('Live programs', 'programsLive', 'number'),
      col('Liability (no debit memo)', 'liability', 'money'), col('Liability claims', 'liabilityClaims', 'number'),
      col('Awaiting decision', 'pendingAmount', 'money'), col('Awaiting claims', 'pendingClaims', 'number'),
      col('Needs support', 'supportAmount', 'money'), col('Posted to GL in period', 'creditedAmount', 'money'), col('Debit memo in period', 'reimbursedAmount', 'money'),
      col('Declined in period', 'declinedAmount', 'money'), ...(ir ? [col('PRO pad in period', 'proPadAmount', 'money')] : []),
      col('Oldest with no debit memo', 'oldestUnreimbursed', 'date')
    ];
    const sheets: any[] = [{ name: 'Vendors', cols, rows: this.shown }];
    if (this.selected) {
      sheets.push({ name: 'Products', rows: this.products, cols: [
        col('Product', 'description', 'text', 45), col('PRO code', 'proCodeText'),
        col('Live programs', 'programsLive', 'number'), col('Last program', 'lastProgramDate', 'date'), col('Current amount', 'liveAmount', 'money'),
        col('Units not reimbursed', 'liabilityUnits', 'number'), col('Liability', 'liability', 'money'),
        col('Awaiting decision', 'pendingAmount', 'money'), col('Posted to GL in period', 'creditedAmount', 'money')] });
      sheets.push({ name: 'Claims not reimbursed', rows: this.openClaims, cols: [
        col('Claim', 'orderId', 'number'), col('Member', 'memberId', 'number'), col('Submitted', 'claimDate', 'date'),
        col('State', (c: any) => this.bucketLabel(c.bucket)),
        col('Products', 'products', 'text', 50), col('Units', 'units', 'number'), col('Member amount', 'amount', 'money'),
        col('Vendor owes', (c: any) => (c.bucket === 'SUBMITTED' ? null : c.vendorAmount), 'money')] });
    }
    downloadXlsx(`${ir ? 'Rebate' : 'Price-protection'} liability ${this.selected ? this.selected.vendorName + ' ' : ''}${this.from} to ${this.to}`, sheets);
  }

  chipCount(c: string): number {
    const n = (f: (v: any) => boolean) => this.vendors.filter(f).length;
    switch (c) {
      case 'LIABILITY': return n(v => v.liability > 0);
      case 'PENDING': return n(v => v.pendingAmount > 0);
      case 'LIVE': return n(v => v.programsLive > 0);
      case 'OLD60': return n(v => (this.daysOld(v.oldestUnreimbursed) ?? 0) > 60);
      case 'OLD90': return n(v => (this.daysOld(v.oldestUnreimbursed) ?? 0) > 90);
    }
    return this.vendors.length;
  }

  billVendor(): void {
    const v = this.selected;
    if (!v) return;
    const from = v.oldestUnreimbursed ? String(v.oldestUnreimbursed).substring(0, 10) : this.from;
    this.debitMemo.emit({ vendorId: v.vendorId, from, to: new Date().toISOString().substring(0, 10) });
  }

  daysOld(d: string | null): number | null {
    if (!d) return null;
    return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  }

  bucketLabel(b: string): string {
    return ({ SUBMITTED: 'Awaiting decision', SUPPORT: 'Needs support', APPROVED: 'Approved, not posted, no debit memo',
              SENT: 'Posted to GL, no debit memo' } as any)[b] ?? b;
  }
}
