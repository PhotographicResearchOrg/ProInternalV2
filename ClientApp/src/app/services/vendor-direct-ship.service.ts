// src/app/services/vendor-direct-ship.service.ts
//
// Direct vendor ship settings for the vendor's own screen: how a vendor's
// orders are delivered and costed, and which of its brands ship direct.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type VendorDirectMethod = 'EMAIL' | 'EDI' | 'FTP' | 'SFTP';

export type VendorDirectCostBase =
  | 'MEMBER_PRICE'
  | 'CARTON_PRICE'
  | 'MAP'
  | 'CONSUMER_RETAIL'
  | 'DISTRIBUTOR_COST';

export interface VendorDirectVendor {
  vendorId: number;
  name?: string;

  /* True = this vendor's orders are sent from the Order Toolbench. */
  enabled: boolean;
  method?: VendorDirectMethod | null;
  emailTo?: string | null;
  emailCc?: string | null;

  /* The EDI folder, or ftp://user@host/path. */
  destination?: string | null;

  /* Only ever sent up. Empty keeps the stored password. */
  password?: string | null;
  hasPassword?: boolean;

  costBase?: VendorDirectCostBase | null;
  costPercent?: number | null;
  brands?: string;
}

export interface VendorDirectBrand {
  brandId: number;
  brandName?: string;
  vendorId?: number | null;
  vendorName?: string;

  /* Every product of the brand ships direct from the vendor. */
  allItems: boolean;

  /* The old "stocked in the warehouse" flag. */
  wh?: string;
}

export interface VendorDirectShipPage {
  vendor: VendorDirectVendor;
  brands: VendorDirectBrand[];
}

export interface VendorDirectResult {
  success: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class VendorDirectShipService {
  private readonly root = 'API/vendor-direct-ship';

  constructor(private api: ApiService) { }

  getVendors(): Observable<VendorDirectVendor[]> {
    return this.api.get<VendorDirectVendor[]>(`${this.root}/vendors`);
  }

  getVendor(vendorId: number): Observable<VendorDirectShipPage> {
    return this.api.get<VendorDirectShipPage>(`${this.root}/vendors/${vendorId}`);
  }

  saveVendor(vendor: VendorDirectVendor): Observable<VendorDirectResult> {
    return this.api.post<VendorDirectResult>(`${this.root}/vendors/${vendor.vendorId}`, vendor);
  }

  /* Sends a marked test file the way this vendor's orders go. Uses the saved settings. */
  sendTest(vendorId: number): Observable<VendorDirectResult> {
    return this.api.post<VendorDirectResult>(`${this.root}/vendors/${vendorId}/test`, {});
  }

  getBrands(): Observable<VendorDirectBrand[]> {
    return this.api.get<VendorDirectBrand[]>(`${this.root}/brands`);
  }

  saveBrand(brand: VendorDirectBrand): Observable<VendorDirectResult> {
    return this.api.post<VendorDirectResult>(`${this.root}/brands/${brand.brandId}`, brand);
  }
}
