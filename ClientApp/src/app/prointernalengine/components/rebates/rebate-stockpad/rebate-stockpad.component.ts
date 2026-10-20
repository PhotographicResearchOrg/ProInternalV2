import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';
import { RebateDeskService, apiMessage } from 'src/app/services/rebate-desk.service';
import { col, downloadXlsx } from '../shared/rebate-excel';

/*
 * Stock padding (EDA.RebateOverride): units a member bought somewhere else (often direct from the
 * vendor) before stocking through PRO. Investigate counts them as available when it checks claims.
 * Here: add padding for a member and PRO code with a reason, look at the history, remove with a reason.
 * Nothing is edited in place or deleted; removed entries stay listed.
 */
@Component({
  selector: 'app-rebate-stockpad',
  templateUrl: './rebate-stockpad.component.html',
  styleUrls: ['../shared/rebate-desk.shared.scss']
})
export class RebateStockpadComponent implements OnChanges {
  /* Opened from Investigate: that member is filled in. */
  @Input() memberId: number | null = null;

  form = { memberId: null as number | null, proCode: null as number | null, quantity: null as number | null, reason: '' };
  productLabel = '';

  /* Member search (number or store name). */
  memberQ = '';
  memberHits: any[] = [];
  memberSearching = false;
  memberLabel = '';
  private memberQ$ = new Subject<string>();

  /* PRO product search for the code. */
  proQ = '';
  proHits: any[] = [];
  proSearching = false;
  private proQ$ = new Subject<string>();

  /* History filter: by member and/or PRO code; empty shows the latest entries. */
  filter = { memberId: null as number | null, proCode: null as number | null, showRemoved: true };
  rows: any[] = [];

  /* History filters: member and product search as you type, and free text over the loaded rows. */
  fMemberQ = ''; fMemberHits: any[] = []; fMemberLabel = '';
  fProQ = ''; fProHits: any[] = []; fProLabel = '';
  textQ = '';
  private filter$ = new Subject<{ kind: 'M' | 'P'; q: string }>();
  loading = false;
  busy = false;
  error = '';
  notice = '';
  removing: any = null;
  removeReason = '';

  constructor(private desk: RebateDeskService) {
    this.proQ$.pipe(
      debounceTime(300), distinctUntilChanged(),
      switchMap(q => {
        if ((q || '').trim().length < 2) { this.proSearching = false; return of([]); }
        this.proSearching = true;
        return this.desk.proCodes(q.trim()).pipe(catchError(() => of([])), finalize(() => (this.proSearching = false)));
      })
    ).subscribe(h => (this.proHits = (h ?? []).slice(0, 12)));
    this.memberQ$.pipe(
      debounceTime(300), distinctUntilChanged(),
      switchMap(q => {
        if ((q || '').trim().length < 2) { this.memberSearching = false; return of([]); }
        this.memberSearching = true;
        return this.desk.investigateFind(q.trim()).pipe(catchError(() => of([])), finalize(() => (this.memberSearching = false)));
      })
    ).subscribe(h => {
      const hits = (h ?? []).filter((x: any) => x.kind === 'MEMBER').slice(0, 12);
      /* A member number not in the name list yet (the nightly copy) can still be used as typed. */
      const n = parseInt((this.memberQ || '').trim(), 10);
      if (n > 0 && String(n) === this.memberQ.trim() && !hits.some((x: any) => +x.memberId === n))
        hits.unshift({ kind: 'MEMBER', memberId: n, label: `Member ${n}` });
      this.memberHits = hits;
    });
    this.filter$.pipe(
      debounceTime(300),
      switchMap(f => {
        const q = (f.q || '').trim();
        if (q.length < 2) return of({ kind: f.kind, q, hits: [] as any[] });
        const call = f.kind === 'M' ? this.desk.investigateFind(q) : this.desk.proCodes(q);
        return call.pipe(catchError(() => of([])), switchMap((h: any) => of({ kind: f.kind, q, hits: h ?? [] })));
      })
    ).subscribe(r => {
      if (r.kind === 'M') {
        const hits = r.hits.filter((x: any) => x.kind === 'MEMBER').slice(0, 12);
        const n = parseInt(r.q, 10);
        if (n > 0 && String(n) === r.q && !hits.some((x: any) => +x.memberId === n)) hits.unshift({ kind: 'MEMBER', memberId: n, label: `Member ${n}` });
        this.fMemberHits = hits;
      } else {
        this.fProHits = r.hits.slice(0, 12);
      }
    });
    this.load();
  }

  searchFilter(kind: 'M' | 'P', q: string): void {
    if (!q.trim()) {
      /* Emptying a box clears that filter. */
      if (kind === 'M' && this.filter.memberId) { this.filter.memberId = null; this.fMemberLabel = ''; this.load(); }
      if (kind === 'P' && this.filter.proCode) { this.filter.proCode = null; this.fProLabel = ''; this.load(); }
      kind === 'M' ? (this.fMemberHits = []) : (this.fProHits = []);
      return;
    }
    this.filter$.next({ kind, q });
  }

