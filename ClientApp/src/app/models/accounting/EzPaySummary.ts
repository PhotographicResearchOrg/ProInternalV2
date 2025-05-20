
export class EzPaySummary {

  account: string;
  ezpay: number;
  ezpayNet: number;
  gross: number;
  discount: number;
  net: number;
  company: string;
  autoPay: string; 
}


export class EzPayDetail {
  invoice: string;
  date: string; // or Date if you parse it
  vendor: string;
  vendorInvoice: string;
  account: string;
  Name: string;
  gross: number;
  discount: number;
  net: number;
  ezpay: number;
  ezpayNet: number;
  receipt: string;
}
     
