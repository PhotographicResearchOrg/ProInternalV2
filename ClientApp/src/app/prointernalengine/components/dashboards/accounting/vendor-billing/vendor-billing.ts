import { Component, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AccountingService } from 'src/app/services/AccountingService';
import { UploadedFile, InvoiceExtractionPreview } from 'src/app/models/accounting/accounting-credit';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface VendorBillingForm {
  vendorID: string;
  proID: string;
  billDate: Date | null;
  terms: string;
  futureBilling: string;
  vendorInv: string;
  vendInvDate: Date | null;
  vendorDueDate: Date | null;
  orderDate: Date | null;
  po: string;
  amount: number;
  discount: number;
  ezPay: boolean;
  description: string;
  files: UploadedFile[];
  extractionPreview?: InvoiceExtractionPreview | null;
}

@Component({
  selector: 'app-vendor-billing',
  templateUrl: './vendor-billing.html',
  styleUrls: ['./vendor-billing.scss']
})
export class VendorBillingComponent {

  queue: VendorBillingForm[] = [];
  dragActive = false;
  isSubmitting = false;
  previewFile: (UploadedFile & { safeSrc?: SafeResourceUrl }) | null = null;
  previewVisible = false;
  extractionConfidence = 0;
  missingFields: string[] = [];
  memberResults: { label: string; value: string }[] = [];
  selectedMember: { label: string; value: string } | null = null;
  selectedVendor:
    | { label: string; value: number; raw: any }
    | null = null;
  vendorResults: { label: string; value: number; raw: any }[] = [];
  extractionPreview: InvoiceExtractionPreview | null = null;

  form: VendorBillingForm = this.emptyForm();

  termsOptions = [
    { label: 'NET 30', value: 'NET30' },
    { label: 'NET 60', value: 'NET60' }
  ];

  futureBillingOptions = Array.from({ length: 10 }).map((_, i) => ({
    label: i === 0 ? 'N' : String(i),
    value: i === 0 ? 'N' : String(i)
  }));

  vendorDateRange: Date[] | null = null;
  vendorBillingHistory: any[] = [];



  constructor(
    private accounting: AccountingService,
    private confirm: ConfirmationService,
    private toast: MessageService,
    private sanitizer: DomSanitizer
  ) { }



  ngOnInit(): void {
    this.loadVendorBillingHistory();

  }

  loadVendorBillingHistory() {
    this.accounting
      .getVendorBillingHistory()
      .subscribe(res => this.vendorBillingHistory = res);

  }


  openInvoicePreview(invoiceNumber: string) {
    // TODO: reuse credits preview logic
    console.log('Open invoice preview:', invoiceNumber);
  }



  /* =========================
     QUEUE + DUPES
     ========================= */

  private billingKey(row: VendorBillingForm): string {
    return [
      row.vendorID.trim().toLowerCase(),
      row.proID.trim().toLowerCase(),
      (row.vendorInv || '').trim().toLowerCase(),
      (row.po || '').trim().toLowerCase(),
      Number(row.amount).toFixed(2)
    ].join('|');
  }


  searchVendor(event: any) {
    const term = event.query;

    this.accounting.searchVendor(term).subscribe(res => {
      this.vendorResults = res.map((v: any) => {
        const id = String(v.vendorId);
        const name = v.name ?? '';

        return {
          label: `${id} – ${name}`,          //  display
          value: v.vendorId,                 //  stored
          searchText: `${id} ${name}`.toLowerCase(), //  searchable
          raw: v
        };
      });
    });
  }


  onVendorSelect(event: any) {
    const selected = event.value;

    // Always store as string if your form expects it
    this.form.vendorID = String(selected.value);

    // Optional auto-fill from vendor record
    if (selected.raw?.BillingTerms) {
      this.form.terms = selected.raw.BillingTerms;
    }

    if (selected.raw?.Address) {
      // future: vendor learning hook
    }
  }

