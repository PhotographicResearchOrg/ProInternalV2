import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { Rail, RebateDeskService, apiMessage } from 'src/app/services/rebate-desk.service';
import { col, downloadXlsx } from '../shared/rebate-excel';

/*
 * Vendors on one rail: products and programs rolled up from product to
 * vendor (and parent company), with claim liability:
 *   liability  approved claims the vendor has not reimbursed (no debit memo), at the vendor's share
 *   pending    submitted, awaiting a decision
 *   credited / reimbursed / declined in the chosen period
 */
/* Numbers added up when vendors are grouped by parent company. */
const SUMMED = ['productsActive', 'programsLive', 'programsCurrent', 'programsUpcoming', 'liability', 'liabilityClaims', 'unsentAmount',
  'pendingAmount', 'pendingClaims', 'creditedAmount', 'creditedClaims', 'reimbursedAmount', 'declinedAmount', 'declinedClaims', 'proPadAmount'];

@Component({
  selector: 'app-rebate-vendors',
  templateUrl: './rebate-vendors.component.html',
  styleUrls: ['../shared/rebate-desk.shared.scss']
})
export class RebateVendorsComponent implements OnChanges {
  @Input() rail: Rail = 'IR';
  @Output() showPrograms = new EventEmitter<{ vendorId?: number; modelId?: number }>();

  from = new Date(new Date().getFullYear(), 0, 1).toISOString().substring(0, 10);
  to = new Date().toISOString().substring(0, 10);
  byParent = false;
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
    this.desk.liability(this.rail, null, this.from, this.to)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: r => (this.vendors = r.vendors), error: e => (this.error = apiMessage(e)) });
  }

  /* Vendors, or parent companies with their vendors' numbers added up. */
  get shown(): any[] {
    let list = this.vendors;
    if (this.onlyWithActivity)
      list = list.filter(v => v.programsLive || v.liability || v.pendingAmount || v.creditedAmount || v.productsActive);
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
    const t = { liability: 0, pendingAmount: 0, creditedAmount: 0, reimbursedAmount: 0, proPadAmount: 0, programsLive: 0 };
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
    this.desk.liability(this.rail, v.vendorId, this.from, this.to)
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
      col('Liability (not reimbursed)', 'liability', 'money'), col('Liability claims', 'liabilityClaims', 'number'),
      col('Awaiting decision', 'pendingAmount', 'money'), col('Awaiting claims', 'pendingClaims', 'number'),
      col('Credited in period', 'creditedAmount', 'money'), col('Reimbursed in period', 'reimbursedAmount', 'money'),
      col('Declined in period', 'declinedAmount', 'money'), ...(ir ? [col('PRO pad in period', 'proPadAmount', 'money')] : []),
      col('Oldest not reimbursed', 'oldestUnreimbursed', 'date')
    ];
    const sheets: any[] = [{ name: 'Vendors', cols, rows: this.shown }];
    if (this.selected) {
      sheets.push({ name: 'Products', rows: this.products, cols: [
        col('Product #', 'modelId', 'number'), col('Product', 'description', 'text', 45), col('PRO code', 'proCodeText'),
        col('Live programs', 'programsLive', 'number'), col('Last program', 'lastProgramDate', 'date'), col('Current amount', 'liveAmount', 'money'),
        col('Units not reimbursed', 'liabilityUnits', 'number'), col('Liability', 'liability', 'money'),
        col('Awaiting decision', 'pendingAmount', 'money'), col('Credited in period', 'creditedAmount', 'money')] });
      sheets.push({ name: 'Claims not reimbursed', rows: this.openClaims, cols: [
        col('Claim', 'orderId', 'number'), col('Member', 'memberId', 'number'), col('Submitted', 'claimDate', 'date'),
        col('State', (c: any) => (c.bucket === 'SUBMITTED' ? 'Awaiting decision' : c.bucket === 'APPROVED' ? 'Approved, not sent' : 'Credited, not billed')),
        col('Products', 'products', 'text', 50), col('Units', 'units', 'number'), col('Member amount', 'amount', 'money'),
        col('Vendor owes', (c: any) => (c.bucket === 'SUBMITTED' ? null : c.vendorAmount), 'money')] });
    }
    downloadXlsx(`${ir ? 'Rebate' : 'Price-protection'} liability ${this.selected ? this.selected.vendorName + ' ' : ''}${this.from} to ${this.to}`, sheets);
  }

  daysOld(d: string | null): number | null {
    if (!d) return null;
    return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  }
}
