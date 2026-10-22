import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DataService } from 'src/app/services/data.service';
import {
  BrandVendorHistoryRow, BrandVendorRow, ProductClassRow, ProductClassSaveRequest
} from 'src/app/models/vendor/vendor-desk.models';
import { exportWorkbook } from './desk-export';
import { HomePin, stablePin } from 'src/app/services/home-pin.service';

type BrandFilter = 'all' | 'novendor' | 'notap' | 'elsewhere' | 'ok';
interface VendorOption { id: number; label: string; }

/** Brands & vendors: which vendor each brand belongs to (SQL is master: dbo.Brand.VendorID, read by the
 *  B2B vendor filter), reconciled against who Computyme says each product is bought from; and product classes.
 *  With [vendorId] it shows one vendor's brands (used inside the Vendor Desk). */
@Component({
  selector: 'app-brand-vendor-desk',
  templateUrl: './brand-vendor-desk.component.html',
  styleUrls: ['./vendor-desk.shared.scss', './brand-vendor-desk.component.scss']
})
export class BrandVendorDeskComponent implements OnInit {
  /** set when embedded in the Vendor Desk: only this vendor's brands, no classes tab */
  @Input() vendorId: number | null = null;

  tab: 'brands' | 'classes' = 'brands';

  brands: BrandVendorRow[] = [];
  canEditBrands = false;
  brandsLoading = false;
  brandsError = '';
  filter: BrandFilter = 'all';
  search = '';
  shown: BrandVendorRow[] = [];

  vendorOptions: VendorOption[] = [];
  private vendorNames = new Map<number, string>();

  moving: BrandVendorRow | null = null;
  moveVendorId: number | null = null;
  moveReason = '';
  moveSaving = false;
  moveError = '';

  historyFor: BrandVendorRow | null = null;
  history: BrandVendorHistoryRow[] = [];

  /* adding a brand to the embedded vendor */
  addBrandId: number | null = null;
  allBrands: BrandVendorRow[] = [];

  classes: ProductClassRow[] = [];
  canEditClasses = false;
  classesLoading = false;
  classesError = '';
  classDraft: ProductClassSaveRequest | null = null;
  classDraftSource: 'COMPUTYME' | 'PIV2' = 'PIV2';
  classSaving = false;
  classError = '';

  constructor(private data: DataService, private route: ActivatedRoute) { }

  ngOnInit(): void {
    const tab = this.route.snapshot?.queryParamMap?.get('tab');
    if (tab === 'classes' && !this.vendorId) this.tab = 'classes';
    const f = this.route.snapshot?.queryParamMap?.get('filter') as BrandFilter | null;
    if (f && ['all', 'novendor', 'notap', 'elsewhere', 'ok'].includes(f)) this.filter = f;
    this.loadBrands();
    this.data.getVendors().subscribe({
      next: list => {
        this.vendorOptions = (list || [])
          .map(v => ({ id: +v.id, label: `${v.id} · ${v.name}` }))
          .sort((a, b) => a.label.localeCompare(b.label));
        (list || []).forEach(v => this.vendorNames.set(+v.id, v.name));
      }
    });
    if (!this.vendorId) this.loadClasses();
  }

  /* ------------------------------------------------------------ brands */

  loadBrands(): void {
    this.brandsLoading = true;
    this.brandsError = '';
    this.data.brandVendors(this.vendorId).subscribe({
      next: r => {
        this.brands = r.brands || [];
        this.canEditBrands = r.canEdit;
        this.brandsLoading = false;
        this.applyFilter();
      },
      error: e => { this.brandsLoading = false; this.brandsError = e?.error?.message || 'Couldn\'t load the brands.'; }
    });
    if (this.vendorId) {
      this.data.brandVendors(null).subscribe({ next: r => this.allBrands = (r.brands || []).filter(b => b.vendorId !== this.vendorId) });
    }
  }

  count(f: BrandFilter): number { return this.brands.filter(b => this.matches(b, f)).length; }

