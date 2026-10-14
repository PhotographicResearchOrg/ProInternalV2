import { Component, OnInit, NgZone, ChangeDetectorRef, ViewChild } from '@angular/core';
import { AccountingService } from 'src/app/services/AccountingService';
import { ConfirmationService, MessageService } from 'primeng/api';
import { VendorCreditForm, UploadedFile, CreditBatchRequestDto } from 'src/app/models/accounting/accounting-credit';
import * as XLSX from 'xlsx';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { saveAs } from 'file-saver';
import { firstValueFrom } from 'rxjs';

type StatusKey = 'ok' | 'noinv' | 'failed';
type HistoryTab = 'all' | StatusKey;

@Component({
  selector: 'app-credits',
  templateUrl: './credits.component.html',
  styleUrls: ['./credits.component.scss']
})
export class CreditsComponent implements OnInit {

  @ViewChild('dt') dt!: any;

  // =====================
  // HISTORY
  // =====================
  credits: any[] = [];
  loading = false;
  dateRange: Date[] | null = null;
  historyTab: HistoryTab = 'all';
  rebuilding = new Set<number>();

  // =====================
  // FORM + QUEUE
  // =====================
  memberResults: { label: string; value: string }[] = [];
  selectedMember: { label: string; value: string } | null = null;
  queue: VendorCreditForm[] = [];
  dragActive = false;
  isSubmitting = false;

  readonly DEFAULT_POSTING_ACCOUNT = '1335';

  postingAccounts = [
    { label: '1320 – IR', value: '1320' },
    { label: '1322 – SARS', value: '1322' },
    { label: '1325 – Pass Through Billing', value: '1325' },
    { label: '1328 – Other Rebates & Patr.', value: '1328' },
    { label: '1335 – Misc', value: '1335' }
  ];

  form: VendorCreditForm = this.blankForm('1320');

  errors = {
    vendorID: false,
    proID: false,
    amount: false,
    description: false
  };

  // =====================
  // PREVIEW MODAL
  // =====================
  previewFile: (UploadedFile & { safeSrc?: SafeResourceUrl }) | null = null;
  previewVisible = false;
  private previewBlobUrl: string | null = null;

  // =====================
  // EMAIL MODAL
  // =====================
  emailOpen = false;
  emailInvoiceNumber: string | null = null;
  emailToText = '';
  emailToList: string[] = [];
  invalidEmails: string[] = [];
  emailNote = '';
  sendingEmail = false;


  constructor(
    private accountingService: AccountingService,
    private confirmationService: ConfirmationService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadCredits();
  }


  // =====================================================
  // STATUS
  // =====================================================
  statusKey(row: any): StatusKey {
    const s = (row?.status ?? '').trim().toUpperCase();
    if (s === 'SUCCESS' || s === 'SUCESS') return 'ok';
    if (s === 'POSTED_NO_INVOICE') return 'noinv';
    return 'failed';   // FAILED + legacy Universe error text
  }

  statusLabel(row: any): string {
    switch (this.statusKey(row)) {
      case 'ok': return 'Posted';
      case 'noinv': return 'No invoice';
      default: return 'Failed';
    }
  }

  statusClass(row: any): string {
    switch (this.statusKey(row)) {
      case 'ok': return 'status-ready';
      case 'noinv': return 'status-exception';
      default: return 'status-hold';
    }
  }

  /** Hover text: the real reason, not just the label */
  statusTitle(row: any): string {
    const key = this.statusKey(row);
    if (key === 'noinv') return row.invoiceError || 'Posted to Universe; invoice PDF not built.';
    if (key === 'failed') return row.errorMessage || row.status || 'Failed';
    return '';
  }

  isNoInvoice(row: any): boolean {
    return this.statusKey(row) === 'noinv';
  }

  hasInvoice(row: any): boolean {
    return !!row?.invoiceNumber?.trim();
  }

  countStatus(key: StatusKey): number {
    return this.credits.filter(c => this.statusKey(c) === key).length;
  }

  get skippedCount(): number {
    return this.credits.filter(c => c.includeInEmail && this.statusKey(c) === 'ok').length;
  }


  // =====================================================
  // HISTORY GRID
  // =====================================================
  loadCredits(): void {
    this.loading = true;
    this.accountingService.getCredits().subscribe({
      next: data => this.credits = data ?? [],
      error: () => this.loading = false,
      complete: () => this.loading = false
    });
  }

