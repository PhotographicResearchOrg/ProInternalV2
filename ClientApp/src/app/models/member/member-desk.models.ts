export interface MemberListItem {
  rosterId: number; accountNumber: string; name: string; legalName?: string;
  memberType?: number; accountRole?: string; status: string; portalEnabled: boolean;
  city?: string; state?: string; country?: string; parentAccountNumber?: string; onCreditHold: boolean;
}

export interface MemberHeader {
  rosterId: number; accountNumber: string; name: string; legalName?: string;
  memberType?: number; accountRole?: string | null; status: string; portalEnabled: boolean;
  joinDate?: string | null; phone?: string; fax?: string; email?: string; website?: string;
  parentAccountNumber?: string | null; parentName?: string; billToParent: boolean;
  previousAccountNumber?: string | null; hasCustomCatalog: boolean;
  paymentMethod?: number | null; defaultPaymentMethod?: number | null; paymentMethodReason?: string | null;
  authorizeNetCustomerProfileId?: string;
  priceCountry?: string | null; currencyCode?: string | null; languageCode?: string | null; fulfillmentCenter?: string | null;
  markupExempt: boolean; markupExemptReason?: string | null;
  duesFrequency?: string | null; instantRebateOverride?: string | null; patronagePayoutMethod?: string | null; terms?: string;
  sqlIsMaster: boolean;
  creditLimit?: number | null; creditHoldSince?: string | null; creditHoldReason?: string | null;
  ezPayAllowed: boolean; duesEnrolled: boolean; computymeDues?: string | null; shippingZone?: number | null; airDuringPeak: boolean;
  computymeName?: string; computymeType?: string;
  holdEveryOrder: boolean; holdEveryOrderReason?: string;
  billToAddressId?: number; address1?: string; address2?: string; city?: string; state?: string; zip?: string; country?: string;
  enterDate?: string; updateDate?: string; updatedBy?: string;
}

export interface MemberLocation {
  addressId: number; addressTypeId?: number; addressTypeName?: string;
  address1?: string; address2?: string; city?: string; state?: string; zip?: string; country?: string; companyName?: string;
  isPrimary: boolean; isActive: boolean; isBillTo: boolean; computymeShipTo?: number | null; isDefaultShipTo: boolean;
}
export interface MemberContact { role: string; userId: number; firstName?: string; lastName?: string; email?: string; phone?: string; }
export interface MemberGrant {
  memberAuthorizationId: number; code: string; name: string; status: string; description: string;
  unlocksAuthorizedPrice: boolean; grantedOn: string; grantedBy: string; reason: string; evidenceDocumentId?: number;
}
export interface MemberBrandExclusion { brandId: number; brandName?: string; source: 'RULE' | 'MANUAL'; ruleCodes?: string; }
export interface MemberGroupExclusion { groupId: number; groupName?: string; }
export interface MemberMapViolation {
  violationId: number; productCode: string; modelName?: string; startDate: string; endDate: string; recordedAt?: string;
  penaltyDays: number; isActive: boolean; note?: string; evidenceDocumentId?: number; createdBy?: string;
}
export interface MemberDocument {
  documentId: number; documentType: string; title?: string; fileName: string; contentType?: string; sizeBytes?: number;
  uploadedAt: string; uploadedBy: string; expiresOn?: string; reviewStatus: string; reviewedBy?: string; reviewedAt?: string; reviewNote?: string;
}
export interface MemberRelated { relation: 'CHILD' | 'PREVIOUS' | 'NEXT'; accountNumber: string; name: string; }
export interface MemberAccessLogEntry {
  logId: number; loggedAt: string; action: string; brandId?: number | null; brandName?: string | null;
  ruleCode?: string | null; detail?: string | null; changedBy: string;
}

export interface MemberDetail {
  header: MemberHeader; locations: MemberLocation[]; contacts: MemberContact[]; grants: MemberGrant[];
  brandExclusions: MemberBrandExclusion[]; groupExclusions: MemberGroupExclusion[];
  mapViolations: MemberMapViolation[]; documents: MemberDocument[]; related: MemberRelated[];
  accessLog: MemberAccessLogEntry[];
  brm?: { firstName: string; lastName: string; email?: string; phone?: string } | null;
}

