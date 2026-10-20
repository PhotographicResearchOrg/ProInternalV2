import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { DataService } from 'src/app/services/data.service';
import { Rail, RebateDeskService, apiMessage, isoDate } from 'src/app/services/rebate-desk.service';
import { IR_PROGRAM_COLS, UPLOAD_ROW_COLS, col, downloadXlsx, fetchAllPages } from '../shared/rebate-excel';
import { DEFAULT_MONTHS, windowStart } from '../shared/rebate-window.component';

type ViewKey =
  | 'overview' | 'upload' | 'uploads' | 'purgatory' | 'programs' | 'batches' | 'products' | 'vendors'
  | 'templates' | 'claims' | 'debitmemos' | 'declines' | 'investigate' | 'stockpad' | 'history'
  | 'pp-programs' | 'pp-products' | 'pp-vendors' | 'pp-claims' | 'pp-debitmemos' | 'pp-history';

interface RailView { key: ViewKey; label: string; icon: string; group: 'IR' | 'PP'; count?: () => number; hot?: boolean; }

type Pending =
  | { kind: 'skip'; row: any }
  | { kind: 'cancel-upload' }
  | { kind: 'batch-active'; batch: any; active: boolean }
  | { kind: 'batch-dates' }
  | { kind: 'retire-template'; template: any }
  | { kind: 'bulk-skip'; ids: number[] }
  | { kind: 'bulk-overlap'; ids: number[] }
  | { kind: 'bp-amounts' }
  | { kind: 'bp-dates' }
  | { kind: 'bp-active'; program: any; active: boolean }
  | { kind: 'resubmit-claim'; claim: any }
  | null;

/*
 * Rebate Desk (/rebatedesk). Two rails, the Product Desk format:
 *   Instant rebates   overview, new upload (interview), uploads and review,
 *                     purgatory, programs, batches, products, vendors and
 *                     liability, templates, declined claims, history
 *                     claims (resend credit, recreate/reprint invoice), debit memos
 *   Price protection  programs, products, vendors and liability, claims,
 *                     debit memos, history
 * Rows that fail a check go to purgatory and stay there until fixed,
 * skipped with a reason, or loaded.
 */
