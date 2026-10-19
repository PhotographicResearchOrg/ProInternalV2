import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';
import { RebateDeskService, apiMessage } from 'src/app/services/rebate-desk.service';
import { col, downloadXlsx } from '../shared/rebate-excel';
import { DEFAULT_MONTHS } from '../shared/rebate-window.component';

/*
 * Investigate (instant rebates): does what a member claimed match what they bought from PRO?
 *   Look up a claim #, a member (number or name), a rebate product or a vendor.
 *   A claim or a member opens the member view: per product bought against claimed,
 *   a month-by-month chart, one row per claim (decision, credit, debit memo, flags).
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
  /* Open a claim on the Claims screen. */
  @Output() openClaim = new EventEmitter<number>();

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
  member: { products: any[]; months: any[]; claims: any[]; purchases: any[]; about: any } | null = null;
  focusLabel = '';
  claimantsOf: { modelId?: number; vendorId?: number; label: string } | null = null;
  claimants: { members: any[]; about: any } | null = null;

  /* One chip at a time, like the rest of the desk. */
  claimChip = '';
  showPurchases = false;
  readonly claimChips = [
    { key: '', label: 'All' }, { key: 'APPROVED', label: 'Approved' }, { key: 'DECLINED', label: 'Declined' },
    { key: 'SUPPORT', label: 'Needs support' }, { key: 'OPEN', label: 'Not decided' },
    { key: 'NOT_IN_AR', label: 'Posted, not in AR' }, { key: 'NO_DM', label: 'Approved, no debit memo' }, { key: 'FLAGGED', label: 'Flagged' }
  ];

  claimState(c: any): string {
    return c.status === 1 ? 'APPROVED' : c.status === 2 ? 'DECLINED' : c.status === 3 ? 'SUPPORT' : 'OPEN';
  }

  stateLabel(c: any): string {
    return ({ APPROVED: 'Approved', DECLINED: 'Declined', SUPPORT: 'Needs support', OPEN: 'Not decided' } as any)[this.claimState(c)];
  }

  isFlagged(c: any): boolean { return !!c.serialAlsoOn || (+c.linesWithNoPurchaseBefore || 0) > 0; }

  private matches(c: any, key: string): boolean {
    switch (key) {
      case '': return true;
      case 'NOT_IN_AR': return c.status === 1 && !!c.markedPosted && !c.arInvoice;
      case 'NO_DM': return c.status === 1 && !c.debitMemo;
      case 'FLAGGED': return this.isFlagged(c);
      default: return this.claimState(c) === key;
    }
  }

  chipCount(key: string): number { return (this.member?.claims ?? []).filter(c => this.matches(c, key)).length; }

  get claimsShown(): any[] { return (this.member?.claims ?? []).filter(c => this.matches(c, this.claimChip)); }

  /* "Duplicate of 112299": the claim numbers in a decline reason, to open them. */
  claimRefs(reason: string | null): number[] {
    return [...new Set((String(reason ?? '').match(/\b\d{5,7}\b/g) ?? []).map(Number))];
  }

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
      case 'CLAIM': this.loadClaim(+h.key, h.memberId); break;
      case 'MEMBER': this.openMember(+h.memberId, [], ''); break;
      case 'PRODUCT': this.openClaimants({ modelId: +h.modelId, label: h.label }); break;
      case 'VENDOR': this.openClaimants({ vendorId: +h.vendorId, label: h.label }); break;
    }
  }

  /* A claim: its member, narrowed to the claim's products. */
  private loadClaim(orderId: number, memberId: number): void {
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
      { name: 'Claims', rows: this.member.claims, cols: [
        col('Claim', 'orderId', 'number'), col('Claimed', 'claimDate', 'date'), col('Product(s)', 'products', 'text', 45),
        col('Units', 'units', 'number'), col('Amount', 'amount', 'money'), col('Status', r => this.stateLabel(r)),
        col('Decided', 'decidedAt', 'date'), col('Decided by', 'decidedBy'), col('Reason', 'reason', 'text', 40),
        col('AR invoice', 'arInvoice'), col('Posted', 'arPostedAt', 'date'), col('Debit memo', 'debitMemo'),
        col('Serials', 'serials'), col('Serial also on', 'serialAlsoOn', 'text', 40),
        col('Lines with no purchase before', 'linesWithNoPurchaseBefore', 'number')] },
      { name: 'Purchases', rows: this.member.purchases, cols: [
        col('Month', 'monthStart', 'date'), col('Units', 'units', 'number'), col('Amount', 'amount', 'money')] }
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
