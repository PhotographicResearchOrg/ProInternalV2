export type OrderChannel =
  | 'warehouse'
  | 'consumer';

export type OrderStatus =
  | 'Ready'
  | 'On Hold'
  | 'In Progress'
  | 'Exception'
  | 'Rejected';

export type CanonicalOrderStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'ON_HOLD'
  | 'CONFIRMED'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'INVOICED'
  | 'CLOSED'
  | 'CANCELLED';

export type SourceChannel =
  | 'B2B_WEB'
  | 'POS'
  | 'SHOPIFY'
  | 'EDI'
  | 'AMAZON'
  | 'PHONE'
  | 'MANUAL';

export interface OrderAddress {

  addressId?: number;
  companyName?: string;
  firstName?: string;
  lastName?: string;

  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}

export interface RejectOrderRequest {
  orderId: string;
  reason: string;
}

export interface OrderAuditRecord {
  actionType: string;
  reason?: string;
  actionBy?: string;
  actionSource?: string;
  actionData?: string;
  actionDate: string;
}

export interface OrderLine {
  sku: string;
  description: string;
  quantity: number;
  total: number;

  lineId?: string;
  stockStatus?: string;
  unitCost?: number;
  notes?: string;
  specialName?: string;
}


export interface SetFreeShippingRequest {
  orderId: string;
  enabled: boolean;
}

export interface UpdateOrderShipToRequest {
  orderId: string;
  mode: 'SAVED' | 'DROPSHIP';
  addressId?: number;

  companyName?: string;
  firstName?: string;
  lastName?: string;

  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;

  phone?: string;
  email?: string;
}


export interface OrderShipToOption {
  addressId: number;
  isDefaultShipTo: boolean;

  companyName?: string;
  firstName?: string;
  lastName?: string;

  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}

export interface OrderRecord {

  freeShipping?: boolean;
  hasSpecial?: boolean;
  orderSectionId?: string;
  orderId: string;
  channel: OrderChannel;

  customerName: string;
  customerReference: string;

  source: string;
  sourceChannel?: SourceChannel;

  orderType: string;
  status: OrderStatus;
  canonicalStatus?: CanonicalOrderStatus;

  enteredDate: Date;
  total: number;

  paymentMethod: string;
  shippingMethod: string;
  systemReference: string;

  accountNumber?: string;
  poNumber?: string;
  computymeOrderId?: string;

  shippingAddress?: OrderAddress;
  billingAddress?: OrderAddress;

  availableBalance?: number;
  netAvailable?: number;

  shippingNotes?: string;
  creditStatus?: string;

  autoHold?: boolean;
  holdOverride?: boolean;

  rejectionReason?: string;

  lines: OrderLine[];
}

export interface OrderSearchRequest {
  channel?: OrderChannel;
  status?: OrderStatus;
  searchTerm?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface RejectOrderRequest {
  orderId: string;
  reason: string;
}

export interface OverrideOrderHoldRequest {
  orderId: string;
  reason: string;
}

export interface ProcessOrdersRequest {
  orderIds: string[];
}

export interface OrderActionResponse {
  success: boolean;
  message: string;
  orderId?: string;
  batchId?: string;
}
export type OrderRecordApi =
  Omit<OrderRecord, 'enteredDate'> & {
    enteredDate: string | Date;
  };

export interface UpdateShippingNotesRequest {
  orderId: string;
  shippingNotes: string;
}

export interface UpdateOrderLineRequest {
  orderId: string;
  lineId: string;
  quantity: number;
  notes?: string;
}

export interface RemoveOrderLineRequest {
  orderId: string;
  lineId: string;
  reason: string;
}

export interface ReopenOrderRequest {
  orderId: string;
  reason: string;
}
