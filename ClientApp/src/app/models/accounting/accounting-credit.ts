import { SafeResourceUrl } from '@angular/platform-browser';


export interface APEntry {
  orderDetails: APOrderDetail[];
}




export interface CreditRequestDto {
  ProID: string;
  Amount: number;
  OrderDate: string;        // ISO string
  Description: string;
  Account: string;
  PO: string;
  VendorInvoice?: string;
  FileIds: string[];
  postingAccount: string;
  EZPay: boolean;
}

export interface CreditBatchRequestDto {
  OrderDetails: CreditRequestDto[];
}




export interface APOrderDetail {
  proID: string;
  po?: string;
  vendinv?: string;
  ezpay: string;
  orderDates: string;
  descriptions: string;
  amount: number;
}

export interface VendorCreditForm {
  postingAccount: string;
  vendorID: string;
  proID: string;
  ezPay: boolean;
  po?: string;
  vendorInv?: string;
  orderDate: Date;
  description: string;
  amount: number;
  files: UploadedFile[];
}




export interface AccountingCredit {
  batchID: number;
  invoiceNumber: string;
  amount: number;
  status: string;
  userEntered: string;
}



export interface UploadedFile {
  fileId: string;              // 🔑 REQUIRED (backend identity)
  originalName: string;        // display name
  src?: string;                // computed URL
  safeSrc?: SafeResourceUrl;   // sanitized iframe/img src
  type?: string;               // mime hint
}


export interface VendorBillingLineItem {
  vendorId: string;
  proId: string;
  orderDate: string;
  terms: string;
  futureBilling: string;
  vendorInv: string;
  vendorInvDate: string;
  vendorDueDate: string;
  amount: number;
  discount: number;
  po: string;
  description: string;

  files: UploadedFile[]; // 🔥 multiple files
}
