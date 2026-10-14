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

/* ---- market pricing: exchange rates, conversion, price history ---- */

export interface ExchangeRate {
  exchangeRateId: number;
  currency: string;
  unitsPerUsd: number;          // $1 buys this many units
  rateDate: string;             // the date the source published it
  source: 'ECB' | 'MANUAL';
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | null;
  reason?: string | null;
  expiresOn?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  clearedBy?: string | null;
  clearedAt?: string | null;
  clearedReason?: string | null;
  /* pending rows: the rate this one would replace */
  currentUnitsPerUsd?: number | null;
  currentRateDate?: string | null;
  currentSource?: string | null;
}

export interface ExchangeRateBoard {
  current: ExchangeRate[];
  pending: ExchangeRate[];
  history: ExchangeRate[];
  added?: number | null;
  feedDate?: string | null;
}

export interface MarketOption {
  country: string;
  name: string;
  currency: string;
  locale: string;
  isHome: boolean;
  upliftPercent: number;
  roundTo: number;
}

export interface MoneyValue { amount: string; currency: string; }

export interface ConvertPricesRequest {
  source: Record<string, MoneyValue>;
  countries: string[];
}

export interface ConvertedMarket {
  country: string;
  currency: string;
  prices: Record<string, MoneyValue>;
  exchangeRateId: number | null;
  unitsPerUsd: number;
  rateDate: string | null;
  rateSource: string | null;
  upliftPercent: number;
  roundTo: number;
}

export interface ConvertPricesResult {
  results: ConvertedMarket[];
  failures: { country: string; message: string }[];
}

export interface MarketPriceMeta {
  country: string;
  method: 'CONVERTED' | 'MANUAL' | null;
  exchangeRateId: number | null;
  unitsPerUsd: number | null;
  rateDate: string | null;
  upliftPercent: number | null;
  sourceHash: string | null;
}

export interface PriceLogRow {
  logId: number;
  country: string;
  priceKey: string;
  currency: string | null;
  oldAmount: number | null;
  newAmount: number | null;
  method: 'CONVERTED' | 'MANUAL' | 'REMOVED';
  exchangeRateId: number | null;
  unitsPerUsd: number | null;
  rateDate: string | null;
  upliftPercent: number | null;
  reason: string | null;
  changedBy: string;
  changedAt: string;
}

export interface ProductPricingAudit {
  markets: MarketPriceMeta[];
  history: PriceLogRow[];
}

/* Sent with a save: how each market's prices were made, and why any converted price was overridden. */
export interface PriceAudit {
  reason: string | null;
  markets: {
    country: string;
    method: 'CONVERTED' | 'MANUAL';
    exchangeRateId: number | null;
    upliftPercent: number | null;
    sourceHash: string | null;
  }[];
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
    followInventoryMarker: boolean,
    priceAudit: PriceAudit | null = null
  ): Observable<ProductSaveResult> {
    return this.api.post<ProductSaveResult>(
      `API/products/${encodeURIComponent(String(productId))}/contract`,
      { product, content, followInventoryMarker, priceAudit }
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

  // ---- market pricing ----

  getExchangeRates(): Observable<ExchangeRateBoard> {
    return this.api.get<ExchangeRateBoard>('API/products/contract/exchange-rates');
  }

  /* Pulls the ECB rates now. New rates come back pending; nothing is used until accepted. */
  refreshExchangeRates(): Observable<ExchangeRateBoard> {
    return this.api.post<ExchangeRateBoard>('API/products/contract/exchange-rates/refresh', {});
  }

  decideExchangeRates(ids: number[], accept: boolean, reason?: string | null): Observable<ExchangeRateBoard> {
    return this.api.post<ExchangeRateBoard>('API/products/contract/exchange-rates/decide', { ids, accept, reason: reason || null });
  }

  /* A rate set by hand: used straight away, needs a reason. */
  overrideExchangeRate(body: { currency: string; unitsPerUsd: number; reason: string; expiresOn?: string | null }): Observable<ExchangeRateBoard> {
    return this.api.post<ExchangeRateBoard>('API/products/contract/exchange-rates/override', body);
  }

  clearExchangeRate(exchangeRateId: number, reason?: string | null): Observable<ExchangeRateBoard> {
    return this.api.post<ExchangeRateBoard>(
      `API/products/contract/exchange-rates/${encodeURIComponent(String(exchangeRateId))}/clear`,
      { reason: reason || null }
    );
  }

  getMarkets(): Observable<MarketOption[]> {
    return this.api.get<MarketOption[]>('API/products/contract/markets');
  }

  /* Converts the US prices into markets. Nothing is saved until the product is saved. */
  convertPrices(body: ConvertPricesRequest): Observable<ConvertPricesResult> {
    return this.api.post<ConvertPricesResult>('API/products/contract/convert-prices', body);
  }

  getPricingAudit(productId: number | string): Observable<ProductPricingAudit> {
    return this.api.get<ProductPricingAudit>(
      `API/products/${encodeURIComponent(String(productId))}/contract/pricing-audit`
    );
  }
}
