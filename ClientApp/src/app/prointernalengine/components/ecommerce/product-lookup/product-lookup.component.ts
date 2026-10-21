import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { DataService } from 'src/app/services/data.service';
import {
  AiGate, AiStatus, CompetitorPriceResult, LookupSpec, ProductLookupResult, ResearchSnapshot
} from 'src/app/models/ai/ai.models';

/** What the product has now, so a found value can be shown beside it. */
export interface LookupCurrent {
  name: string;
  shortDescription: string;
  description: string;
  features: string[];
  specs: LookupSpec[];
  upc: string;
  ean: string;
  upcLocked: boolean;      // UPC is Computyme's until Product:SqlIsMaster
  map: number | null;
  memberPrice: number | null;
}

export type LookupField = 'name' | 'shortDescription' | 'description' | 'features' | 'specs' | 'upc' | 'ean';
export interface LookupApply { field: LookupField; value: any; }

/**
 * Product Desk · Find details and Competitor prices (Perplexity), each behind its own permission.
 * Nothing is written to the product here: "Use" copies a found value into the page, and the normal Save keeps it.
 * Every run is saved to the product (model, cost, who, when) and can be reopened.
 */
@Component({
  selector: 'app-product-lookup',
  templateUrl: './product-lookup.component.html',
  styleUrls: ['./product-lookup.component.scss']
})
export class ProductLookupComponent implements OnChanges {
  @Input() productId: number | string = 0;
  @Input() current: LookupCurrent | null = null;
  @Output() apply = new EventEmitter<LookupApply>();

  status: AiStatus | null = null;

  lookup: ProductLookupResult | null = null;
  lookupList: ResearchSnapshot[] = [];
  lookupBusy = false;
  lookupError: string | null = null;
  used = new Set<LookupField>();

  prices: CompetitorPriceResult | null = null;
  pricesList: ResearchSnapshot[] = [];
  pricesBusy = false;
  pricesError: string | null = null;

  constructor(private data: DataService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId']) { this.load(); }
  }

  get lookupGate(): AiGate | undefined { return this.status?.features.find(f => f.feature === 'PRODUCT_LOOKUP'); }
  get pricesGate(): AiGate | undefined { return this.status?.features.find(f => f.feature === 'COMPETITOR_PRICING'); }
  private canSee(g: AiGate | undefined): boolean {
    return !!g && (g.allowed || !!this.status?.canSeeUsage || /budget|limit/i.test(g.reason ?? ''));
  }

  load(): void {
    const id = Number(this.productId);
    this.lookup = null; this.prices = null; this.used.clear();
    this.lookupList = []; this.pricesList = [];
    this.lookupError = null; this.pricesError = null;
    this.data.aiStatus().subscribe({
      next: s => {
        this.status = s;
        if (!id) { return; }
        if (this.canSee(this.lookupGate)) {
          this.data.aiLookupList(id).subscribe({ next: l => { this.lookupList = l; if (l.length) { this.openLookup(l[0]); } }, error: () => {} });
        }
        if (this.canSee(this.pricesGate)) {
          this.data.aiPricesList(id).subscribe({ next: l => { this.pricesList = l; if (l.length) { this.openPrices(l[0]); } }, error: () => {} });
        }
      },
      error: () => { this.lookupError = 'Couldn\'t check AI access.'; }
    });
  }

  // ------------------------------------------------------------ find details

  runLookup(): void {
    const id = Number(this.productId);
    if (!id || this.lookupBusy) { return; }
    this.lookupBusy = true;
    this.lookupError = null;
    this.data.aiLookup(id).subscribe({
      next: r => { this.lookupBusy = false; this.lookup = r; this.used.clear(); this.refreshLists(); },
      error: (e: HttpErrorResponse) => { this.lookupBusy = false; this.lookupError = e?.error?.message || 'Find details didn\'t answer. Try again in a moment.'; this.refreshStatus(); }
    });
  }

