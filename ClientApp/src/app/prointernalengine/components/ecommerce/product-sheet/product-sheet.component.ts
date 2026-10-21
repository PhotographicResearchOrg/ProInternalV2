import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of, throwError } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { DataService } from 'src/app/services/data.service';
import { ProductContractService, ProductSearchRow } from 'src/app/services/product-contract.service';
import {
  ProductSheetField, ProductSheetLayout, ProductSheetView, ProductTechSpecRow, SheetLock
} from 'src/app/models/Product/product-assets.models';

/** One row of the sheet: a field of the product contract (bound to the page's form) or a ProductData column. */
interface SheetRow {
  key: string;                 // unique: 'c:<path>' for contract fields, 'd:<column>' for ProductData, 'x:<column>' for Computyme
  label: string;
  group: string;
  kind: 'text' | 'textarea' | 'number' | 'bool' | 'date' | 'select' | 'replacement' | 'readonly';
  options?: { value: any; label: string }[];
  lock: SheetLock;
  note?: string | null;
  get: () => any;
  set?: (v: any) => void;      // contract fields write straight into the page's form
  column?: string;             // ProductData column, saved through the sheet
}

interface SheetGroup { name: string; rows: SheetRow[]; }

const LAYOUT_KEY = 'piv2.productSheet.layout';

/** Groups in their default order; anything else follows alphabetically. */
const GROUP_ORDER = [
  'Status', 'Identity', 'Codes', 'Prices', 'Market prices', 'Stock & shipping', 'Supply', 'Size & customs',
  'Reorder & returns', 'B2B product page', 'Content (default language)', 'Tech specs', 'Category', 'Assets',
  'Other fields', 'Computyme', 'System'
];

const LOCK_TEXT: Record<string, string> = {
  COMPUTYME: 'Set in Computyme until product data moves to SQL',
  CATEGORY: 'Change it with the Categories section or the Category Desk',
  SHOPIFY: 'Set by the Shopify sync',
  SYSTEM: 'Kept by the system',
  CONTRACT: 'Edited in the product fields'
};

/**
 * Product Desk · All fields: every attribute of the product on one page.
 * The product contract's fields are bound to the page's form (saved by the page's Save, as before);
 * every other ProductData column comes from piv2.ProductSheet_Get and is saved through piv2.ProductSheet_Save.
 * Computyme's fields show read only until Product:SqlIsMaster. Each person chooses which groups and fields show.
 */
@Component({
  selector: 'app-product-sheet',
  templateUrl: './product-sheet.component.html',
  styleUrls: ['./product-sheet.component.scss']
})
export class ProductSheetComponent implements OnInit, OnChanges {
  @Input() productId: number | string = 0;
  /** The page's product and content forms (edited in place; the page's Save keeps them). */
  @Input() product: any = null;
  @Input() content: any = null;
  @Input() locked = true;
  @Input() brandOptions: { brandId: any; name?: string; vendorName?: string | null }[] = [];
  @Input() statuses: { value: string; label: string }[] = [];
  @Input() dispositions: { value: string; label: string }[] = [];
  /** A contract field changed: the page marks itself unsaved. */
  @Output() touched = new EventEmitter<void>();
  /** How many ProductData columns are changed and not saved yet. */
  @Output() pendingChange = new EventEmitter<number>();
  @Output() openSection = new EventEmitter<string>();
  @Output() openProduct = new EventEmitter<number>();

  view: ProductSheetView | null = null;
  loading = false;
  error: string | null = null;
  saveError: string | null = null;

  /** ProductData edits not saved yet: column -> new value (text, or null). */
  pending = new Map<string, string | null>();

  search = '';
  showLayout = false;
  showHistory = false;
  layout: ProductSheetLayout = { hiddenGroups: [], hiddenFields: [], groupOrder: [], onlyFilled: false };

  // replacement search
  private repl$ = new Subject<string>();
  replTerm = '';
  replResults: ProductSearchRow[] = [];
  replName: string | null = null;

  constructor(private data: DataService, private products: ProductContractService) {}

