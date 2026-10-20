import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';
import { Rail, RebateDeskService, apiMessage } from 'src/app/services/rebate-desk.service';
import { col, downloadXlsx, fetchAllPages } from '../shared/rebate-excel';

/*
 * Rebate products (RebateCameraModels) on one rail: what members claim
 * against. A product covers one or more PRO codes; programs point at the
 * product. Stacks say which products this one qualifies with.
 */
@Component({
  selector: 'app-rebate-products',
  templateUrl: './rebate-products.component.html',
  styleUrls: ['../shared/rebate-desk.shared.scss']
})
export class RebateProductsComponent implements OnChanges {
  @Input() rail: Rail = 'IR';
  @Output() dirtyChange = new EventEmitter<boolean>();
  @Output() showPrograms = new EventEmitter<number>();

  vendors: any[] = [];
  filter = { vendorId: null as number | null, q: '', active: 'true' };
  page = 1;
  pageSize = 50;
  total = 0;
  rows: any[] = [];
  loading = false;

  /* The open product, or a new one (modelId null). */
  detail: { product: any; proCodes: any[]; stacks: any[]; programs: any[] } | null = null;
  form: any = null;
  saved: any = null;
  stackEdit: any[] = [];
  creating = false;

  codeSearch = '';
  codeResults: any[] = [];
  private codeSearch$ = new Subject<string>();

  pending: { kind: 'save' | 'active' | 'stacks'; active?: boolean } | null = null;
  busy = false;
  error = '';
  notice = '';