  getDuplicateKeys(): Set<string> {
    const seen = new Set<string>();
    const dupes = new Set<string>();

    for (const row of this.queue) {
      const key = this.billingKey(row);
      if (seen.has(key)) dupes.add(key);
      else seen.add(key);
    }
    return dupes;
  }

  isDuplicate(row: VendorBillingForm): boolean {
    return this.getDuplicateKeys().has(this.billingKey(row));
  }



  onMemberSelect(event: any): void {
    this.form.proID = String(event.value.value ?? event.value);
  }



  searchMember(event: any) {
    const term = event.query;

    this.accounting.searchMember(term).subscribe(res => {
      this.memberResults = res.map((m: any) => ({
        label: `${m.id} - ${m.hname}`,
        value: m.id
      }));
    });
  }



  private prefillMemberFromCompany(company: string) {
    if (!company || company.length < 3) return;

    this.accounting.searchMember(company).subscribe(res => {
      this.memberResults = res.map((m: any) => ({
        label: `${m.id} - ${m.hname}`,
        value: m.id
      }));

      //  Auto-select ONLY when unambiguous
      if (this.memberResults.length === 1) {
        this.selectedMember = this.memberResults[0];
        this.form.proID = this.memberResults[0].value;
      }
    });
  }


  onInvoiceDrop(file: File) {

    console.log("onInvoiceDrop");

    this.accounting.extractInvoicePreview(file)

      .subscribe(preview => {

        // Store preview
        this.form.extractionPreview = preview;

        // Populate basic fields
        this.form.vendorInv = preview.invoiceNumber ?? '';
        this.form.po = preview.poNumber ?? '';
        this.form.billDate = preview.invoiceDate
          ? new Date(preview.invoiceDate)
          : null;
        this.form.amount = preview.totalAmount ?? 0;

        // -----------------------------
        // AUTO-SELECT VENDOR (by ID)
        // -----------------------------
        if (preview.suggestedVendorId) {
          this.accounting.getVendorById(preview.suggestedVendorId)
            .subscribe(v => {

              const vendorOption = {
                label: `${v.vendorId} – ${v.name}`,
                value: v.vendorId,
                raw: v
              };

              //  PrimeNG contract (non-negotiable)
              this.vendorResults = [vendorOption];
              this.selectedVendor = vendorOption;

              //  Form value
              this.form.vendorID = String(v.vendorId);
            });
        }
        // -----------------------------
        // AUTO-SELECT MEMBER (by ID)
        // -----------------------------
        if (preview.suggestedMemberId) {
          this.accounting.searchMember(String(preview.suggestedMemberId))
            .subscribe(res => {
              this.memberResults = res.map((m: any) => ({
                label: `${m.id} - ${m.hname}`,
                value: m.id
              }));

              const match = this.memberResults.find(
                m => String(m.value) === String(preview.suggestedMemberId)
              );

              if (match) {
                this.selectedMember = match;
                this.form.proID = String(match.value);
              }
            });
        }

        // -----------------------------
        // FALLBACK: Shipping Company
        // -----------------------------
        if (!preview.suggestedMemberId && preview.shippingCompany) {
          this.prefillMemberFromCompany(preview.shippingCompany);
        }
      });
  }



  





  openPreview(file: UploadedFile): void {
    this.accounting.getFilePreview(file.fileId)
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

  get queuedTotal(): number {
    return this.queue.reduce((s, q) => s + (q.amount || 0), 0);
  }

  /* =========================
     FORM
     ========================= */

  addToQueue(): void {
    console.log('ADD TO QUEUE CLICKED', this.form);

    if (!this.validate()) return;

    const snapshot: VendorBillingForm = {
      ...this.form,
      files: [...this.form.files],
      extractionPreview: this.form.extractionPreview ?? null
    };

    this.queue = [...this.queue, snapshot];

    console.log('QUEUE AFTER PUSH', this.queue);

    this.form = this.emptyForm();
  }





  removeFromQueue(i: number): void {
    this.queue = this.queue.filter((_, idx) => idx !== i);
  }

  validate(): boolean {
    console.log('VALIDATE FORM', this.form);

    if (!this.form.vendorID) return this.warn('Vendor required');
    if (!this.form.proID) return this.warn('Member required');

    //  THIS IS THE FIX
    if (this.form.amount === null || Number.isNaN(this.form.amount)) {
      return this.warn('Amount required');
    }

    return true;
  }

  private warn(msg: string): false {
    this.toast.add({
      severity: 'warn',
      summary: 'Missing Data',
      detail: msg
    });
    return false;
  }




  /* =========================
     FILE HANDLING
     ========================= */

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.dragActive = true;
  }
  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragActive = false;

