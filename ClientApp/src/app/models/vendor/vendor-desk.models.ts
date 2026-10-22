/* Vendor Desk foundation: cutover map, brand ↔ vendor, vendor record, direct billing, product classes.
   API: VendorDeskController (api/vendordesk). */

/** Who is master of a section or a field.
 *  COMPUTYME  Computyme is master; PIV2 shows it read only (lock)
 *  SQL        SQL is master; edited in PIV2
 *  MIXED      part of each (see the section's summary)
 *  EXTENSION  exists only in PIV2 */
export type DataOwner = 'COMPUTYME' | 'SQL' | 'MIXED' | 'EXTENSION';

export interface CutoverSection {
  sectionKey: string;
  area: string;
  name: string;
  owner: DataOwner;
  summary?: string | null;
  computymeSource?: string | null;
  sqlObjects?: string | null;
  b2BReads?: string | null;
  pivScreen?: string | null;
  nextStep?: string | null;
  sortOrder: number;
  updatedAt: string;
  updatedBy?: string | null;
}

export interface CutoverLogEntry {
  id: number;
  sectionKey: string;
  name?: string | null;
  oldOwner?: DataOwner | null;
  newOwner: DataOwner;
  note?: string | null;
  changedBy?: string | null;
  changedAt: string;
}

export interface CutoverMap {
  sections: CutoverSection[];
  log: CutoverLogEntry[];
  canEdit: boolean;
}

export type BrandLinkStatus = 'OK' | 'NO_VENDOR' | 'UNKNOWN_VENDOR' | 'NOT_AP_VENDOR';

export interface BrandVendorRow {
  brandId: number;
  brandName: string;
  vendorId?: number | null;
  vendorName?: string | null;
  linkStatus: BrandLinkStatus;
  products: number;
  liveProducts: number;
  /** products whose Computyme actual vendor (IVMST A.VENDOR) isn't the brand's vendor */
  boughtElsewhere: number;
  /** "1023 Videndum (30), 2941 Ansmann (7)" — who the products are actually bought from */
  actualVendors?: string | null;
  lastMovedAt?: string | null;
  lastMovedBy?: string | null;
}

export interface BrandVendorList {
  brands: BrandVendorRow[];
  canEdit: boolean;
}

export interface BrandVendorHistoryRow {
  id: number;
  brandId: number;
  brandName?: string | null;
  oldVendorId?: number | null;
  newVendorId?: number | null;
  reason?: string | null;
  changedBy?: string | null;
  changedAt: string;
}

export interface VendorRecordField {
  columnName: string;
  label: string;
  groupName: string;
  sortOrder: number;
  value?: string | null;
  displayValue?: string | null;
  note?: string | null;
  hidden: boolean;
}

export interface VendorRecordTerms {
  dueDaysText?: string | null;
  cashDiscountText?: string | null;
  cashDiscountPct?: number | null;
  termsType: 'NONE' | 'NET' | 'DAY_NEXT_MONTH' | 'DAY_THIS_MONTH' | 'UNPARSED';
  netDays?: number | null;
  dayOfMonth?: number | null;
  description: string;
}

export interface VendorRecordUsage {
  productsAsVendor: number;
  liveProductsAsVendor: number;
  brands: number;
  directBillingPrograms: number;
  purchaseOrders: number;
  openPurchaseOrders: number;
  inComputyme: boolean;
}

export interface VendorRecord {
  vendorId: number;
  fields: VendorRecordField[];
  terms?: VendorRecordTerms | null;
  usage?: VendorRecordUsage | null;
}

export interface VendorBillingComputyme {
  cashDiscountStored?: string | null;
  cashDiscountPct?: number | null;
  surchargeStored?: string | null;
  surchargeCodeStored?: string | null;
  addsSurchargeToMemberBill: boolean;
  dueDaysText?: string | null;
  termsType?: VendorRecordTerms['termsType'] | null;
  netDays?: number | null;
  dayOfMonth?: number | null;
  termsDescription?: string | null;
}

export interface VendorBillingProgram {
  programNo?: number | null;
  name?: string | null;
  surchargeStored?: string | null;
  specialDeductionStored?: string | null;
  specialPctStored?: string | null;
  adminDaysStored?: string | null;
  ftrStored?: string | null;
  surchargeTypeStored?: string | null;
  ytdSalesStored?: string | null;
  priorYearStored?: string | null;
  surchargesStored?: string | null;
}

/** Computyme's terms for the vendor (read only), shown on Terms & Financials beside the PIV2 split. */
export interface VendorBilling {
  vendorId: number;
  computyme?: VendorBillingComputyme | null;
  programs: VendorBillingProgram[];
}

