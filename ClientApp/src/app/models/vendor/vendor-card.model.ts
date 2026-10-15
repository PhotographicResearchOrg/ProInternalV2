// src/app/models/vendor/vendor-card.model.ts
// Mirrors Models/Vendor/VendorCard.cs (backend DTOs behind api/VendorCard).

export interface VendorTerms {
  vendorId: number;
  proDiscountPct?: number;
  memberDiscountPct?: number;
  paymentTerms?: string;
  termsBasis?: string;
  earlyPayDiscountText?: string;
  creditLimit?: number;
  currency?: string;
  taxStatus?: string;
  remitMethod?: string;
  minimumOrder?: number;
  fobPoint?: string;
  defaultMarkup?: number;
  volumeRebateText?: string;
  priceProtectionDays?: number;
  dropShipEnabled?: boolean;
  primaryCategory?: string;
  countryOfOrigin?: string;
}

// POST api/VendorCard -- mirrors CreateVendorDto. Field set follows
// Schemas/OrderIntegration/v1.0/vendors/vendor.schema.json; name, status
// and currency are required, vendorId is auto-assigned when omitted.
export type VendorStatus = 'ACTIVE' | 'INACTIVE';
export type VendorSupplyModel = 'WAREHOUSE' | 'DIRECT_SHIP';
export type VendorContactRole =
  'SALES' | 'ORDERS' | 'ACCOUNTS_RECEIVABLE' | 'RETURNS' | 'EDI' | 'PROGRAMS' | 'PRODUCT' | 'EXECUTIVE' | 'OTHER';

export interface CreateVendorRequest {
  vendorId?: number | null;
  name: string;
  status: VendorStatus;
  legalName?: string;
  shortName?: string;
  category?: string;
  ourAccountNumber?: string;
  websiteUrl?: string;
  notes?: string;
  managedBy?: string;
  addressLine1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  currency: string;
  paymentTermsCode?: string;
  creditLimit?: number | null;
  minimumOrder?: number | null;
  supplyModels?: VendorSupplyModel[];
  contactRole?: VendorContactRole | null;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface VendorStats {
  activeContracts: number;
  priceListCount: number;
  contactCount: number;
  lastChangeAt?: string;
}

export interface VendorCard {
  vendorId: number;
  name: string;
  legalName?: string;
  accountNumber?: string;
  repName?: string;
  isActive: boolean;
  onWeb: boolean;
  brands: string[];
  terms: VendorTerms;
  stats: VendorStats;
}

export interface VendorContactApi {
  vendorContactId: number;
  vendorContactGroupId: number;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
}

export interface VendorContactGroupApi {
  vendorContactGroupId: number;
  vendorId: number;
  groupName: string;
  sortOrder: number;
  people: VendorContactApi[];
}

export interface VendorContractApi {
  vendorContractId: number;
  vendorId: number;
  name: string;
  contractType?: string;
  startDate?: string;
  endDate?: string;
  valueText?: string;
  status: string;
}

export interface VendorPriceListApi {
  vendorPriceListId: number;
  vendorId: number;
  name: string;
  effectiveDate?: string;
  expirationDate?: string;
  skuCount: number;
  currency: string;
  status: string;
}

// Uploaded document on the vendor file share (contracts / price lists)
export type VendorFileCategory = 'contracts' | 'price-lists';

export interface VendorFileApi {
  fileName: string;
  sizeBytes: number;
  uploadedUtc: string;
}

export interface VendorFreightPolicy {
  vendorId: number;
  freightTerms?: string;
  fobPoint?: string;
  carrier?: string;
  prepaidThreshold?: number;
  fuelSurcharge?: string;
  leadTimeText?: string;
}

export interface VendorShippingPolicy {
  vendorId: number;
  freeFreightThreshold?: number;
  appliesTo?: string;
  proTierOverride?: number;
  excludes?: string;
  stacksWithPromos: boolean;
}

export interface VendorReturnPolicy {
  vendorId: number;
  returnWindowDays?: number;
  restockingFeePct?: number;
  rmaRequired: boolean;
  returnFreightText?: string;
  defectiveHandlingText?: string;
  nonReturnableText?: string;
}

export interface VendorPolicies {
  freight: VendorFreightPolicy;
  shipping: VendorShippingPolicy;
  returns: VendorReturnPolicy;
}

export interface VendorRebateProgramApi {
  vendorRebateProgramId: number;
  vendorId: number;
  name: string;
  code?: string;
  amountText?: string;
  eligibility: string;
  scopeText?: string;
  windowText?: string;
  funding?: string;
  claimMethod?: string;
  status: string;
  isWebVisible: boolean;
  budgetAmount: number;
  rebatedAmount: number;
  redemptionCount: number;
}

// Custom fields are defined once (VendorCustomFieldDefinitionApi) and shown
// on every vendor under the chosen section; each vendor has its own value.
export const VENDOR_CUSTOM_FIELD_SECTIONS: { id: string; label: string }[] = [
  { id: 'terms', label: 'Terms & Financials' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'pricelists', label: 'Price Lists' },
  { id: 'policies', label: 'Policies' },
  { id: 'rebates', label: 'Instant Rebates' }
];

export const VENDOR_CUSTOM_FIELD_TYPES = ['Text', 'Number', 'Date', 'Boolean'];

export interface VendorCustomFieldDefinitionApi {
  vendorCustomFieldDefinitionId: number;
  section: string;
  label: string;
  dataType: string;
  isPublishable: boolean;
  sortOrder: number;
  createdAt?: string;
  createdBy?: string;
  usageCount: number;
}

export interface VendorCustomFieldApi {
  vendorCustomFieldDefinitionId: number;
  vendorId: number;
  section: string;
  label: string;
  dataType: string;
  isPublishable: boolean;
  sortOrder: number;
  value?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface VendorAuditLogEntryApi {
  entityAuditLogId: number;
  entityType: string;
  entityId: number;
  section?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  changedBy?: string;
  changedAt: string;
  sessionId?: string;
  isCurrentSession: boolean;
}
