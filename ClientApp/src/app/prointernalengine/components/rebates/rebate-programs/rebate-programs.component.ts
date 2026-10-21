import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { Rail, RebateDeskService, apiMessage, isoDate } from 'src/app/services/rebate-desk.service';
import { IR_PROGRAM_COLS, PP_PROGRAM_COLS, downloadXlsx, fetchAllPages } from '../shared/rebate-excel';
import { DEFAULT_MONTHS } from '../shared/rebate-window.component';
import { rdSortParams, rdSorts } from '../shared/rebate-sort';

type Pending =
  | { kind: 'active'; program: any; active: boolean }
  | { kind: 'amounts' }
  | { kind: 'dates' }
  | null;

/*
 * Programs on one rail.
 *   Instant rebates: every RebateProgramDetail row (legacy ones too), open or
 *   close, extend one program, change amounts, manual entry with weekly repeats.
 *   Price protection: every PriceProtectionDetails row, open or close, change,
 *   add one.
 * Changes need a reason and are kept in the history.
 */
@Component({
  selector: 'app-rebate-programs',
  templateUrl: './rebate-programs.component.html',
  styleUrls: ['../shared/rebate-desk.shared.scss']
})
export class RebateProgramsComponent implements OnInit, OnChanges {
  readonly sorts = rdSorts();
  @Input() rail: Rail = 'IR';
  @Input() modelId: number | null = null;
  @Input() batchId: number | null = null;
  /* Opened in the drawer once the list arrives (e.g. a program clicked in a batch). */
  @Input() openProgramId: number | null = null;

  vendors: any[] = [];
  types: any[] = [];

  filter = { vendorId: null as number | null, state: 'ON', when: '', q: '', from: '', to: '', months: DEFAULT_MONTHS };
  page = 1;
  pageSize = 50;
  total = 0;
  rows: any[] = [];
  loading = false;

  selected: any = null;
  edit: any = {};
  history: any[] = [];

  adding = false;
  add: any = {};
  addProduct: any = null;

  pending: Pending = null;
  busy = false;
  error = '';
  notice = '';