  filterMember(h: any): void {
    this.filter.memberId = +h.memberId; this.fMemberLabel = h.label; this.fMemberQ = ''; this.fMemberHits = []; this.load();
  }

  filterPro(h: any): void {
    this.filter.proCode = +h.productCode; this.fProLabel = `${h.productCode} · ${h.modelName ?? ''}`; this.fProQ = ''; this.fProHits = []; this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['memberId'] && this.memberId) {
      this.form.memberId = this.memberId;
      this.memberLabel = `Member ${this.memberId}`;
      this.filter.memberId = this.memberId;
      this.fMemberLabel = `Member ${this.memberId}`;
      this.load();
    }
  }

  searchPro(q: string): void { this.proQ$.next(q); }
  searchMember(q: string): void { this.memberQ$.next(q); }

  pickMember(h: any): void {
    this.form.memberId = +h.memberId;
    this.memberLabel = h.label;
    this.memberQ = '';
    this.memberHits = [];
    this.filter.memberId = this.form.memberId;
    this.fMemberLabel = h.label;
    this.load();
  }

  pickPro(h: any): void {
    this.form.proCode = +h.productCode;
    this.productLabel = `${h.productCode} · ${h.modelName ?? ''}`;
    this.proQ = '';
    this.proHits = [];
    if (!this.filter.proCode) { this.filter.proCode = this.form.proCode; this.fProLabel = this.productLabel; this.load(); }
  }

  get canSave(): boolean {
    const f = this.form;
    return !!f.memberId && !!f.proCode && !!f.quantity && !!f.reason.trim() && !this.busy;
  }

  save(): void {
    if (!this.canSave) return;
    const f = this.form;
    this.busy = true;
    this.error = '';
    this.desk.addStockPad({ memberId: +f.memberId!, proCode: +f.proCode!, quantity: +f.quantity!, reason: f.reason.trim() })
      .pipe(finalize(() => (this.busy = false)))
      .subscribe({
        next: () => {
          this.notice = `Added ${f.quantity} unit(s) of ${f.proCode} for member ${f.memberId}.`;
          this.filter.memberId = f.memberId;
          this.filter.proCode = f.proCode;
          this.form = { memberId: f.memberId, proCode: null, quantity: null, reason: '' };
          this.productLabel = '';
          this.load();
        },
        error: e => (this.error = apiMessage(e))
      });
  }

  load(): void {
    this.loading = true;
    this.desk.stockPads(this.filter.memberId, this.filter.proCode)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: r => (this.rows = r ?? []), error: e => (this.error = apiMessage(e)) });
  }

  clearFilter(): void {
    this.filter = { memberId: null, proCode: null, showRemoved: this.filter.showRemoved };
    this.fMemberLabel = ''; this.fProLabel = ''; this.fMemberQ = ''; this.fProQ = ''; this.textQ = '';
    this.load();
  }

  private shownCache: { rows: any[]; removed: boolean; q: string; out: any[] } | null = null;
  get shown(): any[] {
    const q = this.textQ.trim().toLowerCase();
    const c = this.shownCache;
    if (c && c.rows === this.rows && c.removed === this.filter.showRemoved && c.q === q) return c.out;
    let out = this.filter.showRemoved ? this.rows : this.rows.filter(r => !r.removedAt);
    if (q) out = out.filter(r => [r.memberId, r.memberName, r.proCode, r.productName, r.reason, r.createdBy, r.removedReason]
      .some(v => v != null && String(v).toLowerCase().includes(q)));
    this.shownCache = { rows: this.rows, removed: this.filter.showRemoved, q, out };
    return out;
  }

  /* Active units per member and code in the list. */
  get activeTotal(): number { return this.rows.filter(r => !r.removedAt).reduce((s, r) => s + (+r.quantity || 0), 0); }

  confirmRemove(): void {
    if (!this.removing || !this.removeReason.trim()) return;
    this.busy = true;
    this.error = '';
    this.desk.removeStockPad(this.removing.padId, this.removeReason.trim())
      .pipe(finalize(() => (this.busy = false)))
      .subscribe({ next: () => { this.removing = null; this.removeReason = ''; this.load(); }, error: e => (this.error = apiMessage(e)) });
  }

  trackPad = (_: number, d: any) => d.padId;

  exportRows(): void {
    downloadXlsx('Stock padding', [{ name: 'Stock padding', rows: this.shown, cols: [
      col('Member', 'memberId', 'number'), col('Dealer', 'memberName', 'text', 30), col('PRO code', 'proCode', 'number'),
      col('Product', 'productName', 'text', 35), col('Units', 'quantity', 'number'), col('Reason', 'reason', 'text', 50),
      col('Added by', 'createdBy'), col('Added', 'createdAt', 'datetime'), col('Removed by', 'removedBy'),
      col('Removed', 'removedAt', 'datetime'), col('Why removed', 'removedReason', 'text', 40)] }]);
  }
}
