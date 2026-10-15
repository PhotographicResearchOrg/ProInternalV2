import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { DataService } from 'src/app/services/data.service';
import { Rail, RebateDeskService, apiMessage, isoDate } from 'src/app/services/rebate-desk.service';

type ViewKey =
  | 'overview' | 'upload' | 'uploads' | 'purgatory' | 'programs' | 'batches' | 'products' | 'vendors'
  | 'templates' | 'declines' | 'history'
  | 'pp-programs' | 'pp-products' | 'pp-vendors' | 'pp-history';

interface RailView { key: ViewKey; label: string; icon: string; group: 'IR' | 'PP'; count?: () => number; hot?: boolean; }

type Pending =
  | { kind: 'skip'; row: any }
  | { kind: 'cancel-upload' }
  | { kind: 'batch-active'; batch: any; active: boolean }
  | { kind: 'batch-dates' }
  | { kind: 'retire-template'; template: any }
  | null;

/*
 * Rebate Desk (/rebatedesk). Two rails, the Product Desk format:
 *   Instant rebates   overview, new upload (interview), uploads and review,
 *                     purgatory, programs, batches, products, vendors and
 *                     liability, templates, declined claims, history
 *   Price protection  programs, products, vendors and liability, history
 * Rows that fail a check go to purgatory and stay there until fixed,
 * skipped with a reason, or loaded.
 */
@Component({
  selector: 'app-rebate-desk',
  templateUrl: './rebate-desk.component.html',
  styleUrls: ['../shared/rebate-desk.shared.scss']
})
export class RebateDeskComponent implements OnInit {
  overview: any = {};

  readonly views: RailView[] = [
    { key: 'overview', label: 'Overview', icon: 'pi pi-home', group: 'IR' },
    { key: 'upload', label: 'New upload', icon: 'pi pi-upload', group: 'IR' },
    { key: 'uploads', label: 'Uploads', icon: 'pi pi-inbox', group: 'IR', count: () => this.overview.uploadsOpen || 0 },
    { key: 'purgatory', label: 'Purgatory', icon: 'pi pi-exclamation-triangle', group: 'IR', count: () => this.overview.purgatoryRows || 0, hot: true },
    { key: 'programs', label: 'Programs', icon: 'pi pi-list', group: 'IR', count: () => this.overview.programsLive || 0 },
    { key: 'batches', label: 'Batches', icon: 'pi pi-box', group: 'IR' },
    { key: 'products', label: 'Products', icon: 'pi pi-tags', group: 'IR' },
    { key: 'vendors', label: 'Vendors & liability', icon: 'pi pi-building', group: 'IR' },
    { key: 'templates', label: 'Templates', icon: 'pi pi-table', group: 'IR', count: () => this.overview.templates || 0 },
    { key: 'declines', label: 'Declined claims', icon: 'pi pi-ban', group: 'IR' },
    { key: 'history', label: 'History', icon: 'pi pi-history', group: 'IR' },
    { key: 'pp-programs', label: 'Programs', icon: 'pi pi-list', group: 'PP', count: () => this.overview.priceProtectionLive || 0 },
    { key: 'pp-products', label: 'Products', icon: 'pi pi-tags', group: 'PP' },
    { key: 'pp-vendors', label: 'Vendors & liability', icon: 'pi pi-building', group: 'PP' },
    { key: 'pp-history', label: 'History', icon: 'pi pi-history', group: 'PP' }
  ];

  view: ViewKey = 'overview';
  childDirty = false;

  /* Filters handed to the programs view from products and vendors. */
  programModelId: number | null = null;
  programBatchId: number | null = null;

  types: any[] = [];

  /* ---- uploads ---- */
  uploads: any[] = [];
  uploadStatus = '';
  upload: any = null;
  uploadRows: any[] = [];
  rowFilter: 'ALL' | 'READY' | 'PURGATORY' | 'LOADED' | 'SKIPPED' = 'ALL';
  remapUploadId: number | null = null;

  /* ---- purgatory ---- */
  purgatory: any[] = [];
  purgatoryVendorId: number | null = null;
  vendors: any[] = [];

