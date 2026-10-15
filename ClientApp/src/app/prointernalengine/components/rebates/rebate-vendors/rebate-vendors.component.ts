import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { Rail, RebateDeskService, apiMessage } from 'src/app/services/rebate-desk.service';

/*
 * Vendors on one rail: products and programs rolled up from product to
 * vendor (and parent company), with claim liability:
 *   open      submitted, not decided + approved, not yet sent to Computyme
 *   unbilled  approved with no debit memo yet (what PRO still bills the vendor)
 *   sent / declined in the chosen period
 */
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
  products: any[] = [];
  openClaims: any[] = [];
  detailLoading = false;

  constructor(private desk: RebateDeskService) {}

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
      list = list.filter(v => v.programsLive || v.openLiability || v.unbilledAmount || v.sentAmount || v.productsActive);
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
        productsActive: 0, programsLive: 0, programsCurrent: 0, programsUpcoming: 0,
        submittedAmount: 0, submittedClaims: 0, approvedAmount: 0, approvedClaims: 0, openLiability: 0,
        unbilledAmount: 0, unbilledClaims: 0, sentAmount: 0, declinedAmount: 0, oldestOpenClaim: null
      };
      for (const k of ['productsActive', 'programsLive', 'programsCurrent', 'programsUpcoming', 'submittedAmount', 'submittedClaims',
        'approvedAmount', 'approvedClaims', 'openLiability', 'unbilledAmount', 'unbilledClaims', 'sentAmount', 'declinedAmount'])
        g[k] += +v[k] || 0;
      g.members.push(v.vendorName);
      if (v.oldestOpenClaim && (!g.oldestOpenClaim || v.oldestOpenClaim < g.oldestOpenClaim)) g.oldestOpenClaim = v.oldestOpenClaim;
      if (!v.parentCompany) g.vendorId = v.vendorId;
      groups.set(key, g);
    }
    return [...groups.values()].sort((a, b) => b.openLiability - a.openLiability);
  }

  get totals(): any {
    const t = { openLiability: 0, submittedAmount: 0, approvedAmount: 0, unbilledAmount: 0, sentAmount: 0, programsLive: 0 };
    for (const v of this.vendors) for (const k of Object.keys(t)) (t as any)[k] += +v[k] || 0;
    return t;
  }

  open(v: any): void {
    if (!v.vendorId || v.isGroup) { this.byParent = false; this.q = v.vendorName; return; }
    this.selected = v;
    this.detailLoading = true;
    this.desk.liability(this.rail, v.vendorId, this.from, this.to)
      .pipe(finalize(() => (this.detailLoading = false)))
      .subscribe({
        next: r => { this.products = r.products; this.openClaims = r.openClaims; },
        error: e => (this.error = apiMessage(e))
      });
  }

  daysOld(d: string | null): number | null {
    if (!d) return null;
    return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  }
}
