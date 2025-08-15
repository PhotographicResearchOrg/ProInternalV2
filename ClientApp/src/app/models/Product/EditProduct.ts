export interface Result<T = any> {
  success: boolean;
  message?: string;
  resultType?: 'SUCCESS' | 'ERROR' | 'WARNING';
  data?: T;
}

export interface IQPrompt {
  iqPromptId: number;
  name: string;
  isStartPrompt: boolean;
}

export interface GroupMember {
  productCode: string;
  groupCode: string;
}

export interface Accessory {
  accessoryProductId: number;
  productCode: string;
  modelName?: string;
}

export interface RelatedProduct {
  relatedProductId: number;
  productCode: string;
  modelName?: string;
}

export interface ProductAttribute {
  attributeName: string;
  attributeValue: string;
}

export interface BrandOption {
  brandId: number;
  brandName: string;
  displayBrandRebate: boolean;
}

export interface CategoryNode {
  catId: number;
  catName: string;
  children?: CategoryNode[];
}

export interface Prod {
  productId: number;
  productCode: string;
  modelName: string;
  modelVersion?: string;
  p65?: string;

  isActive: boolean;
  isPublic: boolean;
  isForSale: boolean;
  shippingHold: boolean;
  isDiscontinued: boolean;
  requireSerialForSar: boolean;
  specialOrder: boolean;
  newProdOverride: boolean;

  replacementCode?: string;
  topCatId?: number;
  categoryId?: number;

  brandId?: number;
  brandRebate?: number | null;

  multiple?: number | null;
  carton?: number | null;

  features?: string;
  specs?: string;
  faq?: string;
  outOfStockMessage?: string;
  stockDueDate?: string | Date | null;

  accessories: Accessory[];
  relatedProducts: RelatedProduct[];
  tags: string[];

  variationColorName?: string;
  variationColorHex?: string;
  variationSize?: string;

  isGroupDefault?: boolean;
  group?: GroupMember[];

  productAttributes: ProductAttribute[];
  brands?: BrandOption[];         // optional preload
  categoryTree?: CategoryNode[];  // optional preload
  iqPrompts?: IQPrompt[];         // optional preload
}

export interface ProductInfoLookup {
  productId: number;
  modelName: string;
}

export type ProductInfoType = 'accessory' | 'related';