  private matches(b: BrandVendorRow, f: BrandFilter): boolean {
    switch (f) {
      case 'novendor': return b.linkStatus === 'NO_VENDOR';
      case 'notap': return b.linkStatus === 'NOT_AP_VENDOR' || b.linkStatus === 'UNKNOWN_VENDOR';
      case 'elsewhere': return b.boughtElsewhere > 0;
      case 'ok': return b.linkStatus === 'OK' && b.boughtElsewhere === 0;
      default: return true;
    }
  }

  setFilter(f: BrandFilter): void { this.filter = f; this.applyFilter(); }

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();
    this.shown = this.brands.filter(b => this.matches(b, this.filter) &&
      (!q || b.brandName.toLowerCase().includes(q) || (b.vendorName || '').toLowerCase().includes(q) ||
        String(b.vendorId ?? '').includes(q) || (b.actualVendors || '').toLowerCase().includes(q)));
  }

  statusText(b: BrandVendorRow): string {
    switch (b.linkStatus) {
      case 'NO_VENDOR': return 'No vendor';
      case 'UNKNOWN_VENDOR': return 'Vendor not in the vendor list';
      case 'NOT_AP_VENDOR': return 'Not a payable vendor';
      default: return 'Linked';
    }
  }

  /** the vendor most of the brand's products are bought from, if it isn't the brand's vendor */
  suggestedVendor(b: BrandVendorRow): number | null {
    const first = (b.actualVendors || '').split(',')[0]?.trim();
    const id = first ? parseInt(first, 10) : NaN;
    return Number.isFinite(id) && id !== b.vendorId ? id : null;
  }

  vendorLabel(id: number | null | undefined): string {
    if (id == null) return '—';
    const n = this.vendorNames.get(id);
    return n ? `${id} · ${n}` : String(id);
  }

  startMove(b: BrandVendorRow, toVendor?: number | null): void {
    this.moving = b;
    this.moveVendorId = toVendor ?? this.suggestedVendor(b) ?? b.vendorId ?? null;
    this.moveReason = '';
    this.moveError = '';
  }

  saveMove(): void {
    if (!this.moving) return;
    if (!this.moveReason.trim()) { this.moveError = 'Say why. It goes in the brand\'s history.'; return; }
    this.moveSaving = true;
    this.moveError = '';
    this.data.brandVendorMove(this.moving.brandId, this.moveVendorId, this.moveReason).subscribe({
      next: () => { this.moveSaving = false; this.moving = null; this.addBrandId = null; this.loadBrands(); },
      error: e => { this.moveSaving = false; this.moveError = e?.error?.message || 'Couldn\'t move the brand.'; }
    });
  }

  addBrandToVendor(): void {
    const b = this.allBrands.find(x => x.brandId === this.addBrandId);
    if (b && this.vendorId) this.startMove(b, this.vendorId);
  }

  openHistory(b: BrandVendorRow): void {
    this.historyFor = b;
    this.history = [];
    this.data.brandVendorHistory(b.brandId, null).subscribe({ next: h => this.history = h || [] });
  }

  /* ------------------------------------------------------------ classes */

  loadClasses(): void {
    this.classesLoading = true;
    this.classesError = '';
    this.data.productClasses().subscribe({
      next: r => { this.classes = r.classes || []; this.canEditClasses = r.canEdit; this.classesLoading = false; },
      error: e => { this.classesLoading = false; this.classesError = e?.error?.message || 'Couldn\'t load the product classes.'; }
    });
  }

  newClass(): void {
    this.classDraftSource = 'PIV2';
    this.classDraft = { classNo: null, name: '', isActive: true, hasDating: false, fastShipping: true };
    this.classError = '';
  }

  editClass(c: ProductClassRow): void {
    this.classDraftSource = c.source;
    this.classDraft = {
      classNo: c.classNo, name: c.name, shortCode: c.shortCode, description: c.description, termsPct: c.termsPct,
      promptPayPct: c.promptPayPct, netNetFactor: c.netNetFactor, netNet6Factor: c.netNet6Factor, ralNetFactor: c.ralNetFactor,
      hasDating: c.hasDating, fastShipping: c.fastShipping, isActive: c.isActive, ruleRefs: c.ruleRefs
    };
    this.classError = '';
  }

  saveClass(): void {
    if (!this.classDraft) return;
    if (!this.classDraft.name?.trim()) { this.classError = 'A class needs a name.'; return; }
    this.classSaving = true;
    this.classError = '';
    this.data.productClassSave(this.classDraft).subscribe({
      next: () => { this.classSaving = false; this.classDraft = null; this.loadClasses(); },
      error: e => { this.classSaving = false; this.classError = e?.error?.message || 'Couldn\'t save the class.'; }
    });
  }

  pct(v: number | null | undefined): string { return v == null ? '—' : `${+v}%`; }
  factor(v: number | null | undefined): string { return v == null ? '—' : `× ${+v}`; }
  yesNo(v: boolean | null | undefined): string { return v == null ? '—' : v ? 'Yes' : 'No'; }

  private brandRow(b: BrandVendorRow): Record<string, unknown> {
    return {
      'Brand id': b.brandId, Brand: b.brandName, 'Vendor id': b.vendorId ?? '', Vendor: b.vendorName || '',
      Check: this.statusText(b), 'Bought from another vendor': b.boughtElsewhere, 'Live products': b.liveProducts,
      Products: b.products, 'Bought from (Computyme)': b.actualVendors || '',
      'Last moved': b.lastMovedAt || '', 'Moved by': b.lastMovedBy || ''
    };
  }

  exportBrands(): void {
    const sheets = [{ name: 'Brands shown', rows: this.shown.map(b => this.brandRow(b)) }];
    if (this.shown.length !== this.brands.length) sheets.push({ name: 'All brands', rows: this.brands.map(b => this.brandRow(b)) });
    exportWorkbook(this.vendorId ? `Vendor${this.vendorId}_Brands` : 'BrandsAndVendors', sheets);
  }

  exportClasses(): void {
    exportWorkbook('ProductClasses', [{ name: 'Product classes', rows: this.classes.map(c => ({
      Class: c.classNo, Name: c.name, 'Computyme name': c.computymeName || '', Code: c.shortCode || '',
      Master: c.source === 'PIV2' ? 'PIV2 extension' : 'Computyme master', Description: c.description || '',
      'Live products': c.liveProducts, Products: c.products, Vendors: c.vendors, 'Terms %': c.termsPct ?? '',
      'Prompt pay %': c.promptPayPct ?? '', 'Net/net': c.netNetFactor ?? '', '6% net/net': c.netNet6Factor ?? '',
      'RAL net/net': c.ralNetFactor ?? '', Dating: this.yesNo(c.hasDating), 'Fast shipping': this.yesNo(c.fastShipping),
      Active: c.isActive ? 'Yes' : 'No', Rules: c.ruleRefs || '', 'Not described': c.notDescribed ? 'Yes' : ''
    })) }]);
  }

  /** "Pin to home": the brand list as filtered, or the classes tab */
  get homePin(): HomePin {
    if (this.tab === 'classes') {
      return stablePin({ id: 'brands:classes', label: 'Product classes', sub: 'Brands & vendors', icon: 'pi pi-tags', route: '/brandvendors', query: { tab: 'classes' } });
    }
    const names: Record<BrandFilter, string> = { all: 'All brands', novendor: 'Brands with no vendor', notap: 'Brands on a vendor we can\'t pay',
      elsewhere: 'Brands bought from another vendor', ok: 'Brands where all agree' };
    return stablePin({ id: `brands:${this.filter}`, label: names[this.filter], sub: 'Brands & vendors', icon: 'pi pi-tags',
      route: '/brandvendors', query: { filter: this.filter }, metric: this.filter === 'novendor' ? 'brands.novendor' : null });
  }

  trackBrand = (_: number, b: BrandVendorRow) => b.brandId;
  trackClass = (_: number, c: ProductClassRow) => c.classNo;
}