  get filteredCredits(): any[] {
    let rows = this.credits;

    if (this.historyTab !== 'all') {
      rows = rows.filter(r => this.statusKey(r) === this.historyTab);
    }

    if (this.dateRange?.length === 2 && this.dateRange[0] && this.dateRange[1]) {
      const start = new Date(this.dateRange[0]);
      start.setHours(0, 0, 0, 0);
      const end = new Date(this.dateRange[1]);
      end.setHours(23, 59, 59, 999);

      rows = rows.filter(r => {
        const d = new Date(r.date);
        return d >= start && d <= end;
      });
    }

    return rows;
  }

  setTab(tab: HistoryTab): void {
    this.historyTab = tab;
    if (this.dt) this.dt.first = 0;
  }

  onSearch(value: string): void {
    this.dt?.filterGlobal(value, 'contains');
  }

  toggleInclude(row: any): void {
    this.accountingService
      .setCreditEmailFlag(row.invoiceNumber, row.includeInEmail)
      .subscribe({
        next: () => this.messageService.add({
          severity: 'success',
          summary: 'Updated',
          detail: `Invoice ${row.invoiceNumber} ${row.includeInEmail ? 'skipped from' : 'included in'} the 6 PM email`
        }),
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update email setting' });
          row.includeInEmail = !row.includeInEmail;   // rollback
        }
      });
  }

  rebuildInvoice(row: any): void {
    if (this.rebuilding.has(row.id)) return;
    this.rebuilding.add(row.id);

    this.accountingService.rebuildInvoice(row.id).subscribe({
      next: res => {
        this.messageService.add({
          severity: 'success',
          summary: 'Invoice rebuilt',
          detail: `Invoice ${res.invoiceNumber} rebuilt.`
        });
        this.rebuilding.delete(row.id);
        this.loadCredits();
      },
      error: err => {
        this.messageService.add({
          severity: 'error',
          summary: 'Rebuild failed',
          detail: err?.error?.error || 'Unable to rebuild invoice.',
          life: 8000
        });
        this.rebuilding.delete(row.id);
      }
    });
  }

  exportCreditsExcel(): void {
    const rows = this.filteredCredits.map(r => ({
      'Pro ID': r.proid,
      'Date': r.date,
      'Description': r.description,
      'PO': r.po,
      'Vendor PO': r.vendorPO,
      'Post Acct': r.postingAccount || r.account,
      'Amount': r.amount,
      'Status': this.statusLabel(r),
      'Invoice': r.invoiceNumber,
      'Entered By': r.userEntered
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Credit History');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `CreditHistory_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }


  // =====================================================
  // QUEUE
  // =====================================================
  private creditKey(item: { proID?: any; po?: any; description?: any; amount?: any }): string {
    return [
      String(item.proID ?? '').trim().toLowerCase(),
      String(item.po ?? '').trim().toLowerCase(),
      String(item.description ?? '').trim().toLowerCase(),
      Number(item.amount).toFixed(2)
    ].join('|');
  }

  get queuedTotal(): number {
    return this.queue.reduce((sum, item) => sum + (item.amount || 0), 0);
  }

  getDuplicateCreditKeys(): Set<string> {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const item of this.queue) {
      const key = this.creditKey(item);
      if (seen.has(key)) duplicates.add(key);
      else seen.add(key);
    }
    return duplicates;
  }

  queueItemIsDuplicate(item: VendorCreditForm): boolean {
    return this.getDuplicateCreditKeys().has(this.creditKey(item));
  }

  isAlreadyPosted(item: VendorCreditForm): boolean {
    const key = this.creditKey(item);
    return this.credits.some(c =>
      this.creditKey({ proID: c.proid, po: c.po, description: c.description, amount: c.amount }) === key
    );
  }

  hasAlreadyPostedInQueue(): boolean {
    return this.queue.some(q => this.isAlreadyPosted(q));
  }

  addToQueue(): void {
    if (!this.validateForm()) return;

    const proId =
      typeof this.form.proID === 'string'
        ? this.form.proID
        : typeof (this.form.proID as any)?.value === 'string'
          ? (this.form.proID as any).value
          : '';

    const queuedItem: VendorCreditForm = {
      vendorID: this.form.vendorID,
      proID: String(proId),
      ezPay: this.form.ezPay,
      po: this.form.po,
      vendorInv: this.form.vendorInv,
      orderDate: this.form.orderDate,
      description: this.form.description,
      amount: Number(this.form.amount),
      postingAccount: this.form.postingAccount,
      files: [...this.form.files]
    };

    this.queue = [...this.queue, queuedItem];
    this.resetForm();
  }

  removeFromQueue(index: number): void {
    this.queue = this.queue.filter((_, i) => i !== index);
  }

  submitBatch(): void {
    if (!this.queue.length || this.isSubmitting) return;

    this.confirmationService.confirm({
      header: 'Apply credits',
      message: `Apply ${this.queue.length} credit(s) totalling ${this.queuedTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}?`,
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.isSubmitting = true;
        this.executeSubmit();
      }
    });
  }

  private executeSubmit(): void {
    const payload: CreditBatchRequestDto = {
      OrderDetails: this.queue.map(row => ({
        ProID: row.proID,
        Amount: row.amount,
        Account: row.proID,
        OrderDate: new Date(row.orderDate).toISOString(),
        Description: row.description,
        PO: row.po || 'N/A',
        VendorInvoice: row.vendorInv || undefined,
        FileIds: row.files.map(f => f.fileId),
        EZPay: row.ezPay,
        postingAccount: row.postingAccount
      }))
    };

    this.accountingService.saveCredits(payload).subscribe({
      next: (res: any) => {
        this.queue = [];
        this.isSubmitting = false;
        this.loadCredits();

        if (res?.duplicatesSkipped > 0) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Duplicates skipped',
            detail: `${res.duplicatesSkipped} credit(s) were already posted and were skipped.`
          });
        } else {
          this.messageService.add({
            severity: 'success',
            summary: 'Credits applied',
            detail: 'Check history for any rows marked No invoice or Failed.'
          });
        }
      },
      error: err => {
        console.error('Credit submit failed', err);
        this.isSubmitting = false;
        this.messageService.add({ severity: 'error', summary: 'Submit failed', detail: 'Credits were not applied.' });
      }
    });
  }


  // =====================================================
  // FORM
  // =====================================================
  searchMember(event: any): void {
    this.accountingService.searchMember(event.query).subscribe(res => {
      this.memberResults = res.map((m: any) => ({
        label: `${m.id} - ${m.hname}`,
        value: m.id
      }));
    });
  }

  onMemberSelect(event: any): void {
    // PrimeNG 16 passes the item, 17+ passes { value }
    const item = event?.value ?? event;
    this.form.proID = String(item?.value ?? '');
  }

  validateForm(): boolean {
    const amt = Number(this.form.amount);
    this.errors.proID = !this.form.proID;
    this.errors.amount = !amt || Math.abs(amt) > 95000;
    this.errors.description = !this.form.description?.trim();
    return !Object.values(this.errors).some(Boolean);
  }

  private blankForm(postingAccount: string): VendorCreditForm {
    return {
      vendorID: '',
      proID: '',
      ezPay: false,
      po: '',
      postingAccount,
      vendorInv: '',
      orderDate: new Date(),
      description: '',
      amount: 0,
      files: []
    };
  }

  private resetForm(): void {
    this.form = this.blankForm(this.DEFAULT_POSTING_ACCOUNT);
    this.selectedMember = null;
    this.errors = { vendorID: false, proID: false, amount: false, description: false };
  }


  // =====================================================
  // FILES
  // =====================================================
  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) this.handleFiles(input.files);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = false;
    if (event.dataTransfer?.files) this.handleFiles(event.dataTransfer.files);
  }

  removeFile(index: number): void {
    this.form = { ...this.form, files: this.form.files.filter((_, i) => i !== index) };
  }

  removeFileFromQueue(queueIndex: number, fileIndex: number): void {
    this.queue = this.queue.map((q, i) =>
      i === queueIndex ? { ...q, files: q.files.filter((_, fi) => fi !== fileIndex) } : q
    );
  }

  addFilesToQueue(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    this.uploadPdfs(input.files, uploaded => {
      const item = this.queue[index];
      const { unique, duplicates } = this.splitDuplicates(item.files, uploaded);

      if (duplicates.length) this.warnDuplicates(duplicates, 'Already attached to this credit');
      if (unique.length) {
        this.queue = this.queue.map((q, i) => i === index ? { ...q, files: [...q.files, ...unique] } : q);
      }
      input.value = '';
    });
  }

  private handleFiles(files: FileList): void {
    this.uploadPdfs(files, uploaded => {
      const { unique, duplicates } = this.splitDuplicates(this.form.files, uploaded);

      if (duplicates.length) this.warnDuplicates(duplicates, 'Already added');
      if (unique.length) {
        this.form = { ...this.form, files: [...this.form.files, ...unique] };
        this.cdr.detectChanges();
      }
    });
  }

  private uploadPdfs(files: FileList, done: (uploaded: UploadedFile[]) => void): void {
    const all = Array.from(files);
    const pdfFiles = all.filter(f => this.isPdf(f));
    const rejected = all.filter(f => !this.isPdf(f)).map(f => f.name);

    if (rejected.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'PDF only',
        detail: `Rejected: ${rejected.join(', ')}`
      });
    }
    if (!pdfFiles.length) return;

    this.accountingService.uploadFiles(pdfFiles as any).subscribe({
      next: results => done(results.map(r => ({ fileId: r.fileId, originalName: r.originalName }))),
      error: err => {
        console.error('UPLOAD FAILED:', err);
        this.messageService.add({ severity: 'error', summary: 'Upload failed', detail: 'Files were not uploaded.' });
      }
    });
  }

  private splitDuplicates(existing: UploadedFile[], incoming: UploadedFile[]) {
    const ids = new Set(existing.map(f => f.fileId));
    return {
      unique: incoming.filter(f => !ids.has(f.fileId)),
      duplicates: incoming.filter(f => ids.has(f.fileId))
    };
  }

  private warnDuplicates(dupes: UploadedFile[], prefix: string): void {
    this.messageService.add({
      severity: 'warn',
      summary: 'Duplicate file skipped',
      detail: `${prefix}: ${dupes.map(d => d.originalName).join(', ')}`
    });
  }

  private isPdf(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  }


  // =====================================================
  // PREVIEW
  // =====================================================
  openPreview(file: UploadedFile): void {
    this.accountingService.getFilePreview(file.fileId).subscribe(blob => this.showBlob(blob, file.originalName, file));
  }

  openInvoicePreview(invoiceNumber: string): void {
    this.accountingService.getInvoicePdf(invoiceNumber).subscribe({
      next: (blob: Blob) => this.showBlob(blob, `Invoice ${invoiceNumber}`),
      error: () => this.messageService.add({
        severity: 'warn',
        summary: 'Not found',
        detail: `No PDF on file for invoice ${invoiceNumber}. Use Rebuild.`
      })
    });
  }

  private showBlob(blob: Blob, name: string, file?: UploadedFile): void {
    this.releasePreview();
    this.previewBlobUrl = URL.createObjectURL(blob);
    this.previewFile = {
      ...(file ?? {} as UploadedFile),
      originalName: name,
      safeSrc: this.sanitizer.bypassSecurityTrustResourceUrl(this.previewBlobUrl)
    };
    this.previewVisible = true;
  }

  closePreview(): void {
    this.previewVisible = false;
    this.previewFile = null;
    this.releasePreview();
  }

  private releasePreview(): void {
    if (this.previewBlobUrl) {
      URL.revokeObjectURL(this.previewBlobUrl);
      this.previewBlobUrl = null;
    }
  }


  // =====================================================
  // EMAIL
  // =====================================================
  openEmail(row: any): void {
    this.emailInvoiceNumber = row.invoiceNumber;
    this.emailToText = '';
    this.emailToList = [];
    this.invalidEmails = [];
    this.emailNote = '';
    this.emailOpen = true;
  }

  closeEmail(): void {
    if (this.sendingEmail) return;
    this.emailOpen = false;
  }

  onEmailTextChange(text: string): void {
    this.emailToText = text;
    this.emailToList = (text || '')
      .split(/[,;\s]+/)
      .map(e => e.trim())
      .filter(Boolean);

    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.invalidEmails = this.emailToList.filter(e => !re.test(e));
  }

  async sendInvoiceEmail(): Promise<void> {
    if (!this.emailInvoiceNumber || !this.emailToList.length || this.invalidEmails.length) return;

    this.sendingEmail = true;
    try {
      await firstValueFrom(this.accountingService.emailInvoice({
        invoiceNumber: this.emailInvoiceNumber,
        to: this.emailToList.join(','),
        note: this.emailNote
      }));

      this.messageService.add({
        severity: 'success',
        summary: 'Email sent',
        detail: `Invoice ${this.emailInvoiceNumber} sent to ${this.emailToList.length} recipient(s).`
      });

      this.sendingEmail = false;
      this.emailOpen = false;
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Email failed',
        detail: (typeof err?.error === 'string' ? err.error : null) || 'Unable to send invoice email.'
      });
      this.sendingEmail = false;
    }
  }
}
