import { Component, OnInit, NgZone, ChangeDetectorRef, ViewChild } from '@angular/core';
import { AccountingService } from 'src/app/services/AccountingService'
import { ConfirmationService } from 'primeng/api';
import { VendorCreditForm, UploadedFile, CreditBatchRequestDto } from 'src/app/models/accounting/accounting-credit'
import * as XLSX from 'xlsx';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { saveAs } from 'file-saver';
import { forkJoin } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';


@Component({
  selector: 'app-credits',
  templateUrl: './credits.component.html',
  styleUrls: ['./credits.component.scss']
})
export class CreditsComponent implements OnInit {

  @ViewChild('invoiceEmailOp') invoiceEmailOp!: any;
  @ViewChild('dt') dt!: any;

  // =====================
  // GRID STATE
  // =====================
  credits: any[] = [];
  loading = false;
  memberResults: { label: string; value: string }[] = [];
  private uploading = new Set<string>(); // prevents duplicates
  previewFile: (UploadedFile & { safeSrc?: SafeResourceUrl }) | null = null;
  previewVisible = false;
  dateRange: Date[] | null = null;
  statusFilter: 'success' | 'failed' | null = null;
  selectedMember: { label: string; value: string } | null = null;

  postingAccounts = [
    { label: '1320 – Generic', value: '1320' },
    { label: '1322 – Vendor Rebates', value: '1322' },
    { label: '1325 – Pass Through Billing', value: '1325' },
    { label: '1330 – Other Rebates & Patr.', value: '1330' },
    { label: '1335 – Misc ', value: '1335' }
  ];

  emailInvoiceNumber: string | null = null;
  emailToList: string[] = [];
  invalidEmails: string[] = [];
  emailNote = '';
  sendingEmail = false;
  emailItems: any[] = [];

  isSubmitting = false;
  readonly DEFAULT_POSTING_ACCOUNT = '1320';


  private creditKey(item: VendorCreditForm): string {
    return [
      item.proID?.trim().toLowerCase(),          // MEMBER
      (item.po ?? '').trim().toLowerCase(),      // PO
      item.description?.trim().toLowerCase(),    // DESCRIPTION
      Number(item.amount).toFixed(2)             // AMOUNT (normalized)
    ].join('|');
  }



  // =====================
  // QUEUE + FORM
  // =====================
  queue: VendorCreditForm[] = [];
  dragActive = false;

  form: VendorCreditForm = {
    vendorID: '',
    proID: '',  
    ezPay: false,
    po: '',
    postingAccount: '1320',
    vendorInv: '',
    orderDate: new Date(),
    description: '',
    amount: 0,
    files: []
  };

  // =====================
  // INLINE VALIDATION
  // =====================
  errors = {
    vendorID: false,
    proID: false,
    amount: false,
    description: false
  };


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

