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
  /* Manage this member's stock padding (the Stock padding view). */
  @Output() openStockPad = new EventEmitter<number>();

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
  member: { products: any[]; months: any[]; claims: any[]; purchases: any[]; about: any; linked: any[]; pads: any[] } | null = null;
  focusLabel = '';
  claimantsOf: { modelId?: number; vendorId?: number; label: string } | null = null;
  claimants: { members: any[]; about: any; codes?: any[] } | null = null;

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
    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Units' } } }
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
      next: r => { this.member = r; this.productChip = ''; this.productTake = 25; this.claimChip = ''; this.claimTake = 100; this.prepare(); this.buildChart(); },
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

  /* The product search on a member: that member and the picked rebate product (claimed or not). */
  pickProduct(p: any): void { if (p?.modelId) this.onlyProduct(+p.modelId); }

  /* Narrow the member view to one product, or back to all. */
  onlyProduct(modelId: number | null): void {
    this.modelIds = modelId ? [modelId] : [];
    this.loadMember();
  }

  /* ---- products: one chip at a time, the biggest gap first ---- */
  productChip = '';
  productTake = 25;
  readonly productChips = [
    { key: '', label: 'All' }, { key: 'FLAGGED', label: 'Flagged' }, { key: 'NONE', label: 'No PRO purchase on record' },
    { key: 'MORE', label: 'Claimed more than available' },
    { key: 'NOBUY', label: 'Claims before any purchase' }, { key: 'SERIAL', label: 'Repeated serial' }
  ];

  /* Available = bought (incl. linked models) + stock padding. */
  available(p: any): number { return (+p.unitsBought || 0) + (+p.unitsPadded || 0); }
  over(p: any): number { return Math.round((+p.unitsClaimed || 0) - this.available(p)); }

  private productIs(p: any, key: string): boolean {
    switch (key) {
      case '': return true;
      case 'NONE': return !!p.noPurchaseOnRecord;
      case 'MORE': return !!p.claimedMoreThanBought;
      case 'NOBUY': return (+p.claimsWithNoPurchaseBefore || 0) > 0;
      case 'SERIAL': return (+p.repeatedSerials || 0) > 0;
      case 'FLAGGED': return !!p.noPurchaseOnRecord || !!p.claimedMoreThanBought || (+p.claimsWithNoPurchaseBefore || 0) > 0 || (+p.repeatedSerials || 0) > 0;
      default: return true;
    }
  }

  flagCount(key: string): number { return (this.member?.products ?? []).filter(p => this.productIs(p, key)).length; }

  get productsShown(): any[] {
    return (this.member?.products ?? []).filter(p => this.productIs(p, this.productChip))
      .sort((a, b) => this.over(b) - this.over(a) || (+b.unitsClaimed || 0) - (+a.unitsClaimed || 0));
  }

  /* Bars on one scale: the largest bought or claimed figure among the products. */
  barPct(v: any): number {
    const max = Math.max(1, ...(this.member?.products ?? []).map(p => Math.max(this.available(p), +p.unitsClaimed || 0)));
    return Math.max(0, Math.min(100, ((+v || 0) / max) * 100));
  }

  /* ---- linked models (Product.ReplacementCode) ---- */
  linkedFor(modelId: number): any[] { return (this.member?.linked ?? []).filter(k => k.modelId === modelId); }
  get hasLinked(): boolean { return (this.member?.linked ?? []).some(k => k.isLinked); }
  get linkedRows(): any[] {
    const names = new Map((this.member?.products ?? []).map(p => [p.modelId, p.description]));
    return (this.member?.linked ?? []).filter(k => this.linkedFor(k.modelId).some(x => x.isLinked))
      .map(k => ({ ...k, product: names.get(k.modelId) ?? '' }));
  }

  /* ---- stock padding (EDA.RebateOverride): add with a reason, remove with a reason, both kept ---- */
  /* modelId: the product row the form opened under (null: in the Stock padding card). */
  padForm: { proCode: number | null; quantity: number | null; reason: string; modelId: number | null; label: string } | null = null;
  padBusy = false;
  padError = '';
  removing: any = null;
  removeReason = '';

  /* The PRO codes padding can go on: the products' own codes and their linked models. */
  get padCodes(): any[] {
    const seen = new Set<number>();
    return (this.member?.linked ?? []).filter(k => !seen.has(k.proCode) && seen.add(k.proCode))
      .map(k => ({ code: k.proCode, label: `${k.proCode} · ${k.productName ?? ''}${k.isLinked ? ' (linked model)' : ''}` }));
  }

  get activePads(): any[] { return (this.member?.pads ?? []).filter(p => !p.removedAt); }

  startPad(p?: any): void {
    const codes = p ? this.linkedFor(p.modelId).filter(k => !k.isLinked) : [];
    this.padForm = { proCode: codes[0]?.proCode ?? this.v.padCodes[0]?.code ?? null, quantity: null, reason: '',
                     modelId: p ? p.modelId : null, label: p ? p.description : '' };
    this.padError = '';
  }

  savePad(): void {
    const f = this.padForm;
    if (!f || !this.memberId || !f.proCode || !f.quantity || !f.reason.trim()) return;
    this.padBusy = true;
    this.padError = '';
    this.desk.addStockPad({ memberId: this.memberId, proCode: +f.proCode, quantity: +f.quantity, reason: f.reason.trim() })
      .pipe(finalize(() => (this.padBusy = false)))
      .subscribe({ next: () => { this.padForm = null; this.loadMember(); }, error: e => (this.padError = apiMessage(e)) });
  }

  confirmRemove(): void {
    if (!this.removing || !this.removeReason.trim()) return;
    this.padBusy = true;
    this.padError = '';
    this.desk.removeStockPad(this.removing.padId, this.removeReason.trim())
      .pipe(finalize(() => (this.padBusy = false)))
      .subscribe({ next: () => { this.removing = null; this.removeReason = ''; this.loadMember(); }, error: e => (this.padError = apiMessage(e)) });
  }

  /* ---- everything the page shows, worked out once per load or chip click (not on every screen refresh:
         recomputing lists and bars on each refresh redrew whole tables and could lock the browser) ---- */
  v: {
    totals: any; claimRate: number | null; flagCounts: { [k: string]: number }; chipCounts: { [k: string]: number };
    products: any[]; claims: any[]; linked: any[]; padCodes: any[]; hasLinked: boolean; flagged: number;
  } = { totals: {}, claimRate: null, flagCounts: {}, chipCounts: {}, products: [], claims: [], linked: [], padCodes: [], hasLinked: false, flagged: 0 };
  claimTake = 100;

  /* Per-row values that never change for a load. */
  private prepare(): void {
    const m = this.member;
    if (!m) return;
    const max = Math.max(1, ...m.products.map(p => Math.max(this.available(p), +p.unitsClaimed || 0)));
    for (const p of m.products) {
      p._avail = this.available(p);
      p._over = this.over(p);
      p._bA = Math.max(0, Math.min(100, (p._avail / max) * 100));
      p._bC = Math.min(100, ((+p.unitsClaimed || 0) / max) * 100);
    }
    for (const c of m.claims) {
      c._refs = this.claimRefs(c.reason);
      c._state = this.claimState(c);
      c._label = this.stateLabel(c);
    }
    const t = this.totals;
    const avail = t.unitsBought + t.unitsPadded;
    const names = new Map(m.products.map(p => [p.modelId, p.description]));
    const withLinks = new Set(m.linked.filter(k => k.isLinked).map(k => k.modelId));
    const seen = new Set<number>();
    this.v = {
      totals: t,
      claimRate: avail > 0 ? Math.round((t.unitsClaimed * 1000) / avail) / 10 : null,
      flagCounts: Object.fromEntries(this.productChips.map(c => [c.key, this.flagCount(c.key)])),
      chipCounts: Object.fromEntries(this.claimChips.map(c => [c.key, this.chipCount(c.key)])),
      flagged: this.flagged.length,
      hasLinked: withLinks.size > 0,
      linked: m.linked.filter(k => withLinks.has(k.modelId)).map(k => ({ ...k, product: names.get(k.modelId) ?? '' })),
      padCodes: m.linked.filter(k => !seen.has(k.proCode) && seen.add(k.proCode))
        .map(k => ({ code: k.proCode, label: `${k.proCode} · ${k.productName ?? ''}${k.isLinked ? ' (linked model)' : ''}` })),
      products: [],
      claims: []
    };
    this.recompute();
  }

  /* The filtered lists: after a chip click. */
  recompute(): void {
    if (!this.member) return;
    this.v.products = this.productsShown;
    this.v.claims = this.claimsShown;
  }

  trackModel = (_: number, p: any) => p.modelId;
  trackOrder = (_: number, c: any) => c.orderId;
  trackPad = (_: number, d: any) => d.padId;

  get flagged(): any[] {
    return (this.member?.products ?? []).filter(p => p.noPurchaseOnRecord || p.claimedMoreThanBought || p.claimsWithNoPurchaseBefore > 0 || p.repeatedSerials > 0);
  }

  get totals(): any {
    const t = { unitsBought: 0, unitsBoughtLinked: 0, unitsPadded: 0, unitsClaimed: 0, unitsDeclined: 0, approvedAmount: 0, declinedAmount: 0, supportAmount: 0, pendingAmount: 0 };
    for (const p of this.member?.products ?? []) for (const k of Object.keys(t)) (t as any)[k] += +p[k] || 0;
    return t;
  }

  get claimRate(): number | null {
    const t = this.totals;
    const avail = t.unitsBought + t.unitsPadded;
    return avail > 0 ? Math.round((t.unitsClaimed * 1000) / avail) / 10 : null;
  }

  /* Debit memos show as a chip on the claim's lines, not as rows of their own. */
  productName(modelId: number | null): string {
    if (!modelId) return '';
    return this.member?.products.find(p => p.modelId === modelId)?.description ?? '';
  }

  private buildChart(): void {
    const rows = this.member?.months ?? [];
    if (!rows.length) { this.chartData = null; return; }
    this.chartData = {
      labels: rows.map(r => new Date(r.monthStart).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })),
      datasets: [
        { label: 'Units bought from PRO', data: rows.map(r => +r.unitsBought || 0), backgroundColor: '#1d4f91', stack: 'bought' },
        { label: 'Stock padding (month entered)', data: rows.map(r => +r.unitsPadded || 0), backgroundColor: '#7fb2e5', stack: 'bought' },
        { label: 'Units claimed', data: rows.map(r => +r.unitsClaimed || 0), backgroundColor: '#d9822b', stack: 'claimed' },
        { label: 'Units declined', data: rows.map(r => +r.unitsDeclined || 0), backgroundColor: '#c0392b', stack: 'claimed' }
      ]
    };
  }

  exportMember(): void {
    if (!this.member) return;
    const name = `Investigate member ${this.memberId}`;
    downloadXlsx(name, [
      { name: 'Products', rows: this.member.products, cols: [
        col('Product', 'description', 'text', 40), col('PRO code', 'proCodeText'), col('Vendor', 'vendorName'),
        col('Units bought', 'unitsBought', 'number'), col('Of which via linked models', 'unitsBoughtLinked', 'number'), col('Bought $', 'amountBought', 'money'),
        col('Stock padding', 'unitsPadded', 'number'), col('Padding reasons', 'padReasons', 'text', 50), col('Units claimed (not declined)', 'unitsClaimed', 'number'),
        col('Units declined', 'unitsDeclined', 'number'),
        col('Claims', 'claims', 'number'), col('Approved', 'approvedAmount', 'money'), col('Declined', 'declinedAmount', 'money'),
        col('Needs support', 'supportAmount', 'money'), col('Not decided', 'pendingAmount', 'money'),
        col('No PRO purchase on record', 'noPurchaseOnRecord'),
        col('Claimed more than bought', 'claimedMoreThanBought'), col('Claims with no purchase before', 'claimsWithNoPurchaseBefore', 'number'),
        col('Repeated serials', 'repeatedSerials', 'number')] },
      { name: 'Months', rows: this.member.months, cols: [
        col('Month', 'monthStart', 'date'), col('Units bought', 'unitsBought', 'number'), col('Units claimed (not declined)', 'unitsClaimed', 'number'),
        col('Units declined', 'unitsDeclined', 'number')] },
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
      col('Units bought', 'unitsBought', 'number'), col('Of which via linked models', 'unitsBoughtLinked', 'number'), col('Stock padding', 'unitsPadded', 'number'),
      col('Padding reasons', 'padReasons', 'text', 40), col('Available', 'unitsAvailable', 'number'), col('Units claimed', 'unitsClaimed', 'number'),
      col('Net available', 'netAvailable', 'number'), col('Claim rate %', 'claimRatePct', 'number'),
      col('Claimed $', 'amountClaimed', 'money'), col('Bought $', 'amountBought', 'money'),
      col('First claim', 'firstClaim', 'date'), col('Last claim', 'lastClaim', 'date'),
      col('No PRO purchase on record', 'noPurchaseOnRecord'), col('Claimed more than available', 'claimedMoreThanBought')] }]);
  }
}
