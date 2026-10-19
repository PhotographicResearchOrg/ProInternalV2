import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';
import { RebateDeskService, apiMessage } from 'src/app/services/rebate-desk.service';
import { col, downloadXlsx } from '../shared/rebate-excel';
import { DEFAULT_MONTHS } from '../shared/rebate-window.component';

/*
 * Investigate (instant rebates): does what a member claimed match what they bought from PRO?
 *   Look up a claim #, a member (number or name), a rebate product or a vendor.
 *   A claim or a member opens the member view: per product bought against claimed,
 *   a month-by-month chart, the full timeline and the flags.
 *   A product or a vendor lists every member who claimed it, the ones that look wrong first.
 * Sales come from piv2.MemberSalesMonth (EDA.ARHistorical, rebuilt nightly).
 */
@Component({
  selector: 'app-rebate-investigate',
  templateUrl: './rebate-investigate.component.html',
  styleUrls: ['../shared/rebate-desk.shared.scss']
})
export class RebateInvestigateComponent implements OnChanges {
  /* Opened from a claim: that member and the claim's products. */
  @Input() preset: { memberId: number; modelIds?: number[] } | null = null;

  q = '';
  hits: any[] = [];
  searching = false;
  private q$ = new Subject<string>();

  months = DEFAULT_MONTHS;
  loading = false;
  error = '';

  /* What is open: a member, or the claimants of a product or vendor. */
  memberId: number | null = null;
  modelIds: number[] = [];
  member: { products: any[]; months: any[]; timeline: any[]; about: any } | null = null;
  focusLabel = '';
  claimantsOf: { modelId?: number; vendorId?: number; label: string } | null = null;
  claimants: { members: any[]; about: any } | null = null;

  timelineKinds: { [k: string]: boolean } = { BOUGHT: true, CLAIMED: true, APPROVED: true, DECLINED: true, NEEDS_SUPPORT: true, POSTED: true, DEBIT_MEMO: true, DESK: true, DECIDED: true };
  readonly kindLabels: { [k: string]: string } = {
    BOUGHT: 'Bought', CLAIMED: 'Claimed', APPROVED: 'Approved', DECLINED: 'Declined', NEEDS_SUPPORT: 'Needs support',
    DECIDED: 'Decision', POSTED: 'Posted to GL', DEBIT_MEMO: 'Debit memo', DESK: 'Desk action'
  };

  chartData: any = null;
  readonly chartOptions = {
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: { y: { beginAtZero: true, title: { display: true, text: 'Units' } } }
  };