  ngOnInit(): void {
    try {
      const saved = localStorage.getItem(LAYOUT_KEY);
      if (saved) { this.layout = { ...this.layout, ...JSON.parse(saved) }; }
    } catch { /* storage not available */ }
    this.data.productSheetLayout().subscribe({
      next: l => { if (l?.viewJson) { try { this.layout = { ...this.layout, ...JSON.parse(l.viewJson) }; } catch { } } },
      error: () => {}
    });
    this.repl$.pipe(
      map(t => t.trim()), debounceTime(200), distinctUntilChanged(),
      switchMap(t => t.length < 2 ? of(null) : this.products.searchProducts({ term: t, pageSize: 8 }).pipe(catchError(() => of(null))))
    ).subscribe(p => this.replResults = (p?.rows ?? []).filter(r => String(r.productId) !== String(this.productId)));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId']) { this.load(); }
    if (changes['product']) { this.lookupReplacementName(); }
  }

  load(): void {
    const id = Number(this.productId);
    this.view = null;
    this.error = null;
    this.saveError = null;
    this.pending.clear();
    this.pendingChange.emit(0);
    if (!id) { return; }
    this.loading = true;
    this.data.productSheet(id).subscribe({
      next: v => { this.view = v; this.loading = false; },
      error: (e: HttpErrorResponse) => { this.loading = false; this.error = e?.error?.message || 'Couldn\'t load the product\'s fields.'; }
    });
  }

  get canEdit(): boolean { return this.view?.canEdit !== false; }

  // ================================================================ the rows

  private money(group: string, label: string, obj: () => any, prop: string, lock: SheetLock = null): SheetRow {
    return {
      key: `c:${group}.${prop}`, label, group, kind: 'number', lock,
      get: () => { const m = obj()?.[prop]; return m?.amount ?? ''; },
      set: v => { const o = obj(); if (o?.[prop]) { o[prop].amount = v === null || v === undefined ? '' : String(v); } }
    };
  }

  private field(key: string, label: string, group: string, kind: SheetRow['kind'], get: () => any, set?: (v: any) => void,
                lock: SheetLock = null, options?: { value: any; label: string }[]): SheetRow {
    return { key: `c:${key}`, label, group, kind, get, set, lock, options };
  }

