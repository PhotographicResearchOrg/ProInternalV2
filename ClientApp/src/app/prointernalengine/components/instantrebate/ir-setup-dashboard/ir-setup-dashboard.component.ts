// src/app/accountmanagement/ir-setup-dashboard/ir-setup-dashboard.component.ts
//
// IR Setup — landing page of cards with click-through workspaces.
// REVERSE-COMPATIBLE: reads your existing DataService methods and renders on
// today's backend. Writes that need new SQL/APIs (terms save, corrections,
// purgatory, custom fields) are stubbed and toast — swap the stub bodies for
// real calls as you flow them through. Nothing here breaks if the new columns
// don't exist yet.

import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import * as XLSX from 'xlsx';
import { DataService } from 'src/app/services/data.service';
import { RebateVendor, InstantRebate } from 'src/app/models/Dashboard/InstantRebate';
import { DeclinedIR } from 'src/app/models/Dashboard/DeclinedIR';

type View = 'home' | 'vendor' | 'declines' | 'batches' | 'corrections' | 'upload' | 'purgatory';

@Component({
  selector: 'app-ir-setup-dashboard',
  templateUrl: './ir-setup-dashboard.component.html',
  styleUrls: ['./ir-setup-dashboard.component.scss'],
  providers: [MessageService]
})
export class IrSetupDashboardComponent implements OnInit {

  /** Optional: hook this if you'd rather route than switch views internally. */
  @Output() navigate = new EventEmitter<{ view: View; payload?: any }>();

  view: View = 'home';
  loading = true;

  vendors: RebateVendor[] = [];
  declines: DeclinedIR[] = [];
  batches: InstantRebate[] = [];

  // search card
  vendorSearch = '';
  // declines workspace
  declineSearch = '';

  // selected vendor (search click-through)
  selectedVendor: RebateVendor | null = null;

  // Upload Template · Format (per vendor/brand)
  templateName = 'IR Standard';
  templateColumns: { name: string; computed?: boolean }[] = [
    { name: 'Vendor / Brand' }, { name: 'Product Description' }, { name: 'PRO Code (Primary)' },
    { name: 'Instant Rebate' }, { name: 'Member Reimbursement', computed: true }, { name: 'MAP' },
    { name: 'Start Date' }, { name: 'End Date' }, { name: 'Stack Product' }, { name: 'Rebate Type' }
  ];
  // stored template file (download + email)
  templateFile: File | null = null;
  templateUrl: string | null = null;      // stored URL from API, or local object URL this session
  templateFileName = '';
  templateUpdatedOn: Date | null = null;
  showEmail = false;
  emailForm = { to: '', subject: '', body: '' };

  // Upload-format / ingest-profile editor (parses the stored file client-side)
  showFormat = false;
  detectedSheets: string[] = [];
  detectedColumns: string[] = [];
  private _wb: any = null;
  mapFields = [
    { key: 'proCode', label: 'PRO Code (from SKU)', req: true },
    { key: 'description', label: 'Product Description', req: false },
    { key: 'instantRebate', label: 'Instant Rebate ($)', req: true },
    { key: 'map', label: 'MAP', req: false },
    { key: 'start', label: 'Start Date', req: false },
    { key: 'end', label: 'End Date', req: false },
    { key: 'rebateType', label: 'Rebate Type', req: false }
  ];
  fmt: {
    sheet: string; headerRow: number; map: { [k: string]: string };
    reimb: 'computed' | 'column'; reimbColumn: string;
    norm: { stripPrefix: string; addPrefix: string; stripSuffix: string; addSuffix: string };
    sampleSku: string;
  } = {
      sheet: '', headerRow: 1, map: {}, reimb: 'computed', reimbColumn: '',
      norm: { stripPrefix: '', addPrefix: '', stripSuffix: '', addSuffix: '' }, sampleSku: ''
    };
  mappingBusy = false;
  mappingConfidence: { [k: string]: number } = {};

  // Program Template · Defaults (vendor-level, stamped on batches)
  defReimbPct: number | null = null;
  defPadPct: number | null = null;
  expireDays: number | null = null;
  defRebateType = 2;
  rollingWeeks = 0;