    /* Search as you type: runs a moment after the last key. */
  private searchTimer: any;
  searchSoon(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.go(1), 350);
  }

  constructor(private desk: RebateDeskService) {}

  ngOnInit(): void {
    this.desk.types().subscribe(t => (this.types = t));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rail']) {
      this.desk.vendors(this.rail).subscribe(v => (this.vendors = v));
      this.selected = null;
      this.adding = false;
    }
    if (changes['modelId'] || changes['batchId']) this.filter.state = this.modelId || this.batchId ? '' : 'ON';
    this.page = 1;
    this.refresh();
  }

  get pages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }

  refresh(): void {
    this.loading = true;
    const f: any = {
      vendorId: this.filter.vendorId, modelId: this.modelId, state: this.filter.state, q: this.filter.q, months: this.modelId ? 0 : this.filter.months,
      page: this.page, pageSize: this.pageSize, ...rdSortParams(this.sorts['programs'])
    };
    if (this.rail === 'IR') { f.when = this.filter.when; f.batchId = this.batchId; }
    else { f.from = this.filter.from; f.to = this.filter.to; }
    this.desk.programs(this.rail, f)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: r => {
          this.rows = r.rows;
          this.total = r.total;
          if (this.openProgramId) {
            const p = r.rows.find(x => x.programId === this.openProgramId);
            this.openProgramId = null;
            if (p) this.open(p);
          }
        },
        error: e => (this.error = apiMessage(e))
      });
  }

  exporting = false;

  /* Every program matching the filters, not just this page. */
  async exportExcel(): Promise<void> {
    this.exporting = true;
    try {
      const f: any = { vendorId: this.filter.vendorId, modelId: this.modelId, state: this.filter.state, q: this.filter.q };
      if (this.rail === 'IR') { f.when = this.filter.when; f.batchId = this.batchId; } else { f.from = this.filter.from; f.to = this.filter.to; }
      const rows = await fetchAllPages((page, pageSize) => this.desk.programs(this.rail, { ...f, ...rdSortParams(this.sorts['programs']), page, pageSize }), 500);
      downloadXlsx(this.rail === 'PP' ? 'Price-protection programs' : 'Instant-rebate programs',
        [{ name: 'Programs', cols: this.rail === 'PP' ? PP_PROGRAM_COLS : IR_PROGRAM_COLS, rows }]);
    } catch (e) { this.error = apiMessage(e); } finally { this.exporting = false; }
  }

  /* Shortcuts for the filters above (server-side, so Excel follows them too). */
  get chips(): { label: string; state: string; when: string }[] {
    return this.rail === 'IR'
      ? [{ label: 'On', state: 'ON', when: '' }, { label: 'Running today', state: 'ON', when: 'CURRENT' },
         { label: 'Starts later', state: 'ON', when: 'FUTURE' }, { label: 'Ending in 14 days', state: 'ON', when: 'ENDING' },
         { label: 'Off', state: 'OFF', when: '' }, { label: 'Ended', state: '', when: 'PAST' }, { label: 'Everything', state: '', when: '' }]
      : [{ label: 'On', state: 'ON', when: '' }, { label: 'Off', state: 'OFF', when: '' }, { label: 'Everything', state: '', when: '' }];
  }

  chipOn(c: { state: string; when: string }): boolean {
    return (this.filter.state || '') === c.state && (this.rail === 'PP' || (this.filter.when || '') === c.when);
  }

  useChip(c: { state: string; when: string }): void {
    this.filter.state = c.state;
    if (this.rail === 'IR') this.filter.when = c.when;
    this.go(1);
  }

  go(p: number): void { this.page = Math.min(Math.max(1, p), this.pages); this.refresh(); }

  open(p: any): void {
    this.adding = false;
    this.selected = p;
    this.edit = this.rail === 'IR'
      ? { instantRebate: p.instantRebate, vendorShare: p.vendorShare ?? p.reimbursement, proPad: p.proPad ?? 0, mapPrice: p.mapPrice,
          startDate: isoDate(p.startDate), endDate: isoDate(p.endDate), expireOn: isoDate(p.expireOn) }
      : { programDate: isoDate(p.programDate), newInvoiceCost: p.newInvoiceCost, amount: p.amount, newMap: p.mapPrice };
    this.error = '';
    this.desk.history({ rail: this.rail, programId: p.programId, take: 50 }).subscribe(h => (this.history = h));
  }

  close(): void { this.selected = null; }

  /* Which kind of change is pending in the drawer. */
  get amountsDirty(): boolean {
    if (!this.selected) return false;
    if (this.rail === 'PP') {
      return +this.edit.newInvoiceCost !== +this.selected.newInvoiceCost || +this.edit.amount !== +this.selected.amount
        || +this.edit.newMap !== +this.selected.mapPrice || this.edit.programDate !== isoDate(this.selected.programDate);
    }
    return +this.edit.instantRebate !== +this.selected.instantRebate || +this.edit.vendorShare !== +(this.selected.vendorShare ?? this.selected.reimbursement)
      || +this.edit.proPad !== +(this.selected.proPad ?? 0) || +this.edit.mapPrice !== +this.selected.mapPrice;
  }

  get datesDirty(): boolean {
    if (!this.selected || this.rail === 'PP') return false;
    return this.edit.startDate !== isoDate(this.selected.startDate) || this.edit.endDate !== isoDate(this.selected.endDate)
      || this.edit.expireOn !== isoDate(this.selected.expireOn);
  }

  get dirty(): boolean { return this.amountsDirty || this.datesDirty || this.adding; }

  discard(): void { if (this.selected) this.open(this.selected); }

  askActive(p: any, active: boolean): void { this.pending = { kind: 'active', program: p, active }; this.error = ''; }
  askAmounts(): void { this.pending = { kind: 'amounts' }; this.error = ''; }
  askDates(): void { this.pending = { kind: 'dates' }; this.error = ''; }

  get pendingTitle(): string {
    const p = this.pending;
    if (!p) return '';
    if (p.kind === 'active') return p.active ? `Turn program ${p.program.programId} on` : `Turn program ${p.program.programId} off`;
    if (p.kind === 'amounts') return this.rail === 'PP' ? 'Change price protection' : 'Change amounts';
    return 'Change dates';
  }

  get pendingDetail(): string {
    const p = this.pending;
    if (!p) return '';
    if (p.kind === 'active') return p.active ? 'Members will see it again.' : 'Members stop seeing it. Claims already submitted are not affected.';
    if (p.kind === 'amounts') return 'Claims already submitted keep the amount they were submitted with.';
    return this.selected?.batchId
      ? `Members see a program as vendor + exact dates. This program will show on its own, apart from the rest of batch ${this.selected.batchId}. To move the whole batch, use Batches.`
      : 'Members see a program as vendor + exact dates.';
  }

  confirm(reason: string): void {
    const p = this.pending;
    if (!p) return;
    this.busy = true;
    this.error = '';
    let call;
    if (p.kind === 'active') {
      call = this.desk.setProgramActive(this.rail, p.program.programId, p.active, reason);
    } else if (p.kind === 'amounts') {
      call = this.rail === 'PP'
        ? this.desk.changePriceProtection(this.selected.programId, { modelId: this.selected.modelId, ...this.edit, reason })
        : this.desk.changeAmounts(this.selected.programId,
            { instantRebate: this.edit.instantRebate, vendorShare: this.edit.vendorShare, proPad: this.edit.proPad || 0, mapPrice: this.edit.mapPrice, reason });
    } else {
      call = this.desk.changeProgramDates(this.selected.programId,
        { startDate: this.edit.startDate, endDate: this.edit.endDate, expireOn: this.edit.expireOn || null, reason });
    }
    call.pipe(finalize(() => (this.busy = false))).subscribe({
      next: () => {
        this.pending = null;
        this.notice = 'Saved.';
        const id = this.selected?.programId;
        this.refreshKeep(id);
      },
      error: e => (this.error = apiMessage(e))
    });
  }

  private refreshKeep(programId?: number): void {
    this.loading = true;
    const f: any = { vendorId: this.filter.vendorId, modelId: this.modelId, state: this.filter.state, q: this.filter.q, months: this.modelId ? 0 : this.filter.months, page: this.page, pageSize: this.pageSize, ...rdSortParams(this.sorts['programs']) };
    if (this.rail === 'IR') { f.when = this.filter.when; f.batchId = this.batchId; }
    this.desk.programs(this.rail, f).pipe(finalize(() => (this.loading = false))).subscribe(r => {
      this.rows = r.rows;
      this.total = r.total;
      const again = r.rows.find(x => x.programId === programId);
      if (again) this.open(again); else if (programId) this.close();
    });
  }

  /* ---- manual entry ---- */

  startAdd(): void {
    this.selected = null;
    this.adding = true;
    this.addProduct = null;
    this.error = '';
    const today = new Date().toISOString().substring(0, 10);
    this.add = this.rail === 'IR'
      ? { irType: 2, instantRebate: 0, reimbursement: null, proPad: 0, mapPrice: 0, startDate: today, endDate: today, expireOn: '', repeatWeeks: 0, startActive: false, reason: '' }
      : { programDate: today, newInvoiceCost: 0, amount: null, newMap: 0, startActive: false, reason: '' };
  }

  saveAdd(): void {
    if (!this.addProduct) { this.error = 'Pick a product.'; return; }
    this.busy = true;
    this.error = '';
    const call = this.rail === 'IR'
      ? this.desk.addPrograms({ modelId: this.addProduct.modelId, ...this.add })
      : this.desk.addPriceProtection({ modelId: this.addProduct.modelId, ...this.add });
    call.pipe(finalize(() => (this.busy = false))).subscribe({
      next: r => {
        this.adding = false;
        this.notice = this.rail === 'IR'
          ? `Added ${r?.added ?? ''} program(s) as batch ${r?.batchId ?? ''}${r?.skippedExisting ? `; ${r.skippedExisting} week(s) already existed` : ''}.`
          : 'Price protection added.';
        this.refresh();
      },
      error: e => (this.error = apiMessage(e))
    });
  }

  get memberAmount(): number {
    return (+this.edit.vendorShare || 0) + (+this.edit.proPad || 0);
  }

  addEndChanged(): void {
    if (this.rail === 'IR' && this.add.endDate) {
      const d = new Date(this.add.endDate + 'T00:00:00');
      d.setDate(d.getDate() + 60);
      this.add.expireOn = d.toISOString().substring(0, 10);
    }
  }
}
