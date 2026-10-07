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

  /* Consumer orders only. */
  storeId?: string;
  shipPhone?: string;
  shipEmail?: string;

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

export interface OrderExportResult {
  success: boolean;
  message: string;
  batchId: string;
  fileName?: string | null;
  processedCount: number;
  errors: Record<string, string[]>;
}
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


// ---- Needs Review (order inbox) ----

export type OrderInboxState =
  | 'RECEIVED'
  | 'READY'
  | 'NEEDS_REVIEW'
  | 'REJECTED';

export interface OrderInboxProblem {
  code: string;
  field?: string;
  message?: string;
}

export interface OrderInboxAddress {
  firstName?: string;
  lastName?: string;
  name?: string;
  attention?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
}

export interface OrderInboxLine {
  lineId?: string;
  sku?: string;
  productName?: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
}

export interface OrderInboxReviewItem {
  inboxId: number;
  channel: string;
  storeId?: string;
  channelOrderId?: string;
  orderNumber?: string;
  state: OrderInboxState;

  customerName?: string;
  customerEmail?: string;
  total?: number;
  currency?: string;
  itemCount: number;

  receivedAt: string;
  lastAttemptAt: string;
  attemptCount: number;

  problems: OrderInboxProblem[];

  targetTable?: string;
  targetOrderId?: number;

  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface OrderInboxReviewDetail extends OrderInboxReviewItem {
  shipTo?: OrderInboxAddress;
  lines: OrderInboxLine[];
  rawDocument?: string;
}

export interface OrderInboxActionResponse {
  success: boolean;
  message: string;
}


// ---- Modify an order ----

/* The result of one change to an order. */
export interface OrderEditResponse {
  success: boolean;
  message: string;
  orderId?: string;

  /* Set when the saved order no longer passes the order contract. */
  contractErrors?: string[];
}


// ---- Needs Review: fix and release ----

export interface ProductLookup {
  productCode: string;
  modelName?: string;
}

export interface HeldOrderReleaseRequest {
  inboxId: number;
  lines: { lineId: string; sku: string; remove?: boolean }[];
  shipTo?: {
    firstName?: string;
    lastName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  };
  email?: string;
}

export interface HeldOrderReleaseResult {
  released: boolean;
  message: string;
  orderId?: number;
  problems: OrderInboxProblem[];
}


// ---- Sent orders ----

/* The contract's export status, as shown on the Sent tab. */
export type ExportState =
  | 'EXPORTED'
  | 'ACKNOWLEDGED'
  | 'FAILED';

export interface SentOrder {
  exportId: number;
  orderId: string;
  channel: OrderChannel;

  customerName?: string;
  reference?: string;

  destination?: string;
  fileName?: string;
  batchId?: string;
  sentAt?: string;
  sentBy?: string;

  exportState: ExportState;

  destinationOrderId?: string;
  responseReason?: string;
  respondedAt?: string;
  respondedBy?: string;

  /* Shipments as the destination reported them (a JSON array). */
  shipmentsJson?: string;

  /* shipmentsJson, read once when the list loads. */
  shipments?: SentShipment[];

  isOverdue: boolean;
  orderStatus?: string;
  canReopen: boolean;
}

export interface SentShipment {
  shipmentId: string;
  carrier?: string;
  trackingNumber?: string;
  shippedAt?: string;
}
export interface PosImportFileResult {
  fileName: string;
  status: 'IMPORTED' | 'NEEDS_REVIEW' | 'REJECTED' | 'DUPLICATE' | 'SKIPPED';
  account?: string;
  poNumber?: string;
  orderId?: number;
  inboxId?: number;
  priceDifferences: number;
  problems: string[];
}

export interface PosImportSummary {
  success: boolean;
  message: string;
  files: number;
  imported: number;
  needsReview: number;
  rejected: number;
  duplicates: number;
  skipped: number;
  results: PosImportFileResult[];
}
export interface PosImportFileResult {
  fileName: string;
  status: 'IMPORTED' | 'NEEDS_REVIEW' | 'REJECTED' | 'DUPLICATE' | 'SKIPPED';
  account?: string;
  poNumber?: string;
  orderId?: number;
  inboxId?: number;
  priceDifferences: number;
  problems: string[];
}

export interface PosImportSummary {
  success: boolean;
  message: string;
  files: number;
  imported: number;
  needsReview: number;
  rejected: number;
  duplicates: number;
  skipped: number;
  results: PosImportFileResult[];
}