  openLookup(s: ResearchSnapshot): void {
    if (!s.fileId) { return; }
    this.data.aiLookupGet(Number(this.productId), s.fileId).subscribe({
      next: r => { this.lookup = { ...r, usageId: s.usageId }; this.used.clear(); },
      error: () => this.lookupError = 'Couldn\'t open that saved lookup.'
    });
  }

  use(field: LookupField, value: any): void {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) { return; }
    this.apply.emit({ field, value: Array.isArray(value) ? value.map(v => (typeof v === 'object' ? { ...v } : v)) : value });
    this.used.add(field);
  }

  same(a: any, b: any): boolean {
    return JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
  }

  source(n: number | null): string | null {
    if (n === null || n === undefined) { return null; }
    return this.lookup?.sources.find(s => s.number === n)?.url ?? null;
  }

  copy(text: string): void {
    try { navigator.clipboard?.writeText(text); } catch { /* clipboard not available */ }
  }

  // ------------------------------------------------------------ competitor prices

  runPrices(): void {
    const id = Number(this.productId);
    if (!id || this.pricesBusy) { return; }
    this.pricesBusy = true;
    this.pricesError = null;
    this.data.aiPrices(id).subscribe({
      next: r => { this.pricesBusy = false; this.prices = r; this.refreshLists(); },
      error: (e: HttpErrorResponse) => { this.pricesBusy = false; this.pricesError = e?.error?.message || 'Competitor prices didn\'t answer. Try again in a moment.'; this.refreshStatus(); }
    });
  }

  openPrices(s: ResearchSnapshot): void {
    if (!s.fileId) { return; }
    this.data.aiPricesGet(Number(this.productId), s.fileId).subscribe({
      next: r => this.prices = { ...r, usageId: s.usageId },
      error: () => this.pricesError = 'Couldn\'t open those saved prices.'
    });
  }

  /** How a retailer's price compares with our MAP: below MAP is worth a look. */
  vsMap(price: number | null): number | null {
    const map = this.current?.map;
    if (!price || !map) { return null; }
    return Math.round((price - map) / map * 1000) / 10;
  }

  exportPrices(): void {
    const p = this.prices;
    if (!p) { return; }
    const ws = XLSX.utils.json_to_sheet(p.prices.map(x => ({
      Retailer: x.retailer, Price: x.price, Currency: x.currency, 'Vs our MAP %': this.vsMap(x.price) ?? '',
      'In stock': x.inStock === null ? '' : x.inStock ? 'Yes' : 'No', Seen: x.seenOn ?? '', Link: x.url ?? ''
    })));
    const about = XLSX.utils.json_to_sheet([
      { Field: 'Run', Value: this.when(p.calledAt) }, { Field: 'By', Value: p.userName }, { Field: 'Model', Value: p.model },
      { Field: 'Lowest', Value: p.lowest ?? '' }, { Field: 'Typical', Value: p.typical ?? '' }, { Field: 'Our MAP', Value: this.current?.map ?? '' },
      { Field: 'Summary', Value: p.summary ?? '' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Competitor prices');
    XLSX.utils.book_append_sheet(wb, about, 'About');
    XLSX.writeFile(wb, `CompetitorPrices_${this.productId}.xlsx`);
  }

  // ------------------------------------------------------------ shared

  private refreshLists(): void {
    const id = Number(this.productId);
    this.refreshStatus();
    if (this.canSee(this.lookupGate)) { this.data.aiLookupList(id).subscribe({ next: l => this.lookupList = l, error: () => {} }); }
    if (this.canSee(this.pricesGate)) { this.data.aiPricesList(id).subscribe({ next: l => this.pricesList = l, error: () => {} }); }
  }

  private refreshStatus(): void {
    this.data.aiStatus().subscribe({ next: s => this.status = s, error: () => {} });
  }

  when(iso: string): string {
    return new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).toLocaleString();
  }
}
