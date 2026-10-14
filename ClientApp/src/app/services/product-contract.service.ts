// src/app/services/product-contract.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

/* One product as the product page reads it. product and content are the two contract documents. */
export interface ProductPageData {
  product: any;
  content: any;

  /* Live numbers from fulfillment. Shown, never saved. */
  live: {
    unitsAvailable?: number | null;
    unitsOnOrder?: number | null;
    unitsOnMemberOrders?: number | null;
    stockDue?: string | null;
  };

  /* True while Computyme still feeds prices, UPC, case quantities and status. */
  computymeFieldsLocked: boolean;

  /* True when the inventory marker, not a stored flag, decides direct vendor ship. */
  followsInventoryMarker: boolean;
  markerSaysDirect: boolean;

  computymeActualVendor?: string | null;
  computymeVendorGroup?: string | null;
  categoryPath: string[];
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface ProductSaveResult {
  success: boolean;
  message: string;
  problems?: string[];
}

export interface ProductBrandOption {
  brandId: string;
  name?: string;
  vendorId?: string | null;
  vendorName?: string | null;
  directShipAll: boolean;
}

/* ---- product finder ---- */

export interface ProductSearchQuery {
  term?: string;
  brandId?: string | number;
  status?: string;          // ACTIVE | DISCONTINUED | INACTIVE
  shipsFrom?: string;       // WAREHOUSE | DIRECT
  forSale?: boolean;
  gap?: string;             // NO_BARCODE | NO_EAN | NO_WEIGHT | NO_CUSTOMS
  sort?: string;            // RELEVANCE | CODE | NAME | BRAND | PRICE | AVAILABLE
  desc?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ProductSearchRow {
  productId: number;
  productCode: string;
  name: string;
  brandId: string | null;
  brandName: string | null;
  vendorId: string | null;
  upc: string | null;
  ean: string | null;
  vendorCatalogNumber: string | null;
  status: 'ACTIVE' | 'DISCONTINUED' | 'INACTIVE';
  forSale: boolean;
  shipsDirect: boolean;
  memberPrice: number | null;
  mapPrice: number | null;
  available: number | null;
  hasBarcode: boolean;
  hasWeight: boolean;
  hasCustoms: boolean;
}

export interface ProductSearchPage {
  rows: ProductSearchRow[];
  total: number;
  page: number;
  pageSize: number;
}

/* ---- AI translation (Bedrock) ---- */

export interface ProductTranslateRequest {
  sourceLocale: string;
  source: Record<string, unknown>;
  targets: string[];
  doNotTranslate: string[];
}

export interface ProductTranslateResult {
  model: string;
  results: { locale: string; content: any; notes: string[] }[];
  failures: { locale: string; message: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class ProductContractService {
  constructor(private api: ApiService) { }

  getProduct(productId: number | string): Observable<ProductPageData> {
    return this.api.get<ProductPageData>(
      `API/products/${encodeURIComponent(String(productId))}/contract`
    );
  }

  saveProduct(
    productId: number | string,
    product: unknown,
    content: unknown,
    followInventoryMarker: boolean
  ): Observable<ProductSaveResult> {
    return this.api.post<ProductSaveResult>(
      `API/products/${encodeURIComponent(String(productId))}/contract`,
      { product, content, followInventoryMarker }
    );
  }

  getBrands(): Observable<ProductBrandOption[]> {
    return this.api.get<ProductBrandOption[]>('API/products/contract/brands');
  }

  /* Translate one language's content into others. Nothing is saved until the product is saved. */
  translateContent(productId: number | string, request: ProductTranslateRequest): Observable<ProductTranslateResult> {
    return this.api.post<ProductTranslateResult>(
      `API/products/${encodeURIComponent(String(productId))}/contract/translate`,
      request
    );
  }

  /* The product finder and the quick-jump box. Empty filters are left off the URL. */
  searchProducts(query: ProductSearchQuery): Observable<ProductSearchPage> {
    const qs = Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');

    return this.api.get<ProductSearchPage>(`API/products/contract/search${qs ? '?' + qs : ''}`);
  }
}
