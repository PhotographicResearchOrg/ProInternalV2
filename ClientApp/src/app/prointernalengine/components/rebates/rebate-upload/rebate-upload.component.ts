import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { finalize } from 'rxjs/operators';
import {
  MappingProposal,
  REBATE_FIELDS,
  RebateDeskService,
  apiMessage,
  isoDate
} from 'src/app/services/rebate-desk.service';

/*
 * The upload interview, instant rebates:
 *   1 Vendor and file. The original is kept on S3.
 *   2 Columns. The desk proposes a mapping: the vendor's saved template for
 *     this layout, else the AI, else the header names. The person confirms
 *     or changes it, and chooses the defaults for the whole file.
 *   3 The rows are checked; the parent opens the upload to review and load.
 */
@Component({
  selector: 'app-rebate-upload',
  templateUrl: './rebate-upload.component.html',
  styleUrls: ['../shared/rebate-desk.shared.scss']
})
export class RebateUploadComponent implements OnInit, OnChanges {
  /* Set to re-map an upload that is already in review. */
  @Input() remapUploadId: number | null = null;
  @Output() mapped = new EventEmitter<number>();
  @Output() dirtyChange = new EventEmitter<boolean>();

  readonly fields = REBATE_FIELDS;

  vendors: any[] = [];
  types: any[] = [];

  step: 1 | 2 = 1;
  vendorId: number | null = null;
  file: File | null = null;

  uploadId: number | null = null;
  proposal: MappingProposal | null = null;
  original: { [field: string]: number | null } = {};
  mapping: { [field: string]: number | null } = {};

  defaultRebateType: number | null = null;
  expireOn = '';
  startActive = true;
  fileStart = '';
  fileEnd = '';
  vendorSharePct: number | null = null;
  padPct: number | null = null;

  busy = false;
  error = '';

  constructor(private desk: RebateDeskService) {}

  ngOnInit(): void {
    this.desk.vendors('IR').subscribe(v => (this.vendors = v.filter(x => x.isActive)));
    this.desk.types().subscribe({
      next: t => { this.types = t ?? []; this.preselectType(); },
      error: e => (this.error = 'Rebate types could not be loaded: ' + apiMessage(e))
    });
  }

