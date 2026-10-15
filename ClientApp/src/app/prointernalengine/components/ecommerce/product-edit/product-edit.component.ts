// product-edit.component.ts
//
// Product configuration: one page that edits the two product contracts.
//   product  -> Schemas/products/product.schema.json          (identity, barcodes, prices, supply, logistics, reorder, returns)
//   content  -> Schemas/products/product-content.schema.json  (languages, categories, where it is shown)
//
// It loads and saves through ProductContractService. While Computyme still
// feeds a field (prices, UPC, case quantities, status), the page shows it
// locked; the server decides that with one setting, Product:SqlIsMaster.
//
// Finding a product: the page opens on the finder (filters, sortable results,
// recently opened). The quick-jump box in the header works from anywhere:
// type a code, name, UPC/EAN or scan a barcode; "/" focuses it. Routes:
// /products (finder) and /products/:id (one product). Embedded with
// [productId] it works without a router.
//
// Market prices: "Convert from USD" fills a market's prices from the US prices
// at the accepted exchange rate, plus the market's uplift and rounding. Rates
// are pulled from the ECB on demand and used only once someone accepts them;
// a rate can be typed by hand with a reason. Every market price change is
// logged (PIV2_ProductPriceLog), and overriding a converted price needs a reason.

import {
  Component, ElementRef, HostListener, Input, OnChanges, OnDestroy, OnInit, Optional, SimpleChanges, ViewChild
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import {
  ConvertPricesResult, ExchangeRate, ExchangeRateBoard, MarketOption, PriceAudit, PriceLogRow,
  ProductBrandOption, ProductContractService, ProductPageData, ProductPricingAudit, ProductSearchPage, ProductSearchQuery,
  ProductSearchRow, ProductTranslateResult
} from 'src/app/services/product-contract.service';

// ---- the form: the contract shape, with every field present so inputs can bind ----

interface Money { amount: string; currency: string; }

type ProductStatus = 'ACTIVE' | 'DISCONTINUED' | 'INACTIVE';

/* MARKER = the inventory marker decides, as today. */
type DirectMode = 'MARKER' | 'DIRECT' | 'WAREHOUSE';

interface PriceSet {
  memberPrice: Money;
  cartonPrice: Money;
  cartonQuantity: number | null;
  authorizedDealerPrice: Money;
  map: Money;
  consumerRetail: Money;
  dropShipCharge: Money;
}

/* How a market's prices were made. Null = entered by hand before conversion existed. */
interface MarketConversion {
  method: 'CONVERTED' | 'MANUAL';
  exchangeRateId: number | null;
  unitsPerUsd: number | null;
  rateDate: string | null;
  upliftPercent: number | null;
  sourceHash: string | null;
}

interface MarketPrice extends PriceSet {
  country: string;
  conversion: MarketConversion | null;
  /* The method stored in SQL when the product was loaded: overriding a CONVERTED price needs a reason. */
  savedMethod: 'CONVERTED' | 'MANUAL' | null;
}

/* NONE = typed before conversion existed; the rest describe a converted market. */
type ConversionState = 'NONE' | 'CONVERTED' | 'MANUAL' | 'SOURCE_CHANGED' | 'RATE_MOVED';

/* A converted market is flagged when today's rate is this far from the one it was converted at. */
const RATE_MOVE_FLAG = 0.03;

/* Converting on rates older than this asks first. */
const RATE_AGE_DAYS = 7;

interface ProductForm {
  productId: string;
  product: { sku: string; name: string; status: ProductStatus; forSale: boolean; replacementSku: string; notes: string; };
  brandId: string | null;
  identifiers: { upc: string; ean: string; caseGtin: string; vendorCatalogNumber: string; };
  pricing: PriceSet & { distributorCost: Money; landedCost: Money; shippingSurcharge: Money; };
  marketPricing: MarketPrice[];
  supply: {
    directMode: DirectMode;
    vendorId: string;
    dropShipEligible: boolean;
    specialOrder: boolean;
    orderMultiple: number | null;
    unitsPerCase: number | null;
  };
  logistics: {
    weight: { value: number | null; unit: 'LB' | 'KG' };
    dimensions: { length: number | null; width: number | null; height: number | null; unit: 'IN' | 'CM' };
    countryOfOrigin: string;
    hsCodes: { country: string; code: string }[];
    containsLithiumBattery: boolean | null;
    prop65Warning: boolean | null;
  };
  replenishment: { minimumStock: number | null; monthsSupply: number | null; };
  returns: { defectiveDisposition: string; };
}

/* How a language's text was made. Null = written by a person. */
interface TranslationInfo {
  method: 'AI' | 'HUMAN';
  model?: string;
  translatedAt?: string;
  sourceLocale?: string;
  sourceHash?: string;
  reviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
}

interface LocaleContent {
  locale: string;
  translation: TranslationInfo | null;
  /* Points the AI asked a person to check. Shown only, never saved. */
  notes: string[];
  name: string;
  shortDescription: string;
  description: string;
  featuresHtml: string;
  specsHtml: string;
  features: string[];
  specs: { label: string; value: string }[];
  documents: { type: string; title: string; url: string }[];
  outOfStockMessage: string;
}

interface ContentForm {
  published: boolean;
  markets: string[];
  categories: { categoryId: string; isPrimary?: boolean }[];
  defaultLocale: string;
  locales: LocaleContent[];
}

interface NavItem { id: string; label: string; icon: string; }
interface Problem { section: string; text: string; }

/* The finder's filters; kept for the session so Back returns to the same list. */
interface FinderState {
  term: string;
  brandId: string;
  status: '' | ProductStatus;
  shipsFrom: '' | 'WAREHOUSE' | 'DIRECT';
  forSale: '' | 'YES' | 'NO';
  gap: '' | 'NO_BARCODE' | 'NO_EAN' | 'NO_WEIGHT' | 'NO_CUSTOMS';
  sort: 'RELEVANCE' | 'CODE' | 'NAME' | 'BRAND' | 'PRICE' | 'AVAILABLE';
  desc: boolean;
  page: number;
  pageSize: number;
}

interface RecentProduct { id: string; code: string; name: string; }

const FINDER_KEY = 'piv2.productFinder';
const RECENT_KEY = 'piv2.productRecent';

type MoneyKey = 'memberPrice' | 'cartonPrice' | 'authorizedDealerPrice' | 'map' | 'consumerRetail' | 'dropShipCharge';

@Component({
  selector: 'app-product-edit',
  templateUrl: './product-edit.component.html',
  styleUrls: ['./product-edit.component.scss']
})
export class ProductEditComponent implements OnInit, OnChanges, OnDestroy {

  @Input() productId: number | string = 0;

  /* Where the finder lives when the page is routed. */
  @Input() routeBase = '/productedit';

  /* 'find' = the product finder; 'edit' = one product. */
  mode: 'find' | 'edit' = 'find';

  // ---- quick jump (header) ----
  @ViewChild('jumpInput') jumpInput?: ElementRef<HTMLInputElement>;
  jumpTerm = '';
  jumpResults: ProductSearchRow[] = [];
  jumpOpen = false;
  jumpIndex = -1;
  jumpLoading = false;
  private jump$ = new Subject<string>();

  // ---- finder ----
  finder: FinderState = this.emptyFinder();
  results: ProductSearchRow[] = [];
  total = 0;
  searching = false;
  searchError = '';
  searched = false;
  recent: RecentProduct[] = [];
  private find$ = new Subject<void>();

  readonly gapOptions: { value: FinderState['gap']; label: string }[] = [
    { value: 'NO_BARCODE', label: 'No barcode' },
    { value: 'NO_EAN', label: 'No EAN' },
    { value: 'NO_WEIGHT', label: 'No weight' },
    { value: 'NO_CUSTOMS', label: 'No customs data' }
  ];

  readonly pageSizes = [25, 50, 100];

  private destroy$ = new Subject<void>();
  private loadSub?: Subscription;

  // palette (exposed so the template can inline data-driven colors)
  P = {
    ink: '#1a2434', sub: '#5c6b81', faint: '#8a97ab',
    teal: '#0e7c73', tealSoft: '#dff1ef', violet: '#5b4bb5', violetSoft: '#e9e6f7',
    amber: '#a15c07', amberSoft: '#fbeecb', blue: '#1d4ed8', blueSoft: '#dce8fd',
    green: '#166534', greenSoft: '#dcfce7', red: '#b4231f', redSoft: '#fbe1de', muted: '#eef1f5'
  };

  navSections: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: 'pi pi-th-large' },
    { id: 'identity', label: 'Identity & Barcodes', icon: 'pi pi-id-card' },
    { id: 'pricing', label: 'Pricing', icon: 'pi pi-dollar' },
    { id: 'supply', label: 'Supply & Returns', icon: 'pi pi-truck' },
    { id: 'reorder', label: 'Reorder', icon: 'pi pi-refresh' },
    { id: 'logistics', label: 'Size & Customs', icon: 'pi pi-box' },
    { id: 'content', label: 'Content & Languages', icon: 'pi pi-globe' },
    { id: 'categories', label: 'Categories', icon: 'pi pi-sitemap' },
    { id: 'contract', label: 'Contract JSON', icon: 'pi pi-code' }
  ];
  activeSection = 'overview';

  readonly statuses: { value: ProductStatus; label: string }[] = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'DISCONTINUED', label: 'Discontinued' },
    { value: 'INACTIVE', label: 'Inactive' }
  ];

  readonly dispositions: { value: string; label: string }[] = [
    { value: 'DISCARD', label: 'Discard it' },
    { value: 'RETURN_TO_WAREHOUSE', label: 'Send it to the warehouse' },
    { value: 'RETURN_TO_VENDOR', label: 'Send it to the vendor' },
    { value: 'RETURN_TO_HQ', label: 'Send it to PRO headquarters' }
  ];

  /* Selling currencies first; the rest are for costs in a vendor's own currency. */
  readonly currencies = ['USD', 'GBP', 'EUR', 'CNY', 'JPY', 'TWD', 'KRW', 'CAD'];

  /*
   * Markets PRO sells in: the US home market plus EMEA. Used for prices,
   * "where it is shown" and HS codes by importing country. The currency is
   * the default for a new market's prices. Loaded from PIV2_Market (to add
   * a market, add a row there); this list is only the fallback if that fails.
   */
  countries: { code: string; name: string; currency: string; locale: string; upliftPercent?: number; roundTo?: number }[] = [
    { code: 'US', name: 'United States', currency: 'USD', locale: 'en' },
    { code: 'GB', name: 'United Kingdom', currency: 'GBP', locale: 'en-GB' },
    { code: 'DE', name: 'Germany', currency: 'EUR', locale: 'de' },
    { code: 'FR', name: 'France', currency: 'EUR', locale: 'fr' },
    { code: 'ES', name: 'Spain', currency: 'EUR', locale: 'es' },
    { code: 'IT', name: 'Italy', currency: 'EUR', locale: 'it' },
    { code: 'NL', name: 'Netherlands', currency: 'EUR', locale: 'nl' }
  ];

  /* Where products are made: country of origin only, not a market. */
  readonly originCountries: { code: string; name: string }[] = [
    { code: 'CN', name: 'China' },
    { code: 'JP', name: 'Japan' },
    { code: 'TW', name: 'Taiwan' },
    { code: 'KR', name: 'South Korea' },
    { code: 'VN', name: 'Vietnam' },
    { code: 'TH', name: 'Thailand' },
    { code: 'MY', name: 'Malaysia' },
    { code: 'PH', name: 'Philippines' },
    { code: 'ID', name: 'Indonesia' },
    { code: 'IN', name: 'India' },
    { code: 'US', name: 'United States' },
    { code: 'MX', name: 'Mexico' },
    { code: 'CA', name: 'Canada' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'ES', name: 'Spain' },
    { code: 'IT', name: 'Italy' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'PL', name: 'Poland' },
    { code: 'CZ', name: 'Czechia' },
    { code: 'HU', name: 'Hungary' }
  ];

  /* Content languages: US English plus the EMEA markets. */
  readonly localeOptions: { locale: string; label: string }[] = [
    { locale: 'en', label: 'English (US)' },
    { locale: 'en-GB', label: 'English (UK)' },
    { locale: 'de', label: 'German' },
    { locale: 'fr', label: 'French' },
    { locale: 'es', label: 'Spanish' },
    { locale: 'it', label: 'Italian' },
    { locale: 'nl', label: 'Dutch' }
  ];

  readonly documentTypes = ['INSTRUCTIONS', 'FAQ', 'SPEC_SHEET', 'WARRANTY', 'OTHER'];

  /* The home market: pricing on the product record itself. */
  homeCountry = 'US';

  // ---- exchange rates and conversion ----
  rates: ExchangeRateBoard | null = null;
  ratesBusy = false;
  ratesError = '';
  showRateHistory = false;
  overrideRate = { currency: '', unitsPerUsd: null as number | null, reason: '', expiresOn: '' };
  converting = false;

  /* Why converted prices were overridden by hand; required when any were. */
  priceReason = '';
  priceHistory: PriceLogRow[] = [];
  showPriceHistory = false;

  brandOptions: ProductBrandOption[] = [];

  product: ProductForm = this.emptyProduct();
  content: ContentForm = this.emptyContent();
  page: ProductPageData | null = null;

  /* True while Computyme still feeds prices, UPC, case quantities and status. */
  locked = true;

  loading = false;
  loadError = '';
  serverProblems: string[] = [];

  activeLocale = '';

  /* Languages being translated right now. */
  translating = new Set<string>();
  newMarketCountry = '';
  newLocale = '';
  newHsCountry = '';

  dirty = false;
  saving = false;
  toastMsg = '';
  private toastT: any;

  constructor(
    private products: ProductContractService,
    @Optional() private route: ActivatedRoute | null,
    @Optional() public router: Router | null
  ) { }

  ngOnInit(): void {
    this.products.getBrands().subscribe({
      next: brands => (this.brandOptions = brands ?? []),
      error: error => console.error('Unable to load brands.', error)
    });

    this.products.getMarkets().subscribe({
      next: markets => this.applyMarkets(markets ?? []),
      error: error => console.error('Unable to load markets; using the built-in list.', error)
    });

    this.loadRates();

    this.recent = this.readStore<RecentProduct[]>(RECENT_KEY, []);
    this.finder = { ...this.emptyFinder(), ...this.readStore<Partial<FinderState>>(FINDER_KEY, {}, true) };

    // Quick jump: debounced; a newer keystroke cancels the older request.
    this.jump$.pipe(
      map(term => term.trim()),
      debounceTime(200),
      distinctUntilChanged(),
      tap(term => { this.jumpLoading = term.length >= 2; this.jumpIndex = -1; }),
      switchMap(term => term.length < 2
        ? of(null)
        : this.products.searchProducts({ term, pageSize: 8 }).pipe(catchError(() => of(null)))),
      takeUntil(this.destroy$)
    ).subscribe(page => {
      this.jumpLoading = false;
      this.jumpResults = page?.rows ?? [];
    });

    // Finder: debounced so typing in the filter box does not fire per key.
    this.find$.pipe(
      debounceTime(250),
      tap(() => { this.searching = true; this.searchError = ''; this.saveStore(FINDER_KEY, this.finder, true); }),
      switchMap(() => this.products.searchProducts(this.finderQuery()).pipe(
        catchError(error => {
          console.error('Product search failed.', error);
          this.searchError = 'The search could not be run. Try again, or check the connection.';
          return of(null);
        }))),
      takeUntil(this.destroy$)
    ).subscribe(page => {
      this.searching = false;
      this.searched = true;
      if (!page) { return; }

      // Past the last page (the list shrank): go back to page 1.
      if (page.rows.length === 0 && page.total === 0 && this.finder.page > 1) {
        this.finder.page = 1;
        this.find$.next();
        return;
      }

      this.results = page.rows;
      this.total = page.total;
    });

    if (this.route) {
      // Use the route this page is actually mounted on ('productedit' or 'productedit/:id'),
      // so a renamed route never sends the finder to a page that does not exist.
      const configured = this.route.snapshot.routeConfig?.path;
      if (configured) {
        this.routeBase = '/' + configured.replace(/\/:id$/, '');
      }

      this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
        const id = params.get('id');
        if (id) {
          this.productId = id;
          this.load();
        } else if (!this.productId) {
          this.showFinder();
        } else {
          this.load();
        }
      });
    } else if (this.productId) {
      this.load();
    } else {
      this.showFinder();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId'] && !changes['productId'].firstChange) {
      if (this.productId) { this.load(); } else { this.showFinder(); }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.loadSub?.unsubscribe();
    clearTimeout(this.toastT);
  }

  // ---- navigation: finder <-> product ----------------------------------

  /* Leaving unsaved edits needs a yes. */
  private canLeave(): boolean {
    return !this.dirty || confirm('You have unsaved changes to this product. Leave without saving?');
  }

  /* For a CanDeactivate guard on the route: canDeactivate: [(c: ProductEditComponent) => c.canDeactivate()] */
  canDeactivate(): boolean { return this.canLeave(); }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty) { event.preventDefault(); event.returnValue = ''; }
  }

  open(id: number | string): void {
    this.closeJump();

    if (this.mode === 'edit' && String(id) === String(this.productId)) { return; }
    if (!this.canLeave()) { return; }

    this.dirty = false;

    if (this.router && this.route) {
      this.router.navigate([this.routeBase, id]);
      return;
    }

    this.productId = id;
    this.load();
  }

  backToFinder(): void {
    if (!this.canLeave()) { return; }

    this.dirty = false;

    if (this.router && this.route) {
      this.router.navigate([this.routeBase]);
      return;
    }

    this.productId = 0;
    this.showFinder();
  }

  private showFinder(): void {
    this.mode = 'find';
    this.page = null;
    this.loadError = '';
    if (!this.searched) { this.find$.next(); }
  }

  // ---- quick jump --------------------------------------------------------

  onJumpInput(): void {
    this.jumpOpen = true;
    this.jump$.next(this.jumpTerm);
  }

  onJumpKey(event: KeyboardEvent): void {
    const count = this.jumpResults.length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.jumpOpen = true;
        this.jumpIndex = count ? (this.jumpIndex + 1) % count : -1;
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.jumpIndex = count ? (this.jumpIndex - 1 + count) % count : -1;
        break;
      case 'Escape':
        this.closeJump();
        this.jumpInput?.nativeElement.blur();
        break;
      case 'Enter':
        event.preventDefault();
        this.jumpEnter();
        break;
    }
  }

  /*
   * Enter: the highlighted row; else a single or exact match opens directly
   * (a barcode scanner ends with Enter); else the full results in the finder.
   */
  private jumpEnter(): void {
    const term = this.jumpTerm.trim();
    if (!term) { return; }

    if (this.jumpIndex >= 0 && this.jumpResults[this.jumpIndex]) {
      this.open(this.jumpResults[this.jumpIndex].productId);
      return;
    }

    // A scanner types faster than the debounce: search now and decide.
    this.jumpLoading = true;
    this.products.searchProducts({ term, pageSize: 8 }).pipe(catchError(() => of(null))).subscribe(page => {
      this.jumpLoading = false;
      const rows = page?.rows ?? [];
      const exact = rows.find(r =>
        this.same(r.productCode, term) || this.same(r.upc, term) || this.same(r.ean, term));

      if (exact) { this.open(exact.productId); return; }
      if (rows.length === 1) { this.open(rows[0].productId); return; }

      this.seeAllResults();
    });
  }

  seeAllResults(): void {
    const term = this.jumpTerm.trim();
    this.closeJump();

    if (this.mode === 'edit' && !this.canLeave()) { return; }

    this.finder = { ...this.finder, term, page: 1, sort: 'RELEVANCE', desc: false };
    this.saveStore(FINDER_KEY, this.finder, true);
    this.searched = false;
    this.jumpTerm = '';
    this.dirty = false;

    if (this.mode === 'edit') {
      if (this.router && this.route) { this.router.navigate([this.routeBase]); return; }
      this.productId = 0;
    }

    this.showFinder();
  }

  closeJump(): void {
    this.jumpOpen = false;
    this.jumpIndex = -1;
  }

  onJumpBlur(): void {
    // Rows use mousedown, so a click lands before this closes the list.
    setTimeout(() => this.closeJump(), 120);
  }

  /* "/" focuses the jump box; Ctrl/Cmd+S saves; Esc closes the list. */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing = !!target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);

    if (event.key === '/' && !typing) {
      event.preventDefault();
      this.jumpInput?.nativeElement.focus();
      this.jumpInput?.nativeElement.select();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && this.mode === 'edit') {
      event.preventDefault();
      if (this.dirty && !this.saving) { this.save(); }
    }
  }

  private same(a: string | null | undefined, b: string): boolean {
    return !!a && a.trim().toUpperCase() === b.toUpperCase();
  }

  // ---- finder ------------------------------------------------------------

  search(resetPage = true): void {
    if (resetPage) { this.finder.page = 1; }
    this.find$.next();
  }

  clearFilters(): void {
    this.finder = this.emptyFinder();
    this.search();
  }

  get filtersActive(): boolean {
    const f = this.finder;
    return !!(f.term || f.brandId || f.status || f.shipsFrom || f.forSale || f.gap);
  }

  sortBy(column: FinderState['sort']): void {
    if (this.finder.sort === column) {
      this.finder.desc = !this.finder.desc;
    } else {
      this.finder.sort = column;
      this.finder.desc = column === 'PRICE' || column === 'AVAILABLE';
    }
    this.search();
  }

  sortIcon(column: FinderState['sort']): string {
    if (this.finder.sort !== column) { return 'pi pi-sort-alt'; }
    return this.finder.desc ? 'pi pi-sort-amount-down' : 'pi pi-sort-amount-up-alt';
  }

  get pageCount(): number { return Math.max(1, Math.ceil(this.total / this.finder.pageSize)); }
  get firstShown(): number { return this.total ? (this.finder.page - 1) * this.finder.pageSize + 1 : 0; }
  get lastShown(): number { return Math.min(this.total, this.finder.page * this.finder.pageSize); }

  goToPage(page: number): void {
    const next = Math.min(Math.max(1, page), this.pageCount);
    if (next === this.finder.page) { return; }
    this.finder.page = next;
    this.search(false);
  }

  /* Open in a new tab with Ctrl/Cmd or middle click, like a link. */
  openRow(row: ProductSearchRow, event?: MouseEvent): void {
    if (event && (event.ctrlKey || event.metaKey || event.button === 1) && this.router) {
      const url = this.router.serializeUrl(this.router.createUrlTree([this.routeBase, row.productId]));
      window.open(url, '_blank');
      return;
    }
    this.open(row.productId);
  }

  brandName(row: ProductSearchRow): string {
    return row.brandName || this.brandOptions.find(b => String(b.brandId) === String(row.brandId))?.name || '—';
  }

  /* The brand's vendor name, unless the product names a different vendor. */
  rowVendor(row: ProductSearchRow): string {
    const brand = this.brandOptions.find(b => String(b.brandId) === String(row.brandId));
    if (!row.vendorId) { return '—'; }
    if (brand && String(brand.vendorId) === String(row.vendorId)) { return brand.vendorName || `Vendor ${row.vendorId}`; }
    return `Vendor ${row.vendorId}`;
  }

  rowGaps(row: ProductSearchRow): string[] {
    const gaps: string[] = [];
    if (!row.hasBarcode) { gaps.push('No barcode'); }
    if (!row.hasWeight) { gaps.push('No weight'); }
    if (!row.hasCustoms) { gaps.push('No customs'); }
    return gaps;
  }

  price(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : value.toFixed(2);
  }

  trackRow(_: number, row: ProductSearchRow): number { return row.productId; }

  private finderQuery(): ProductSearchQuery {
    const f = this.finder;
    return {
      term: f.term.trim() || undefined,
      brandId: f.brandId || undefined,
      status: f.status || undefined,
      shipsFrom: f.shipsFrom || undefined,
      forSale: f.forSale === 'YES' ? true : f.forSale === 'NO' ? false : undefined,
      gap: f.gap || undefined,
      sort: f.sort,
      desc: f.desc,
      page: f.page,
      pageSize: f.pageSize
    };
  }

  private emptyFinder(): FinderState {
    return {
      term: '', brandId: '', status: '', shipsFrom: '', forSale: '', gap: '',
      sort: 'RELEVANCE', desc: false, page: 1, pageSize: 50
    };
  }

  // ---- recently opened -------------------------------------------------------

  private remember(): void {
    const entry: RecentProduct = {
      id: String(this.product.productId),
      code: this.product.product.sku,
      name: this.product.product.name
    };
    this.recent = [entry, ...this.recent.filter(r => r.id !== entry.id)].slice(0, 8);
    this.saveStore(RECENT_KEY, this.recent);
  }

  clearRecent(): void {
    this.recent = [];
    this.saveStore(RECENT_KEY, this.recent);
  }

  /* Browser storage can be missing or blocked; the page works without it. */
  private readStore<T>(key: string, fallback: T, session = false): T {
    try {
      const raw = (session ? sessionStorage : localStorage).getItem(key);
      return raw ? JSON.parse(raw) as T : fallback;
    } catch {
      return fallback;
    }
  }

  private saveStore(key: string, value: unknown, session = false): void {
    try {
      (session ? sessionStorage : localStorage).setItem(key, JSON.stringify(value));
    } catch { /* storage unavailable: nothing to do */ }
  }

  // ---- load and save --------------------------------------------------

  /* keepSection: reload the same product in place (after a save or discard). */
  load(keepSection = false): void {
    if (!this.productId) {
      this.showFinder();
      return;
    }

    this.mode = 'edit';
    this.loading = true;
    this.loadError = '';

    if (!keepSection) {
      this.activeSection = 'overview';
      this.serverProblems = [];
      this.page = null;
    }

    // A newer open replaces an older one still loading.
    this.loadSub?.unsubscribe();
    this.loadSub = this.products.getProduct(this.productId).subscribe({
      next: page => {
        this.page = page;
        this.locked = page.computymeFieldsLocked;
        this.product = this.fromProductContract(page);
        this.content = this.fromContentContract(page.content ?? {});
        this.activeLocale = this.content.defaultLocale || this.content.locales[0]?.locale || '';
        this.dirty = false;
        this.loading = false;
        this.priceReason = '';
        this.priceHistory = [];
        this.remember();
        this.loadPricingAudit();
      },

      error: error => {
        console.error('Unable to load the product.', error);
        this.loading = false;
        this.product = this.emptyProduct();
        this.content = this.emptyContent();
        this.loadError = error?.status === 404
          ? `Product ${this.productId} was not found.`
          : error?.status === 403
            ? 'You do not have permission to view products.'
            : 'The product could not be loaded.';
        if (error?.status === 404) {
          this.recent = this.recent.filter(r => r.id !== String(this.productId));
          this.saveStore(RECENT_KEY, this.recent);
        }
      }
    });
  }

  save(): void {
    if (this.problems.length > 0) {
      this.showToast(`Fix ${this.problems.length} problem(s) before saving.`);
      return;
    }

    this.saving = true;
    this.serverProblems = [];

    this.products
      .saveProduct(
        this.product.productId,
        this.productContract,
        this.contentContract,
        this.product.supply.directMode === 'MARKER',
        this.priceAudit
      )
      .subscribe({
        next: result => {
          this.saving = false;

          if (!result.success) {
            this.serverProblems = result.problems?.length ? result.problems : [result.message];
            this.activeSection = 'overview';
            return;
          }

          this.showToast(result.message || 'Product saved.');
          this.load(true);
        },

        error: error => {
          this.saving = false;
          console.error('Unable to save the product.', error);
          this.serverProblems = [
            error?.status === 403
              ? 'You do not have permission to change products.'
              : 'The server could not save the product.'
          ];
          this.activeSection = 'overview';
        }
      });
  }

  discard(): void {
    if (confirm('Discard your changes to this product?')) { this.load(true); }
  }

  // ---- header ---------------------------------------------------------

  setSection(id: string): void { this.activeSection = id; }
  touch(): void { this.dirty = true; }

  toggleForSale(): void { this.product.product.forSale = !this.product.product.forSale; this.touch(); }
  togglePublished(): void { this.content.published = !this.content.published; this.touch(); }

  get brand(): ProductBrandOption | undefined {
    return this.brandOptions.find(b => b.brandId === this.product.brandId);
  }

  get markerSaysDirect(): boolean { return this.page?.markerSaysDirect === true; }

  /* What the product itself says, before the brand is considered. */
  get productSaysDirect(): boolean {
    switch (this.product.supply.directMode) {
      case 'DIRECT': return true;
      case 'WAREHOUSE': return false;
      default: return this.markerSaysDirect;
    }
  }

  /* A line ships direct when the product says so OR its brand ships everything direct. */
  get shipsDirect(): boolean {
    return this.productSaysDirect || this.brand?.directShipAll === true;
  }

  /* The vendor an order or a PO goes to: the product's own, else the brand's. */
  get vendorLabel(): string {
    if (this.product.supply.vendorId) {
      return `Vendor ${this.product.supply.vendorId}`;
    }

    return this.brand?.vendorName || '';
  }

  get shipsFromLabel(): string {
    if (!this.shipsDirect) { return 'PRO warehouse'; }
    return this.vendorLabel ? `Direct from ${this.vendorLabel}` : 'Direct from vendor';
  }

  statusColor(status: ProductStatus): { fg: string; bg: string } {
    switch (status) {
      case 'ACTIVE': return { fg: this.P.green, bg: this.P.greenSoft };
      case 'DISCONTINUED': return { fg: this.P.amber, bg: this.P.amberSoft };
      default: return { fg: this.P.faint, bg: this.P.muted };
    }
  }

  statusLabel(status: ProductStatus): string {
    return this.statuses.find(s => s.value === status)?.label ?? status;
  }

  /* Margin on the home member price, when cost and price share a currency. */
  get margin(): string {
    const price = this.product.pricing.memberPrice;
    const cost = this.product.pricing.distributorCost;
    const p = Number(price.amount);
    const c = Number(cost.amount);

    if (!price.amount || !cost.amount || price.currency !== cost.currency || !(p > 0) || isNaN(c)) {
      return '—';
    }

    return `${(((p - c) / p) * 100).toFixed(1)}%`;
  }

  show(money: Money): string { return money.amount ? `${money.amount} ${money.currency}` : '—'; }
  countryName(code: string): string {
    return this.countries.find(c => c.code === code)?.name
      ?? this.originCountries.find(c => c.code === code)?.name
      ?? code;
  }
  localeLabel(locale: string): string { return this.localeOptions.find(l => l.locale === locale)?.label ?? locale; }

  // ---- pricing --------------------------------------------------------

  readonly priceRows: { key: MoneyKey; label: string; hint: string }[] = [
    { key: 'memberPrice', label: 'Member price', hint: 'What a dealer pays PRO for one unit' },
    { key: 'cartonPrice', label: 'Carton price', hint: 'Unit price at the carton quantity' },
    { key: 'authorizedDealerPrice', label: 'Authorized dealer price', hint: 'For the fixed set of authorized dealers' },
    { key: 'map', label: 'MAP', hint: 'Minimum advertised price' },
    { key: 'consumerRetail', label: 'Consumer retail', hint: 'Suggested retail to the consumer' },
    { key: 'dropShipCharge', label: 'Drop ship charge', hint: 'Charged to ship one unit to the dealer\'s customer' }
  ];

  get availableMarkets(): { code: string; name: string }[] {
    return this.countries.filter(c =>
      c.code !== this.homeCountry &&
      !this.product.marketPricing.some(m => m.country === c.code)
    );
  }

  addMarket(): void {
    const country = this.countries.find(c => c.code === this.newMarketCountry);

    if (!country) { return; }

    this.product.marketPricing.push({
      country: country.code, ...this.emptyPrices(country.currency), conversion: null, savedMethod: null
    });
    this.newMarketCountry = '';
    this.touch();
  }

  removeMarket(market: MarketPrice): void {
    this.product.marketPricing = this.product.marketPricing.filter(m => m !== market);
    this.touch();
  }

  // ---- markets and exchange rates ----------------------------------------

  /* Markets come from PIV2_Market: currency, language, uplift and rounding per market. */
  private applyMarkets(markets: MarketOption[]): void {
    if (!markets.length) { return; }

    this.countries = markets.map(m => ({
      code: m.country, name: m.name, currency: m.currency, locale: m.locale,
      upliftPercent: m.upliftPercent, roundTo: m.roundTo
    }));
    this.homeCountry = markets.find(m => m.isHome)?.country ?? 'US';
  }

  loadRates(): void {
    this.products.getExchangeRates().subscribe({
      next: board => { this.rates = board; this.ratesError = ''; },
      error: error => {
        console.error('Unable to load exchange rates.', error);
        this.ratesError = 'Exchange rates could not be loaded.';
      }
    });
  }

  /* Pulls the ECB file. New rates arrive PENDING: nothing is used until someone accepts them. */
  refreshRates(): void {
    this.rateCall(this.products.refreshExchangeRates(), board => {
      const date = board.feedDate ? this.shortDate(board.feedDate) : 'the latest date';
      this.showToast(board.added
        ? `Pulled the ECB rates published ${date}: ${board.added} to review.`
        : `No new rates: the ECB rates published ${date} are already here.`);
    });
  }

  acceptRates(ids: number[]): void {
    if (!ids.length) { return; }
    this.rateCall(this.products.decideExchangeRates(ids, true), () =>
      this.showToast(ids.length === 1 ? 'Rate accepted. Conversions now use it.' : `${ids.length} rates accepted. Conversions now use them.`));
  }

  acceptAllPending(): void {
    this.acceptRates((this.rates?.pending ?? []).map(r => r.exchangeRateId));
  }

  rejectRate(rate: ExchangeRate): void {
    const reason = prompt(`Why reject the ${rate.currency} rate? (optional)`, '');
    if (reason === null) { return; }
    this.rateCall(this.products.decideExchangeRates([rate.exchangeRateId], false, reason), () => this.showToast('Rate rejected.'));
  }

  get overrideCurrencies(): string[] {
    return this.currencies.filter(c => c !== 'USD');
  }

  get overrideProblem(): string {
    const o = this.overrideRate;
    if (!o.currency) { return 'Choose a currency.'; }
    if (!(Number(o.unitsPerUsd) > 0)) { return 'Enter how many units $1 buys.'; }
    if (!o.reason.trim()) { return 'A reason is required.'; }
    return '';
  }

  saveOverride(): void {
    if (this.overrideProblem) { this.showToast(this.overrideProblem); return; }

    const o = this.overrideRate;
    this.rateCall(this.products.overrideExchangeRate({
      currency: o.currency,
      unitsPerUsd: Number(o.unitsPerUsd),
      reason: o.reason.trim(),
      expiresOn: o.expiresOn || null
    }), () => {
      this.showToast(`${o.currency} set to ${o.unitsPerUsd} per $1. Conversions now use it.`);
      this.overrideRate = { currency: '', unitsPerUsd: null, reason: '', expiresOn: '' };
    });
  }

  clearOverride(rate: ExchangeRate): void {
    const reason = prompt(`Withdraw the manual ${rate.currency} rate? The last accepted ECB rate applies again.\nReason (optional):`, '');
    if (reason === null) { return; }
    this.rateCall(this.products.clearExchangeRate(rate.exchangeRateId, reason), () => this.showToast('Manual rate withdrawn.'));
  }

  private rateCall(call: Observable<ExchangeRateBoard>, done?: (board: ExchangeRateBoard) => void): void {
    if (this.ratesBusy) { return; }

    this.ratesBusy = true;
    this.ratesError = '';

    call.subscribe({
      next: board => {
        this.ratesBusy = false;
        this.rates = board;
        done?.(board);
      },
      error: error => {
        this.ratesBusy = false;
        console.error('Exchange rate action failed.', error);
        this.ratesError = typeof error?.error === 'string' && error.error.length < 300
          ? error.error
          : error?.status === 403 ? 'You do not have permission to change exchange rates.' : 'The exchange rate action failed.';
      }
    });
  }

  /* The rate in force for a currency; USD is always 1. */
  currentRate(currency: string): ExchangeRate | null {
    if (currency === 'USD') { return null; }
    return this.rates?.current.find(r => r.currency === currency) ?? null;
  }

  rateAgeDays(rate: ExchangeRate | null): number | null {
    if (!rate?.rateDate) { return null; }
    const published = new Date(rate.rateDate.substring(0, 10) + 'T00:00:00');
    return Math.floor((Date.now() - published.getTime()) / 86400000);
  }

  /* Percent change a pending rate makes against the one in force. */
  rateChange(rate: ExchangeRate): string {
    if (!rate.currentUnitsPerUsd) { return 'first rate'; }
    const pct = (rate.unitsPerUsd / rate.currentUnitsPerUsd - 1) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  }

  shortDate(value: string | null | undefined): string {
    if (!value) { return '—'; }
    const d = new Date(value.length <= 10 ? value + 'T00:00:00' : value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ---- converting market prices ---------------------------------------------

  marketCurrency(m: MarketPrice): string {
    return this.priceRows.map(row => m[row.key].currency).find(c => !!c)
      || this.countries.find(c => c.code === m.country)?.currency
      || 'USD';
  }

  /* Fingerprint of the US prices, to spot when they change after a conversion. */
  get homePriceHash(): string {
    const p = this.product.pricing;
    const norm = (v: string) => (v && !isNaN(Number(v)) ? String(Number(v)) : (v || ''));

    return this.fnv(JSON.stringify([
      ...this.priceRows.map(row => [row.key, norm(p[row.key].amount), p[row.key].currency]),
      p.cartonPrice.amount ? Number(p.cartonQuantity) || null : null
    ]));
  }

  /* Every market the product is priced in or shown in, outside the home market. */
  get convertTargets(): string[] {
    const codes = [
      ...this.product.marketPricing.map(m => m.country),
      ...this.content.markets
    ].filter(c => c !== this.homeCountry && this.countries.some(x => x.code === c));

    return [...new Set(codes)];
  }

  get hasHomePrice(): boolean {
    return this.priceRows.some(row => !!this.product.pricing[row.key].amount);
  }

  convertAll(): void { this.runConvert(this.convertTargets); }

  convertMarket(market: MarketPrice): void { this.runConvert([market.country]); }

  private runConvert(countries: string[]): void {
    if (this.converting || !countries.length) { return; }

    if (!this.hasHomePrice) {
      this.showToast('There is no US price to convert from.');
      return;
    }

    // Prices typed by hand are only replaced with a yes.
    const typed = this.product.marketPricing.filter(m =>
      countries.includes(m.country) &&
      m.conversion?.method !== 'CONVERTED' &&
      this.priceRows.some(row => !!m[row.key].amount));

    if (typed.length && !confirm(`Replace the prices typed by hand for ${typed.map(m => this.countryName(m.country)).join(', ')} with converted ones?`)) {
      return;
    }

    // Old rates are allowed, but only knowingly.
    const currencies = [...new Set(countries.map(c => this.countries.find(x => x.code === c)?.currency).filter((c): c is string => !!c && c !== 'USD'))];
    const old = currencies
      .map(c => this.currentRate(c))
      .filter((r): r is ExchangeRate => !!r && (this.rateAgeDays(r) ?? 0) > RATE_AGE_DAYS);

    if (old.length && !confirm(`Rates in use: ${old.map(r => `${r.currency} from ${this.shortDate(r.rateDate)}`).join(', ')}. Convert anyway? (Cancel, then Refresh rates, to use newer ones.)`)) {
      return;
    }

    const source: Record<string, { amount: string; currency: string }> = {};
    for (const row of this.priceRows) {
      const m = this.product.pricing[row.key];
      if (m.amount) { source[row.key] = { amount: m.amount, currency: m.currency }; }
    }

    const hash = this.homePriceHash;
    this.converting = true;

    this.products.convertPrices({ source, countries }).subscribe({
      next: result => {
        this.converting = false;
        this.applyConversions(result, hash);
      },
      error: error => {
        this.converting = false;
        console.error('Conversion failed.', error);
        this.showToast(typeof error?.error === 'string' && error.error.length < 300 ? error.error : 'Conversion failed. Try again.');
      }
    });
  }

  private applyConversions(result: ConvertPricesResult, sourceHash: string): void {
    const home = this.product.pricing;

    for (const r of result.results ?? []) {
      let market = this.product.marketPricing.find(m => m.country === r.country);

      if (!market) {
        market = { country: r.country, ...this.emptyPrices(r.currency), conversion: null, savedMethod: null };
        this.product.marketPricing.push(market);
      }

      for (const row of this.priceRows) {
        const price = r.prices?.[row.key];
        market[row.key] = price ? { amount: price.amount, currency: price.currency } : this.emptyMoney(r.currency);
      }

      market.cartonQuantity = market.cartonPrice.amount ? home.cartonQuantity : null;

      market.conversion = {
        method: r.exchangeRateId ? 'CONVERTED' : 'MANUAL',
        exchangeRateId: r.exchangeRateId,
        unitsPerUsd: r.unitsPerUsd,
        rateDate: r.rateDate,
        upliftPercent: r.upliftPercent,
        sourceHash
      };
    }

    if ((result.results ?? []).length) { this.touch(); }

    const done = (result.results ?? []).map(r => this.countryName(r.country));
    const failed = (result.failures ?? []).map(f => `${this.countryName(f.country)}: ${f.message}`);

    this.showToast([
      done.length ? `Converted: ${done.join(', ')}. Check, then save.` : '',
      failed.length ? `Not converted: ${failed.join('; ')}` : ''
    ].filter(Boolean).join(' '));
  }

  /* A typed change to a converted price makes it a manual override. */
  priceEdited(market?: MarketPrice | null): void {
    if (market?.conversion?.method === 'CONVERTED') {
      market.conversion = { ...market.conversion, method: 'MANUAL' };
    }
    this.touch();
  }

  /* Saved as converted, now changed by hand: these need a reason. */
  get overriddenMarkets(): MarketPrice[] {
    return this.product.marketPricing.filter(m => m.savedMethod === 'CONVERTED' && m.conversion?.method === 'MANUAL');
  }

  conversionState(m: MarketPrice): ConversionState {
    const c = m.conversion;

    if (!c) { return 'NONE'; }
    if (c.method === 'MANUAL') { return 'MANUAL'; }
    if (c.sourceHash && c.sourceHash !== this.homePriceHash) { return 'SOURCE_CHANGED'; }

    const now = this.currentRate(this.marketCurrency(m));
    if (now && c.unitsPerUsd && Math.abs(now.unitsPerUsd / c.unitsPerUsd - 1) > RATE_MOVE_FLAG) { return 'RATE_MOVED'; }

    return 'CONVERTED';
  }

  conversionLabel(m: MarketPrice): string {
    const c = m.conversion;

    switch (this.conversionState(m)) {
      case 'CONVERTED': return `Converted at ${c?.unitsPerUsd} · ${this.shortDate(c?.rateDate)}${c?.upliftPercent ? ` · +${c.upliftPercent}%` : ''}`;
      case 'SOURCE_CHANGED': return 'Converted · US price changed since';
      case 'RATE_MOVED': return 'Converted · rate has moved';
      case 'MANUAL': return 'Set by hand';
      default: return '';
    }
  }

  conversionColor(m: MarketPrice): { fg: string; bg: string } {
    switch (this.conversionState(m)) {
      case 'CONVERTED': return { fg: this.P.green, bg: this.P.greenSoft };
      case 'MANUAL': return { fg: this.P.violet, bg: this.P.violetSoft };
      default: return { fg: this.P.amber, bg: this.P.amberSoft };
    }
  }

  /* Sent with the save: how each market was priced, and why converted prices were overridden. */
  get priceAudit(): PriceAudit {
    return {
      reason: this.priceReason.trim() || null,
      markets: this.product.marketPricing.map(m => ({
        country: m.country,
        method: m.conversion?.method ?? 'MANUAL',
        exchangeRateId: m.conversion?.exchangeRateId ?? null,
        upliftPercent: m.conversion?.upliftPercent ?? null,
        sourceHash: m.conversion?.sourceHash ?? null
      }))
    };
  }

  private loadPricingAudit(): void {
    const id = this.product.productId;
    if (!id) { return; }

    this.products.getPricingAudit(id).subscribe({
      next: (audit: ProductPricingAudit) => {
        if (String(this.product.productId) !== String(id)) { return; }

        for (const meta of audit.markets ?? []) {
          const market = this.product.marketPricing.find(m => m.country === meta.country);
          if (!market) { continue; }

          market.savedMethod = meta.method;
          market.conversion = meta.method
            ? {
              method: meta.method,
              exchangeRateId: meta.exchangeRateId,
              unitsPerUsd: meta.unitsPerUsd,
              rateDate: meta.rateDate,
              upliftPercent: meta.upliftPercent,
              sourceHash: meta.sourceHash
            }
            : null;
        }

        this.priceHistory = audit.history ?? [];
      },
      error: error => console.error('Unable to load the price history.', error)
    });
  }

  // ---- foreign prices beside US prices (display only, never saved) -----------

  /* Currencies to show beside the US prices: those of markets it is shown or priced in, with a rate. */
  get equivalentCurrencies(): string[] {
    const codes = new Set([...this.content.markets, ...this.product.marketPricing.map(m => m.country)]);
    const list = this.countries
      .filter(c => c.code !== this.homeCountry && codes.has(c.code))
      .map(c => c.currency)
      .filter(c => c !== 'USD' && !!this.currentRate(c));

    return [...new Set(list)];
  }

  /* A US price at today's rate: straight conversion, no uplift or rounding. */
  equivalent(key: MoneyKey, currency: string): string {
    const amount = Number(this.product.pricing[key].amount);
    const rate = this.currentRate(currency);

    if (!this.product.pricing[key].amount || isNaN(amount) || !rate) { return '—'; }
    return (amount * rate.unitsPerUsd).toFixed(2);
  }

  /* A market price back in US dollars at today's rate, to compare with the US price. */
  usdEquivalent(market: MarketPrice, key: MoneyKey): string {
    const money = market[key];
    const amount = Number(money.amount);

    if (!money.amount || isNaN(amount)) { return ''; }
    if (money.currency === 'USD') { return ''; }

    const rate = this.currentRate(money.currency);
    if (!rate) { return ''; }

    return `≈ $${(amount / rate.unitsPerUsd).toFixed(2)} at today's rate`;
  }

  priceKeyLabel(key: string): string {
    if (key === 'cartonQuantity') { return 'Carton quantity'; }
    return this.priceRows.find(r => r.key === key)?.label ?? key;
  }

  logAmount(value: number | null, currency: string | null): string {
    if (value === null || value === undefined) { return '—'; }
    return currency ? `${Number(value).toFixed(2)} ${currency}` : String(Number(value));
  }

  trackRate(_: number, r: ExchangeRate): number { return r.exchangeRateId; }

  // ---- reorder ---------------------------------------------------------

  /* Stock that can still be promised, plus what is already on its way. */
  get stockPosition(): number | null {
    const live = this.page?.live;

    if (!live || live.unitsAvailable === null || live.unitsAvailable === undefined) { return null; }

    return live.unitsAvailable + (live.unitsOnOrder ?? 0);
  }

  /*
   * A plain suggestion: enough to get back to minimum stock, rounded up to
   * a full case. It is not the buyer's real rule, which is not built yet.
   */
  get suggestedOrder(): number | null {
    const minimum = this.product.replenishment.minimumStock;
    const position = this.stockPosition;

    if (minimum === null || position === null || this.shipsDirect) { return null; }

    const short = minimum - position;

    if (short <= 0) { return 0; }

    const perCase = Number(this.product.supply.unitsPerCase) || 1;

    return Math.ceil(short / perCase) * perCase;
  }

  addToPurchaseOrder(): void {
    this.showToast('Purchasing is not built yet. This will add the line to a purchase order for the vendor.');
  }

  // ---- size and customs ------------------------------------------------

  /* The other system's weight, for people who think in it. Display only: one value is stored. */
  get weightOther(): string {
    const w = this.product.logistics.weight;

    if (!w.value || w.value <= 0) { return ''; }

    return w.unit === 'LB'
      ? `${(w.value * 0.45359237).toFixed(2)} kg`
      : `${(w.value / 0.45359237).toFixed(2)} lb`;
  }

  get dimensionsOther(): string {
    const d = this.product.logistics.dimensions;

    if (!d.length || !d.width || !d.height) { return ''; }

    const factor = d.unit === 'IN' ? 2.54 : 1 / 2.54;
    const unit = d.unit === 'IN' ? 'cm' : 'in';

    return [d.length, d.width, d.height].map(v => (v * factor).toFixed(1)).join(' x ') + ' ' + unit;
  }

  get availableHsCountries(): { code: string; name: string }[] {
    return this.countries.filter(c => !this.product.logistics.hsCodes.some(h => h.country === c.code));
  }

  addHsCode(): void {
    if (!this.newHsCountry) { return; }

    this.product.logistics.hsCodes.push({ country: this.newHsCountry, code: '' });
    this.newHsCountry = '';
    this.touch();
  }

  removeHsCode(index: number): void {
    this.product.logistics.hsCodes.splice(index, 1);
    this.touch();
  }

  /* Computyme stores HS codes with dots. The contract is digits only. */
  cleanHsCode(entry: { code: string }): void {
    entry.code = (entry.code || '').replace(/[^0-9]/g, '');
    this.touch();
  }

  // ---- content and languages -------------------------------------------

  get locale(): LocaleContent | undefined {
    return this.content.locales.find(l => l.locale === this.activeLocale);
  }

  get defaultContent(): LocaleContent | undefined {
    return this.content.locales.find(l => l.locale === this.content.defaultLocale);
  }

  get availableLocales(): { locale: string; label: string }[] {
    return this.localeOptions.filter(o => !this.content.locales.some(l => l.locale === o.locale));
  }

  addLocale(): void {
    if (!this.newLocale) { return; }

    this.content.locales.push(this.emptyLocale(this.newLocale));

    if (!this.content.defaultLocale) { this.content.defaultLocale = this.newLocale; }

    this.activeLocale = this.newLocale;
    this.newLocale = '';
    this.touch();
  }

  setDefaultLocale(locale: string): void {
    const target = this.content.locales.find(l => l.locale === locale);

    if (target?.translation?.method === 'AI' && !target.translation.reviewed) {
      this.showToast('Review this translation before making it the default language.');
      return;
    }

    this.content.defaultLocale = locale;
    if (target) { target.translation = null; }
    this.touch();
  }

  // ---- AI translation ---------------------------------------------------

  /* Market languages the product is shown in but has no content for. */
  get missingMarketLocales(): string[] {
    const wanted = this.content.markets
      .map(code => this.countries.find(c => c.code === code)?.locale)
      .filter((l): l is string => !!l);

    return [...new Set(wanted)].filter(l =>
      l !== this.content.defaultLocale && !this.content.locales.some(x => x.locale === l));
  }

  get missingMarketLabels(): string {
    return this.missingMarketLocales.map(l => this.localeLabel(l)).join(', ');
  }

  isTranslating(locale?: string): boolean {
    return locale ? this.translating.has(locale) : this.translating.size > 0;
  }

  translateLocale(target: LocaleContent): void {
    const hasHumanText = !!target.name.trim() && (target.translation?.method !== 'AI' || target.translation.reviewed);

    if (hasHumanText && !confirm(`Replace the ${this.localeLabel(target.locale)} text with a new AI translation? It will need reviewing again.`)) {
      return;
    }

    this.runTranslation([target.locale]);
  }

  translateMissing(): void {
    const targets = this.missingMarketLocales;

    if (!targets.length) {
      this.showToast('Every market the product is shown in already has its language.');
      return;
    }

    this.runTranslation(targets);
  }

  private runTranslation(targets: string[]): void {
    const source = this.defaultContent;

    if (!source || !source.name.trim()) {
      this.showToast('Write the default language first; translations are made from it.');
      return;
    }

    if (this.isTranslating()) { return; }

    const doNotTranslate = [
      this.product.product.sku,
      this.product.identifiers.vendorCatalogNumber,
      this.brand?.name ?? ''
    ].filter(w => !!w && w.trim().length > 1);

    targets.forEach(t => this.translating.add(t));
    const sourceHash = this.contentHash(source);

    this.products.translateContent(this.product.productId, {
      sourceLocale: source.locale,
      source: this.translationSource(source),
      targets,
      doNotTranslate
    }).subscribe({
      next: result => {
        targets.forEach(t => this.translating.delete(t));
        this.applyTranslations(result, source, sourceHash);
      },
      error: error => {
        targets.forEach(t => this.translating.delete(t));
        console.error('Translation failed.', error);
        const message = typeof error?.error === 'string' && error.error.length < 300
          ? error.error
          : 'Translation failed. Try again in a moment.';
        this.showToast(message);
      }
    });
  }

  private applyTranslations(result: ProductTranslateResult, source: LocaleContent, sourceHash: string): void {
    let first = '';

    for (const r of result.results ?? []) {
      let target = this.content.locales.find(l => l.locale === r.locale);

      if (!target) {
        target = this.emptyLocale(r.locale);
        this.content.locales.push(target);
      }

      const c = r.content ?? {};
      target.name = c.name ?? '';
      target.shortDescription = c.shortDescription ?? '';
      target.description = c.description ?? '';
      target.featuresHtml = c.featuresHtml ?? '';
      target.specsHtml = c.specsHtml ?? '';
      target.outOfStockMessage = c.outOfStockMessage ?? '';
      target.features = Array.isArray(c.features) ? [...c.features] : [];
      target.specs = Array.isArray(c.specs) ? c.specs.map((s: any) => ({ label: s.label ?? '', value: s.value ?? '' })) : [];

      /* Same documents and links as the source; only the titles are translated. */
      const titles: (string | null)[] = Array.isArray(c.documentTitles) ? c.documentTitles : [];
      target.documents = source.documents.map((d, i) => ({ ...d, title: titles[i] || d.title }));

      target.translation = {
        method: 'AI',
        model: result.model,
        translatedAt: new Date().toISOString(),
        sourceLocale: source.locale,
        sourceHash,
        reviewed: false
      };
      target.notes = r.notes ?? [];
      first = first || r.locale;
    }

    if (first) {
      this.activeLocale = first;
      this.touch();
    }

    const done = (result.results ?? []).map(r => this.localeLabel(r.locale));
    const failed = (result.failures ?? []).map(f => `${this.localeLabel(f.locale)}: ${f.message}`);

    this.showToast([
      done.length ? `Translated: ${done.join(', ')}. Review, then save.` : '',
      failed.length ? `Not translated: ${failed.join('; ')}` : ''
    ].filter(Boolean).join(' '));
  }

  /* The source language as the server expects it: only the fields worth translating. */
  private translationSource(l: LocaleContent): Record<string, unknown> {
    return this.compact({
      name: l.name.trim(),
      shortDescription: l.shortDescription.trim(),
      description: l.description.trim(),
      featuresHtml: l.featuresHtml.trim(),
      specsHtml: l.specsHtml.trim(),
      outOfStockMessage: l.outOfStockMessage.trim(),
      features: l.features.length ? l.features.map(f => f.trim()) : null,
      specs: l.specs.length ? l.specs : null,
      documents: l.documents.length ? l.documents.map(d => ({ title: d.title })) : null
    });
  }

  setReviewed(target: LocaleContent, reviewed: boolean): void {
    if (!target.translation) { return; }

    target.translation = reviewed
      ? { ...target.translation, reviewed: true }
      : { ...target.translation, reviewed: false, reviewedBy: undefined, reviewedAt: undefined };

    if (reviewed) { target.notes = []; }
    this.touch();
  }

  /* An AI translation whose source text has changed since it was made. */
  isStale(target: LocaleContent): boolean {
    const t = target.translation;
    const source = this.defaultContent;

    return !!t && t.method === 'AI' && !!t.sourceHash && !!source
      && t.sourceLocale === source.locale && t.sourceHash !== this.contentHash(source);
  }

  translationLabel(target: LocaleContent): string {
    const t = target.translation;

    if (!t || target.locale === this.content.defaultLocale) { return ''; }
    if (t.method !== 'AI') { return 'Written by a person'; }
    if (this.isStale(target)) { return 'AI · source changed'; }
    return t.reviewed ? 'AI · reviewed' : 'AI · not reviewed';
  }

  translationColor(target: LocaleContent): { fg: string; bg: string } {
    if (this.isStale(target)) { return { fg: this.P.red, bg: this.P.redSoft }; }
    return target.translation?.reviewed
      ? { fg: this.P.green, bg: this.P.greenSoft }
      : { fg: this.P.amber, bg: this.P.amberSoft };
  }

  /* A short fingerprint of a language's text (FNV-1a), to spot when the source changes. */
  private contentHash(l: LocaleContent): string {
    const text = JSON.stringify([
      l.name, l.shortDescription, l.description, l.featuresHtml, l.specsHtml,
      l.features, l.specs.map(s => [s.label, s.value]), l.outOfStockMessage
    ].map(v => (typeof v === 'string' ? v.trim() : v)));

    return this.fnv(text);
  }

  /* FNV-1a: a short fingerprint, to spot when a source has changed. */
  private fnv(text: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  removeLocale(target: LocaleContent): void {
    if (target.locale === this.content.defaultLocale) {
      this.showToast('Choose another default language before removing this one.');
      return;
    }

    this.content.locales = this.content.locales.filter(l => l !== target);
    this.activeLocale = this.content.defaultLocale;
    this.touch();
  }

  /* How much of the default language's content this language has. */
  translated(target: LocaleContent): string {
    const base = this.defaultContent;

    if (!base || base === target) { return 'default'; }

    const hasFeatures = (l: LocaleContent) => l.features.length > 0 || !!l.featuresHtml;
    const hasSpecs = (l: LocaleContent) => l.specs.length > 0 || !!l.specsHtml;

    const parts: [boolean, boolean][] = [
      [!!base.name, !!target.name],
      [!!base.shortDescription, !!target.shortDescription],
      [!!base.description, !!target.description],
      [hasFeatures(base), hasFeatures(target)],
      [hasSpecs(base), hasSpecs(target)]
    ];

    const wanted = parts.filter(([needed]) => needed);
    const done = wanted.filter(([, has]) => has).length;

    return wanted.length === 0 ? 'complete' : `${done} of ${wanted.length} parts`;
  }

  addFeature(target: LocaleContent): void { target.features.push(''); this.touch(); }
  removeFeature(target: LocaleContent, index: number): void { target.features.splice(index, 1); this.touch(); }
  addSpec(target: LocaleContent): void { target.specs.push({ label: '', value: '' }); this.touch(); }
  removeSpec(target: LocaleContent, index: number): void { target.specs.splice(index, 1); this.touch(); }
  addDocument(target: LocaleContent): void { target.documents.push({ type: 'INSTRUCTIONS', title: '', url: '' }); this.touch(); }
  removeDocument(target: LocaleContent, index: number): void { target.documents.splice(index, 1); this.touch(); }

  toggleContentMarket(code: string): void {
    this.content.markets = this.content.markets.includes(code)
      ? this.content.markets.filter(c => c !== code)
      : [...this.content.markets, code];
    this.touch();
  }

  // ---- the contract rules, checked as you type --------------------------

  get problems(): Problem[] {
    const found: Problem[] = [];
    const add = (section: string, text: string) => found.push({ section, text });
    const p = this.product;
    const digits = (value: string, length: number) => new RegExp(`^[0-9]{${length}}$`).test(value);
    const amount = (value: string) => /^[0-9]+(\.[0-9]{1,4})?$/.test(value);

    if (!p.product.name.trim()) { add('identity', 'A name is required.'); }
    if (p.product.replacementSku.trim() && p.product.status !== 'DISCONTINUED') {
      add('identity', 'Only a discontinued product names a replacement.');
    }
    if (p.identifiers.upc && !digits(p.identifiers.upc, 12)) { add('identity', 'A UPC is 12 digits.'); }
    if (p.identifiers.ean && !digits(p.identifiers.ean, 13)) { add('identity', 'An EAN is 13 digits.'); }
    if (p.identifiers.caseGtin && !digits(p.identifiers.caseGtin, 14)) { add('identity', 'A case GTIN is 14 digits.'); }

    const checkPrices = (where: string, prices: PriceSet) => {
      for (const row of this.priceRows) {
        if (prices[row.key].amount && !amount(prices[row.key].amount)) {
          add('pricing', `${where}: ${row.label} is not a valid amount.`);
        }
      }

      if (prices.cartonPrice.amount && !(Number(prices.cartonQuantity) >= 2)) {
        add('pricing', `${where}: a carton price needs a carton quantity of 2 or more.`);
      }
    };

    checkPrices('Home market', p.pricing);

    for (const market of p.marketPricing) {
      checkPrices(this.countryName(market.country), market);

      if (!this.priceRows.some(row => market[row.key].amount)) {
        add('pricing', `${this.countryName(market.country)} has no price. Enter one or remove the market.`);
      }
    }

    if (this.overriddenMarkets.length && !this.priceReason.trim()) {
      add('pricing', `Say why the converted prices for ${this.overriddenMarkets.map(m => this.countryName(m.country)).join(', ')} were changed by hand.`);
    }

    const costs: [string, Money][] = [
      ['Distributor cost', p.pricing.distributorCost],
      ['Landed cost', p.pricing.landedCost],
      ['Shipping surcharge', p.pricing.shippingSurcharge]
    ];

    for (const [label, money] of costs) {
      if (money.amount && !amount(money.amount)) { add('pricing', `${label} is not a valid amount.`); }
    }

    if (p.supply.vendorId && !/^[0-9]+$/.test(p.supply.vendorId)) { add('supply', 'The vendor number is digits only.'); }
    if (this.productSaysDirect && !p.brandId && !p.supply.vendorId) {
      add('supply', 'A direct vendor ship product needs a brand or a vendor, so the order has somewhere to go.');
    }
    if (this.shipsDirect && !p.supply.vendorId && this.brand && !this.brand.vendorId) {
      add('supply', `${this.brand.name} has no vendor, so there is nowhere to send the order.`);
    }

    const r = p.replenishment;

    if (r.minimumStock !== null && (r.minimumStock < 0 || !Number.isInteger(Number(r.minimumStock)))) {
      add('reorder', 'Minimum stock is a whole number, 0 or more.');
    }
    if (r.monthsSupply !== null && !(r.monthsSupply > 0)) { add('reorder', 'Months of supply must be more than zero.'); }

    const l = p.logistics;
    const dims = [l.dimensions.length, l.dimensions.width, l.dimensions.height];

    if (dims.some(v => !!v) && !dims.every(v => !!v && v > 0)) {
      add('logistics', 'Enter length, width and height, or none of them.');
    }
    if (l.weight.value !== null && l.weight.value <= 0) { add('logistics', 'Weight must be more than zero.'); }

    for (const hs of l.hsCodes) {
      if (!/^[0-9]{6,10}$/.test(hs.code)) {
        add('logistics', `${this.countryName(hs.country)}: an HS code is 6 to 10 digits, with no dots.`);
      }
    }

    const c = this.content;

    if (c.published && c.locales.length === 0) { add('content', 'A product shown on the web needs content in at least one language.'); }
    if (c.locales.length > 0 && !c.locales.some(x => x.locale === c.defaultLocale)) {
      add('content', 'Choose the default language.');
    }

    for (const lang of c.locales) {
      const name = this.localeLabel(lang.locale);

      if (!lang.name.trim()) { add('content', `${name}: a name is required.`); }
      if (lang.features.some(f => !f.trim())) { add('content', `${name}: remove the empty feature.`); }
      if (lang.specs.some(s => !s.label.trim() || !s.value.trim())) { add('content', `${name}: every spec needs a label and a value.`); }
      if (lang.documents.some(d => !/^https?:\/\/\S+$/.test(d.url))) { add('content', `${name}: every document needs a web address.`); }
    }

    return found;
  }

  problemCount(section: string): number { return this.problems.filter(p => p.section === section).length; }
  problemsFor(section: string): Problem[] { return this.problems.filter(p => p.section === section); }

  /* Not rule breaks: gaps a 3PL or an international partner will ask about. */
  get advisories(): string[] {
    const notes: string[] = [];
    const p = this.product;

    if (!p.identifiers.upc && !p.identifiers.ean) { notes.push('No barcode. A 3PL will not accept the product without a UPC or EAN.'); }
    if (p.marketPricing.length > 0 && !p.identifiers.ean) { notes.push('Priced outside the home market with no EAN.'); }
    if (!p.logistics.weight.value) { notes.push('No weight.'); }
    if (!p.logistics.countryOfOrigin || p.logistics.hsCodes.length === 0) {
      notes.push('Country of origin or HS code is missing; both are needed to ship across a border.');
    }
    if (p.pricing.distributorCost.amount && p.pricing.distributorCost.currency !== p.pricing.memberPrice.currency) {
      notes.push(`Distributor cost is in ${p.pricing.distributorCost.currency}. A vendor cost formula based on it needs converting first.`);
    }
    if (!p.returns.defectiveDisposition) { notes.push('No instruction for defective units.'); }

    for (const m of p.marketPricing) {
      const state = this.conversionState(m);

      if (state === 'SOURCE_CHANGED') {
        notes.push(`${this.countryName(m.country)}: the US prices changed after these were converted. Convert again or check them.`);
      } else if (state === 'RATE_MOVED') {
        notes.push(`${this.countryName(m.country)}: the ${this.marketCurrency(m)} rate has moved more than ${RATE_MOVE_FLAG * 100}% since these were converted.`);
      }
    }

    if (this.rates?.pending.length) {
      notes.push(`${this.rates.pending.length} pulled exchange rate(s) are waiting to be accepted or rejected (Pricing).`);
    }

    for (const l of this.content.locales) {
      if (l.translation?.method === 'AI' && l.locale !== this.content.defaultLocale) {
        if (this.isStale(l)) {
          notes.push(`${this.localeLabel(l.locale)}: the source text changed since it was translated. Retranslate or recheck it.`);
        } else if (!l.translation.reviewed) {
          notes.push(`${this.localeLabel(l.locale)} is an AI translation not yet reviewed; it is held until someone ticks Reviewed.`);
        }
      }
    }

    for (const code of this.content.markets) {
      if (code !== this.homeCountry && !p.marketPricing.some(m => m.country === code)) {
        notes.push(`Shown in ${this.countryName(code)} but not priced there.`);
      }

      const locale = this.countries.find(c => c.code === code)?.locale;
      if (code !== this.homeCountry && locale && !this.content.locales.some(l => l.locale === locale)) {
        notes.push(`Shown in ${this.countryName(code)} with no ${this.localeLabel(locale)} content; buyers there see the default language.`);
      }

      if (code !== this.homeCountry && !p.logistics.hsCodes.some(h => h.country === code)) {
        notes.push(`Shown in ${this.countryName(code)} with no HS code for it.`);
      }
    }

    return notes;
  }

  showToast(msg: string): void {
    this.toastMsg = msg;
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => (this.toastMsg = ''), 3600);
  }

  trackIndex(index: number): number { return index; }

  // ---- contract -> form ---------------------------------------------------

  private money(source: any, currency: string): Money {
    return {
      amount: source?.amount !== undefined && source?.amount !== null ? String(source.amount) : '',
      currency: source?.currency || currency
    };
  }

  private pricesIn(source: any, currency: string): PriceSet {
    return {
      memberPrice: this.money(source?.memberPrice, currency),
      cartonPrice: this.money(source?.cartonPrice, currency),
      cartonQuantity: source?.cartonQuantity ?? null,
      authorizedDealerPrice: this.money(source?.authorizedDealerPrice, currency),
      map: this.money(source?.map, currency),
      consumerRetail: this.money(source?.consumerRetail, currency),
      dropShipCharge: this.money(source?.dropShipCharge, currency)
    };
  }

  private fromProductContract(page: ProductPageData): ProductForm {
    const d = page.product ?? {};
    const pricing = d.pricing ?? {};
    const home = pricing.memberPrice?.currency || 'USD';
    const logistics = d.logistics ?? {};
    const supply = d.supply ?? {};

    return {
      productId: String(d.metadata?.productId ?? this.productId),
      product: {
        sku: d.product?.sku ?? '',
        name: d.product?.name ?? '',
        status: d.product?.status ?? 'ACTIVE',
        forSale: d.product?.forSale !== false,
        replacementSku: d.product?.replacementSku ?? '',
        notes: d.product?.notes ?? ''
      },
      brandId: d.brandId ?? null,
      identifiers: {
        upc: d.identifiers?.upc ?? '',
        ean: d.identifiers?.ean ?? '',
        caseGtin: d.identifiers?.caseGtin ?? '',
        vendorCatalogNumber: d.identifiers?.vendorCatalogNumber ?? ''
      },
      pricing: {
        ...this.pricesIn(pricing, home),
        distributorCost: this.money(pricing.distributorCost, home),
        landedCost: this.money(pricing.landedCost, home),
        shippingSurcharge: this.money(pricing.shippingSurcharge, home)
      },
      marketPricing: (d.marketPricing ?? []).map((m: any) => {
        const first = this.priceRows.map(row => m[row.key]?.currency).find((value: string) => !!value);
        const currency = first || this.countries.find(c => c.code === m.country)?.currency || 'USD';

        return { country: m.country, ...this.pricesIn(m, currency), conversion: null, savedMethod: null };
      }),
      supply: {
        directMode: page.followsInventoryMarker ? 'MARKER' : (supply.directVendorShip ? 'DIRECT' : 'WAREHOUSE'),
        vendorId: supply.vendorId ?? '',
        dropShipEligible: supply.dropShipEligible === true,
        specialOrder: supply.specialOrder === true,
        orderMultiple: supply.orderMultiple ?? null,
        unitsPerCase: supply.unitsPerCase ?? null
      },
      logistics: {
        weight: { value: logistics.weight?.value ?? null, unit: logistics.weight?.unit ?? 'LB' },
        dimensions: {
          length: logistics.dimensions?.length ?? null,
          width: logistics.dimensions?.width ?? null,
          height: logistics.dimensions?.height ?? null,
          unit: logistics.dimensions?.unit ?? 'IN'
        },
        countryOfOrigin: logistics.countryOfOrigin ?? '',
        hsCodes: (logistics.hsCodes ?? []).map((h: any) => ({ country: h.country, code: h.code })),
        containsLithiumBattery: logistics.containsLithiumBattery ?? null,
        prop65Warning: logistics.prop65Warning ?? null
      },
      replenishment: {
        minimumStock: d.replenishment?.minimumStock ?? null,
        monthsSupply: d.replenishment?.monthsSupply ?? null
      },
      returns: { defectiveDisposition: d.returns?.defectiveDisposition ?? '' }
    };
  }

  private fromContentContract(d: any): ContentForm {
    return {
      published: d.visibility?.published === true,
      markets: [...(d.visibility?.markets ?? [])],
      categories: [...(d.categories ?? [])],
      defaultLocale: d.defaultLocale ?? '',
      locales: (d.locales ?? []).map((l: any) => ({
        locale: l.locale,
        name: l.name ?? '',
        shortDescription: l.shortDescription ?? '',
        description: l.description ?? '',
        featuresHtml: l.featuresHtml ?? '',
        specsHtml: l.specsHtml ?? '',
        features: [...(l.features ?? [])],
        specs: (l.specs ?? []).map((s: any) => ({ label: s.label ?? '', value: s.value ?? '' })),
        documents: (l.documents ?? []).map((x: any) => ({ type: x.type ?? 'OTHER', title: x.title ?? '', url: x.url ?? '' })),
        outOfStockMessage: l.outOfStockMessage ?? '',
        translation: l.translation ? { ...l.translation, reviewed: l.translation.reviewed === true } : null,
        notes: []
      }))
    };
  }

  // ---- form -> contract: empty values are left out -------------------------

  private pricesOut(prices: PriceSet): Record<string, unknown> {
    const out: Record<string, unknown> = {};

    for (const row of this.priceRows) {
      const money = prices[row.key];

      if (money.amount) { out[row.key] = { amount: money.amount, currency: money.currency }; }
    }

    if (prices.cartonPrice.amount && prices.cartonQuantity) { out['cartonQuantity'] = Number(prices.cartonQuantity); }

    return out;
  }

  private compact(source: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(source)) {
      if (value !== '' && value !== null && value !== undefined) { out[key] = value; }
    }

    return out;
  }

  /* What is sent to Schemas/products/product.schema.json. */
  get productContract(): Record<string, unknown> {
    const p = this.product;
    const pricing = this.pricesOut(p.pricing);

    if (p.pricing.distributorCost.amount) { pricing['distributorCost'] = { ...p.pricing.distributorCost }; }
    if (p.pricing.landedCost.amount) { pricing['landedCost'] = { ...p.pricing.landedCost }; }
    if (p.pricing.shippingSurcharge.amount) { pricing['shippingSurcharge'] = { ...p.pricing.shippingSurcharge }; }

    const l = p.logistics;
    const logistics = this.compact({
      countryOfOrigin: l.countryOfOrigin,
      containsLithiumBattery: l.containsLithiumBattery,
      prop65Warning: l.prop65Warning
    });

    if (l.weight.value) { logistics['weight'] = { value: Number(l.weight.value), unit: l.weight.unit }; }
    if (l.dimensions.length && l.dimensions.width && l.dimensions.height) {
      logistics['dimensions'] = {
        length: Number(l.dimensions.length), width: Number(l.dimensions.width),
        height: Number(l.dimensions.height), unit: l.dimensions.unit
      };
    }
    if (l.hsCodes.length) { logistics['hsCodes'] = l.hsCodes.map(h => ({ country: h.country, code: h.code })); }

    const out: Record<string, unknown> = {
      schemaVersion: '1.0',
      metadata: { productId: p.productId },
      product: this.compact({
        sku: p.product.sku.trim(),
        name: p.product.name.trim(),
        status: p.product.status,
        forSale: p.product.forSale,
        replacementSku: p.product.replacementSku.trim(),
        notes: p.product.notes.trim()
      })
    };

    if (p.brandId) { out['brandId'] = p.brandId; }

    const identifiers = this.compact({ ...p.identifiers });
    if (Object.keys(identifiers).length) { out['identifiers'] = identifiers; }
    if (Object.keys(pricing).length) { out['pricing'] = pricing; }

    if (p.marketPricing.length) {
      out['marketPricing'] = p.marketPricing.map(m => ({ country: m.country, ...this.pricesOut(m) }));
    }

    out['supply'] = this.compact({
      directVendorShip: this.productSaysDirect,
      vendorId: p.supply.vendorId.trim(),
      dropShipEligible: p.supply.dropShipEligible,
      specialOrder: p.supply.specialOrder,
      orderMultiple: p.supply.orderMultiple ? Number(p.supply.orderMultiple) : null,
      unitsPerCase: p.supply.unitsPerCase ? Number(p.supply.unitsPerCase) : null
    });

    if (Object.keys(logistics).length) { out['logistics'] = logistics; }

    const replenishment = this.compact({
      minimumStock: p.replenishment.minimumStock !== null ? Number(p.replenishment.minimumStock) : null,
      monthsSupply: p.replenishment.monthsSupply ? Number(p.replenishment.monthsSupply) : null
    });
    if (Object.keys(replenishment).length) { out['replenishment'] = replenishment; }

    if (p.returns.defectiveDisposition) {
      out['returns'] = { defectiveDisposition: p.returns.defectiveDisposition };
    }

    return out;
  }

  /* What is sent to Schemas/products/product-content.schema.json. */
  get contentContract(): Record<string, unknown> {
    const c = this.content;
    const out: Record<string, unknown> = {
      schemaVersion: '1.0',
      productId: this.product.productId,
      visibility: { published: c.published, markets: c.markets }
    };

    if (c.categories.length) { out['categories'] = c.categories; }

    if (c.locales.length) {
      out['defaultLocale'] = c.defaultLocale;
      out['locales'] = c.locales.map(l => this.compact({
        locale: l.locale,
        name: l.name.trim(),
        shortDescription: l.shortDescription.trim(),
        description: l.description.trim(),
        featuresHtml: l.featuresHtml.trim(),
        specsHtml: l.specsHtml.trim(),
        features: l.features.length ? l.features.map(f => f.trim()) : null,
        specs: l.specs.length ? l.specs : null,
        documents: l.documents.length ? l.documents.map(d => this.compact({ ...d })) : null,
        outOfStockMessage: l.outOfStockMessage.trim(),
        translation: l.translation && l.locale !== c.defaultLocale ? this.compact({ ...l.translation }) : null
      }));
    }

    return out;
  }

  // ---- empty forms ---------------------------------------------------------

  private emptyMoney(currency: string): Money { return { amount: '', currency }; }

  private emptyPrices(currency: string): PriceSet {
    return {
      memberPrice: this.emptyMoney(currency),
      cartonPrice: this.emptyMoney(currency),
      cartonQuantity: null,
      authorizedDealerPrice: this.emptyMoney(currency),
      map: this.emptyMoney(currency),
      consumerRetail: this.emptyMoney(currency),
      dropShipCharge: this.emptyMoney(currency)
    };
  }

  private emptyLocale(locale: string): LocaleContent {
    return {
      locale, name: '', shortDescription: '', description: '', featuresHtml: '', specsHtml: '',
      features: [], specs: [], documents: [], outOfStockMessage: '', translation: null, notes: []
    };
  }

  private emptyProduct(): ProductForm {
    return {
      productId: '',
      product: { sku: '', name: '', status: 'ACTIVE', forSale: true, replacementSku: '', notes: '' },
      brandId: null,
      identifiers: { upc: '', ean: '', caseGtin: '', vendorCatalogNumber: '' },
      pricing: {
        ...this.emptyPrices('USD'),
        distributorCost: this.emptyMoney('USD'),
        landedCost: this.emptyMoney('USD'),
        shippingSurcharge: this.emptyMoney('USD')
      },
      marketPricing: [],
      supply: { directMode: 'MARKER', vendorId: '', dropShipEligible: false, specialOrder: false, orderMultiple: null, unitsPerCase: null },
      logistics: {
        weight: { value: null, unit: 'LB' },
        dimensions: { length: null, width: null, height: null, unit: 'IN' },
        countryOfOrigin: '', hsCodes: [], containsLithiumBattery: null, prop65Warning: null
      },
      replenishment: { minimumStock: null, monthsSupply: null },
      returns: { defectiveDisposition: '' }
    };
  }

  private emptyContent(): ContentForm {
    return { published: false, markets: [], categories: [], defaultLocale: '', locales: [] };
  }
}
