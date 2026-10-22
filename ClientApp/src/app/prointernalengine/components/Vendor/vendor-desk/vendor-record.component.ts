import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { exportWorkbook } from './desk-export';
import { VendorBilling, VendorFulfillment, VendorFulfillmentBrand, VendorRecord, VendorRecordField } from 'src/app/models/vendor/vendor-desk.models';

interface FieldGroup { name: string; fields: VendorRecordField[]; }
/** what the Direct Vendor Ship tab has for a brand (VendorDirectBrand) */
export interface DvsBrandSetting { brandId: number; allItems?: boolean | null; wh?: string | null; }

/** Vendor Desk panels fed from Computyme (read only):
 *  mode 'record'      every APMST field for the vendor, parsed terms, where the vendor is used
 *  mode 'terms'       Computyme's terms, cash discount, surcharge and direct-billing programs, compared with the
 *                     PIV2 terms on the same tab (Terms & Financials)
 *  mode 'fulfillment' where the vendor's products ship from (PA warehouse / direct / out of stock), compared with
 *                     the Direct Vendor Ship settings on the same tab */
@Component({
  selector: 'app-vendor-record',
  templateUrl: './vendor-record.component.html',
  styleUrls: ['./vendor-desk.shared.scss', './vendor-record.component.scss']
})
export class VendorRecordComponent implements OnChanges {
  @Input() vendorId: number | null = null;
  @Input() mode: 'record' | 'terms' | 'fulfillment' = 'record';

  /* terms mode: the PIV2 values on Terms & Financials */
  @Input() piv2ProDiscountPct: number | null | undefined = null;
  @Input() piv2MemberDiscountPct: number | null | undefined = null;
  @Input() piv2PaymentTerms: string | null | undefined = null;

  /* fulfillment mode: the Direct Vendor Ship settings */
  @Input() dvsEnabled: boolean | null | undefined = null;
  @Input() dvsBrands: DvsBrandSetting[] | null | undefined = null;

  record: VendorRecord | null = null;
  groups: FieldGroup[] = [];
  showHidden = false;

  billing: VendorBilling | null = null;
  fulfillment: VendorFulfillment | null = null;

  loading = false;
  error = '';

  constructor(private data: DataService) { }

  ngOnChanges(ch: SimpleChanges): void {
    if (!this.vendorId) return;
    if (!ch['vendorId'] && !ch['mode']) return;   // only the comparison inputs changed
    if (this.mode === 'record') this.loadRecord();
    else if (this.mode === 'terms') this.loadTerms();
    else this.loadFulfillment();
  }

  /* ------------------------------------------------------------ record */

  loadRecord(): void {
    this.loading = true;
    this.error = '';
    this.data.vendorRecord(this.vendorId!).subscribe({
      next: r => { this.record = r; this.loading = false; this.regroup(); },
      error: e => { this.loading = false; this.error = e?.error?.message || 'Couldn\'t load the vendor record.'; }
    });
  }

  regroup(): void {
    const by = new Map<string, VendorRecordField[]>();
    for (const f of this.record?.fields || []) {
      if (f.hidden && !this.showHidden) continue;
      if (!by.has(f.groupName)) by.set(f.groupName, []);
      by.get(f.groupName)!.push(f);
    }
    this.groups = Array.from(by.entries()).map(([name, fields]) => ({ name, fields }));
  }

  shown(f: VendorRecordField): string {
    const v = f.displayValue ?? f.value;
    return v == null || String(v).trim() === '' ? '—' : String(v);
  }

  exportRecord(): void {
    const r = this.record;
    if (!r) return;
    exportWorkbook(`Vendor${r.vendorId}_Record`, [
      { name: 'Vendor record', rows: r.fields.map(f => ({ Group: f.groupName, Field: f.label, Column: f.columnName, Value: f.displayValue ?? f.value ?? '', Note: f.note || '' })) },
      { name: 'Terms', rows: r.terms ? [{ 'As typed': r.terms.dueDaysText || '', Meaning: r.terms.description, Type: r.terms.termsType,
          'Net days': r.terms.netDays ?? '', 'Day of month': r.terms.dayOfMonth ?? '', 'Cash discount %': r.terms.cashDiscountPct ?? r.terms.cashDiscountText ?? '' }] : [] },
      { name: 'Usage', rows: r.usage ? [{ 'Live products bought here': r.usage.liveProductsAsVendor, 'Products incl. discontinued': r.usage.productsAsVendor,
          Brands: r.usage.brands, 'Direct-billing programs': r.usage.directBillingPrograms, 'Open POs': r.usage.openPurchaseOrders, 'POs on file': r.usage.purchaseOrders }] : [] }
    ]);
  }