  /* ---- one row (from an upload or purgatory) ---- */
  row: any = null;
  rowEdit: any = {};
  rowVendorId: number | null = null;
  newProduct: any = null;

  /* ---- batches ---- */
  batchFilter = { q: '', vendorId: null as number | null, state: 'LIVE' };
  batches: any[] = [];
  batchTotal = 0;
  batchPage = 1;
  batch: any = null;
  batchPrograms: any[] = [];
  batchDates: any = {};
  batchHistory: any[] = [];

  /* ---- templates, declines, history ---- */
  templates: any[] = [];
  declines: any[] = [];
  readonly declineCols = [
    { header: 'Order_ID', field: 'orderID' }, { header: 'Decline_Date', field: 'processDate' },
    { header: 'IR_Total', field: 'total' }, { header: 'Reject_Reason', field: 'rejectReason' },
    { header: 'Member', field: 'memberID' }, { header: 'Model', field: 'model' },
    { header: 'Quantity', field: 'quantity' }, { header: 'EMail', field: 'eMail' }
  ];
  history: any[] = [];

  pending: Pending = null;
  loading = false;
  busy = false;
  error = '';
  notice = '';

  constructor(
    private desk: RebateDeskService,
    private data: DataService,
    private route: ActivatedRoute,
    private router: Router) {}

  ngOnInit(): void {
    this.desk.types().subscribe(t => (this.types = t));
    this.desk.vendors('IR').subscribe(v => (this.vendors = v));
    this.loadOverview();
    const v = this.route.snapshot.queryParamMap.get('view') as ViewKey | null;
    const id = Number(this.route.snapshot.queryParamMap.get('upload'));
    if (id) this.openUpload(id);
    else if (v && this.views.some(x => x.key === v)) this.pick(v);
  }

  /* ---------------- navigation ---------------- */

  get irViews(): RailView[] { return this.views.filter(v => v.group === 'IR'); }
  get ppViews(): RailView[] { return this.views.filter(v => v.group === 'PP'); }
  get rail(): Rail { return this.view.startsWith('pp-') ? 'PP' : 'IR'; }

  get dirty(): boolean { return this.childDirty || this.rowDirty || this.batchDatesDirty; }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(e: BeforeUnloadEvent): void {
    if (this.dirty) { e.preventDefault(); e.returnValue = ''; }
  }

  private leaveOk(): boolean {
    return !this.dirty || confirm('You have unsaved changes. Leave without saving?');
  }

  pick(key: ViewKey, keepFilters = false): void {
    if (key !== this.view && !this.leaveOk()) return;
    this.childDirty = false;
    this.view = key;
    this.error = '';
    this.row = null;
    this.newProduct = null;
    if (!keepFilters) { this.programModelId = null; this.programBatchId = null; }
    if (key !== 'uploads') this.upload = null;
    if (key !== 'upload') this.remapUploadId = null;
    this.router.navigate([], { queryParams: { view: key }, replaceUrl: true });

    switch (key) {
      case 'overview': this.loadOverview(); break;
      case 'uploads': this.loadUploads(); break;
      case 'purgatory': this.loadPurgatory(); break;
      case 'batches': this.loadBatches(1); break;
      case 'templates': this.desk.templates().subscribe(t => (this.templates = t)); break;
      case 'declines': this.data.GetDeclinedInstantRebates().subscribe(d => (this.declines = d as any[])); break;
      case 'history': case 'pp-history': this.loadHistory(); break;
    }
  }

  showPrograms(f: { vendorId?: number; modelId?: number; batchId?: number }, rail: Rail = this.rail): void {
    const target: ViewKey = rail === 'PP' ? 'pp-programs' : 'programs';
    if (!this.leaveOk()) return;
    this.childDirty = false;
    this.programModelId = f.modelId ?? null;
    this.programBatchId = f.batchId ?? null;
    this.pick(target, true);
  }

  loadOverview(): void {
    this.desk.overview().subscribe({ next: o => (this.overview = o || {}), error: e => (this.error = apiMessage(e)) });
  }

