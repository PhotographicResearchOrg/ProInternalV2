import { Component } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { RebateIRRowDto, CommitResult, CommitRequest } from 'src/app/models/IR/IRLoad';
import { utils as XLSXUtils, writeFile as XLSXWriteFile, WorkBook } from 'xlsx';
import { MessageService } from 'primeng/api';

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast';


@Component({
  selector: 'app-rebate-excel-uploader',
  templateUrl: './rebate-excel-uploader.component.html',
  styleUrls: ['./rebate-excel-uploader.component.scss']
})


export class RebateExcelUploaderComponent {

  constructor(private dataService: DataService, private messageService: MessageService) { }

  isDragOver = false;
  selectedFile: File | null = null;
  expireDate: Date = new Date();
  previewRows: any[] = []; // Will be populated by API response
  isLoading = false;
  selectedRows: RebateIRRowDto[] = [];
  density: 'comfortable' | 'compact' = 'compact';
  commitResult?: CommitResult;

 REBATE_TYPES: Record<number, { label: string; severity: TagSeverity }> = {
  2: { label: 'IR', severity: 'success' },
  3: { label: 'Trade-In Trade-Up', severity: 'info' },
  4: { label: 'Bundle', severity: 'warning' },
  5: { label: 'Coupon', severity: 'secondary' },
  6: { label: 'Social Media', severity: 'info' } // was 'help' -> use 'info'
};

  commitSeverity(status?: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    const s = (status || '').toLowerCase();
    if (s.startsWith('error')) return 'danger';
    if (s.includes('update')) return 'info';
    if (s.startsWith('skipped')) return 'secondary';
    if (s.includes('insert')) return 'success';
    return 'warning';
  }


  ngOnInit() {
    const saved = localStorage.getItem('irDensity') as 'comfortable' | 'compact' | null;
    if (saved) this.density = saved;
  }


  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  setDensity(val: 'comfortable' | 'compact') {
    this.density = val;
    // optional: remember choice
    localStorage.setItem('irDensity', val);
  }


  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelect(event: any): void {
    const file = event.target.files[0];
    this.handleFile(file);
  }

  handleFile(file: File): void {
    if (file.name.endsWith('.xlsx')) {
      this.selectedFile = file;
    } else {
      alert('Invalid file type. Only .xlsx supported.');
    }
  }

  clearFile(): void {
    this.selectedFile = null;
    this.previewRows = [];


    this.commitResult = undefined;   // <-- hides the summary chips

  }

rebateTypeLabel(t ?: number | null): string {
  return (t != null && this.REBATE_TYPES[t]) ? this.REBATE_TYPES[t].label : 'Unknown';
}
rebateTypeSeverity(t ?: number | null): TagSeverity {
  return (t != null && this.REBATE_TYPES[t]) ? this.REBATE_TYPES[t].severity : 'contrast';
}

