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