  /* ---------------- uploads ---------------- */

  loadUploads(): void {
    this.loading = true;
    this.desk.uploads(this.uploadStatus).pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: u => (this.uploads = u), error: e => (this.error = apiMessage(e)) });
  }

  onMapped(uploadId: number): void {
    this.childDirty = false;
    this.notice = 'Rows checked. Review them, fix or skip what is in purgatory, then load.';
    this.loadOverview();
    this.openUpload(uploadId);
  }

  openUpload(id: number): void {
    this.view = 'uploads';
    this.row = null;
    this.loading = true;
    this.desk.getUpload(id).pipe(finalize(() => (this.loading = false))).subscribe({
      next: d => {
        this.upload = d.upload;
        this.uploadRows = d.rows;
        this.rowFilter = (d.upload?.rowsPurgatory ?? 0) > 0 ? 'PURGATORY' : 'ALL';
        this.router.navigate([], { queryParams: { upload: id }, replaceUrl: true });
      },
      error: e => (this.error = apiMessage(e))
    });
  }

  get filteredRows(): any[] {
    return this.rowFilter === 'ALL' ? this.uploadRows : this.uploadRows.filter(r => r.status === this.rowFilter);
  }

  remap(): void {
    if (!this.upload) return;
    this.remapUploadId = this.upload.uploadId;
    this.view = 'upload';
  }

  loadReady(): void {
    if (!this.upload) return;
    this.busy = true;
    this.error = '';
    this.desk.load(this.upload.uploadId).pipe(finalize(() => (this.busy = false))).subscribe({
      next: r => {
        this.notice = `Loaded ${r.loaded} program(s) as batch ${r.batchId}.` + (r.inPurgatory ? ` ${r.inPurgatory} row(s) still in purgatory.` : '');
        this.loadOverview();
        this.openUpload(this.upload.uploadId);
      },
      error: e => (this.error = apiMessage(e))
    });
  }

  openFile(): void {
    if (!this.upload) return;
    this.desk.uploadFile(this.upload.uploadId).subscribe({ next: r => window.open(r.url, '_blank'), error: e => (this.error = apiMessage(e)) });
  }

  /* ---------------- purgatory and rows ---------------- */

  loadPurgatory(): void {
    this.loading = true;
    this.desk.purgatory(this.purgatoryVendorId).pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: p => (this.purgatory = p), error: e => (this.error = apiMessage(e)) });
  }

  openRow(r: any, vendorId: number | null): void {
    if (this.row && this.row.rowId !== r.rowId && !this.leaveOk()) return;
    this.row = r;
    this.rowVendorId = vendorId;
    this.newProduct = null;
    this.rowEdit = {
      proCode: r.proCode ?? '', description: r.description ?? '', instantRebate: r.instantRebate, reimbursement: r.reimbursement,
      mapPrice: r.mapPrice, startDate: isoDate(r.startDate), endDate: isoDate(r.endDate), rebateType: r.rebateType, notes: r.notes ?? ''
    };
  }

  get rowDirty(): boolean {
    const r = this.row;
    if (!r) return false;
    const e = this.rowEdit;
    return (e.proCode || '') !== (r.proCode || '') || (e.description || '') !== (r.description || '')
      || +e.instantRebate !== +r.instantRebate || +e.reimbursement !== +r.reimbursement || +e.mapPrice !== +r.mapPrice
      || e.startDate !== isoDate(r.startDate) || e.endDate !== isoDate(r.endDate)
      || (e.rebateType ?? null) !== (r.rebateType ?? null) || (e.notes || '') !== (r.notes || '');
  }

  rowCodes(r: any): string[] {
    return (r?.problems ?? []).map((p: any) => p.code);
  }

  hasProblem(r: any, ...codes: string[]): boolean {
    return this.rowCodes(r).some(c => codes.includes(c));
  }

  private afterRowChange(): void {
    this.loadOverview();
    if (this.view === 'uploads' && this.upload) {
      const rowId = this.row?.rowId;
      this.desk.getUpload(this.upload.uploadId).subscribe(d => {
        this.upload = d.upload;
        this.uploadRows = d.rows;
        const again = d.rows.find(x => x.rowId === rowId);
        if (again && again.status !== 'LOADED') this.openRow(again, this.rowVendorId); else this.row = null;
      });
    } else {
      const rowId = this.row?.rowId;
      this.desk.purgatory(this.purgatoryVendorId).subscribe(p => {
        this.purgatory = p;
        const again = p.find(x => x.rowId === rowId);
        if (again) this.openRow(again, again.vendorId); else this.row = null;
      });
    }
  }

  saveRow(): void {
    this.busy = true;
    this.error = '';
    const e = this.rowEdit;
    this.desk.updateRow(this.row.rowId, {
      ...e,
      rebateType: e.rebateType === '' ? null : e.rebateType,
      startDate: e.startDate || null,
      endDate: e.endDate || null
    }).pipe(finalize(() => (this.busy = false))).subscribe({
      next: r => {
        this.notice = r?.status === 'READY' ? 'Fixed: the row is ready to load.' : 'Saved. The row still has problems.';
        this.afterRowChange();
      },
      error: err => (this.error = apiMessage(err))
    });
  }

  pickModel(p: any | null): void {
    this.busy = true;
    this.error = '';
    this.desk.pickModel(this.row.rowId, p ? p.modelId : null).pipe(finalize(() => (this.busy = false))).subscribe({
      next: r => {
        this.notice = p ? `Row set to product #${p.modelId}${r?.status === 'READY' ? '; ready to load.' : '.'}` : 'Row handed back to automatic matching.';
        this.afterRowChange();
      },
      error: err => (this.error = apiMessage(err))
    });
  }

  startNewProduct(): void {
    this.newProduct = {
      rail: 'IR', vendorId: this.rowVendorId, description: this.row.description || '',
      proCodes: this.row.proCode || '', serialNumbersRequired: false
    };
  }

  saveNewProduct(): void {
    this.busy = true;
    this.error = '';
    this.desk.addProduct({ ...this.newProduct, forRowId: this.row.rowId }).pipe(finalize(() => (this.busy = false))).subscribe({
      next: r => {
        this.newProduct = null;
        this.notice = `Product #${r.modelId} added and set on this row.` + (r.unknownProCodes ? ` Not found in PRO products: ${r.unknownProCodes}.` : '');
        this.afterRowChange();
      },
      error: err => (this.error = apiMessage(err))
    });
  }

  restoreRow(r: any): void {
    this.busy = true;
    this.desk.restoreRow(r.rowId).pipe(finalize(() => (this.busy = false))).subscribe({
      next: () => { this.notice = 'Row restored; checked again.'; this.afterRowChange(); },
      error: err => (this.error = apiMessage(err))
    });
  }

  /* ---------------- batches ---------------- */

  loadBatches(page: number): void {
    this.batchPage = Math.max(1, page);
    this.loading = true;
    this.desk.batches({ ...this.batchFilter, page: this.batchPage, pageSize: 50 }).pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: r => { this.batches = r.rows; this.batchTotal = r.total; }, error: e => (this.error = apiMessage(e)) });
  }

  get batchPages(): number { return Math.max(1, Math.ceil(this.batchTotal / 50)); }

  openBatch(b: any): void {
    if (this.batch && this.batch.batchId !== b.batchId && !this.leaveOk()) return;
    this.batch = b;
    this.batchDates = { startDate: isoDate(b.programStart), endDate: isoDate(b.programEnd), expireOn: isoDate(b.expireOn) };
    this.desk.batchPrograms(b.batchId).subscribe(p => (this.batchPrograms = p));
    this.desk.history({ batchId: b.batchId, take: 50 }).subscribe(h => (this.batchHistory = h));
  }

  get batchDatesDirty(): boolean {
    const b = this.batch;
    if (!b || this.view !== 'batches') return false;
    return this.batchDates.startDate !== isoDate(b.programStart) || this.batchDates.endDate !== isoDate(b.programEnd)
      || this.batchDates.expireOn !== isoDate(b.expireOn);
  }

  /* ---------------- history ---------------- */

  loadHistory(): void {
    this.loading = true;
    this.desk.history({ rail: this.rail, take: 300 }).pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: h => (this.history = h), error: e => (this.error = apiMessage(e)) });
  }

  detailText(d: any): string {
    if (!d) return '';
    try { return typeof d === 'string' ? d : JSON.stringify(d); } catch { return ''; }
  }

  /* ---------------- reasons ---------------- */

  get pendingTitle(): string {
    const p = this.pending;
    if (!p) return '';
    switch (p.kind) {
      case 'skip': return `Skip row ${p.row.sourceRow}`;
      case 'cancel-upload': return `Cancel upload ${this.upload?.uploadId}`;
      case 'batch-active': return `${p.active ? 'Turn on' : 'Turn off'} batch ${p.batch.batchId}`;
      case 'batch-dates': return `Change dates for batch ${this.batch?.batchId}`;
      case 'retire-template': return `Retire the saved layout for ${p.template.vendorName}`;
    }
  }

  get pendingDetail(): string {
    const p = this.pending;
    if (!p) return '';
    switch (p.kind) {
      case 'skip': return 'The row is not loaded. You can restore it later.';
      case 'cancel-upload': return 'Nothing from this upload has loaded. The file stays in the library.';
      case 'batch-active': return p.active ? `All ${p.batch.programs} programs go live for members.` : `All ${p.batch.programs} programs stop showing to members. Submitted claims are not affected.`;
      case 'batch-dates': return 'Every program in the batch moves together, so members keep seeing it as one program.';
      case 'retire-template': return 'Next time this vendor sends this layout, the AI proposes the mapping again.';
    }
  }

  get pendingDanger(): boolean {
    const p = this.pending;
    return !!p && (p.kind === 'skip' || p.kind === 'cancel-upload' || p.kind === 'retire-template' || (p.kind === 'batch-active' && !p.active));
  }

  confirm(reason: string): void {
    const p = this.pending;
    if (!p) return;
    this.busy = true;
    this.error = '';
    let call;
    switch (p.kind) {
      case 'skip': call = this.desk.skipRow(p.row.rowId, reason); break;
      case 'cancel-upload': call = this.desk.cancelUpload(this.upload.uploadId, reason); break;
      case 'batch-active': call = this.desk.setBatchActive(p.batch.batchId, p.active, reason); break;
      case 'batch-dates': call = this.desk.changeBatchDates(this.batch.batchId, { ...this.batchDates, expireOn: this.batchDates.expireOn || null, reason }); break;
      case 'retire-template': call = this.desk.retireTemplate(p.template.templateId, reason); break;
    }
    call.pipe(finalize(() => (this.busy = false))).subscribe({
      next: () => {
        this.pending = null;
        this.notice = 'Done.';
        switch (p.kind) {
          case 'skip': this.afterRowChange(); break;
          case 'cancel-upload': this.upload = null; this.loadUploads(); this.loadOverview(); break;
          case 'batch-active': case 'batch-dates': {
            const id = this.batch?.batchId ?? (p as any).batch?.batchId;
            this.desk.batches({ q: String(id), page: 1, pageSize: 5 }).subscribe(r => {
              const again = r.rows.find((x: any) => x.batchId === id);
              if (again) this.openBatch(again);
              this.loadBatches(this.batchPage);
            });
            this.loadOverview();
            break;
          }
          case 'retire-template': this.desk.templates().subscribe(t => (this.templates = t)); this.loadOverview(); break;
        }
      },
      error: e => (this.error = apiMessage(e))
    });
  }

  typeName(id: number | null): string {
    if (id === -1) return 'not recognised';
    return this.types.find(t => t.rebateTypeId === id)?.name ?? (id ? String(id) : '');
  }

  mappingText(m: any, headers: any): string {
    if (!m) return '';
    const h: string[] = Array.isArray(headers) ? headers : [];
    return Object.keys(m).filter(k => m[k] !== null && m[k] !== undefined).map(k => `${k}: ${h[m[k]] ?? m[k]}`).join(' · ');
  }
}
