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

  /* PRO product search for the code. */
  proQ = '';
  proHits: any[] = [];
  proSearching = false;
  private proQ$ = new Subject<string>();

  /* History filter: by member and/or PRO code; empty shows the latest entries. */
  filter = { memberId: null as number | null, proCode: null as number | null, showRemoved: true };
  rows: any[] = [];
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
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['memberId'] && this.memberId) {
      this.form.memberId = this.memberId;
      this.filter.memberId = this.memberId;
      this.load();
    }
  }

  searchPro(q: string): void { this.proQ$.next(q); }

  pickPro(h: any): void {
    this.form.proCode = +h.productCode;
    this.productLabel = `${h.productCode} · ${h.modelName ?? ''}`;
    this.proQ = '';
    this.proHits = [];
    if (!this.filter.proCode) { this.filter.proCode = this.form.proCode; this.load(); }
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

  clearFilter(): void { this.filter = { memberId: null, proCode: null, showRemoved: this.filter.showRemoved }; this.load(); }

  get shown(): any[] { return this.filter.showRemoved ? this.rows : this.rows.filter(r => !r.removedAt); }

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