export interface AccessRule {
  authorizationId?: number | null; code: string; name: string; description: string; businessReason: string;
  status: 'ACTIVE' | 'LEGACY' | 'RETIRED'; brandId?: number | null; brandName?: string; vendorId?: number | null;
  unlocksAuthorizedPrice: boolean; segmentType: 'MEMBER_TYPE' | 'INTERNATIONAL_COUNTRY' | 'NON_NUMERIC_POSTAL' | 'NONE';
  memberTypes?: string | null; requiresCustomCatalog: boolean; requiresPortalEnabled: boolean;
  reviewStatus: 'NEEDS_REVIEW' | 'REVIEWED'; approvedBy?: string; approvedOn?: string; reviewBy?: string | null;
  updatedAt?: string; updatedBy?: string; membersInSegment?: number; membersGranted?: number; membersExcluded?: number;
}
export interface AccessRuleMember {
  accountNumber: string; name: string; memberType?: number; standing: 'GRANTED' | 'EXCLUDED';
  grantedOn?: string; grantedBy?: string; reason?: string;
}

export const MEMBER_TYPES: { [k: number]: string } = { 1: 'Member', 2: 'Affiliate', 3: 'Client', 4: 'House account (GL)' };
export const DOCUMENT_TYPES = [
  { value: 'BUSINESS_CERT', label: 'Business certificate' }, { value: 'RESALE_CERT', label: 'Resale certificate' },
  { value: 'MEMBERSHIP_AGREEMENT', label: 'Membership agreement' }, { value: 'CREDIT_APPLICATION', label: 'Credit application' },
  { value: 'W9', label: 'W-9' }, { value: 'EIN_LETTER', label: 'EIN letter' },
  { value: 'VENDOR_AUTHORIZATION', label: 'Vendor authorization' }, { value: 'MAP_EVIDENCE', label: 'MAP evidence' },
  { value: 'OTHER', label: 'Other' }
];
export const SEGMENT_LABELS: { [k: string]: string } = {
  MEMBER_TYPE: 'Member type', INTERNATIONAL_COUNTRY: 'Billed outside the US',
  NON_NUMERIC_POSTAL: 'Non-numeric postal code', NONE: 'Grant only'
};

/* ---------- ship-tos: SQL vs Computyme (read only). API: GET api/members/{acct}/shiptos, GET api/members/shipto-issues */
export type ShipToStatus =
  'MATCH' | 'DIFFERENT' | 'NOT_IN_COMPUTYME' | 'ONLY_IN_COMPUTYME' | 'NOT_MAPPED' |
  'BAD_CODE' | 'DUPLICATE_CODE' | 'ADDRESS_MISSING' | 'ADDRESS_INACTIVE' | 'NO_MIRROR';
export interface ShipToMirror { mirrorAvailable: boolean; mirrorSource?: string | null; mirrorShipTos: number; }
export interface ShipToCompareRow {
  accountNumber: string; memberName?: string | null; code?: string | null; mapId?: number | null; codeRaw?: string | null;
  isDefault?: boolean | null; addressId?: number | null; addressActive?: boolean | null; addressTypeName?: string | null;
  sqlStreet?: string | null; sqlStreet2?: string | null; sqlCity?: string | null; sqlState?: string | null; sqlZip?: string | null; sqlCountry?: string | null;
  computymeSource?: string | null; computymeKey?: string | null; ctyName?: string | null; ctyStreet?: string | null; ctyStreet2?: string | null;
  ctyCity?: string | null; ctyState?: string | null; ctyZip?: string | null; ctyZone?: string | null;
  status: ShipToStatus; differences?: string | null; fitIssues?: string | null;
}
export interface MemberShipTos { mirror?: ShipToMirror | null; rows: ShipToCompareRow[]; }
export interface ShipToIssues { mirror?: ShipToMirror | null; counts: { status: string; shipTos: number; members: number }[]; rows: ShipToCompareRow[]; }