    const files = e.dataTransfer?.files;
    if (!files || !files.length) return;

    const pdfs = Array.from(files).filter(
      f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (!pdfs.length) {
      this.toast.add({
        severity: 'warn',
        summary: 'Invalid Files',
        detail: 'Only PDF files are allowed.'
      });
      return;
    }

    //  STEP 1: extract from FIRST PDF
    this.onInvoiceDrop(pdfs[0]);

    //  STEP 2: upload & attach ALL PDFs
    this.uploadFiles(pdfs as any);
  }


  onFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      this.uploadFiles(input.files);
      input.value = '';
    }
  }


  get confidenceLevel(): 'high' | 'medium' | 'low' {
    if (this.extractionConfidence >= 80) return 'high';
    if (this.extractionConfidence >= 50) return 'medium';
    return 'low';
  }



  uploadFiles(files: FileList) {
    const pdfs = Array.from(files).filter(
      f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (!pdfs.length) {
      this.toast.add({
        severity: 'warn',
        summary: 'Invalid Files',
        detail: 'Only PDF files are allowed.'
      });
      return;
    }

    this.accounting.uploadFiles(pdfs as any).subscribe(res => {
      const uploaded = res.map(r => ({
        fileId: r.fileId,
        originalName: r.originalName
      }));

      this.form.files = [...this.form.files, ...uploaded];
    });
  }

  removeFile(i: number) {
    this.form.files.splice(i, 1);
  }



  /* =========================
     SUBMIT
     ========================= */

  submitBatch(): void {
    if (!this.queue.length) return;

    this.confirm.confirm({
      header: 'Apply Vendor Billing',
      message: `Apply ${this.queue.length} billing entries?`,
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.executeSubmit()
    });
  }

  executeSubmit(): void {
    this.isSubmitting = true;

    const payload = {
      orderDetails: this.queue.map(row => ({
        VendorID: row.vendorID,
        ProID: row.proID,
        BillDate: row.billDate?.toISOString(),
        Terms: row.terms,
        FutureBilling: row.futureBilling,
        VendorInv: row.vendorInv,
        VendInvDate: row.vendInvDate,
        VendorDueDate: row.vendorDueDate,
        orderDate: row.orderDate,
        PO: row.po || 'N/A',
        Amount: row.amount,
        Discount: row.discount,
        EZPay: row.ezPay,
        Description: row.description,
        FileIds: row.files.map(f => f.fileId),

        // ADD THIS
        ExtractionPreview: row.extractionPreview
      }))
    };

    this.accounting.saveVendorBilling(payload).subscribe({
      next: () => {
        this.queue = [];
        this.extractionPreview = null; // reset
        this.toast.add({
          severity: 'success',
          summary: 'Billing Applied',
          detail: 'Vendor billing batch processed successfully.'
        });
      },
      error: err => {
        this.toast.add({
          severity: 'error',
          summary: 'Billing Failed',
          detail: err?.error || 'Vendor billing failed.'
        });
      },
      complete: () => (this.isSubmitting = false)
    });
  }


  emptyForm(): VendorBillingForm {
    return {
      vendorID: '',
      proID: '',
      billDate: new Date(),
      terms: '',
      futureBilling: 'N',
      vendorInv: '',
      vendInvDate: null,
      vendorDueDate: null,
      orderDate: null,
      po: '',
      amount: 0,
      discount: 0,
      ezPay: true,
      description: '',
      files: [],
      extractionPreview: null
    };
  }
}