  constructor(private desk: RebateDeskService) {
    this.q$.pipe(
      debounceTime(300), distinctUntilChanged(),
      switchMap(q => {
        if ((q || '').trim().length < 2) { this.searching = false; return of([]); }
        this.searching = true;
        return this.desk.investigateFind(q.trim()).pipe(catchError(e => { this.error = apiMessage(e); return of([]); }), finalize(() => (this.searching = false)));
      })
    ).subscribe(h => (this.hits = h ?? []));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['preset'] && this.preset) this.openMember(this.preset.memberId, this.preset.modelIds ?? [], '');
  }

  search(q: string): void { this.q$.next(q); }

  pick(h: any): void {
    this.hits = [];
    this.q = '';
    switch (h.kind) {
      case 'CLAIM': this.openClaim(+h.key, h.memberId); break;
      case 'MEMBER': this.openMember(+h.memberId, [], ''); break;
      case 'PRODUCT': this.openClaimants({ modelId: +h.modelId, label: h.label }); break;
      case 'VENDOR': this.openClaimants({ vendorId: +h.vendorId, label: h.label }); break;
    }
  }

  /* A claim: its member, narrowed to the claim's products. */
  private openClaim(orderId: number, memberId: number): void {
    this.desk.claim('IR', orderId).subscribe({
      next: d => this.openMember(memberId, [...new Set((d.lines ?? []).map((l: any) => +l.modelId))], `Claim ${orderId}`),
      error: () => this.openMember(memberId, [], `Claim ${orderId}`)
    });
  }

  openMember(memberId: number, modelIds: number[], label: string): void {
    this.memberId = memberId;
    this.modelIds = modelIds;
    this.focusLabel = label;
    this.claimantsOf = null;
    this.claimants = null;
    this.loadMember();
  }

  loadMember(): void {
    if (!this.memberId) return;
    this.loading = true;
    this.error = '';
    this.desk.investigateMember(this.memberId, this.modelIds, this.months).pipe(finalize(() => (this.loading = false))).subscribe({
      next: r => { this.member = r; this.buildChart(); },
      error: e => (this.error = apiMessage(e))
    });
  }

  openClaimants(of_: { modelId?: number; vendorId?: number; label: string }): void {
    this.claimantsOf = of_;
    this.memberId = null;
    this.member = null;
    this.loadClaimants();
  }

  loadClaimants(): void {
    if (!this.claimantsOf) return;
    this.loading = true;
    this.error = '';
    this.desk.investigateClaimants({ modelId: this.claimantsOf.modelId ?? null, vendorId: this.claimantsOf.vendorId ?? null, months: this.months })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: r => (this.claimants = r), error: e => (this.error = apiMessage(e)) });
  }

  setWindow(m: number): void {
    this.months = m;
    if (this.memberId) this.loadMember(); else if (this.claimantsOf) this.loadClaimants();
  }

  /* From the claimants list into one member, keeping the product. */
  drill(m: any): void {
    const back = this.claimantsOf;
    this.openMember(m.memberId, back?.modelId ? [back.modelId] : [], back?.label ?? '');
  }

  /* Narrow the member view to one product, or back to all. */
  onlyProduct(modelId: number | null): void {
    this.modelIds = modelId ? [modelId] : [];
    this.loadMember();
  }

  get flagged(): any[] {
    return (this.member?.products ?? []).filter(p => p.claimedMoreThanBought || p.claimsWithNoPurchaseBefore > 0 || p.repeatedSerials > 0);
  }

  get totals(): any {
    const t = { unitsBought: 0, unitsClaimed: 0, approvedAmount: 0, declinedAmount: 0, supportAmount: 0, pendingAmount: 0 };
    for (const p of this.member?.products ?? []) for (const k of Object.keys(t)) (t as any)[k] += +p[k] || 0;
    return t;
  }

  get claimRate(): number | null {
    const t = this.totals;
    return t.unitsBought > 0 ? Math.round((t.unitsClaimed * 1000) / t.unitsBought) / 10 : null;
  }

  /* Debit memos show as a chip on the claim's lines, not as rows of their own. */
  get timelineShown(): any[] {
    return (this.member?.timeline ?? []).filter(e => e.kind !== 'DEBIT_MEMO' && this.timelineKinds[e.kind] !== false);
  }

  private dmCache: { src: any; map: Map<number, string> } | null = null;
  debitMemoFor(orderId: number | null): string | null {
    if (!orderId || !this.member) return null;
    if (!this.dmCache || this.dmCache.src !== this.member.timeline) {
      const map = new Map<number, string>();
      for (const e of this.member.timeline) if (e.kind === 'DEBIT_MEMO' && e.orderId) map.set(+e.orderId, String(e.text || '').replace(/^On debit memo\s*/, ''));
      this.dmCache = { src: this.member.timeline, map };
    }
    return this.dmCache.map.get(+orderId) ?? null;
  }

  productName(modelId: number | null): string {
    if (!modelId) return '';
    return this.member?.products.find(p => p.modelId === modelId)?.description ?? '#' + modelId;
  }

  private buildChart(): void {
    const rows = this.member?.months ?? [];
    if (!rows.length) { this.chartData = null; return; }
    this.chartData = {
      labels: rows.map(r => new Date(r.monthStart).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })),
      datasets: [
        { label: 'Units bought from PRO', data: rows.map(r => +r.unitsBought || 0), backgroundColor: '#1d4f91' },
        { label: 'Units claimed', data: rows.map(r => +r.unitsClaimed || 0), backgroundColor: '#d9822b' }
      ]
    };
  }

  exportMember(): void {
    if (!this.member) return;
    const name = `Investigate member ${this.memberId}`;
    downloadXlsx(name, [
      { name: 'Products', rows: this.member.products, cols: [
        col('Product #', 'modelId', 'number'), col('Product', 'description', 'text', 40), col('PRO code', 'proCodeText'), col('Vendor', 'vendorName'),
        col('Units bought', 'unitsBought', 'number'), col('Bought $', 'amountBought', 'money'), col('Units claimed', 'unitsClaimed', 'number'),
        col('Claims', 'claims', 'number'), col('Approved', 'approvedAmount', 'money'), col('Declined', 'declinedAmount', 'money'),
        col('Needs support', 'supportAmount', 'money'), col('Not decided', 'pendingAmount', 'money'),
        col('Claimed more than bought', 'claimedMoreThanBought'), col('Claims with no purchase before', 'claimsWithNoPurchaseBefore', 'number'),
        col('Repeated serials', 'repeatedSerials', 'number')] },
      { name: 'Months', rows: this.member.months, cols: [
        col('Month', 'monthStart', 'date'), col('Units bought', 'unitsBought', 'number'), col('Units claimed', 'unitsClaimed', 'number')] },
      { name: 'Timeline', rows: this.member.timeline.filter(e => e.kind !== 'DEBIT_MEMO'), cols: [
        col('When', 'at', 'datetime'), col('What', r => this.kindLabels[r.kind] ?? r.kind), col('Claim', 'orderId', 'number'),
        col('Debit memo', r => this.debitMemoFor(r.orderId)),
        col('Product', r => this.productName(r.modelId), 'text', 40), col('Detail', 'text', 'text', 50), col('Qty', 'quantity', 'number'),
        col('Amount', 'amount', 'money'), col('Note', 'detail', 'text', 50)] }
    ]);
  }

  exportClaimants(): void {
    if (!this.claimants) return;
    downloadXlsx(`Investigate ${this.claimantsOf?.label ?? ''}`.trim(), [{ name: 'Members', rows: this.claimants.members, cols: [
      col('Member', 'memberId', 'number'), col('Name', 'memberName', 'text', 30), col('Claims', 'claims', 'number'),
      col('Units claimed', 'unitsClaimed', 'number'), col('Units bought', 'unitsBought', 'number'), col('Claim rate %', 'claimRatePct', 'number'),
      col('Claimed $', 'amountClaimed', 'money'), col('Bought $', 'amountBought', 'money'),
      col('First claim', 'firstClaim', 'date'), col('Last claim', 'lastClaim', 'date'), col('Claimed more than bought', 'claimedMoreThanBought')] }]);
  }
}