  /* ------------------------------------------------------------ terms */

  loadTerms(): void {
    this.loading = true;
    this.error = '';
    this.data.vendorBilling(this.vendorId!).subscribe({
      next: b => { this.billing = b; this.loading = false; },
      error: e => { this.loading = false; this.error = e?.error?.message || 'Couldn\'t load Computyme\'s terms.'; }
    });
  }

  /** Computyme's cash discount differs from the PRO discount entered in PIV2 */
  get discountDiffers(): boolean {
    const c = this.billing?.computyme?.cashDiscountPct;
    const p = this.piv2ProDiscountPct;
    return c != null && p != null && Math.abs(+c - +p) > 0.0001;
  }

  /** a stored surcharge read as tenths of a percent (35 = 3.5%), when it's a whole number */
  tenths(v: string | null | undefined): string | null {
    const n = parseFloat(v || '');
    return isNaN(n) || !Number.isInteger(n) || n === 0 ? null : `${n / 10}%`;
  }

  exportTerms(): void {
    const b = this.billing;
    if (!b) return;
    const c = b.computyme;
    exportWorkbook(`Vendor${b.vendorId}_Terms`, [
      { name: 'Terms', rows: [{
        'Computyme terms (as typed)': c?.dueDaysText || '', 'Computyme terms': c?.termsDescription || '', 'PIV2 payment terms': this.piv2PaymentTerms || '',
        'Computyme cash discount': c?.cashDiscountStored || '', 'PIV2 PRO discount %': this.piv2ProDiscountPct ?? '', 'PIV2 member discount %': this.piv2MemberDiscountPct ?? '',
        'PRO surcharge (stored)': c?.surchargeStored || '', 'Surcharge on member bill': c?.addsSurchargeToMemberBill ? 'Yes' : 'No' }] },
      { name: 'Direct-billing programs', rows: b.programs.map(p => ({ Program: p.programNo ?? '', Name: p.name || '', 'Surcharge (stored)': p.surchargeStored || '',
          'Special deduction': p.specialDeductionStored || '', 'Special %': p.specialPctStored || '', 'Admin days': p.adminDaysStored || '',
          FTR: p.ftrStored || '', 'YTD sales': p.ytdSalesStored || '', 'Prior year': p.priorYearStored || '' })) }
    ]);
  }

  /* ------------------------------------------------------------ fulfillment */

  loadFulfillment(): void {
    this.loading = true;
    this.error = '';
    this.data.vendorFulfillment(this.vendorId!).subscribe({
      next: f => { this.fulfillment = f; this.loading = false; },
      error: e => { this.loading = false; this.error = e?.error?.message || 'Couldn\'t load where this vendor\'s products ship from.'; }
    });
  }

  dvsFor(b: VendorFulfillmentBrand): DvsBrandSetting | undefined {
    return (this.dvsBrands || []).find(x => x.brandId === b.brandId);
  }

  dvsText(b: VendorFulfillmentBrand): string {
    const s = this.dvsFor(b);
    if (!s) return 'Not on direct ship';
    return s.allItems ? 'Everything ships direct' : 'Only products marked direct';
  }

  /** set to ship everything direct, yet products are stocked in the PA warehouse */
  conflict(b: VendorFulfillmentBrand): boolean {
    return !!this.dvsFor(b)?.allItems && b.inWarehouse > 0;
  }

  get conflicts(): number {
    return (this.fulfillment?.brands || []).filter(b => this.conflict(b)).length;
  }

  exportFulfillment(): void {
    const f = this.fulfillment;
    if (!f) return;
    exportWorkbook(`Vendor${f.vendorId}_Fulfillment`, [
      { name: 'Summary', rows: f.summary ? [{ 'Live products': f.summary.liveProducts, 'In PA warehouse': f.summary.inWarehouse,
          'Ships direct (99999+)': f.summary.shipsDirect, 'Out of stock': f.summary.outOfStock, 'Drop-ship eligible': f.summary.dropShipEligible,
          'Products incl. discontinued': f.summary.products }] : [] },
      { name: 'By brand', rows: f.brands.map(b => ({ Brand: b.brandName || '', 'Brand on this vendor': b.brandOnThisVendor ? 'Yes' : 'No (bought here)',
          'Live products': b.liveProducts, 'In PA warehouse': b.inWarehouse, 'Ships direct': b.shipsDirect, 'Out of stock': b.outOfStock,
          'Direct vendor ship setting': this.dvsText(b), Conflict: this.conflict(b) ? 'Set to ship everything direct but stocked in PA' : '' })) }
    ]);
  }

  dash(v: string | null | undefined): string { return v == null || String(v).trim() === '' ? '—' : String(v); }
}