export interface VendorFulfillmentSummary {
  products: number;
  liveProducts: number;
  inWarehouse: number;
  shipsDirect: number;
  outOfStock: number;
  dropShipEligible: number;
  fromOtherBrands: number;
}

export interface VendorFulfillmentBrand {
  brandId?: number | null;
  brandName?: string | null;
  brandOnThisVendor: boolean;
  products: number;
  liveProducts: number;
  inWarehouse: number;
  shipsDirect: number;
  outOfStock: number;
}

/** Where a vendor's products ship from, from what the B2B site reads (dbo.Product). */
export interface VendorFulfillment {
  vendorId: number;
  summary?: VendorFulfillmentSummary | null;
  brands: VendorFulfillmentBrand[];
}

export interface ProductClassRow {
  classNo: number;
  name: string;
  computymeName?: string | null;
  shortCode?: string | null;
  source: 'COMPUTYME' | 'PIV2';
  description?: string | null;
  termsPct?: number | null;
  promptPayPct?: number | null;
  netNetFactor?: number | null;
  netNet6Factor?: number | null;
  ralNetFactor?: number | null;
  hasDating?: boolean | null;
  fastShipping?: boolean | null;
  isOrderBucket?: boolean | null;
  ruleRefs?: string | null;
  isActive: boolean;
  products: number;
  liveProducts: number;
  vendors: number;
  notDescribed: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface ProductClassList {
  classes: ProductClassRow[];
  canEdit: boolean;
}

export interface ProductClassSaveRequest {
  classNo?: number | null;
  name: string;
  shortCode?: string | null;
  description?: string | null;
  termsPct?: number | null;
  promptPayPct?: number | null;
  netNetFactor?: number | null;
  netNet6Factor?: number | null;
  ralNetFactor?: number | null;
  hasDating?: boolean | null;
  fastShipping?: boolean | null;
  isActive?: boolean | null;
  ruleRefs?: string | null;
}

export interface ProductSupplyVendor {
  productId: number;
  productCode?: string | null;
  brandId?: number | null;
  brandName?: string | null;
  brandVendorId?: number | null;
  brandVendorName?: string | null;
  /** Computyme's actual vendor (IVMST A.VENDOR): who the product is bought from */
  vendorId?: number | null;
  vendorName?: string | null;
  vendorsDiffer: boolean;
  classNo?: number | null;
  className?: string | null;
  /** IVMST field 15: '1' | '2' | '3', blank = not suspended */
  suspendStatus?: string | null;
  suspendMeaning?: string | null;
  isDiscontinued: boolean;
  inComputyme: boolean;
}

export interface ProductWarehouseStock {
  warehouseCode: string;
  name: string;
  warehouseType: 'OWN' | '3PL' | 'VENDOR';
  city?: string | null;
  state?: string | null;
  country?: string | null;
  stockSource: string;
  onHand?: number | null;
  shipsDirectMarker: boolean;
  memberOrdersWaiting?: number | null;
  onOrder?: number | null;
  stockDue?: string | null;
  binPrimary?: string | null;
  binSecondary?: string | null;
  hasStockFeed: boolean;
}

export interface ProductSupply {
  vendor?: ProductSupplyVendor | null;
  warehouses: ProductWarehouseStock[];
}

/* ---------------------------------------------------------- Warehouses (api/warehouses) */

export type WarehouseType = 'OWN' | '3PL' | 'VENDOR';
export type StockSource = 'COMPUTYME' | 'PIV2' | 'FEED';

export interface WarehouseRow {
  warehouseCode: string;
  name: string;
  warehouseType: WarehouseType;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  stockSource: StockSource;
  isActive: boolean;
  sortOrder: number;
  primaryContact?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  contacts: number;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface WarehouseDetail {
  warehouseCode: string;
  name: string;
  warehouseType: WarehouseType;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  timeZone?: string | null;
  hours?: string | null;
  orderCutoff?: string | null;
  receivingNotes?: string | null;
  shippingNotes?: string | null;
  accountNumber?: string | null;
  stockSource: StockSource;
  notes?: string | null;
  isActive: boolean;
  sortOrder: number;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface WarehouseContact {
  contactId?: number | null;
  warehouseCode?: string;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary: boolean;
  notes?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface WarehouseLogEntry { id: number; what: string; oldJson?: string | null; newJson?: string | null; changedBy?: string | null; changedAt: string; }
export interface WarehouseView { warehouse: WarehouseDetail; contacts: WarehouseContact[]; log: WarehouseLogEntry[]; canEdit: boolean; }
export interface WarehouseList { warehouses: WarehouseRow[]; canEdit: boolean; }
