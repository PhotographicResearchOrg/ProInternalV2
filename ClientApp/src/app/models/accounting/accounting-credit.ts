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

  FileNames: string[];
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
  name: string;
  size: number;
  src: string;      // returned by API
  type: string;     // mime type
  progress?: number;
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
