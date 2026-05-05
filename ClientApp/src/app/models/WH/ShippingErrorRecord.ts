export interface ShippingErrorRecord {
  id: number;
  companyName: string;
  account: string;
  status: string;
  dateSubmitted: string;
  shipnumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  shipDate: Date;
  rmaStatus: string;
  submitted: string;
  supportFile?: string; // optional for attached documents
  disposition?: number;
  approved?: boolean;
  customMessage?: string;
  products: ShippingErrorProduct[];
}

export interface ShippingErrorProduct {

  isBRMProduct?: boolean;  // ← add this
  productCode: string;
  productDescription: string;
  quantity: number;
  errorType: string;
  cost?: number;
  serial?: string;
  disposition?: string;
  BRMFollowUp?: number;
  customMessage?: string;
  returnMessage?: string;
  returnedBy?: string;
  returnedDate?: string;


}

export interface PackingSlipData {
  header: PackingSlipHeader;
  products: PackingSlipProduct[];
}

export interface PackingSlipHeader {
  orderDate: string;
  proOrderNumber: string;
  po: string;
  checkedBy: string;
  shippingNumber: string;
  proMember: string;
}

export interface PackingSlipProduct {
  productCode: string;
  quantityOrdered: number;
  quantityShipped: number;
  description: string;
}


export interface PackingSlipData {
  header: PackingSlipHeader;
  products: PackingSlipProduct[];
}

export interface PackingSlipHeader {
  orderDate: string;
  proOrderNumber: string;
  po: string;
  checkedBy: string;
  shippingNumber: string;
  proMember: string;
}

export interface PackingSlipProduct {
  productCode: string;
  quantityOrdered: number;
  quantityShipped: number;
  description: string;
}
export interface ProcessShippingErrorResponse {
  success: boolean;
  message: string;
}