    /* Search as you type: runs a moment after the last key. */
  private searchTimer: any;
  searchSoon(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.go(1), 350);
  }

  exporting = false;

  async exportExcel(): Promise<void> {
    this.exporting = true;
    try {
      const rows = await fetchAllPages((page, pageSize) => this.desk.products(this.rail, {
        vendorId: this.filter.vendorId, q: this.filter.q, active: this.filter.active, page, pageSize }));
      downloadXlsx(this.rail === 'PP' ? 'Price-protection products' : 'Rebate products', [{ name: 'Products', rows, cols: [
        col('Description', 'description', 'text', 45), col('Primary PRO code', 'proCodeText'),
        col('PRO codes', 'proCodes'), col('Vendor', 'vendorName'), col('Active', 'isActive'), col('Serials required', 'serialNumbersRequired'),
        col('Live programs', 'programsLive', 'number'), col('Last program', 'lastProgramDate', 'date'), col('Stacks', 'stacks', 'number')] }]);
    } catch (e) { this.error = apiMessage(e); } finally { this.exporting = false; }
  }

  constructor(private desk: RebateDeskService) {
    this.codeSearch$.pipe(
      debounceTime(250), distinctUntilChanged(),
      switchMap(q => this.desk.proCodes(q))
    ).subscribe({ next: r => (this.codeResults = r), error: () => (this.codeResults = []) });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rail']) {
      this.desk.vendors(this.rail).subscribe(v => (this.vendors = v));
      this.close();
      this.go(1);
    }
  }

  get pages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }

  go(p: number): void {
    this.page = Math.min(Math.max(1, p), this.pages);
    this.loading = true;
    this.desk.products(this.rail, {
      vendorId: this.filter.vendorId, q: this.filter.q, active: this.filter.active, page: this.page, pageSize: this.pageSize
    }).pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: r => { this.rows = r.rows; this.total = r.total; }, error: e => (this.error = apiMessage(e)) });
  }

  open(modelId: number): void {
    this.creating = false;
    this.error = '';
    this.desk.product(modelId).subscribe({
      next: d => {
        this.detail = d;
        this.form = {
          vendorId: d.product.vendorId,
          description: d.product.description,
          proCodes: d.proCodes.map(c => c.proCode).join(', '),
          serialNumbersRequired: !!d.product.serialNumbersRequired
        };
        this.saved = { ...this.form };
        this.stackEdit = d.stacks.filter(s => s.direction === 'OUT').map(s => ({ ...s }));
        this.dirtyChange.emit(false);
      },
      error: e => (this.error = apiMessage(e))
    });
  }

  startNew(): void {
    this.detail = null;
    this.creating = true;
    this.form = { vendorId: this.filter.vendorId, description: '', proCodes: '', serialNumbersRequired: false };
    this.saved = { ...this.form };
    this.error = '';
  }

  close(): void {
    this.detail = null;
    this.creating = false;
    this.form = null;
    this.dirtyChange.emit(false);
  }

  get dirty(): boolean {
    return !!this.form && JSON.stringify(this.form) !== JSON.stringify(this.saved);
  }

  get stacksDirty(): boolean {
    if (!this.detail) return false;
    const before = this.detail.stacks.filter(s => s.direction === 'OUT').map(s => s.modelId).sort().join(',');
    return before !== this.stackEdit.map(s => s.modelId).sort().join(',');
  }

  changed(): void { this.dirtyChange.emit(this.dirty || this.stacksDirty); }

  discard(): void {
    if (this.creating) { this.close(); return; }
    this.form = { ...this.saved };
    if (this.detail) this.stackEdit = this.detail.stacks.filter(s => s.direction === 'OUT').map(s => ({ ...s }));
    this.dirtyChange.emit(false);
  }

  searchCodes(q: string): void {
    this.codeSearch = q;
    if (q && q.trim().length >= 2) this.codeSearch$.next(q.trim()); else this.codeResults = [];
  }

  addCode(code: string): void {
    const list = String(this.form.proCodes || '').split(',').map((s: string) => s.trim()).filter((s: string) => s);
    if (!list.includes(String(code))) list.push(String(code));
    this.form.proCodes = list.join(', ');
    if (!this.form.description && this.codeResults.length) {
      const hit = this.codeResults.find(r => r.productCode === code);
      if (hit?.modelName) this.form.description = hit.modelName;
    }
    this.codeResults = [];
    this.codeSearch = '';
    this.changed();
  }

  addStack(p: any): void {
    if (!this.detail || p.modelId === this.detail.product.modelId) return;
    if (!this.stackEdit.some(s => s.modelId === p.modelId))
      this.stackEdit.push({ modelId: p.modelId, description: p.description, proCodeText: p.proCodeText });
    this.changed();
  }

  removeStack(modelId: number): void {
    this.stackEdit = this.stackEdit.filter(s => s.modelId !== modelId);
    this.changed();
  }

  /* New products need no reason; changes to existing ones do. */
  save(): void {
    if (this.creating) { this.confirm(''); return; }
    this.pending = { kind: 'save' };
  }

  askActive(active: boolean): void { this.pending = { kind: 'active', active }; }
  askStacks(): void { this.pending = { kind: 'stacks' }; }

  get pendingTitle(): string {
    if (!this.pending) return '';
    if (this.pending.kind === 'save') return 'Save product';
    if (this.pending.kind === 'stacks') return 'Save stacks';
    return this.pending.active ? 'Reactivate product' : 'Retire product';
  }

  confirm(reason: string): void {
    this.busy = true;
    this.error = '';
    const kind = this.pending?.kind ?? 'save';
    const body = { rail: this.rail, ...this.form, reason };
    let call;
    if (kind === 'active') call = this.desk.setProductActive(this.detail!.product.modelId, !!this.pending!.active, reason);
    else if (kind === 'stacks') call = this.desk.setStacks(this.detail!.product.modelId, this.stackEdit.map(s => s.modelId), reason);
    else call = this.creating ? this.desk.addProduct(body) : this.desk.changeProduct(this.detail!.product.modelId, body);

    call.pipe(finalize(() => (this.busy = false))).subscribe({
      next: (r: any) => {
        this.pending = null;
        const id = r?.modelId ?? this.detail?.product.modelId;
        this.notice = r?.unknownProCodes ? `Saved. Not found in PRO products: ${r.unknownProCodes}. Check the codes.` : 'Saved.';
        this.go(this.page);
        if (id) this.open(id);
      },
      error: e => (this.error = apiMessage(e))
    });
  }
}
