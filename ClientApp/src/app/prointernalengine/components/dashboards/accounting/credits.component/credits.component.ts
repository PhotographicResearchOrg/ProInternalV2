import { Component, OnInit, NgZone, ChangeDetectorRef, ViewChild } from '@angular/core';
import { AccountingService } from 'src/app/services/AccountingService'
import { ConfirmationService } from 'primeng/api';
import { VendorCreditForm, UploadedFile, CreditBatchRequestDto } from 'src/app/models/accounting/accounting-credit'
import * as XLSX from 'xlsx';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { saveAs } from 'file-saver';
import { forkJoin } from 'rxjs';



@Component({
  selector: 'app-credits',
  templateUrl: './credits.component.html',
  styleUrls: ['./credits.component.scss']
})
export class CreditsComponent implements OnInit {


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
    private sanitizer: DomSanitizer
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



  openHistoryFile(row: any): void {
    if (!row.fileName) return;

    const file: UploadedFile = {
      name: row.fileName.trim(),
      size: 0, //
      src: `/AutomationInvoice/${row.fileName.trim()}`,
      type: this.detectMime(row.fileName)
    };

    this.openPreview(file); // reuse your existing preview dialog
  }

  onMemberSelect(event: any): void {
    // HARD RULE: proID is STRING ONLY
    this.form.proID = event.value;
  }

  openPreview(file: UploadedFile): void {
    this.previewFile = {
      ...file,
      safeSrc: this.sanitizer.bypassSecurityTrustResourceUrl(file.src)
    };
    this.previewVisible = true;
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
        FileNames: row.files.map(f => f.name),
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
      const uploaded = results.map(r => ({
        name: r.name,
        size: r.size,
        src: r.src,
        type: this.detectMime(r.name)
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



  private handleFiles(files: FileList): void {
    if (!files || !files.length) return;

    console.log('HANDLE FILES CALLED:', files.length);

    this.accountingService.uploadFiles(files).subscribe({
      next: (results) => {
        console.log('UPLOAD RESULTS:', results);

        this.zone.run(() => {

          const uploaded: UploadedFile[] = (results || []).map(r => ({
            name: r.name,
            size: r.size,
            src: r.src,
            type: this.detectMime(r.name)
          }));

          // 🔥 MUTATE VIA NEW REFERENCE
          this.form = {
            ...this.form,
            files: [...this.form.files, ...uploaded]
          };

          console.log('FILES AFTER UPDATE:', this.form.files);

          // 🔥 FORCE UI REFRESH (IMPORTANT)
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