    if (this.dt) {
      this.dt.first = 0;
    }

  }

  hasAlreadyPostedInQueue(): boolean {
    return this.queue.some(q => this.isAlreadyPosted(q));
  }

  isDuplicateOrPosted(row: VendorCreditForm): boolean {
    return this.queueItemIsDuplicate(row) || this.isAlreadyPosted(row);
  }

  isAlreadyPosted(item: VendorCreditForm): boolean {
    const key = this.creditKey(item);

    return this.credits.some(c =>
      [
        String(c.proid).trim().toLowerCase(),
        (c.po ?? '').trim().toLowerCase(),
        c.description?.trim().toLowerCase(),
        Number(c.amount).toFixed(2)
      ].join('|') === key
    );
  }



  get queuedTotal(): number {
    return this.queue.reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    );
  }


  getDuplicateCreditKeys(): Set<string> {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const item of this.queue) {
      const key = this.creditKey(item);
      if (seen.has(key)) {
        duplicates.add(key);
      } else {
        seen.add(key);
      }
    }

    return duplicates;
  }

  queueItemIsDuplicate(item: VendorCreditForm): boolean {
    return this.getDuplicateCreditKeys().has(this.creditKey(item));
  }



  searchMember(event: any) {
    const term = event.query;

    this.accountingService.searchMember(term).subscribe(res => {
      this.memberResults = res.map((m: any) => ({
        label: `${m.id} - ${m.hname}`,
        value: m.id
      }));
    });
  }


  openInvoiceEmail(row: any) {
    this.emailInvoiceNumber = row.invoiceNumber;
    this.emailToList = [];
    this.invalidEmails = [];
    this.emailNote = '';
    this.invoiceEmailOp.show();
  }


  onEmailListChange(list: string[]) {
    this.emailToList = list || [];

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    this.invalidEmails = this.emailToList.filter(
      e => !emailRegex.test(e)
    );
  }



  openEmailPanel(
    event: Event,
    panel: any,
    row: any
  ) {
    event.stopPropagation();
    // 🔑 THIS IS WHAT SEND USES
    this.emailInvoiceNumber = row.invoiceNumber;

    // reset state
    this.emailToList = [];
    this.invalidEmails = [];
    this.emailNote = '';

    panel.toggle(event);
  }



  async sendInvoiceEmail(panel: any) {

    if (!this.emailInvoiceNumber || !this.emailToList.length) return;

    this.sendingEmail = true;

    try {
      await firstValueFrom(
        this.accountingService.emailInvoice({
          invoiceNumber: this.emailInvoiceNumber,
          to: this.emailToList.join(','),
          note: this.emailNote
        })
      );

      // ✅ SUCCESS MESSAGE
      this.messageService.add({
        severity: 'success',
        summary: 'Email Sent',
        detail: `Invoice ${this.emailInvoiceNumber} was emailed successfully.`
      });

      panel.hide();

      // reset state
      this.emailToList = [];
      this.emailNote = '';
      this.emailInvoiceNumber = null;

    } catch (err: any) {

      // ❌ ERROR MESSAGE
      this.messageService.add({
        severity: 'error',
        summary: 'Email Failed',
        detail: err?.error || 'Unable to send invoice email.'
      });

    } finally {
      this.sendingEmail = false;
    }
  }




  openInvoice(invoiceNumber: string) {
    if (!invoiceNumber) return;

    const url = `/ProcessInvoice/${invoiceNumber}.pdf`;
    window.open(url, '_blank', 'noopener');
  }


  openInvoicePreview(invoiceNumber: string): void {
    this.accountingService.getInvoicePdf(invoiceNumber)
      .subscribe((blob: Blob) => {

        const blobUrl = URL.createObjectURL(blob);

        this.previewFile = {
          originalName: `Invoice_${invoiceNumber}.pdf`,
          safeSrc: this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl)
        } as any;

        this.previewVisible = true;
      });
  }


  get filteredCredits() {
    if (!this.dateRange || this.dateRange.length !== 2) {
      return this.credits;
    }

    const [start, end] = this.dateRange;

    if (!start || !end) {
      return this.credits;
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999); // 🔥 critical fix

    return this.credits.filter(r => {
      const rowDate = new Date(r.date);
      return rowDate >= startDate && rowDate <= endDate;
    });
  }


  openHistoryFile(row: any) {
    if (!row.fileId) return;
    this.openPreview({ fileId: row.fileId, originalName: row.fileName });
  }

  onMemberSelect(event: any): void {
    // HARD RULE: proID is STRING ONLY
    this.form.proID = event.value;
  }

  openPreview(file: UploadedFile): void {
    this.accountingService.getFilePreview(file.fileId)
      .subscribe(blob => {

        const blobUrl = URL.createObjectURL(blob);

        this.previewFile = {
          ...file,
          safeSrc: this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl)
        };

        this.previewVisible = true;
      });
  }





  closePreview(): void {
    this.previewVisible = false;
    this.previewFile = null;
  }


  exportCreditsExcel(): void {
    const rows = this.credits.map(r => ({
      'Pro ID': r.proid,
      'Date': r.date,
      'Description': r.description,
      'PO': r.po,
      'Vendor PO': r.vendorPO,
      'Amount': r.amount,
      'Status': r.status,
      'Invoice': r.invoiceNumber,
      'File': r.fileName,
      'Entered By': r.userEntered
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Credit History');

    const buffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    saveAs(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }),
      `CreditHistory_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }





  submitBatch(): void {
    if (!this.queue.length || this.isSubmitting) return;

    this.confirmationService.confirm({
      header: 'Apply Credits',
      message: `You are about to apply ${this.queue.length} credit(s). Continue?`,
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
        OrderDate: row.orderDate.toISOString(),
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
        this.loadCredits();
        this.isSubmitting = false;
        if (res?.duplicatesSkipped > 0) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Duplicate Credits Skipped',
            detail: `${res.duplicatesSkipped} credit(s) were already posted and were skipped.`
          });
        } else {
          this.messageService.add({
            severity: 'success',
            summary: 'Credits Applied',
            detail: 'All credits were processed successfully.'
          });
        }
      },

      error: err => {
        console.error('Credit submit failed', err);
        this.isSubmitting = false;
      }
    });
  }


  getInvoiceUrl(invoiceNumber: string): string {
    return `/ProcessInvoice/${invoiceNumber}.pdf`;
  }

  // =====================
  // HISTORY GRID
  // =====================
  loadCredits(): void {
    this.loading = true;
    this.accountingService.getCredits().subscribe({
      next: data => this.credits = data,
      complete: () => this.loading = false
    });
  }



  // =====================
  // FILE HANDLING
  // =====================
  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(input.files);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = false;
    if (event.dataTransfer?.files) {
      this.handleFiles(event.dataTransfer.files);
    }
  }

  removeFileFromQueue(queueIndex: number, fileIndex: number): void {
    const item = this.queue[queueIndex];

    const updatedItem: VendorCreditForm = {
      ...item,
      files: item.files.filter((_, i) => i !== fileIndex)
    };

    this.queue = this.queue.map((q, i) =>
      i === queueIndex ? updatedItem : q
    );
  }

  addFilesToQueue(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const pdfFiles: File[] = [];
    const rejected: string[] = [];

    // 🔒 PDF-only filter
    Array.from(input.files).forEach(file => {
      if (this.isPdf(file)) {
        pdfFiles.push(file);
      } else {
        rejected.push(file.name);
      }
    });

    if (rejected.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Invalid File Type',
        detail: `Only PDF files are allowed. Rejected: ${rejected.join(', ')}`
      });
    }

    if (!pdfFiles.length) return;

    this.accountingService.uploadFiles(pdfFiles as any).subscribe({
      next: results => {

        const uploaded: UploadedFile[] = results.map(r => ({
          fileId: r.fileId,
          originalName: r.originalName
        }));

        const item = this.queue[index];

        // 🔁 De-dupe against QUEUE ITEM files
        const { unique, duplicates } =
          this.splitDuplicates(item.files, uploaded);

        if (duplicates.length) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Duplicate File Skipped',
            detail: `Already attached to this credit: ${duplicates
              .map(d => d.originalName)
              .join(', ')}`
          });
        }

        if (!unique.length) return;

        this.queue[index] = {
          ...item,
          files: [...item.files, ...unique]
        };

        this.queue = [...this.queue]; // refresh UI
        input.value = '';
      },
      error: err => {
        console.error('UPLOAD FAILED:', err);
      }
    });
  }


  private splitDuplicates(
    existing: UploadedFile[],
    incoming: UploadedFile[]
  ): { unique: UploadedFile[]; duplicates: UploadedFile[] } {

    const existingIds = new Set(existing.map(f => f.fileId));
    const unique: UploadedFile[] = [];
    const duplicates: UploadedFile[] = [];

    for (const f of incoming) {
      if (existingIds.has(f.fileId)) {
        duplicates.push(f);
      } else {
        unique.push(f);
      }
    }

    return { unique, duplicates };
  }

  private isPdf(file: File): boolean {
    return (
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf')
    );
  }




  getFileIcon(_: any): string {
    return 'pi-file-pdf text-red-500';
  }










  private handleFiles(files: FileList): void {
    if (!files || !files.length) return;

    const pdfFiles: File[] = [];
    const rejected: string[] = [];

    // 🔒 PDF-only filter
    Array.from(files).forEach(file => {
      if (this.isPdf(file)) {
        pdfFiles.push(file);
      } else {
        rejected.push(file.name);
      }
    });

    if (rejected.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Invalid File Type',
        detail: `Only PDF files are allowed. Rejected: ${rejected.join(', ')}`
      });
    }

    if (!pdfFiles.length) return;

    this.accountingService.uploadFiles(pdfFiles as any).subscribe({
      next: results => {

        const uploaded: UploadedFile[] = results.map(r => ({
          fileId: r.fileId,
          originalName: r.originalName
        }));

        // 🔁 De-dupe against FORM files
        const { unique, duplicates } =
          this.splitDuplicates(this.form.files, uploaded);

        if (duplicates.length) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Duplicate File Skipped',
            detail: `Already added: ${duplicates
              .map(d => d.originalName)
              .join(', ')}`
          });
        }

        if (!unique.length) return;

        this.form = {
          ...this.form,
          files: [...this.form.files, ...unique]
        };

        this.cdr.detectChanges();
      },
      error: err => {
        console.error('UPLOAD FAILED:', err);
      }
    });
  }











  removeFile(index: number): void {
    this.form.files.splice(index, 1);
  }

  // =====================
  // QUEUE LOGIC
  // =====================
  addToQueue(): void {
    if (!this.validateForm()) return;

    // 🔥 FORCE STRING — NO TRUST
    const proId =
      typeof this.form.proID === 'string'
        ? this.form.proID
        : typeof (this.form.proID as any)?.value === 'string'
          ? (this.form.proID as any).value
          : '';

    const queuedItem: VendorCreditForm = {
      
      vendorID: this.form.vendorID,
      proID: String(proId), // 🚨 ABSOLUTE STRING
      ezPay: this.form.ezPay,
      po: this.form.po,
      vendorInv: this.form.vendorInv,
      orderDate: this.form.orderDate,
      description: this.form.description,
      amount: this.form.amount,
      postingAccount: this.form.postingAccount,
      files: [...this.form.files],
    };

    console.log('QUEUED PROID:', queuedItem.proID, typeof queuedItem.proID);

    this.queue = [...this.queue, queuedItem];
    this.resetForm();
  }




  removeFromQueue(index: number): void {
    this.queue.splice(index, 1);
  }

  // =====================
  // VALIDATION
  // =====================
  validateForm(): boolean {
    this.errors.proID = !this.form.proID;
    this.errors.amount =
      !this.form.amount || Math.abs(this.form.amount) > 50000;
    this.errors.description = !this.form.description;

    return !Object.values(this.errors).some(Boolean);
  }





  // =====================
  // RESET
  // =====================
  private resetForm(): void {
    this.form = {
      vendorID: '',
      postingAccount: this.DEFAULT_POSTING_ACCOUNT,
      proID: '',
      ezPay: false,
      po: '',
      vendorInv: '',
      orderDate: new Date(),
      description: '',
      amount: 0,
      files: [],
    };
    this.selectedMember = null; // 🔥 REQUIRED
  }
}