  /** The product contract's fields, bound to the page's form. */
  private contractRows(): SheetRow[] {
    const p = this.product;
    if (!p) { return []; }
    const L: SheetLock = this.locked ? 'COMPUTYME' : null;
    const c = this.content;
    const loc = () => c?.locales?.find((l: any) => l.locale === c.defaultLocale) ?? c?.locales?.[0];
    const rows: SheetRow[] = [
      this.field('forSale', 'For sale', 'Status', 'bool', () => p.product.forSale, v => p.product.forSale = v),
      this.field('published', 'Shown on web', 'Status', 'bool', () => c?.published, v => { if (c) { c.published = v; } }),
      this.field('status', 'Status (active / discontinued)', 'Status', 'select', () => p.product.status, v => p.product.status = v, L,
        this.statuses.map(s => ({ value: s.value, label: s.label }))),
      this.field('replacement', 'Replaced by', 'Status', 'replacement', () => p.product.replacementSku, v => p.product.replacementSku = v),
      this.field('notes', 'Notes', 'Status', 'textarea', () => p.product.notes, v => p.product.notes = v),

      this.field('sku', 'Product code', 'Identity', 'readonly', () => p.product.sku, undefined, 'SYSTEM'),
      this.field('name', 'Name', 'Identity', 'text', () => p.product.name, v => p.product.name = v),
      this.field('brand', 'Brand', 'Identity', 'select', () => p.brandId, v => p.brandId = v, null,
        [{ value: null, label: 'No brand' }, ...this.brandOptions.map(b => ({ value: b.brandId, label: (b.name ?? String(b.brandId)) + (b.vendorName ? ' · ' + b.vendorName : '') }))]),

      this.field('upc', 'UPC', 'Codes', 'text', () => p.identifiers.upc, v => p.identifiers.upc = v, L),
      this.field('ean', 'EAN', 'Codes', 'text', () => p.identifiers.ean, v => p.identifiers.ean = v),
      this.field('caseGtin', 'Case GTIN', 'Codes', 'text', () => p.identifiers.caseGtin, v => p.identifiers.caseGtin = v),
      this.field('vendorCat', 'Vendor catalog number', 'Codes', 'text', () => p.identifiers.vendorCatalogNumber, v => p.identifiers.vendorCatalogNumber = v, L),

      this.money('Prices', 'Member price', () => p.pricing, 'memberPrice', L),
      this.money('Prices', 'Carton price', () => p.pricing, 'cartonPrice', L),
      this.field('cartonQty', 'Carton quantity', 'Prices', 'number', () => p.pricing.cartonQuantity, v => p.pricing.cartonQuantity = this.num(v), L),
      this.money('Prices', 'Authorized dealer price', () => p.pricing, 'authorizedDealerPrice', L),
      this.money('Prices', 'MAP', () => p.pricing, 'map', L),
      this.money('Prices', 'Consumer retail', () => p.pricing, 'consumerRetail', L),
      this.money('Prices', 'Drop-ship charge', () => p.pricing, 'dropShipCharge', L),
      this.money('Prices', 'Distributor cost', () => p.pricing, 'distributorCost'),
      this.money('Prices', 'Landed cost', () => p.pricing, 'landedCost', L),
      this.money('Prices', 'Shipping surcharge', () => p.pricing, 'shippingSurcharge'),

      this.field('directMode', 'Ships from', 'Supply', 'select', () => p.supply.directMode, v => p.supply.directMode = v, null, [
        { value: 'MARKER', label: 'As the inventory marker says' }, { value: 'WAREHOUSE', label: 'Our warehouse' }, { value: 'DIRECT', label: 'Direct from the vendor' }]),
      this.field('vendorId', 'Supplying vendor id', 'Supply', 'text', () => p.supply.vendorId, v => p.supply.vendorId = v),
      this.field('dropShip', 'Drop-ship eligible', 'Supply', 'bool', () => p.supply.dropShipEligible, v => p.supply.dropShipEligible = v),
      this.field('specialOrder', 'Special order', 'Supply', 'bool', () => p.supply.specialOrder, v => p.supply.specialOrder = v, L),
      this.field('orderMultiple', 'Order multiple', 'Supply', 'number', () => p.supply.orderMultiple, v => p.supply.orderMultiple = this.num(v), L),
      this.field('unitsPerCase', 'Units per case', 'Supply', 'number', () => p.supply.unitsPerCase, v => p.supply.unitsPerCase = this.num(v), L),

      this.field('weight', 'Weight', 'Size & customs', 'number', () => p.logistics.weight.value, v => p.logistics.weight.value = this.num(v)),
      this.field('weightUnit', 'Weight unit', 'Size & customs', 'select', () => p.logistics.weight.unit, v => p.logistics.weight.unit = v, null,
        [{ value: 'LB', label: 'lb' }, { value: 'KG', label: 'kg' }]),
      this.field('length', 'Length', 'Size & customs', 'number', () => p.logistics.dimensions.length, v => p.logistics.dimensions.length = this.num(v)),
      this.field('width', 'Width', 'Size & customs', 'number', () => p.logistics.dimensions.width, v => p.logistics.dimensions.width = this.num(v)),
      this.field('height', 'Height', 'Size & customs', 'number', () => p.logistics.dimensions.height, v => p.logistics.dimensions.height = this.num(v)),
      this.field('dimUnit', 'Size unit', 'Size & customs', 'select', () => p.logistics.dimensions.unit, v => p.logistics.dimensions.unit = v, null,
        [{ value: 'IN', label: 'in' }, { value: 'CM', label: 'cm' }]),
      this.field('origin', 'Country of origin', 'Size & customs', 'text', () => p.logistics.countryOfOrigin, v => p.logistics.countryOfOrigin = (v ?? '').toUpperCase()),
      this.field('hs', 'HS codes', 'Size & customs', 'readonly',
        () => (p.logistics.hsCodes ?? []).map((h: any) => `${h.country} ${h.code}`).join(' · ') || '—', undefined, 'CONTRACT'),
      this.field('lithium', 'Contains a lithium battery', 'Size & customs', 'bool', () => !!p.logistics.containsLithiumBattery, v => p.logistics.containsLithiumBattery = v),
      this.field('prop65', 'Prop 65 warning', 'Size & customs', 'bool', () => !!p.logistics.prop65Warning, v => p.logistics.prop65Warning = v),

      this.field('minStock', 'Minimum stock', 'Reorder & returns', 'number', () => p.replenishment.minimumStock, v => p.replenishment.minimumStock = this.num(v)),
      this.field('monthsSupply', 'Months of supply', 'Reorder & returns', 'number', () => p.replenishment.monthsSupply, v => p.replenishment.monthsSupply = this.num(v)),
      this.field('disposition', 'Defective returns', 'Reorder & returns', 'select', () => p.returns.defectiveDisposition, v => p.returns.defectiveDisposition = v, null,
        this.dispositions.map(d => ({ value: d.value, label: d.label })))
    ];

    if (loc()) {
      const g = `Content (default language)`;
      rows.push(
        this.field('cName', 'Name shown to buyers', g, 'text', () => loc().name, v => loc().name = v),
        this.field('cShort', 'Short description', g, 'textarea', () => loc().shortDescription, v => loc().shortDescription = v),
        this.field('cDesc', 'Description', g, 'textarea', () => loc().description, v => loc().description = v),
        this.field('cFeatures', 'Features (one per line)', g, 'textarea', () => (loc().features ?? []).join('\n'),
          v => loc().features = String(v ?? '').split('\n').map((x: string) => x.trim()).filter((x: string) => !!x)),
        this.field('cSpecs', 'Specs (Label: value, one per line)', g, 'textarea',
          () => (loc().specs ?? []).map((s: any) => `${s.label}: ${s.value}`).join('\n'),
          v => loc().specs = String(v ?? '').split('\n').map((x: string) => x.trim()).filter((x: string) => x.includes(':'))
            .map((x: string) => ({ label: x.slice(0, x.indexOf(':')).trim(), value: x.slice(x.indexOf(':') + 1).trim() }))),
        this.field('cOos', 'Out-of-stock message', g, 'text', () => loc().outOfStockMessage, v => loc().outOfStockMessage = v)
      );
    }

    (p.marketPricing ?? []).forEach((m: any) => {
      const g = 'Market prices';
      rows.push(
        this.money(g, `${m.country} · member price`, () => m, 'memberPrice'),
        this.money(g, `${m.country} · MAP`, () => m, 'map'),
        this.money(g, `${m.country} · consumer retail`, () => m, 'consumerRetail')
      );
    });
    return rows;
  }

