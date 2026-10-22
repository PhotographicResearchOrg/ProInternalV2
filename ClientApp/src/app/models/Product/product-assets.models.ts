/* Product Desk · Shopify & assets (GET api/products/{id}/assets). Read only. */

export interface ProductAssetField { fieldName: string; fieldValue: string | null; }

export interface ProductImageAsset {
  imageName: string;
  displayOrder: number | null;
  inProductImage: boolean;   // listed in dbo.ProductImage (what the B2B site shows)
  has100: boolean;
  has250: boolean;
  hasFull: boolean;
}

export interface ProductDocumentAsset {
  fileName: string;
  displayName: string | null;
  fileLocation: string | null;
  url: string | null;
  uploadDate: string | null;
  link: string | null;
}

export interface ProductS3File { bucket: string | null; link: string | null; displayName: string | null; }

export interface ProductShopifyChange {
  id: number;
  change: string | null;
  oldValue: string | null;
  newValue: string | null;
  dateChanged: string | null;
  dateProcessed: string | null;
  result: string | null;
}

export interface ShopifyGovernanceIssue {
  id: number; productCode: number; shopifyProductId: number;
  issueType: string; issueSeverity: string; details: string; createdDate: string;
}

export interface ShopifyTaxonomyRow {
  id: number; productCode: number; modelName: string; brandName: string; productType: string;
  shopifyCategoryId: string; shopifyCategoryFullName: string; wasApplied: boolean; imageCount: number;
  status: string; createdDate: string;
}

export interface ProductAssetsView {
  productId: number;
  productCode: string;
  fields: ProductAssetField[];
  images: ProductImageAsset[];
  documents: ProductDocumentAsset[];
  files: ProductS3File[];
  shopifyFeed: ProductShopifyChange[];
  shopifyIssues: ShopifyGovernanceIssue[];
  shopifyTaxonomy: ShopifyTaxonomyRow[];
  imageBaseUrl: string;
  filesBaseUrl: string | null;
  shopifyAdminProductUrl: string | null;
  filesError: string | null;
  shopifyError: string | null;
}

/* ------------------------------------------------------------ product sheet (GET api/products/{id}/sheet) */

export type SheetLock = 'SYSTEM' | 'CATEGORY' | 'SHOPIFY' | 'MARKETPLACE' | 'COMPUTYME' | 'VIEW' | 'CONTRACT' | null;

export interface ProductSheetField {
  source: 'ProductData' | 'Computyme';
  columnName: string;
  dataType: string;
  maxLength: number;
  prec: number;
  scale: number;
  isNullable: boolean;
  value: string | null;
  displayValue?: string | null;
  label: string;
  groupName: string;
  sortOrder: number;
  lock: SheetLock;
  note: string | null;
}

export interface ProductTechSpecRow {
  sectionId: number; sectionName: string; sectionDisplayOrder: number;
  attributeId: number; attributeName: string; attributeDisplayOrder: number;
  value: string | null;
}

export interface ProductSheetChangeLog {
  logId: number; columnName: string; label: string; oldValue: string | null; newValue: string | null;
  changedBy: string; changedAt: string;
}

export interface ProductSheetView {
  fields: ProductSheetField[];
  techSpecs: ProductTechSpecRow[];
  history: ProductSheetChangeLog[];
  techSpecsError: string | null;
  sqlIsMaster: boolean;
  canEdit: boolean;
}

/** Each person's layout: hidden groups and fields, group order, only-filled. */
export interface ProductSheetLayout {
  hiddenGroups: string[];
  hiddenFields: string[];
  groupOrder: string[];
  onlyFilled: boolean;
  /** Named layouts the person saved ("Pricing", "Web content"...), and which one is in use. */
  views?: { name: string; hiddenGroups: string[]; hiddenFields: string[]; groupOrder: string[]; onlyFilled: boolean }[];
  current?: string | null;
}