  /* No type column and no vendor default: most files are plain instant rebates, so start there (it can be changed). */
  private preselectType(): void {
    if (!this.proposal || this.mapping['rebateType'] != null || this.defaultRebateType != null) return;
    const ir = this.types.find(t => /instant/i.test(t.name ?? '')) ?? this.types.find(t => t.rebateTypeId === 2);
    if (ir) this.defaultRebateType = ir.rebateTypeId;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['remapUploadId'] && this.remapUploadId) {
      this.uploadId = this.remapUploadId;
      this.reload(undefined, undefined);
    }
  }

  get edited(): boolean {
    return this.fields.some(f => (this.mapping[f.key] ?? null) !== (this.original[f.key] ?? null));
  }

  get vendorName(): string {
    return this.vendors.find(v => v.vendorId === this.vendorId)?.vendorName ?? '';
  }

  pickFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = input.files && input.files.length ? input.files[0] : null;
    this.dirtyChange.emit(!!this.file);
  }

  start(): void {
    if (!this.vendorId || !this.file) return;
    this.busy = true;
    this.error = '';
    this.desk.upload(this.vendorId, this.file)
      .pipe(finalize(() => (this.busy = false)))
      .subscribe({
        next: r => {
          this.uploadId = r.uploadId;
          this.useProposal(r.proposal);
        },
        error: e => (this.error = apiMessage(e, 'The file could not be uploaded.'))
      });
  }

  /* A different sheet, or the person says the column names are on another row. */
  reload(sheetName?: string, headerRow?: number): void {
    if (!this.uploadId) return;
    this.busy = true;
    this.error = '';
    this.desk.proposal(this.uploadId, sheetName ?? this.proposal?.sheetName ?? '', headerRow ?? this.proposal?.headerRow ?? 0)
      .pipe(finalize(() => (this.busy = false)))
      .subscribe({
        next: p => this.useProposal(p),
        error: e => (this.error = apiMessage(e))
      });
  }

  private useProposal(p: MappingProposal): void {
    this.proposal = p;
    this.original = { ...p.mapping };
    this.mapping = { ...p.mapping };
    if (!this.expireOn && p.suggestedExpireOn) this.expireOn = isoDate(p.suggestedExpireOn);
    if (!this.fileStart && p.fileStartDate) this.fileStart = isoDate(p.fileStartDate);
    if (!this.fileEnd && p.fileEndDate) this.fileEnd = isoDate(p.fileEndDate);
    if (this.vendorSharePct == null && p.vendorSharePct != null) this.vendorSharePct = p.vendorSharePct;
    if (this.padPct == null && p.padPct != null) this.padPct = p.padPct;
    if (this.defaultRebateType == null && p.defaultRebateType != null) this.defaultRebateType = p.defaultRebateType;
    this.preselectType();
    this.step = 2;
    this.dirtyChange.emit(true);
  }

  /* Column → field, for the select above each column. */
  fieldFor(col: number): string {
    return this.fields.find(f => this.mapping[f.key] === col)?.key ?? '';
  }

  setColumn(col: number, field: string): void {
    this.fields.forEach(f => { if (this.mapping[f.key] === col) this.mapping[f.key] = null; });
    if (field) this.mapping[field] = col;
  }

  columnLetter(i: number): string {
    let n = i + 1, s = '';
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  missing(): string[] {
    const out: string[] = [];
    if (this.mapping['vendorSku'] == null && this.mapping['upc'] == null && this.mapping['proCode'] == null) out.push('Vendor SKU, UPC or PRO code');
    if (this.mapping['reimbursement'] == null && !(this.vendorSharePct && this.mapping['instantRebate'] != null))
      out.push('Reimbursement column (or a vendor share % with an instant rebate column)');
    if (this.mapping['startDate'] == null && !this.fileStart) out.push('Start date (column or for the whole file)');
    if (this.mapping['endDate'] == null && !this.fileEnd) out.push('End date (column or for the whole file)');
    if (this.mapping['rebateType'] == null && this.defaultRebateType == null) out.push('Rebate type (column or default)');
    if (!this.expireOn) out.push('Claim expiry');
    return out;
  }

  apply(): void {
    if (!this.uploadId || !this.proposal || this.missing().length) return;
    this.busy = true;
    this.error = '';
    this.desk.applyMapping(this.uploadId, {
      sheetName: this.proposal.sheetName,
      headerRow: this.proposal.headerRow,
      mapping: this.mapping,
      proposalSource: this.proposal.source,
      templateId: this.proposal.templateId ?? null,
      edited: this.edited,
      defaultRebateType: this.defaultRebateType,
      expireOn: this.expireOn || null,
      startActive: this.startActive,
      defaultStartDate: this.fileStart || null,
      defaultEndDate: this.fileEnd || null,
      vendorSharePct: this.vendorSharePct,
      padPct: this.padPct
    })
      .pipe(finalize(() => (this.busy = false)))
      .subscribe({
        next: () => {
          const id = this.uploadId!;
          this.resetAll();
          this.mapped.emit(id);
        },
        error: e => (this.error = apiMessage(e))
      });
  }

  resetAll(): void {
    this.step = 1;
    this.file = null;
    this.uploadId = null;
    this.proposal = null;
    this.mapping = {};
    this.original = {};
    this.defaultRebateType = null;
    this.expireOn = '';
    this.startActive = true;
    this.fileStart = '';
    this.fileEnd = '';
    this.vendorSharePct = null;
    this.padPct = null;
    this.error = '';
    this.dirtyChange.emit(false);
  }

  sourceLabel(s: string | undefined): string {
    return s === 'TEMPLATE' ? 'Saved layout' : s === 'AI' ? 'AI proposal' : 'Header names';
  }
}