  /** Every ProductData column the contract doesn't cover, and Computyme's columns, from the server. */
  private columnRows(): SheetRow[] {
    return (this.view?.fields ?? [])
      .filter(f => f.lock !== 'CONTRACT')
      .map(f => {
        const key = (f.source === 'Computyme' ? 'x:' : 'd:') + f.columnName;
        const editable = f.source === 'ProductData' && !f.lock;
        return {
          key, label: f.label, group: f.groupName, lock: f.lock, note: f.note, column: f.columnName,
          kind: editable ? this.kindOf(f) : 'readonly',
          get: () => this.pending.has(f.columnName) ? this.pending.get(f.columnName) : this.display(f)
        } as SheetRow;
      });
  }

  private kindOf(f: ProductSheetField): SheetRow['kind'] {
    const t = f.dataType.toLowerCase();
    if (t === 'bit') { return 'bool'; }
    if (['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'money', 'smallmoney', 'float', 'real'].includes(t)) { return 'number'; }
    if (['date', 'datetime', 'datetime2', 'smalldatetime'].includes(t)) { return 'date'; }
    if (['text', 'ntext'].includes(t) || f.maxLength === -1 || f.maxLength > 400) { return 'textarea'; }
    return 'text';
  }

  /** A server value as the input shows it: trims float zeros, dates as yyyy-mm-dd, bits as booleans. */
  private display(f: ProductSheetField): any {
    const v = f.value;
    if (v === null || v === undefined) { return f.dataType === 'bit' ? false : ''; }
    const t = f.dataType.toLowerCase();
    if (t === 'bit') { return v === '1' || v.toLowerCase() === 'true'; }
    if (['float', 'real', 'decimal', 'numeric', 'money', 'smallmoney'].includes(t) && v.includes('.')) { return v.replace(/\.?0+$/, ''); }
    if (['date', 'datetime', 'datetime2', 'smalldatetime'].includes(t)) { return v.slice(0, 10); }
    return v;
  }

  private techRows(): SheetRow[] {
    return (this.view?.techSpecs ?? [])
      .slice()
      .sort((a, b) => a.sectionDisplayOrder - b.sectionDisplayOrder || a.attributeDisplayOrder - b.attributeDisplayOrder)
      .map((t: ProductTechSpecRow) => ({
        key: `t:${t.sectionId}.${t.attributeId}`, label: (t.sectionName ? t.sectionName + ' · ' : '') + t.attributeName,
        group: 'Tech specs', kind: 'readonly', lock: null, get: () => t.value ?? '—'
      } as SheetRow));
  }

  get allRows(): SheetRow[] {
    return [...this.contractRows(), ...this.columnRows(), ...this.techRows()];
  }

  /** Groups in the person's order, filtered by search, hidden fields and only-filled. */
  get groups(): SheetGroup[] {
    const term = this.search.trim().toLowerCase();
    const byGroup = new Map<string, SheetRow[]>();
    for (const r of this.allRows) {
      if (this.layout.hiddenFields.includes(r.key) && !term) { continue; }
      if (term && !r.label.toLowerCase().includes(term) && !r.group.toLowerCase().includes(term)
          && !String(r.get() ?? '').toLowerCase().includes(term)) { continue; }
      if (this.layout.onlyFilled && !term && this.isEmpty(r.get()) && r.kind !== 'bool') { continue; }
      if (!byGroup.has(r.group)) { byGroup.set(r.group, []); }
      byGroup.get(r.group)!.push(r);
    }
    return this.orderedGroupNames([...byGroup.keys(), 'Assets'])
      .filter(g => term || !this.layout.hiddenGroups.includes(g))
      .filter(g => g === 'Assets' ? !term : byGroup.has(g))
      .map(g => ({ name: g, rows: byGroup.get(g) ?? [] }));
  }

  /** Every group name, in the person's order (for the layout panel). */
  get allGroupNames(): string[] {
    return this.orderedGroupNames([...new Set([...this.allRows.map(r => r.group), 'Assets'])]);
  }

  private orderedGroupNames(names: string[]): string[] {
    const uniq = [...new Set(names)];
    const custom = this.layout.groupOrder;
    const rank = (g: string) => {
      const c = custom.indexOf(g);
      if (c >= 0) { return c; }
      const d = GROUP_ORDER.indexOf(g);
      return 1000 + (d >= 0 ? d : 500);
    };
    return uniq.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }

  rowsOf(group: string): SheetRow[] { return this.allRows.filter(r => r.group === group); }

  isEmpty(v: any): boolean { return v === null || v === undefined || String(v).trim() === '' || v === '—'; }

  lockText(r: SheetRow): string { return r.note || (r.lock ? LOCK_TEXT[r.lock] ?? '' : ''); }

  isReadonly(r: SheetRow): boolean {
    return r.kind === 'readonly' || !!r.lock || !this.canEdit || (!r.set && !r.column);
  }

  isChanged(r: SheetRow): boolean { return !!r.column && this.pending.has(r.column); }

  // ================================================================ editing

  change(r: SheetRow, value: any): void {
    if (this.isReadonly(r)) { return; }
    if (r.set) {                        // contract field: into the page's form
      r.set(value);
      this.touched.emit();
      return;
    }
    if (!r.column) { return; }
    const f = this.view?.fields.find(x => x.columnName === r.column);
    if (!f) { return; }
    const original = this.display(f);
    const same = (r.kind === 'bool' ? !!value === !!original : String(value ?? '') === String(original ?? ''));
    if (same) { this.pending.delete(r.column); }
    else {
      const text = r.kind === 'bool' ? (value ? '1' : '0') : (value === '' || value === null || value === undefined ? (f.isNullable ? null : '') : String(value));
      this.pending.set(r.column, text);
    }
    this.pendingChange.emit(this.pending.size);
  }

  /** Called by the page's Save. Saves the changed ProductData columns; nothing when there are none. */
  save(): Observable<number> {
    const id = Number(this.productId);
    if (!id || this.pending.size === 0) { return of(0); }
    this.saveError = null;
    const changes = [...this.pending.entries()].map(([column, value]) => ({ column, value }));
    return this.data.productSheetSave(id, changes).pipe(
      map(r => r.saved),
      tap(() => { this.pending.clear(); this.pendingChange.emit(0); this.load(); }),
      catchError((e: HttpErrorResponse) => {
        this.saveError = e?.error?.message || 'The product fields weren\'t saved.';
        return throwError(() => new Error(this.saveError!));
      })
    );
  }

  discard(): void {
    this.pending.clear();
    this.pendingChange.emit(0);
  }

  // ================================================================ replacement

  searchReplacement(t: string): void { this.replTerm = t; this.repl$.next(t); }

  pickReplacement(r: SheetRow, p: ProductSearchRow): void {
    this.change(r, p.productCode);
    this.replName = p.name;
    this.replTerm = '';
    this.replResults = [];
  }

  private lookupReplacementName(): void {
    const code = String(this.product?.product?.replacementSku ?? '').trim();
    this.replName = null;
    if (!code) { return; }
    this.products.searchProducts({ term: code, pageSize: 10 }).pipe(catchError(() => of(null))).subscribe(p => {
      const hit = (p?.rows ?? []).find(x => String(x.productCode).trim().toUpperCase() === code.toUpperCase());
      this.replName = hit?.name ?? null;
      this.replId = hit?.productId ?? null;
    });
  }
  replId: number | null = null;

  get isDiscontinued(): boolean { return this.product?.product?.status === 'DISCONTINUED'; }

  // ================================================================ layout

  toggleGroup(g: string): void {
    const h = this.layout.hiddenGroups;
    this.layout.hiddenGroups = h.includes(g) ? h.filter(x => x !== g) : [...h, g];
    this.saveLayout();
  }

  toggleField(key: string): void {
    const h = this.layout.hiddenFields;
    this.layout.hiddenFields = h.includes(key) ? h.filter(x => x !== key) : [...h, key];
    this.saveLayout();
  }

  moveGroup(g: string, dir: -1 | 1): void {
    const order = this.allGroupNames;
    const i = order.indexOf(g);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) { return; }
    [order[i], order[j]] = [order[j], order[i]];
    this.layout.groupOrder = order;
    this.saveLayout();
  }

  setOnlyFilled(v: boolean): void { this.layout.onlyFilled = v; this.saveLayout(); }

  resetLayout(): void {
    this.layout = { hiddenGroups: [], hiddenFields: [], groupOrder: [], onlyFilled: false };
    this.saveLayout();
  }

  private layoutTimer: any;
  private saveLayout(): void {
    const json = JSON.stringify(this.layout);
    try { localStorage.setItem(LAYOUT_KEY, json); } catch { /* storage not available */ }
    clearTimeout(this.layoutTimer);
    this.layoutTimer = setTimeout(() => this.data.productSheetLayoutSave(json).subscribe({ error: () => {} }), 600);
  }

  // ================================================================ export

  exportSheet(): void {
    const rows = this.allRows.map(r => ({
      Group: r.group, Field: r.label, Value: this.cell(r.get()), Locked: r.lock ? (LOCK_TEXT[r.lock] ?? r.lock) : '',
      Column: r.column ?? ''
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'All fields');
    if (this.view?.history?.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.view.history.map(h => ({
        When: this.when(h.changedAt), Field: h.label, From: h.oldValue ?? '', To: h.newValue ?? '', By: h.changedBy
      }))), 'Changes');
    }
    XLSX.writeFile(wb, `Product_${this.product?.product?.sku || this.productId}.xlsx`);
  }

  private cell(v: any): string {
    if (typeof v === 'boolean') { return v ? 'Yes' : 'No'; }
    return v === null || v === undefined ? '' : String(v);
  }

  when(iso: string): string { return new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).toLocaleString(); }

  private num(v: any): number | null {
    if (v === '' || v === null || v === undefined) { return null; }
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  trackRow = (_: number, r: SheetRow) => r.key;
  trackGroup = (_: number, g: SheetGroup) => g.name;
}
