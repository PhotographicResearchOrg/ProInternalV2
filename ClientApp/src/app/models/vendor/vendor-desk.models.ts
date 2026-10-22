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
  surchargeStored?: string | null;
  surchargeCodeStored?: string | null;
  addsSurchargeToMemberBill: boolean;
  dueDaysText?: string | null;
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

export interface VendorBillingSplit {
  vendorId: number;
  cashDiscountPct?: number | null;
  proSharePct?: number | null;
  specialDeductionPct?: number | null;
  passToMemberPct?: number | null;
  passToMemberEffectivePct?: number | null;
  passToMemberIsCalculated: boolean;
  addSurchargeToMemberBill?: boolean | null;
  effectiveFrom?: string | null;
  notes?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface VendorBillingLogEntry {
  id: number;
  oldJson?: string | null;
  newJson?: string | null;
  changedBy?: string | null;
  changedAt: string;
}

export interface VendorBilling {
  vendorId: number;
  computyme?: VendorBillingComputyme | null;
  programs: VendorBillingProgram[];
  split?: VendorBillingSplit | null;
  log: VendorBillingLogEntry[];
  canEdit: boolean;
}

export interface VendorBillingSaveRequest {
  cashDiscountPct?: number | null;
  proSharePct?: number | null;
  specialDeductionPct?: number | null;
  passToMemberPct?: number | null;
  addSurchargeToMemberBill?: boolean | null;
  effectiveFrom?: string | null;
  notes?: string | null;
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