  rebateTypes = [
    { label: 'IR', value: 2 }, { label: 'Trade-In Trade-Up', value: 3 },
    { label: 'Bundle', value: 4 }, { label: 'Coupon', value: 5 }, { label: 'Social Media', value: 6 }
  ];

  // Custom fields (stub persist)
  customFields: { id: number; label: string; type: string; value: string }[] = [];
  fieldTypes = ['text', 'number', 'percent', 'currency', 'date', 'yes/no', 'link'];
  showAddField = false;
  newField = { label: '', type: 'text', value: '' };

  // Single program setup — the override lives HERE (inherits vendor default)
  showProgram = false;
  program = { model: '', proCode: '', ir: null as number | null, map: null as number | null, start: '', end: '', reimbPct: null as number | null, padPct: null as number | null };

  // Audit — who / what / when (local session feed until wired to your audit table)
  auditLog: { who: string; action: string; detail: string; when: Date }[] = [];

  constructor(private dataService: DataService, private messageService: MessageService) { }

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    this.dataService.getAllRebateVendors().subscribe({
      next: v => { this.vendors = v || []; this.loading = false; },
      error: () => { this.loading = false; this.warn('Could not load vendors'); }
    });
    this.dataService.GetDeclinedInstantRebates().subscribe({
      next: d => this.declines = d || [],
      error: () => { }
    });
    this.dataService.GetInstantRebateBatches().subscribe({
      next: b => this.batches = b || [],
      error: () => { }
    });
  }

  // ---------- counts for stat cards ----------
  get vendorCount(): number { return this.vendors.length; }
  get activeCount(): number { return this.vendors.filter(v => v.active).length; }
  get irCount(): number { return this.vendors.filter(v => v.isInstantRebate).length; }
  get ppCount(): number { return this.vendors.filter(v => !v.isInstantRebate).length; }
  get declineCount(): number { return this.declines.length; }
  get batchCount(): number { return this.batches.length; }
  get activeBatchCount(): number { return this.batches.filter(b => !b.expired).length; }

  // ---------- vendor search ----------
  get filteredVendors(): RebateVendor[] {
    const t = this.vendorSearch.trim().toLowerCase();
    if (!t) return [];
    return this.vendors.filter(v =>
      v.vendorName?.toLowerCase().includes(t) ||
      v.parentCompany?.toLowerCase().includes(t) ||
      (v.apmstid || '').toLowerCase().includes(t)
    ).slice(0, 12);
  }

  // ---------- navigation ----------
  open(view: View, payload?: any): void {
    this.view = view;
    if (view === 'vendor' && payload) this.selectVendor(payload);
    this.navigate.emit({ view, payload }); // optional external routing hook
  }
  back(): void { this.view = 'home'; this.selectedVendor = null; }

  selectVendor(v: RebateVendor): void {
    this.selectedVendor = v;
    this.view = 'vendor';
    // Reverse-compatible: read config if the columns already exist, else defaults.
    this.defReimbPct = (v as any).reimbursementPct ?? null;
    this.defPadPct = (v as any).proPadPct ?? null;
    this.expireDays = (v as any).expireDays ?? null;
    this.templateName = (v as any).uploadTemplate ?? 'IR Standard';
    this.templateUrl = (v as any).templateUrl ?? null;
    this.templateFileName = (v as any).templateFileName ?? '';
    this.templateUpdatedOn = (v as any).templateUpdatedOn ? new Date((v as any).templateUpdatedOn) : null;
    this.templateFile = null;
    this.customFields = [];
    this.auditLog = [];
  }

  // ---------- per-program resolution (variable — computed where the IR is known) ----------
  get programReimb(): number {
    const pct = this.program.reimbPct ?? this.defReimbPct;
    return (this.program.ir != null && pct != null) ? Number(this.program.ir) * (pct / 100) : 0;
  }
  get programPad(): number {
    const pct = this.program.padPct ?? this.defPadPct;
    return (this.program.ir != null && pct != null) ? Number(this.program.ir) * (pct / 100) : 0;
  }
  get programMember(): number { return Number(this.program.ir || 0) + this.programPad; }
  get progReimbPct(): number | null { return this.program.reimbPct ?? this.defReimbPct; }

  // ---------- audit (who / what / when) ----------
  private logAudit(action: string, detail: string): void {
    this.auditLog.unshift({ who: 'You', action, detail, when: new Date() });
  }

  toggleActive(): void {
    if (!this.selectedVendor) return;
    const v = this.selectedVendor;
    v.active = !v.active;
    // Reverse-compatible: reuse your existing update endpoint.
    this.dataService.updateRebateVendor(v).subscribe({
      next: () => { this.ok(`${v.vendorName} set ${v.active ? 'Active' : 'Inactive'}`); this.logAudit('set status', v.active ? 'Active' : 'Inactive'); },
      error: () => { v.active = !v.active; this.warn('Could not update status'); }
    });
  }

  saveDefaults(): void {
    this.logAudit('saved program defaults', `reimb ${this.defReimbPct ?? '—'}% · pad ${this.defPadPct ?? '—'}% · expire ${this.expireDays ?? '—'}d`);
    this.ok('Defaults saved locally — connect saveVendorDefaults() to persist.');
  }

  async openFormat(): Promise<void> {
    this.detectedSheets = []; this.detectedColumns = []; this._wb = null;
    if (this.templateFile) {
      try {
        const buf = await this.templateFile.arrayBuffer();
        this._wb = XLSX.read(buf, { type: 'array' });
        this.detectedSheets = this._wb.SheetNames || [];
        if (!this.fmt.sheet || !this.detectedSheets.includes(this.fmt.sheet)) this.fmt.sheet = this.detectedSheets[0] || '';
        this.detectColumns();
      } catch { this.warn('Could not read the stored file — enter columns manually.'); }
    }
    this.showFormat = true;
  }
  detectColumns(): void {
    if (!this._wb || !this.fmt.sheet) { this.detectedColumns = []; return; }
    try {
      const ws = this._wb.Sheets[this.fmt.sheet];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
      const hdr = rows[Math.max(0, (this.fmt.headerRow || 1) - 1)] || [];
      this.detectedColumns = hdr.map((h: any) => String(h ?? '').replace(/\s+/g, ' ').trim()).filter((h: string) => !!h);
    } catch { this.detectedColumns = []; }
  }
  get normalizedSku(): string {
    let s = (this.fmt.sampleSku || '').trim();
    const n = this.fmt.norm;
    if (n.stripPrefix && s.startsWith(n.stripPrefix)) s = s.slice(n.stripPrefix.length);
    if (n.stripSuffix && s.endsWith(n.stripSuffix)) s = s.slice(0, s.length - n.stripSuffix.length);
    s = (n.addPrefix || '') + s + (n.addSuffix || '');
    return s || '—';
  }
  saveFormat(): void {
    // TODO(you): dataService.saveIngestProfile(vendorId, this.fmt)
    this.logAudit('saved upload format', `${this.fmt.sheet || 'sheet'} · header row ${this.fmt.headerRow}`);
    this.showFormat = false;
    this.ok('Format saved locally — connect saveIngestProfile() to persist.');
  }

  // ---- auto-map: fast local name match (works with no backend) ----
  autoMap(): void {
    if (!this.detectedColumns.length) { this.warn('Detect columns first (upload a file / set the sheet).'); return; }
    const cols = this.detectedColumns;
    const pick = (keys: string[]) => cols.find(c => keys.some(k => c.toLowerCase().includes(k))) || '';
    this.fmt.map['proCode'] = pick(['pro code', 'procode', 'sku', 'item number', 'item no', 'cat', 'upc', 'model']);
    this.fmt.map['description'] = pick(['description', 'product name', 'series', 'spec', 'item desc']);
    this.fmt.map['instantRebate'] = pick(['instant rebate', '$ discount', '$/unit', 'discount amount', 'promotion price', 'promo']);
    this.fmt.map['map'] = pick(['map', 'msrp', 'ws price']);
    this.fmt.map['start'] = pick(['start', 'from', 'begin']);
    this.fmt.map['end'] = pick(['end', 'until', 'thru', 'expire']);
    this.fmt.map['rebateType'] = pick(['rebate type', 'promote way', 'type']);
    const reimbCol = pick(['reimbursement', 'reimburse', 'wholesale rebate', 'credit']);
    if (reimbCol) { this.fmt.reimb = 'column'; this.fmt.reimbColumn = reimbCol; }
    this.mappingConfidence = {};
    this.ok('Auto-mapped by column name — review, then Save.');
  }

  // ---- auto-map: AI suggestion (propose → human confirms). Falls back if not wired. ----
  aiAutoMap(): void {
    if (!this.detectedColumns.length) { this.warn('Detect columns first.'); return; }
    const payload = this.buildMappingPayload();
    const svc: any = this.dataService as any;
    // Wire svc.suggestMapping() to a backend endpoint that calls the Claude Messages API
    // (keep the key server-side). Prompt it with payload; require JSON-only output:
    //   { "map": { proCode, description, instantRebate, map, start, end, rebateType },
    //     "norm": { stripPrefix, addPrefix, stripSuffix, addSuffix },
    //     "reimb": "computed" | "column", "reimbColumn": "",
    //     "confidence": { "<field>": 0-100 } }
    // Only choose column names present in payload.columns; leave a field null if unsure.
    if (typeof svc.suggestMapping === 'function') {
      this.mappingBusy = true;
      svc.suggestMapping(payload).subscribe({
        next: (res: any) => { this.applySuggestion(res); this.mappingBusy = false; this.ok('AI proposed a mapping — review, then Save.'); },
        error: () => { this.mappingBusy = false; this.warn('AI mapping failed — used name match instead.'); this.autoMap(); }
      });
    } else {
      this.autoMap();
      this.stub('AI mapping not wired — used name match. Connect suggestMapping() to your Claude backend.');
    }
  }

  private buildMappingPayload() {
    return {
      targetFields: this.mapFields.map(f => ({ key: f.key, label: f.label, required: f.req })),
      columns: this.detectedColumns,
      sampleRows: this.sampleRows(3)
    };
  }
  private sampleRows(n: number): string[][] {
    if (!this._wb || !this.fmt.sheet) return [];
    try {
      const ws = this._wb.Sheets[this.fmt.sheet];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
      const start = Math.max(0, this.fmt.headerRow || 1); // first data row after the header
      return rows.slice(start, start + n).map(r => (r || []).map((v: any) => v == null ? '' : String(v)));
    } catch { return []; }
  }
  private applySuggestion(res: any): void {
    if (!res) return;
    const valid = new Set(this.detectedColumns);
    const m = res.map || res.mapping || {};
    for (const f of this.mapFields) {
      const col = m[f.key];
      if (col && valid.has(col)) this.fmt.map[f.key] = col;   // never invent a column
    }
    if (res.norm) this.fmt.norm = { ...this.fmt.norm, ...res.norm };
    if (res.reimb === 'computed' || res.reimb === 'column') this.fmt.reimb = res.reimb;
    if (res.reimbColumn && valid.has(res.reimbColumn)) this.fmt.reimbColumn = res.reimbColumn;
    this.mappingConfidence = res.confidence || {};
  }

  uploadTemplateFile(ev: any): void {
    const file: File = ev?.target?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) { this.warn('Template must be an .xlsx file'); return; }
    this.templateFile = file;
    this.templateFileName = file.name;
    this.templateUpdatedOn = new Date();
    try { this.templateUrl = URL.createObjectURL(file); } catch { this.templateUrl = null; } // lets Download work this session
    // TODO(you): persist — const fd = new FormData(); fd.append('file', file); fd.append('location','RebateVendorTemplate');
    //            dataService.uploadVendorTemplate(vendorId, fd).subscribe(url => store url on the vendor)
    this.logAudit('uploaded template', file.name);
    this.ok(`Stored "${file.name}" locally — connect uploadVendorTemplate() to persist.`);
    if (ev?.target) ev.target.value = '';
  }

  downloadVendorTemplate(): void {
    window.open(this.templateUrl || '/assets/RebateIRTemplate.xlsx', '_blank');
  }

  openEmailTemplate(): void {
    const name = this.selectedVendor?.vendorName || 'Vendor';
    this.emailForm = {
      to: '',
      subject: `${name} — IR Upload Template`,
      body: `Hi,\n\nAttached is the Instant Rebate upload template for ${name}. Please populate the PRO codes and rebate amounts and return it for processing.\n\nThanks,`
    };
    this.showEmail = true;
  }
  sendTemplateEmail(): void {
    if (!this.emailForm.to.trim()) { this.warn('Enter a recipient email'); return; }
    if (!this.templateFileName && !this.templateUrl) { this.warn('No template stored to attach'); return; }
    // TODO(you): dataService.emailVendorTemplate(vendorId, this.emailForm) — server attaches the stored file
    this.logAudit('emailed template', `${this.templateFileName || this.templateName} → ${this.emailForm.to}`);
    this.showEmail = false;
    this.ok(`Email queued to ${this.emailForm.to} — connect emailVendorTemplate() to send with the attachment.`);
  }

  openAddField(): void { this.newField = { label: '', type: 'text', value: '' }; this.showAddField = true; }
  addField(): void {
    if (!this.newField.label.trim()) { this.warn('Name the field'); return; }
    this.customFields.push({ id: Date.now(), ...this.newField });
    this.logAudit('added custom field', this.newField.label);
    this.showAddField = false;
    this.ok(`Field "${this.newField.label}" added (local) — connect custom-field API to persist.`);
  }
  removeField(id: number): void {
    const f = this.customFields.find(x => x.id === id);
    this.customFields = this.customFields.filter(x => x.id !== id);
    if (f) this.logAudit('removed custom field', f.label);
  }

  openProgram(): void {
    this.program = { model: '', proCode: '', ir: null, map: null, start: '', end: '', reimbPct: this.defReimbPct, padPct: this.defPadPct };
    this.showProgram = true;
  }
  saveProgram(): void {
    if (!this.program.proCode || this.program.ir == null) { this.warn('PRO code and IR amount are required'); return; }
    // TODO(you): dataService.insertProgram({ ...program, reimbursement: programReimb, vendorId: selectedVendor.id })
    this.logAudit('created program', `${this.program.proCode} · IR ${this.program.ir} → reimb ${this.programReimb}`);
    this.showProgram = false;
    this.ok('Program staged — reimbursement computed. Connect insertProgram() to persist.');
  }

  // ---------- Declines ----------
  get filteredDeclines(): DeclinedIR[] {
    const t = this.declineSearch.trim().toLowerCase();
    if (!t) return this.declines;
    return this.declines.filter(d =>
      String((d as any).orderID ?? '').toLowerCase().includes(t) ||
      String((d as any).memberID ?? '').toLowerCase().includes(t) ||
      String((d as any).model ?? '').toLowerCase().includes(t) ||
      String((d as any).rejectReason ?? '').toLowerCase().includes(t)
    );
  }

  // ---------- Batch management (fully wired to your methods) ----------
  batchActive(b: InstantRebate): boolean { return !b.expired; }

  activateBatch(b: InstantRebate): void {
    const next = !b.expired;
    this.dataService.activateIRBatch(b.batchID).subscribe({
      next: () => {
        b.expired = next;
        this.ok(`Batch ${b.batchID} marked ${next ? 'Expired' : 'Active'}`);
      },
      error: () => this.warn(`Could not update batch ${b.batchID}`)
    });
  }

  downloadBatch(batchID: number): void {
    this.dataService.pullIRBatchDetail(batchID).subscribe(resp => {
      const wb = XLSX.utils.book_new();
      if (resp?.summary?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resp.summary), 'Summary');
      if (resp?.detail?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resp.detail), 'Detail');
      XLSX.writeFile(wb, `Batch_${batchID}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
  }

  globalFilter(table: Table, event: Event): void {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

  // ---------- stubs for not-yet-wired write surfaces ----------
  stub(msg = "This flow isn't wired yet — coming next"): void { this.messageService.add({ severity: 'info', summary: 'Stub', detail: msg }); }

  private ok(detail: string): void { this.messageService.add({ severity: 'success', summary: 'OK', detail }); }
  private warn(detail: string): void { this.messageService.add({ severity: 'warn', summary: 'Heads up', detail }); }

  initials(name: string): string {
    return (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }
}
