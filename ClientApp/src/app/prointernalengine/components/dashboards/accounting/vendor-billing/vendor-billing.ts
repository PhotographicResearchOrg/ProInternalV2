import { Component, OnInit } from '@angular/core';
import { AccountingService } from 'src/app/services/AccountingService'
import { ConfirmationService } from 'primeng/api';
import {  UploadedFile } from 'src/app/models/accounting/accounting-credit'

interface VendorBillingForm {
  vendorID: string;
  proID: string;
  orderDates: Date | null;

  terms: string;
  futureBilling: string;

  vendorInv: string;
  vendInvDate: Date | null;
  vendorDueDate: Date | null;

  po: string;
  amount: number;
  discount: number;

  ezPay: boolean;
  descriptions: string;

  files: UploadedFile[];
}


@Component({
  selector: 'app-vendor-billing',
  templateUrl: './vendor-billing.html',
  styleUrls: ['./vendor-billing.scss'],
})
export class VendorBillingComponent implements OnInit {

  billing: any[] = [];
  loading = false;
  queue: VendorBillingForm[] = [];
  dragActive = false;



  form: VendorBillingForm = {
    vendorID: '',
    proID: '',
    orderDates: null,

    terms: '',
    futureBilling: '',

    vendorInv: '',
    vendInvDate: null,
    vendorDueDate: null,

    po: '',
    amount: 0,
    discount: 0,

    ezPay: true,
    descriptions: '',

    files: []
  };


  termsOptions = [
    { label: '0%', value: 0 },
    { label: '2%', value: 2 }
  ];

  futureBillingOptions = [
    { label: 'N', value: 'N' },
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' }
  ];



  constructor(
    private accountingService: AccountingService,
    private confirmationService: ConfirmationService
  ) { }

  ngOnInit(): void {
    this.loadBilling();
  }

  loadBilling(): void {
    this.loading = true;
    this.accountingService.getVendorBilling().subscribe({
      next: data => this.billing = data,
      complete: () => this.loading = false
    });
  }

  reload(): void {
    this.loadBilling();
  }

  submit(): void {
    console.log('Submit clicked', this.form);
  }


  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    this.handleFiles(input.files);
  }


  onDragOver(event: DragEvent) {
    event.preventDefault();
  }



  DragOver(event: DragEvent) {
    event.preventDefault();
    this.dragActive = true;
  }

  onDragLeave() {
    this.dragActive = false;
  }


  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (!event.dataTransfer?.files) return;

    this.handleFiles(event.dataTransfer.files);
  }


  private handleFiles(fileList: FileList): void {
    this.accountingService.uploadFiles(fileList).subscribe(results => {

      const uploaded: UploadedFile[] = results.map(r => ({
        fileId: r.fileId,
        originalName: r.originalName
      }));

      this.form = {
        ...this.form,
        files: [...this.form.files, ...uploaded]
      };
    });
  }

  openFile(file: UploadedFile): void {
    window.open(
      `/api/accounting/files/${file.fileId}`,
      '_blank'
    );
  }



  submitBatch() {
    const payload = {
      orderDetails: this.queue.map(row => ({
        ...row,
        fileIds: row.files.map(f => f.fileId)
      }))
    };

    this.accountingService
      .saveVendorBilling(payload)
      .subscribe(() => {
        this.queue = [];
      });
  }


  uploadFile(file: File) {
    const fd = new FormData();
    fd.append('file', file);


  }



  addToQueue() {
    this.queue.push({
      ...this.form,
      files: [...this.form.files] // clone
    });

    this.resetForm();
  }

  removeFile(index: number) {
    this.form.files.splice(index, 1);
  }


  resetForm() {
    this.form = {
      vendorID: '',
      proID: '',
      orderDates: null,
      vendInvDate: null,
      vendorDueDate: null,
      terms: '',
      futureBilling: '',
      vendorInv: '',
      po: '',
      amount: 0,
      discount: 0,
      ezPay: false,
      descriptions: '',
      files: []
    };

  }



  removeFromQueue(index: number) {
    this.queue.splice(index, 1);
  }




  submitBilling(payload: any): void {
    this.accountingService.saveVendorBilling(payload).subscribe(() => {
      this.reload();
    });
  }
}