const HISTORY_COLS = [
  col('When', 'at', 'datetime'), col('Who', 'actor'), col('What', 'eventType'), col('Batch', 'batchId', 'number'),
  col('Program', 'programId', 'number'), col('Upload', 'uploadId', 'number'), col('Product #', 'modelId', 'number'),
  col('Product', 'modelDescription', 'text', 40), col('Claim', 'claimId', 'number'), col('Reason', 'reason', 'text', 40),
  col('Detail', (h: any) => h.detailText ?? (typeof h.detail === 'string' ? h.detail : JSON.stringify(h.detail ?? '')), 'text', 80)
];

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
    { key: 'claims', label: 'Claims', icon: 'pi pi-wallet', group: 'IR' },
    { key: 'debitmemos', label: 'Debit memos', icon: 'pi pi-send', group: 'IR' },
    { key: 'declines', label: 'Needs support / declined', icon: 'pi pi-ban', group: 'IR' },
    { key: 'investigate', label: 'Investigate', icon: 'pi pi-search', group: 'IR' },
    { key: 'stockpad', label: 'Stock padding', icon: 'pi pi-plus-circle', group: 'IR' },
    { key: 'history', label: 'History', icon: 'pi pi-history', group: 'IR' },
    { key: 'pp-programs', label: 'Programs', icon: 'pi pi-list', group: 'PP', count: () => this.overview.priceProtectionLive || 0 },
    { key: 'pp-products', label: 'Products', icon: 'pi pi-tags', group: 'PP' },
    { key: 'pp-vendors', label: 'Vendors & liability', icon: 'pi pi-building', group: 'PP' },
    { key: 'pp-claims', label: 'Claims', icon: 'pi pi-wallet', group: 'PP' },
    { key: 'pp-debitmemos', label: 'Debit memos', icon: 'pi pi-send', group: 'PP' },
    { key: 'pp-history', label: 'History', icon: 'pi pi-history', group: 'PP' }
  ];

  view: ViewKey = 'overview';
  childDirty = false;

  /* Filters handed to the programs view from products and vendors. */
  programModelId: number | null = null;
  programBatchId: number | null = null;
  programOpenId: number | null = null;

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
  batchFilter = { q: '', vendorId: null as number | null, state: 'LIVE', months: DEFAULT_MONTHS };
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
  declineQ = '';
  declineTake = 100;
  /* 3 = needs support from the member (actionable: back to the queue once added), 2 = declined (final). */
  declineStatus: 2 | 3 = 3;
  declineMonths = DEFAULT_MONTHS;

  private declineCache: { src: any[]; key: string; out: any[] } | null = null;

  /* In the window, newest first, filtered by status and the search box; worked out again only when one of those changes. */
  get declinesInWindow(): any[] {
    const start = windowStart(this.declineMonths);
    return start ? this.declines.filter(d => String(d.processDate ?? '').substring(0, 10) >= start) : this.declines;
  }

  declineCount(status: number): number { return this.declinesInWindow.filter(d => d.status === status).length; }

  get declinesShown(): any[] {
    const q = this.declineQ.trim().toLowerCase();
    const key = `${q}|${this.declineStatus}|${this.declineMonths}`;
    if (this.declineCache && this.declineCache.src === this.declines && this.declineCache.key === key) return this.declineCache.out;
    let out = this.declinesInWindow.filter(d => d.status === this.declineStatus)
      .sort((a, b) => String(b.processDate ?? '').localeCompare(String(a.processDate ?? '')));
    if (q) out = out.filter(d => [d.orderID, d.memberID, d.model, d.rejectReason, d.email, d.eMail, d.vendorName]
      .some(v => v != null && String(v).toLowerCase().includes(q)));
    this.declineCache = { src: this.declines, key, out };
    return out;
  }

  /* Needs support: the member added what was asked for, so it goes back into the approval queue. */
  resubmitDecline(d: any): void { this.pending = { kind: 'resubmit-claim', claim: d }; }

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

    /* Search as you type: runs a moment after the last key. */
  private searchTimer: any;
  searchSoon(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadBatches(1), 350);
  }

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
    this.picked = new Set();
    this.pChip = null;
    this.uChip = null;
    this.childDirty = false;
    this.view = key;
    this.error = '';
    this.row = null;
    this.newProduct = null;
    if (!keepFilters) { this.programModelId = null; this.programBatchId = null; this.programOpenId = null; this.memoPreset = null; this.investigatePreset = null; this.claimsOpenId = null; this.stockPadMember = null; }
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

  noticeUploadId: number | null = null;

  memoPreset: { vendorId: number; from: string; to: string } | null = null;

  /* Investigate a claim's member and products (from the claim, or a needs-support / declined row). */
  investigatePreset: { memberId: number; modelIds?: number[] } | null = null;
  claimsOpenId: number | null = null;
  stockPadMember: number | null = null;
  openStockPad(memberId: number): void {
    if (!this.leaveOk()) return;
    this.stockPadMember = memberId;
    this.pick('stockpad', true);
  }
  openClaim(orderId: number): void {
    if (!this.leaveOk()) return;
    this.claimsOpenId = orderId;
    this.pick('claims', true);
  }
  investigate(p: { memberId: number; modelIds?: number[] }): void {
    if (!this.leaveOk()) return;
    this.investigatePreset = { ...p };
    this.pick('investigate', true);
  }

  billVendor(p: { vendorId: number; from: string; to: string }, rail: Rail): void {
    if (!this.leaveOk()) return;
    this.childDirty = false;
    this.memoPreset = p;
    this.pick(rail === 'PP' ? 'pp-debitmemos' : 'debitmemos', true);
  }

  showPrograms(f: { vendorId?: number; modelId?: number; batchId?: number; programId?: number }, rail: Rail = this.rail): void {
    const target: ViewKey = rail === 'PP' ? 'pp-programs' : 'programs';
    if (!this.leaveOk()) return;
    this.childDirty = false;
    this.programModelId = f.modelId ?? null;
    this.programBatchId = f.batchId ?? null;
    this.programOpenId = f.programId ?? null;
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
    this.picked = new Set();
    this.uChip = null;
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

  /* ---- Excel ---- */
  exporting = false;

  exportUploadRows(): void {
    if (!this.upload) return;
    const rows = this.filteredRows.map(r => ({ ...r, uploadId: this.upload.uploadId, vendorName: this.upload.vendorName, fileName: this.upload.fileName,
      rebateTypeName: this.typeName(r.rebateType ?? this.upload.defaultRebateType) }));
    downloadXlsx(`Upload ${this.upload.uploadId} ${this.upload.vendorName ?? ''} ${this.rowFilter.toLowerCase()}`,
      [{ name: 'Rows', cols: UPLOAD_ROW_COLS, rows }]);
  }

  exportPurgatory(): void {
    const rows = this.purgatory.map(r => ({ ...r, status: 'PURGATORY', rebateTypeName: this.typeName(r.rebateType ?? r.defaultRebateType) }));
    downloadXlsx('Purgatory', [{ name: 'Purgatory', cols: UPLOAD_ROW_COLS, rows }]);
  }

  exportUploads(): void {
    downloadXlsx('Uploads', [{ name: 'Uploads', rows: this.uploads, cols: [
      col('Upload', 'uploadId', 'number'), col('Vendor', 'vendorName'), col('File', 'fileName', 'text', 40), col('Status', 'status'),
      col('Rows', 'rowsTotal', 'number'), col('Ready', 'rowsReady', 'number'), col('Purgatory', 'rowsPurgatory', 'number'),
      col('Loaded', 'rowsLoaded', 'number'), col('Skipped', 'rowsSkipped', 'number'), col('Batch', 'batchId', 'number'),
      col('Uploaded by', 'createdBy'), col('Uploaded', 'createdAt', 'datetime')] }]);
  }

  async exportBatches(): Promise<void> {
    this.exporting = true;
    try {
      const rows = await fetchAllPages((page, pageSize) => this.desk.batches({ ...this.batchFilter, page, pageSize }));
      downloadXlsx('Batches', [{ name: 'Batches', rows, cols: [
        col('Batch', 'batchId', 'number'), col('Vendor', 'vendorName'), col('Type', 'irTypeName'), col('State', 'state'),
        col('Programs', 'programs', 'number'), col('On', 'livePrograms', 'number'), col('Start', 'programStart', 'date'),
        col('End', 'programEnd', 'date'), col('Claims until', 'expireOn', 'date'), col('Upload', 'uploadId', 'number'),
        col('Loaded by', 'loadedBy'), col('Entered', 'enteredAt', 'datetime')] }]);
    } catch (e) { this.error = apiMessage(e); } finally { this.exporting = false; }
  }

  exportBatch(): void {
    if (!this.batch) return;
    downloadXlsx(`Batch ${this.batch.batchId} ${this.batch.vendorName ?? ''}`, [
      { name: 'Programs', cols: IR_PROGRAM_COLS, rows: this.batchPrograms },
      { name: 'History', cols: HISTORY_COLS, rows: this.batchHistory }
    ]);
  }

  exportDeclines(): void {
    downloadXlsx(this.declineStatus === 3 ? 'Claims needing support' : 'Declined claims', [{ name: this.declineStatus === 3 ? 'Needs support' : 'Declined', rows: this.declinesShown, cols: [
      col('Claim', 'orderID', 'number'), col('Declined', 'processDate', 'date'), col('Member', 'memberID', 'number'),
      col('Vendor', 'vendorName'), col('Product', 'model', 'text', 40), col('Qty', 'quantity', 'number'), col('Amount', 'total', 'money'),
      col('Reason', 'rejectReason', 'text', 50), col('Email', r => r.email ?? r.eMail)] }]);
  }

  exportTemplates(): void {
    downloadXlsx('Saved vendor layouts', [{ name: 'Layouts', rows: this.templates, cols: [
      col('Template', 'templateId', 'number'), col('Vendor', 'vendorName'), col('Sheet', 'sheetName'), col('Header row', 'headerRow', 'number'),
      col('Columns', t => this.mappingText(t.mapping, t.headers), 'text', 80), col('Source', 'source'),
      col('Times used', 'timesUsed', 'number'), col('Last used', 'lastUsedAt', 'date')] }]);
  }

  exportHistory(): void {
    downloadXlsx(`History ${this.rail === 'PP' ? 'price protection' : 'instant rebates'}`, [{ name: 'History', cols: HISTORY_COLS,
      rows: this.history.map(h => ({ ...h, detailText: this.detailText(h.detail) })) }]);
  }

  get filteredRows(): any[] {
    const byStatus = this.rowFilter === 'ALL' ? this.uploadRows : this.uploadRows.filter(r => r.status === this.rowFilter);
    return this.uChip ? byStatus.filter(r => this.hasProblem(r, this.uChip!)) : byStatus;
  }

  /* ---- problem chips and ticked rows (upload review and purgatory) ---- */
  uChip: string | null = null;
  pChip: string | null = null;
  picked = new Set<number>();

  readonly problemLabels: { [code: string]: string } = {
    NO_PRODUCT: 'No PRO product', AMBIGUOUS_PRODUCT: 'Several PRO products', SEVERAL_PRO_CODES: 'Several PRO codes', NO_MODEL: 'No rebate product yet',
    MODEL_RETIRED: 'Product retired', NO_STACK: 'Stack missing', STACK_UNKNOWN: 'Stack not found', NO_DATES: 'No dates',
    DATES_REVERSED: 'Dates reversed', BAD_REIMBURSEMENT: 'No vendor share', NEGATIVE_AMOUNT: 'Negative amount',
    NO_TYPE: 'No type', UNKNOWN_TYPE: 'Unknown type', DUPLICATE_IN_FILE: 'Duplicate in file', OVERLAP_IN_FILE: 'Overlaps in file',
    OVERLAP: 'Overlaps live program', ALREADY_LOADED: 'Already loaded'
  };


  problemChips(rows: any[]): { code: string; label: string; count: number }[] {
    const n = new Map<string, number>();
    for (const r of rows) for (const p of (r.problems ?? [])) n.set(p.code, (n.get(p.code) ?? 0) + 1);
    return [...n.entries()].map(([code, count]) => ({ code, label: this.problemLabels[code] ?? code, count }))
      .sort((a, b) => b.count - a.count);
  }

  get purgatoryShown(): any[] {
    return this.pChip ? this.purgatory.filter(r => this.hasProblem(r, this.pChip!)) : this.purgatory;
  }

  get tickable(): any[] {
    return (this.view === 'purgatory' ? this.purgatoryShown : this.filteredRows).filter(r => r.status === 'PURGATORY' || r.status === 'READY' || !r.status);
  }

  tickRow(r: any, on: boolean, e?: Event): void {
    e?.stopPropagation();
    on ? this.picked.add(r.rowId) : this.picked.delete(r.rowId);
    this.picked = new Set(this.picked);
  }

  tickAll(on: boolean): void {
    this.picked = on ? new Set(this.tickable.map(r => r.rowId)) : new Set();
  }

  get allTicked(): boolean { return this.tickable.length > 0 && this.tickable.every(r => this.picked.has(r.rowId)); }

  /* Ticked rows that overlap something (the only ones "Load anyway" applies to). */
  get pickedOverlaps(): number[] {
    const rows = this.view === 'purgatory' ? this.purgatory : this.uploadRows;
    return rows.filter(r => this.picked.has(r.rowId) && (this.hasProblem(r, 'OVERLAP') || this.hasProblem(r, 'OVERLAP_IN_FILE'))).map(r => r.rowId);
  }

  bulkSkip(): void { this.pending = { kind: 'bulk-skip', ids: [...this.picked] }; }
  bulkOverlap(): void { this.pending = { kind: 'bulk-overlap', ids: this.pickedOverlaps }; }
  clearTicks(): void { this.picked = new Set(); }

  rowLoadAnyway(): void {
    if (this.row) this.pending = { kind: 'bulk-overlap', ids: [this.row.rowId] };
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

  /* Creates every rebate product the naming rule set calls for in this upload, then checks again. */
  createMissing(): void {
    if (!this.upload) return;
    this.busy = true;
    this.error = '';
    this.desk.createMissingProducts(this.upload.uploadId).pipe(finalize(() => (this.busy = false))).subscribe({
      next: r => {
        this.notice = `Created ${r.created} rebate product(s) from the naming rule set.`;
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

  /* ---- look up a PRO product for the open row (dbo.Product: code, catalog #, UPC, name) ---- */
  proQ = '';
  proHits: any[] = [];
  proSearching = false;
  proSearched = false;
  proErr = '';
  private proTimer: any;

  get rowNeedsProduct(): boolean {
    const r = this.row;
    return !!r && (!r.productCode || this.hasProblem(r, 'NO_PRODUCT') || this.hasProblem(r, 'AMBIGUOUS_PRODUCT'));
  }

  searchProSoon(): void {
    clearTimeout(this.proTimer);
    this.proHits = [];
    this.proTimer = setTimeout(() => this.searchPro(), 600);
  }

  searchPro(): void {
    const q = (this.proQ || '').trim();
    if (q.length < 2) { this.proHits = []; return; }
    this.proSearching = true;
    this.proSearched = true;
    this.proErr = '';
    this.desk.proCodes(q).pipe(finalize(() => (this.proSearching = false))).subscribe({
      next: h => (this.proHits = h ?? []),
      error: e => { this.proHits = []; this.proErr = apiMessage(e); }
    });
  }

  openRow(r: any, vendorId: number | null): void {
    if (this.row && this.row.rowId !== r.rowId && !this.leaveOk()) return;
    if (!r.status) r.status = 'PURGATORY';
    this.row = r;
    this.mapChoice = null;
    this.step1Open = false;
    this.step2Open = false;
    this.detailsOpen = this.hasProblem(r, ...this.valueProblems);
    this.s2Type = this.effectiveType(r);
    this.s2Choice = r.modelId ?? null;
    this.s2Options = [];
    if (r.productCode) this.desk.rowOptions(r.rowId).subscribe({ next: o => (this.s2Options = o ?? []), error: () => (this.s2Options = []) });
    this.proHits = [];
    this.proErr = '';
    this.proSearched = false;
    this.proQ = r.vendorSku || r.upc || r.description || '';
    this.rowVendorId = vendorId;
    /* The file's original line is not in the purgatory list: fetch it for this row. */
    if (r.raw === undefined) this.desk.getRow(r.rowId).subscribe({ next: full => { if (this.row?.rowId === r.rowId) this.row.raw = full?.raw ?? null; }, error: () => {} });
    this.newProduct = null;
    this.ticked = [];
    this.rowEdit = {
      proCode: r.proCode ?? '', vendorSku: r.vendorSku ?? '', upc: r.upc ?? '', stackProduct: r.stackProduct ?? '',
      description: r.description ?? '', instantRebate: r.instantRebate, reimbursement: r.reimbursement,
      mapPrice: r.mapPrice, proPad: r.proPadInput ?? null, startDate: isoDate(r.startDate), endDate: isoDate(r.endDate), rebateType: r.rebateType, notes: r.notes ?? ''
    };
  }

  get rowDirty(): boolean {
    const r = this.row;
    if (!r) return false;
    const e = this.rowEdit;
    return (e.proCode || '') !== (r.proCode || '') || (e.description || '') !== (r.description || '')
      || (e.vendorSku || '') !== (r.vendorSku || '') || (e.upc || '') !== (r.upc || '') || (e.stackProduct || '') !== (r.stackProduct || '')
      || +e.instantRebate !== +r.instantRebate || +e.reimbursement !== +r.reimbursement || +e.mapPrice !== +r.mapPrice
      || (e.proPad ?? null) !== (r.proPadInput ?? null)
      || e.startDate !== isoDate(r.startDate) || e.endDate !== isoDate(r.endDate)
      || (e.rebateType ?? null) !== (r.rebateType ?? null) || (e.notes || '') !== (r.notes || '');
  }

  rowCodes(r: any): string[] {
    return (r?.problems ?? []).map((p: any) => p.code);
  }

  hasProblem(r: any, ...codes: string[]): boolean {
    return this.rowCodes(r).some(c => codes.includes(c));
  }

  /* Show the saved row's new state straight away; the full lists refresh behind it. */
  private applyRowResult(r: any): void {
    if (!r?.rowId) return;
    const patch = (list: any[]) => {
      const i = list.findIndex(x => x.rowId === r.rowId);
      if (i < 0) return list;
      const merged = { ...list[i], ...r };
      return this.view === 'purgatory' && r.status !== 'PURGATORY' ? list.filter(x => x.rowId !== r.rowId) : list.map((x, k) => (k === i ? merged : x));
    };
    this.purgatory = patch(this.purgatory);
    this.uploadRows = patch(this.uploadRows);
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
      const was = this.row;
      this.desk.purgatory(this.purgatoryVendorId).subscribe(p => {
        this.purgatory = p;
        const again = p.find(x => x.rowId === was?.rowId);
        if (again) { this.openRow(again, again.vendorId); return; }
        this.row = null;
        if (!was) return;
        /* A fixed row leaves the purgatory list; keep it open so you see what it resolved to, and say where it loads. */
        this.noticeUploadId = was.uploadId;
        this.notice = `Row ${was.sourceRow} is fixed and ready. It loads with upload #${was.uploadId}${was.vendorName ? ' (' + was.vendorName + ')' : ''}.`;
        this.desk.getRow(was.rowId).subscribe(fixed => {
          if (fixed && !this.row) this.openRow(fixed, was.vendorId);
        });
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
      proPad: e.proPad === '' || e.proPad === null || e.proPad === undefined ? null : +e.proPad,
      startDate: e.startDate || null,
      endDate: e.endDate || null
    }).pipe(finalize(() => (this.busy = false))).subscribe({
      next: r => {
        this.notice = r?.status === 'READY' ? 'Fixed: the row is ready to load.' : 'Saved. The row still has problems.';
        this.applyRowResult(r);
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
      rail: 'IR', vendorId: this.rowVendorId, description: this.row.proposedName || this.row.description || '',
      proCodes: this.row.productCode || this.row.proCode || '', serialNumbersRequired: false
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

  /* Several PRO products matched: the ones ticked, in the order ticked. */
  ticked: string[] = [];

  /* ---- the row panel, one step at a time ---- */
  step1Open = false;
  step2Open = false;
  detailsOpen = false;
  private readonly valueProblems = ['NO_DATES', 'DATES_REVERSED', 'BAD_REIMBURSEMENT', 'NEGATIVE_AMOUNT', 'NO_TYPE', 'UNKNOWN_TYPE',
    'NO_STACK', 'STACK_UNKNOWN', 'SEVERAL_PRO_CODES', 'DUPLICATE_IN_FILE', 'OVERLAP_IN_FILE', 'OVERLAP', 'ALREADY_LOADED'];

  get step1Done(): boolean {
    const r = this.row;
    return !!r?.productCode && !this.hasProblem(r, 'NO_PRODUCT', 'AMBIGUOUS_PRODUCT', 'SEVERAL_PRO_CODES');
  }

  get step2Done(): boolean { return !!this.row?.modelId && !this.hasProblem(this.row, 'NO_MODEL', 'MODEL_RETIRED'); }

  /* ---- step 2: map to a rebate product, or create one by the naming convention, for the chosen type ---- */
  s2Type: number | null = null;
  s2Choice: number | 'CREATE' | null = null;
  s2Options: any[] = [];

  /* Rebate products carrying the PRO code; the one in use first. */
  get s2List(): any[] {
    const list = [...this.s2Options];
    const r = this.row;
    if (r?.modelId && !list.some(o => o.modelId === r.modelId))
      list.unshift({ modelId: r.modelId, name: r.modelDescription, kind: '', vendor: '', active: true });
    return list.sort((a, b) => (a.modelId === r?.modelId ? -1 : b.modelId === r?.modelId ? 1 : 0));
  }

  get s2Name(): string { return this.previewName(this.row, this.s2Type); }

  get s2Changed(): boolean {
    return this.s2Choice !== null && (this.s2Choice !== this.row?.modelId || this.s2Type !== this.effectiveType(this.row));
  }

  /* Applies step 2: the type first (it decides the name), then the mapping or the new product. */
  applyStep2(): void {
    const r = this.row;
    if (!r || this.s2Choice === null) return;
    const typeChanged = this.s2Type !== this.effectiveType(r);
    const choice = this.s2Choice;
    this.busy = true;
    this.error = '';
    const setType$ = typeChanged
      ? this.desk.updateRow(r.rowId, { ...this.rowEdit, rebateType: this.s2Type, proPad: this.rowEdit.proPad === '' || this.rowEdit.proPad == null ? null : +this.rowEdit.proPad,
          startDate: this.rowEdit.startDate || null, endDate: this.rowEdit.endDate || null })
      : of(null);
    setType$.pipe(
      switchMap(() => choice === 'CREATE'
        ? this.desk.addProduct({ rail: 'IR', vendorId: this.rowVendorId ?? r.vendorId, description: this.s2Name,
            proCodes: String(r.productCode).split(',')[0], serialNumbersRequired: false, forRowId: r.rowId })
        : this.desk.pickModel(r.rowId, choice as number)),
      finalize(() => (this.busy = false))
    ).subscribe({
      next: () => {
        this.notice = choice === 'CREATE' ? `Created "${this.s2Name}" and set it on row ${r.sourceRow}.` : `Row ${r.sourceRow} mapped to rebate product #${choice}.`;
        this.loadOverview();
        this.afterRowChange();
      },
      error: e => (this.error = apiMessage(e))
    });
  }

  /* ---- mapping a row to a rebate product (no product by the rule-set name) ---- */
  mapChoice: number | 'CREATE' | null = null;

  mapCandidates(r: any): any[] {
    return (r?.problems ?? []).find((p: any) => p.code === 'NO_MODEL')?.candidates ?? [];
  }

  /* The naming rule set (fixed; same as piv2.RebateNamingRule): suffix, or stack products added with WITH. */
  private readonly nameRules: { [type: number]: { suffix?: string; stack?: boolean } } = {
    3: { suffix: 'TRADE-IN TRADE-UP' }, 4: { stack: true }, 5: { suffix: 'WITH COUPON CODE' },
    6: { suffix: 'WITH SOCIAL MEDIA' }, 7: { stack: true }
  };

  /* The type the row will load as: its own, or the upload's default. */
  effectiveType(r: any, edited?: any): number | null {
    const own = edited !== undefined ? edited : r?.rebateType;
    return own ?? r?.defaultRebateType ?? this.upload?.defaultRebateType ?? null;
  }

  /* The rebate product name that Create would use for this row and type. */
  previewName(r: any, typeId: number | null): string {
    const base = (r?.productName || '').trim();
    if (!base) return '';
    if (typeId === this.effectiveType(r) && r?.proposedName) return r.proposedName;
    const rule = typeId != null ? this.nameRules[typeId] : undefined;
    if (rule?.stack) {
      const stacks = String(r?.stackCodes || r?.stackProduct || '').split(/[,+]/).map(x => x.trim()).filter(x => x);
      return `${base} ${stacks.length ? stacks.map(x => 'WITH ' + x).join(' ') : 'WITH <stack product>'}`;
    }
    return rule?.suffix ? `${base} ${rule.suffix}` : base;
  }

  useMapChoice(): void {
    if (this.mapChoice === null || !this.row) return;
    if (this.mapChoice === 'CREATE') { this.createForRow(); return; }
    this.pickModel({ modelId: this.mapChoice });
  }

  /* Creates the one rebate product this row calls for, under the naming convention, and checks again. */
  createForRow(): void {
    const uploadId = this.row?.uploadId ?? this.upload?.uploadId;
    if (!uploadId) return;
    this.busy = true;
    this.error = '';
    this.desk.createMissingProducts(uploadId, [this.row.rowId]).pipe(finalize(() => (this.busy = false))).subscribe({
      next: r => {
        this.notice = r.created ? `Created "${this.row?.proposedName}" and set it on this row.` : 'Nothing was created: the row may already have a product.';
        this.loadOverview();
        this.afterRowChange();
      },
      error: e => (this.error = apiMessage(e))
    });
  }

  candidatesOf(r: any): any[] {
    return (r?.problems ?? []).find((p: any) => p.code === 'AMBIGUOUS_PRODUCT')?.candidates ?? [];
  }

  /* One PRO product per row. */
  tick(code: string, on: boolean): void {
    this.ticked = on ? [code] : [];
  }

  useTicked(): void {
    if (!this.ticked.length) return;
    this.rowEdit.proCode = this.ticked[0];
    this.ticked = [];
    this.saveRow();
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
    this.bProg = null;
    this.batchDates = { startDate: isoDate(b.programStart), endDate: isoDate(b.programEnd), expireOn: isoDate(b.expireOn) };
    this.desk.batchPrograms(b.batchId).subscribe(p => (this.batchPrograms = p));
    this.desk.history({ batchId: b.batchId, take: 50 }).subscribe(h => (this.batchHistory = h));
  }

  /* ---- one program inside the open batch ---- */
  bProg: any = null;
  bEdit: any = {};

  editBatchProgram(p: any): void {
    if (this.bProg?.programId === p.programId) { this.bProg = null; return; }
    this.bProg = p;
    this.bEdit = {
      instantRebate: p.instantRebate, vendorShare: p.vendorShare ?? p.reimbursement, proPad: p.proPad ?? 0, mapPrice: p.mapPrice,
      startDate: isoDate(p.startDate), endDate: isoDate(p.endDate), expireOn: isoDate(p.expireOn)
    };
  }

  get bMember(): number { return (+this.bEdit.vendorShare || 0) + (+this.bEdit.proPad || 0); }

  get bAmountsDirty(): boolean {
    const p = this.bProg;
    return !!p && (+this.bEdit.instantRebate !== +p.instantRebate || +this.bEdit.vendorShare !== +(p.vendorShare ?? p.reimbursement)
      || +this.bEdit.proPad !== +(p.proPad ?? 0) || +this.bEdit.mapPrice !== +p.mapPrice);
  }

  get bDatesDirty(): boolean {
    const p = this.bProg;
    return !!p && (this.bEdit.startDate !== isoDate(p.startDate) || this.bEdit.endDate !== isoDate(p.endDate)
      || this.bEdit.expireOn !== isoDate(p.expireOn));
  }

  private reloadBatch(keepProgramId?: number): void {
    const id = this.batch?.batchId;
    if (!id) return;
    this.desk.batches({ q: String(id), page: 1, pageSize: 5 }).subscribe(r => {
      const again = r.rows.find((x: any) => x.batchId === id);
      if (again) {
        this.batch = again;
        this.batchDates = { startDate: isoDate(again.programStart), endDate: isoDate(again.programEnd), expireOn: isoDate(again.expireOn) };
      }
      this.loadBatches(this.batchPage);
    });
    this.desk.batchPrograms(id).subscribe(p => {
      this.batchPrograms = p;
      const keep = keepProgramId ? p.find((x: any) => x.programId === keepProgramId) : null;
      this.bProg = null;
      if (keep) this.editBatchProgram(keep);
    });
    this.desk.history({ batchId: id, take: 50 }).subscribe(h => (this.batchHistory = h));
    this.loadOverview();
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
      case 'bulk-skip': return `Skip ${p.ids.length} row(s)`;
      case 'bulk-overlap': return `Load ${p.ids.length} overlapping row(s) anyway`;
      case 'bp-amounts': return `Change amounts on program ${this.bProg?.programId}`;
      case 'bp-dates': return `Change dates on program ${this.bProg?.programId}`;
      case 'bp-active': return `${p.active ? 'Turn on' : 'Turn off'} program ${p.program.programId}`;
      case 'resubmit-claim': return `Send claim ${p.claim.orderID} back to the approval queue`;
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
      case 'bulk-skip': return 'They are not loaded and leave purgatory. Each can be restored later.';
      case 'bulk-overlap': return 'They load even though a live program for the same product and type covers some of these dates. Members may see both. An exact copy of a live program still waits; skip those.';
      case 'bp-amounts': return 'Only this program changes. Claims already submitted keep the amount they were submitted with.';
      case 'bp-dates': return `Only this program moves. Members will see it apart from the rest of batch ${this.batch?.batchId}; to move the whole batch, use the batch dates above.`;
      case 'bp-active': return p.active ? 'Members see this program again.' : 'Members stop seeing this program. Submitted claims are not affected.';
      case 'resubmit-claim': return 'The member has added the support asked for. The claim goes back into the approval queue (the same as Resubmit on the BRM dashboard).';
    }
  }

  get pendingDanger(): boolean {
    const p = this.pending;
    return !!p && (p.kind === 'skip' || p.kind === 'cancel-upload' || p.kind === 'retire-template' || (p.kind === 'batch-active' && !p.active) || (p.kind === 'bp-active' && !p.active) || p.kind === 'bulk-skip' || p.kind === 'bulk-overlap');
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
      case 'bulk-skip': call = this.desk.skipRows(p.ids, reason); break;
      case 'bulk-overlap': call = this.desk.allowOverlap(p.ids, reason); break;
      case 'bp-amounts': call = this.desk.changeAmounts(this.bProg.programId, {
        instantRebate: this.bEdit.instantRebate, vendorShare: this.bEdit.vendorShare, proPad: this.bEdit.proPad || 0, mapPrice: this.bEdit.mapPrice, reason }); break;
      case 'bp-dates': call = this.desk.changeProgramDates(this.bProg.programId, {
        startDate: this.bEdit.startDate, endDate: this.bEdit.endDate, expireOn: this.bEdit.expireOn || null, reason }); break;
      case 'bp-active': call = this.desk.setProgramActive('IR', p.program.programId, p.active, reason); break;
      case 'resubmit-claim': call = this.desk.resubmit('IR', p.claim.orderID, reason); break;
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
          case 'bulk-skip': case 'bulk-overlap': this.picked = new Set(); this.afterRowChange(); break;
          case 'bp-amounts': case 'bp-dates': this.reloadBatch(this.bProg?.programId); break;
          case 'bp-active': this.reloadBatch(p.program.programId); break;
          case 'resubmit-claim':
            this.declines = this.declines.filter(x => x !== p.claim);
            this.notice = `Claim ${p.claim.orderID} is back in the approval queue.`;
            break;
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
