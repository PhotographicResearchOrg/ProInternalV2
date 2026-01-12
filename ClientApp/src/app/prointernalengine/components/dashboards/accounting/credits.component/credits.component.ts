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


  emailInvoiceNumber: string | null = null;
  emailToList: string[] = [];
  invalidEmails: string[] = [];
  emailNote = '';
  sendingEmail = false;
  emailItems: any[] = [];


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
    if (!this.queue.length) return;

    this.confirmationService.confirm({
      header: 'Apply Credits',
      message: `You are about to apply ${this.queue.length} credit(s). Continue?`,
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.executeSubmit()
    });
  }

  private executeSubmit(): void {

    const payload: CreditBatchRequestDto = {
      OrderDetails: this.queue.map(row => ({
        ProID: row.proID,                 // string ✅
        Amount: row.amount,
        Account: row.proID,    
        OrderDate: row.orderDate.toISOString(),
        Description: row.description,
        PO: row.po || 'N/A',
        VendorInvoice: row.vendorInv || undefined, // 🔥 FIXED
        FileIds: row.files.map(f => f.fileId),
        EZPay: row.ezPay                  // boolean ✅
      }))
    };

    this.accountingService.saveCredits(payload).subscribe({
      next: () => {
        this.queue = [];
        this.loadCredits();
      },
      error: err => {
        console.error('Credit submit failed', err);
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

    this.accountingService.uploadFiles(input.files).subscribe(results => {
      const uploaded: UploadedFile[] = results.map(r => ({
        fileId: r.fileId,
        originalName: r.originalName
      }));
      const item = this.queue[index];

      this.queue[index] = {
        ...item,
        files: [...item.files, ...uploaded]
      };

      this.queue = [...this.queue]; // refresh
      input.value = '';
    });
  }

  getFileIcon(file: { originalName: string }): string {
    const ext = file.originalName.split('.').pop()?.toLowerCase();

    if (!ext) return 'pi-file';

    if (ext === 'pdf') return 'pi-file-pdf text-red-500';
    if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return 'pi-image text-blue-500';
    if (['xls', 'xlsx'].includes(ext)) return 'pi-file-excel text-green-500';

    return 'pi-file';
  }



  private handleFiles(files: FileList): void {
    if (!files || !files.length) return;

    console.log('HANDLE FILES CALLED:', files.length);

    this.accountingService.uploadFiles(files).subscribe({
      next: (results) => {
        console.log('UPLOAD RESULTS:', results);

        this.zone.run(() => {

          // 🔥 FILE-ID BASED MODEL (NO src / name / size)
          const uploaded: UploadedFile[] = (results || []).map(r => ({
            fileId: r.fileId,
            originalName: r.originalName
          }));

          // 🔥 IMMUTABLE UPDATE (Angular change detection)
          this.form = {
            ...this.form,
            files: [...this.form.files, ...uploaded]
          };

          console.log('FILES AFTER UPDATE:', this.form.files);

          // 🔥 FORCE UI REFRESH
          this.cdr.detectChanges();
        });
      },
      error: err => {
        console.error('UPLOAD FAILED:', err);
      }
    });
  }





  detectMime(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'pdf':
        return 'application/pdf';
      case 'xls':
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return 'image/*';
      default:
        return 'application/octet-stream';
    }
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
      files: [...this.form.files]
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
      vendorID: '',        // ✅ REQUIRED
      proID: '',
      ezPay: false,
      po: '',
      vendorInv: '',
      orderDate: new Date(),
      description: '',
      amount: 0,
      files: []
    };
    this.selectedMember = null; // 🔥 REQUIRED
  }
}