  uploadFile(): void {
    if (!this.selectedFile) return;

    this.isLoading = true;
    this.dataService.uploadIRFile(this.selectedFile, this.expireDate).subscribe({
      next: rows => {
        this.previewRows = rows;
        this.isLoading = false;

        // ✅ Toast: prompt the user to review
        this.messageService.add({
          severity: 'info',
          summary: 'Upload complete',
          detail: 'Review results below.',
          life: 3500
        });
      },
      error: err => {
        this.isLoading = false;
        console.error('Upload failed', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Upload failed',
          detail: (err?.error && (err.error.message || err.error)) || 'Please check the file and try again.',
          life: 5000
        });
      }
    });
  }


  submitSelected() {
    const ids = (this.selectedRows?.length ? this.selectedRows : this.previewRows)
      .map(r => r.previewId)
      .filter((id: number | undefined): id is number => !!id);

    if (!ids.length) {
      this.messageService.add({
        severity: 'info',
        summary: 'No rows selected',
        detail: 'Select rows to submit, or leave none selected to submit all.',
        life: 3000
      });
      return;
    }

    this.isLoading = true;
    const payload: CommitRequest = {
      previewIds: ids,
      dryRun: false,
      overwriteDuplicates: false
    };

    this.dataService.commitIR(payload).subscribe({
      next: (res: CommitResult) => {
        // keep the full result for your summary chips
        this.commitResult = res;

        // apply per-row status/messages to the grid
        const byId = new Map(res.rows.map(r => [r.previewId, r]));
        this.previewRows = this.previewRows.map(r => {
          const m = byId.get(r.previewId);
          return m ? { ...r, commitStatus: m.status, commitMessage: m.message } : r;
        });

        this.selectedRows = [];
        this.isLoading = false;

        // Toast summary
        const hasErrors = (res.errors ?? 0) > 0;
        this.messageService.add({
          severity: hasErrors ? 'warn' : 'success',
          summary: 'Submit complete',
          detail: `Inserted: ${res.inserted} • Updated: ${res.updated} • Skipped: ${res.skipped} • Errors: ${res.errors}`,
          life: 6000
        });
      },
      error: (err) => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Submit failed',
          detail: (err?.error && (err.error.message || err.error)) || 'Please try again.',
          life: 5000
        });
        console.error('Commit failed', err);
      }
    });
  }


  saveProposed(row: RebateIRRowDto) {
    if (!row?.previewId) return;

    const val = (row.proposedModelName || '').trim();
    if (!val) {
      this.messageService.add({ severity: 'warn', summary: 'Cannot save', detail: 'Proposed name cannot be empty.' });
      return;
    }

    // Optional: avoid duplicate saves for unchanged value
    if ((row as any)._lastSavedProposed === val) return;

    (row as any)._saving = true;
    this.dataService.updateProposedModelName(row.previewId, val).subscribe({
      next: () => {
        (row as any)._saving = false;
        (row as any)._lastSavedProposed = val;
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Proposed model name updated.' });
      },
      error: err => {
        (row as any)._saving = false;
        this.messageService.add({ severity: 'error', summary: 'Save failed', detail: 'Could not update proposed name.' });
        console.error('Proposed name update failed', err);
      }
    });
  }





  exportGrid(): void {
    const rows = (this.selectedRows?.length ? this.selectedRows : this.previewRows) || [];
    if (!rows.length) return;

    // map to export-friendly objects (ordered columns)
    const data = rows.map(r => ({
      'PreviewId': r.previewId ?? '',
      'Vendor / Brand': r.vendorBrand ?? '',
      'Product Description': r.productDescription ?? '',
      'Proposed Model Name': r.proposedModelName ?? '',
      'PRO Code (Primary)': r.proCodePrimary ?? r.productCode ?? '',
      'Instant Rebate': this.asNumber(r.instantRebate),
      'Member Reimbursement': this.asNumber(r.memberReimbursement ?? r.reimbursement),
      'MAP': this.asNumber(r.map),
      'Start Date': this.asDate(r.startDate),
      'End Date': this.asDate(r.endDate),
      'Stack Code(s)': r.stackProductCode ?? '',
      'Stack Product (Desc)': r.stackProduct ?? '',
      'Rebate Type': this.rebateTypeLabel(r.rebateType),
      'Disposition': r.dispositionModelID ?? '',
      'Notes': r.notes ?? '',
      'Commit Status': r.commitStatus ?? '',
      'Commit Message': r.commitMessage ?? '',
    }));

    // build worksheet
    const ws = XLSXUtils.json_to_sheet(data, { skipHeader: false });

    // set column widths (rough, in “characters”)
    ws['!cols'] = [
      { wch: 10 }, // PreviewId
      { wch: 18 }, // Vendor / Brand
      { wch: 28 }, // Product Description
      { wch: 36 }, // Proposed Model Name
      { wch: 16 }, // PRO Code
      { wch: 14 }, // Instant Rebate
      { wch: 18 }, // Member Reimbursement
      { wch: 10 }, // MAP
      { wch: 20 }, // Start Date
      { wch: 20 }, // End Date
      { wch: 18 }, // Stack Codes
      { wch: 32 }, // Stack Product (Desc)
      { wch: 16 }, // Rebate Type
      { wch: 12 }, // Disposition
      { wch: 28 }, // Notes
      { wch: 16 }, // Commit Status
      { wch: 30 }, // Commit Message
    ];

    // (optional) apply date number formats for Start/End (columns 9 & 10)
    // NOTE: SheetJS community supports number formats; this tags cells with a date format.
    const range = XLSXUtils.decode_range(ws['!ref']!);
    for (let R = range.s.r + 1; R <= range.e.r; R++) { // skip header row
      for (const C of [8, 9]) { // 0-based index: col 9 & 10 in sheet (Start/End)
        const cellAddr = XLSXUtils.encode_cell({ r: R, c: C });
        const cell = ws[cellAddr];
        if (cell && cell.v instanceof Date) {
          // convert Date object to Excel serial and set format
          const serial = this.dateToExcelSerial(cell.v);
          cell.v = serial;
          cell.t = 'n';
          (cell as any).z = 'm/d/yyyy h:mm AM/PM';
        }
      }
    }

    // build workbook + save
    const wb: WorkBook = XLSXUtils.book_new();
    XLSXUtils.book_append_sheet(wb, ws, 'IR Preview');
    const filename = `IR_Preview_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSXWriteFile(wb, filename);
  }

  // helpers for export
  private asNumber(v: any): number | '' {
    if (v === null || v === undefined || v === '') return '';
    const n = Number(v);
    return Number.isFinite(n) ? n : '';
  }

  private asDate(v: any): Date | '' {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(+d) ? '' : d;
  }

  private dateToExcelSerial(d: Date): number {
    // Excel serial: days since 1899-12-30
    const epoch = Date.UTC(1899, 11, 30);
    return (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()) - epoch) / 86400000;
  }



}
