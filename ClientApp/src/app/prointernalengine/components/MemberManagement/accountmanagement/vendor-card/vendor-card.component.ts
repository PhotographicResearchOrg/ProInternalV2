// src/app/accountmanagement/vendor-card/vendor-card.component.ts
//
// Vendor management dashboard. Loads real data from api/VendorCard via
// DataService. Section nav, header toggles, and the Edit/Add flows below
// are wired to the CRUD endpoints; anything without a dialog here (e.g.
// contract/price-list edit, audit filter) still shows a stub() toast.

//
// LIVE so far: the Direct Vendor Ship section. It loads and saves real
// settings through VendorDirectShipService. Everything else is still stub.


import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { DataService } from 'src/app/services/data.service';
import {
  VendorTerms, VendorFreightPolicy, VendorShippingPolicy, VendorReturnPolicy, VendorStats,
  VendorContactApi, VendorContractApi, VendorPriceListApi, VendorRebatesApi,
  VendorFileApi, VendorFileCategory
} from 'src/app/models/vendor/vendor-card.model';

import { VendorDirectBrand, VendorDirectShipService, VendorDirectVendor } from 'src/app/services/vendor-direct-ship.service';
import { HomePin, stablePin } from 'src/app/services/home-pin.service';
import { VendorBillingComputyme, VendorBillingProgram } from 'src/app/models/vendor/vendor-desk.models';

interface NavItem { id: string; label: string; icon: string; }
interface Tile { id: string; icon: string; title: string; lines: string[]; color: number; }
interface Person { id: number; name: string; title: string; email: string; phone: string; primary?: boolean; }
interface ContactGroup { groupId: number; group: string; color: number; people: Person[]; }
interface Contract { id: number; name: string; type: string; start: string; end: string; value: string; status: string; }
interface PriceList { name: string; eff: string; exp: string; skus: number; status: string; cur: string; }
type Rebate = VendorRebatesApi['programs'][number];
interface AuditEntry { who: string; when: string; section: string; field: string; from: string; to: string; currentSession: boolean; }
interface CustomField { defId: number; label: string; type: string; value: string; section: string; publishable: boolean; }

@Component({
  selector: 'app-vendor-card',
  templateUrl: './vendor-card.component.html',
  styleUrls: ['./vendor-card.component.scss']
})
export class VendorCardComponent implements OnInit, OnChanges {

  @Input() vendorId: number | string = 0;

  // palette (exposed so the template can inline data-driven colors)
  P = {
    ink: '#1a2434', sub: '#5c6b81', faint: '#8a97ab',
    teal: '#0e7c73', tealSoft: '#dff1ef', violet: '#5b4bb5', violetSoft: '#e9e6f7',
    amber: '#a15c07', amberSoft: '#fbeecb', blue: '#1d4ed8', blueSoft: '#dce8fd',
    green: '#166534', greenSoft: '#dcfce7', muted: '#eef1f5'
  };

  brandColors = [
    { fg: '#0e7c73', bg: '#dff1ef' },
    { fg: '#5b4bb5', bg: '#e9e6f7' },
    { fg: '#a15c07', bg: '#fbeecb' },
    { fg: '#1d4ed8', bg: '#dce8fd' }
  ];

  vendor = { name: '', legal: '', id: '', acct: '', initials: '', rep: '' };

  brands: string[] = [];

  navSections: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: 'pi pi-th-large' },
    { id: 'record', label: 'Vendor record', icon: 'pi pi-lock' },
    { id: 'terms', label: 'Terms & Financials', icon: 'pi pi-receipt' },
    { id: 'brandlinks', label: 'Brands', icon: 'pi pi-tag' },
    { id: 'contacts', label: 'Contacts', icon: 'pi pi-users' },
    { id: 'contracts', label: 'Contracts', icon: 'pi pi-file' },
    { id: 'pricelists', label: 'Price Lists', icon: 'pi pi-tags' },
    { id: 'policies', label: 'Policies', icon: 'pi pi-truck' },
    { id: 'rebates', label: 'Instant Rebates', icon: 'pi pi-ticket' },
    { id: 'directship', label: 'Direct Vendor Ship', icon: 'pi pi-send' },
    { id: 'audit', label: 'Audit Log', icon: 'pi pi-history' }
  ];
  activeSection = 'overview';

  live = true;
  onWeb = true;
  loading = false;
  toastMsg = '';
  private toastT: any;

  terms: VendorTerms = { vendorId: 0 };
  stats: VendorStats = { activeContracts: 0, priceListCount: 0, contactCount: 0 };
  freightPolicy: VendorFreightPolicy = { vendorId: 0 };
  shippingPolicy: VendorShippingPolicy = { vendorId: 0, stacksWithPromos: false };
  returnPolicy: VendorReturnPolicy = { vendorId: 0, rmaRequired: false };

  overviewTiles: Tile[] = [];
  contacts: ContactGroup[] = [];
  contracts: Contract[] = [];
  lists: PriceList[] = [];
  rebates: Rebate[] = [];
  rebateSummary: VendorRebatesApi['summary'] = { liability: 0, liabilityClaims: 0, pendingAmount: 0, creditedAmount: 0, billedAmount: 0, programsLive: 0 };
  rebateLinked: VendorRebatesApi['linked'] = [];
  rebatesLoaded = false;
  audit: AuditEntry[] = [];
  customFields: CustomField[] = [];

  // uploaded documents on the vendor file share, keyed by VendorFileCategory
  // (string index so the untyped template context variable can index it)
  files: { [category: string]: VendorFileApi[] } = { 'contracts': [], 'price-lists': [] };
  uploadingFiles: { [category: string]: boolean } = { 'contracts': false, 'price-lists': false };

  statusMap: { [k: string]: { fg: string; bg: string; label: string; icon: string } } = {
    active: { fg: '#166534', bg: '#dcfce7', label: 'Active', icon: 'pi pi-check-circle' },
    scheduled: { fg: '#1d4ed8', bg: '#dce8fd', label: 'Scheduled', icon: 'pi pi-clock' },
    expiring: { fg: '#a15c07', bg: '#fbeecb', label: 'Expiring soon', icon: 'pi pi-exclamation-triangle' },
    expired: { fg: '#8a97ab', bg: '#eef1f5', label: 'Expired', icon: 'pi pi-history' },
    draft: { fg: '#a15c07', bg: '#fbeecb', label: 'Draft', icon: 'pi pi-pencil' }
  };
  eligMap: { [k: string]: { fg: string; bg: string; label: string } } = {
    all: { fg: '#5c6b81', bg: '#eef1f5', label: 'All customers' },
    pro: { fg: '#0e7c73', bg: '#dff1ef', label: 'PRO only' },
    member: { fg: '#5b4bb5', bg: '#e9e6f7', label: 'Member only' }
  };
  sectionColor: { [k: string]: { fg: string; bg: string } } = {
    Terms: { fg: '#0e7c73', bg: '#dff1ef' }, 'Price Lists': { fg: '#a15c07', bg: '#fbeecb' },
    Policies: { fg: '#1d4ed8', bg: '#dce8fd' }, Vendor: { fg: '#5b4bb5', bg: '#e9e6f7' }, Contacts: { fg: '#5b4bb5', bg: '#e9e6f7' },
    Contracts: { fg: '#1d4ed8', bg: '#dce8fd' }, Rebates: { fg: '#a15c07', bg: '#fbeecb' },
    Brands: { fg: '#0e7c73', bg: '#dff1ef' }, 'Custom Fields': { fg: '#5b4bb5', bg: '#e9e6f7' }
  };

  
  // ---- Direct Vendor Ship (live) -------------------------------------

  /* The vendor being set up: the card's own vendor, or one picked here while the card is a stub. */
  dvsVendorId: number | null = null;
  dvsVendors: VendorDirectVendor[] = [];
  dvs: VendorDirectVendor | null = null;
  dvsBrands: VendorDirectBrand[] = [];
  dvsAllBrands: VendorDirectBrand[] = [];
  dvsAddBrandId: number | null = null;
  dvsLoading = false;
  dvsSaving = false;
  dvsTesting = false;
  dvsDirty = false;
  dvsError = '';
  dvsNote = '';

  readonly dvsMethods = ['EMAIL', 'EDI', 'FTP', 'SFTP'];

  readonly dvsCostBases = [
    { value: 'MEMBER_PRICE', label: 'Member price (what the dealer pays)' },
    { value: 'CARTON_PRICE', label: 'Carton price' },
    { value: 'MAP', label: 'MAP' },
    { value: 'CONSUMER_RETAIL', label: 'Consumer retail' },
    { value: 'DISTRIBUTOR_COST', label: 'Distributor cost (what PRO pays)' }
  ];

  statusOptions = ['draft', 'scheduled', 'active', 'expiring', 'expired'];
  eligibilityOptions = ['all', 'pro', 'member'];

  // ---- audit log filters ----
  showAuditFilters = false;
  auditUsernameOptions: string[] = [];
  auditFieldOptions: string[] = [];
  selectedAuditUsernames: string[] = [];
  selectedAuditFields: string[] = [];
  auditCurrentSessionOnly = false;

  // ---- dialog state: Terms (one dialog per card) ----
  discountDialogVisible = false;
  discountDraft: VendorTerms = { vendorId: 0 };

  payableDialogVisible = false;
  payableDraft: VendorTerms = { vendorId: 0 };

  orderingDialogVisible = false;
  orderingDraft: VendorTerms = { vendorId: 0 };

  // field-level validation errors from the last failed save, keyed by
  // lowercased API property name (e.g. "paymentterms" -> message)
  formErrors: { [field: string]: string } = {};

  // ---- dialog state: Brand ----
  brandDialogVisible = false;
  newBrandName = '';

  // ---- dialog state: Contact group / contact ----
  contactGroupDialogVisible = false;
  newGroupName = '';

  contactDialogVisible = false;
  contactDraft: Partial<VendorContactApi> = {};
  editingContactId: number | null = null;

  // ---- dialog state: Contract ----
  contractDialogVisible = false;
  contractDraft: Partial<VendorContractApi> = { status: 'draft' };
  editingContractId: number | null = null;

  // ---- dialog state: Price list ----
  priceListDialogVisible = false;
  priceListDraft: Partial<VendorPriceListApi> = { currency: 'USD', status: 'draft', skuCount: 0 };

  // ---- dialog state: Policies ----
  freightDialogVisible = false;
  freightDraft: VendorFreightPolicy = { vendorId: 0 };

  shippingDialogVisible = false;
  shippingDraft: VendorShippingPolicy = { vendorId: 0, stacksWithPromos: false };

  returnDialogVisible = false;
  returnDraft: VendorReturnPolicy = { vendorId: 0, rmaRequired: false };


  // ---- dialog state: Custom field values (one dialog per section card) ----
  // Fields themselves are defined on the Vendor Custom Fields page; this
  // only edits this vendor's values. Drafts are keyed by definition id.
  customFieldDialogVisible = false;
  customFieldSection = '';
  customFieldDrafts: { [defId: number]: any } = {};
  savingCustomFields = false;

  constructor(
    private dataService: DataService,
    private route: ActivatedRoute,
    private router: Router,
    private confirmationService: ConfirmationService,
	private directShip: VendorDirectShipService
  ) { }

  ngOnInit(): void {
    const routeId = this.route.snapshot.paramMap.get('vendorId') || this.route.snapshot.queryParamMap.get('vendorId');
    if (routeId) this.vendorId = +routeId;
    /* a pinned drawer opens straight on its section */
    const sec = this.route.snapshot.queryParamMap.get('section');
    if (sec && this.navSections.some(n => n.id === sec)) this.activeSection = sec;

    if (!this.vendorId) {
      this.showToast('No vendor selected');
      return;
    }

    this.loadVendorCard();
	this.loadDirectShip();
  }

  get id(): number {
    return typeof this.vendorId === 'string' ? +this.vendorId : this.vendorId;
  }

  loadVendorCard(): void {
    this.loading = true;

    this.dataService.getVendorCard(this.id).subscribe({
      next: card => {
        this.vendor = {
          name: card.name, legal: card.legalName || '', id: `VND-${card.vendorId}`,
          acct: card.accountNumber || '', initials: this.initials(card.name), rep: card.repName || ''
        };
        this.brands = card.brands || [];
        /* the brand family comes from dbo.Brand.VendorID (what the B2B site uses); VendorBrand is empty */
        this.dataService.brandVendors(this.id).subscribe({
          next: r => { if (r?.brands?.length) this.brands = r.brands.map(b => b.brandName); }
        });
        this.live = card.isActive;
        this.onWeb = card.onWeb;
        this.terms = card.terms || { vendorId: this.id };
        this.stats = card.stats || { activeContracts: 0, priceListCount: 0, contactCount: 0 };
        this.loading = false;
        this.buildOverviewTiles();
      },
      error: () => { this.loading = false; this.showToast('Failed to load vendor'); }
    });

    this.loadComputymeTerms();
    this.loadContacts();
    this.loadContracts();
    this.loadPriceLists();
    this.loadPolicies();
    this.loadRebates();
    this.loadAudit();
    this.loadCustomFields();
    this.loadFiles('contracts');
    this.loadFiles('price-lists');
  }

  private loadContacts(): void {
    this.dataService.getVendorContacts(this.id).subscribe(groups => {
      this.contacts = (groups || []).map((g, i) => ({
        groupId: g.vendorContactGroupId, group: g.groupName, color: i % this.brandColors.length,
        people: (g.people || []).map(p => ({
          id: p.vendorContactId, name: p.name, title: p.title || '', email: p.email || '', phone: p.phone || '', primary: p.isPrimary
        }))
      }));
      this.buildOverviewTiles();
    });
  }

  private loadContracts(): void {
    this.dataService.getVendorContracts(this.id).subscribe(list => {
      this.contracts = (list || []).map(c => ({
        id: c.vendorContractId, name: c.name, type: c.contractType || '', start: this.dateOnly(c.startDate), end: this.dateOnly(c.endDate),
        value: c.valueText || '—', status: c.status
      }));
      this.buildOverviewTiles();
    });
  }

  private loadPriceLists(): void {
    this.dataService.getVendorPriceLists(this.id).subscribe(list => {
      this.lists = (list || []).map(l => ({
        name: l.name, eff: this.dateOnly(l.effectiveDate), exp: this.dateOnly(l.expirationDate),
        skus: l.skuCount, status: l.status, cur: l.currency
      }));
      this.buildOverviewTiles();
    });
  }

  private loadPolicies(): void {
    this.dataService.getVendorPolicies(this.id).subscribe(p => {
      this.freightPolicy = p.freight || { vendorId: this.id };
      this.shippingPolicy = p.shipping || { vendorId: this.id, stacksWithPromos: false };
      this.returnPolicy = p.returns || { vendorId: this.id, rmaRequired: false };
      this.buildOverviewTiles();
    });
  }

  /* Rebates come from the Rebate Desk (managed there); this card only shows them. */
  private loadRebates(): void {
    this.rebatesLoaded = false;
    this.dataService.getVendorRebates(this.id).subscribe({
      next: r => {
        this.rebates = r?.programs ?? [];
        this.rebateLinked = r?.linked ?? [];
        if (r?.summary) this.rebateSummary = r.summary;
        this.rebatesLoaded = true;
        this.buildOverviewTiles();
      },
      error: () => { this.rebates = []; this.rebatesLoaded = true; this.buildOverviewTiles(); }
    });
  }

  openRebateDesk(): void {
    this.router.navigate(['/rebatedesk'], { queryParams: { view: 'vendors' } });
  }

  private loadAudit(): void {
    this.dataService.getVendorAuditLog(this.id, 50).subscribe(list => {
      this.audit = (list || []).map(a => ({
        who: a.changedBy || 'System', when: this.timeAgo(a.changedAt), section: a.section || '',
        field: a.fieldName || '', from: a.oldValue ?? '—', to: a.newValue ?? '—',
        currentSession: a.isCurrentSession
      }));

      this.auditUsernameOptions = Array.from(new Set(this.audit.map(a => a.who))).sort();
      this.auditFieldOptions = Array.from(new Set(this.audit.map(a => a.field))).sort();
      this.selectedAuditUsernames = this.selectedAuditUsernames.filter(u => this.auditUsernameOptions.includes(u));
      this.selectedAuditFields = this.selectedAuditFields.filter(f => this.auditFieldOptions.includes(f));
    });
  }

  filteredAudit(): AuditEntry[] {
    return this.audit.filter(a =>
      (!this.selectedAuditUsernames.length || this.selectedAuditUsernames.includes(a.who)) &&
      (!this.selectedAuditFields.length || this.selectedAuditFields.includes(a.field)) &&
      (!this.auditCurrentSessionOnly || a.currentSession)
    );
  }

  clearAuditFilters(): void {
    this.selectedAuditUsernames = [];
    this.selectedAuditFields = [];
  }

  private loadCustomFields(): void {
    this.dataService.getVendorCustomFields(this.id).subscribe(list => {
      this.customFields = (list || []).map(f => ({
        defId: f.vendorCustomFieldDefinitionId, label: f.label, type: f.dataType,
        value: f.value || '', section: f.section, publishable: f.isPublishable
      }));
    });
  }

  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vendorId'] && !changes['vendorId'].firstChange) {
      this.loadDirectShip();
    }
  }

  /* The card's own vendor when it has one; otherwise the list to pick from. */
  private loadDirectShip(): void {
    const id = Number(this.vendorId);

    this.directShip.getBrands().subscribe({
      next: brands => (this.dvsAllBrands = brands ?? []),
      error: () => (this.dvsAllBrands = [])
    });

    if (id > 0) {
      this.dvsVendorId = id;
      this.loadDvsVendor();
      return;
    }

    this.directShip.getVendors().subscribe({
      next: vendors => {
        /* Vendors already set up come first. */
        this.dvsVendors = (vendors ?? []).sort((a, b) =>
          Number(!!b.method) - Number(!!a.method) ||
          String(a.name ?? '').localeCompare(String(b.name ?? ''))
        );
      },
      error: error => (this.dvsError = this.dvsFailure(error, 'Unable to load vendors.'))
    });

    if (this.dvsVendorId) {
      this.loadDvsVendor();
    }
  }

  loadDvsVendor(): void {
    if (!this.dvsVendorId) {
      this.dvs = null;
      this.dvsBrands = [];
      return;
    }

    this.dvsLoading = true;
    this.dvsError = '';
    this.dvsNote = '';

    this.directShip.getVendor(this.dvsVendorId).subscribe({
      next: page => {
        /* Works on a copy, so nothing changes until Save. */
        this.dvs = { ...page.vendor, password: '' };
        this.dvsBrands = (page.brands ?? []).map(brand => ({ ...brand }));
        this.dvsDirty = false;
        this.dvsLoading = false;
      },
      error: error => {
        this.dvsLoading = false;
        this.dvs = null;
        this.dvsError = this.dvsFailure(error, 'Unable to load the settings for this vendor.');
      }
    });
  }

  dvsTouch(): void { this.dvsDirty = true; this.dvsNote = ''; }

  toggleDvsEnabled(): void {
    if (this.dvs) {
      this.dvs.enabled = !this.dvs.enabled;
      this.dvsTouch();
    }
  }

  get dvsDestinationLabel(): string {
    switch (this.dvs?.method) {
      case 'EDI': return 'EDI folder';
      case 'FTP': return 'FTP address (ftp://user@host/path)';
      case 'SFTP': return 'SFTP address (sftp://user@host/path)';
      default: return 'Destination';
    }
  }

  /* In words: what the vendor is sent for one unit. */
  get dvsCostSummary(): string {
    const base = this.dvsCostBases.find(b => b.value === (this.dvs?.costBase || 'MEMBER_PRICE'));
    const percent = Number(this.dvs?.costPercent) || 0;

    return `${base?.label ?? 'Member price'}${percent > 0 ? `, less ${percent}%` : ''}`;
  }

  saveDvs(): void {
    const vendor = this.dvs;

    if (!vendor || this.dvsSaving) { return; }

    this.dvsSaving = true;
    this.dvsError = '';
    this.dvsNote = '';

    this.directShip.saveVendor(vendor).subscribe({
      next: result => {
        this.dvsSaving = false;

        if (!result.success) {
          this.dvsError = result.message;
          return;
        }

        this.loadDvsVendor();
        this.showToast(result.message);
      },
      error: error => {
        this.dvsSaving = false;
        this.dvsError = this.dvsFailure(error, 'The server could not save the settings.');
      }
    });
  }

  /* Uses the saved settings, so save first. */
  sendDvsTest(): void {
    const vendor = this.dvs;

    if (!vendor || this.dvsTesting) { return; }

    this.dvsTesting = true;
    this.dvsError = '';
    this.dvsNote = '';

    this.directShip.sendTest(vendor.vendorId).subscribe({
      next: result => {
        this.dvsTesting = false;

        if (result.success) {
          this.dvsNote = result.message;
        } else {
          this.dvsError = result.message;
        }
      },
      error: error => {
        this.dvsTesting = false;
        this.dvsError = this.dvsFailure(error, 'The server could not send the test.');
      }
    });
  }

  /* A brand saves on its own, as soon as its switch is changed. */
  toggleDvsBrand(brand: VendorDirectBrand): void {
    brand.allItems = !brand.allItems;
    this.dvsError = '';

    this.directShip.saveBrand(brand).subscribe({
      next: result => {
        if (!result.success) {
          this.dvsError = result.message;
          this.loadDvsVendor();
          return;
        }

        this.showToast(`${brand.brandName}: ${brand.allItems ? 'everything ships direct' : 'only marked products ship direct'}`);
      },
      error: error => {
        this.dvsError = this.dvsFailure(error, 'The server could not save the brand.');
        this.loadDvsVendor();
      }
    });
  }

  /* Brands that belong to another vendor, or to none. */
  get dvsOtherBrands(): VendorDirectBrand[] {
    return this.dvsAllBrands.filter(brand => brand.vendorId !== this.dvsVendorId);
  }

  addDvsBrand(): void {
    const brand = this.dvsAllBrands.find(row => row.brandId === this.dvsAddBrandId);

    if (!brand || !this.dvsVendorId) { return; }

    this.directShip.saveBrand({ ...brand, vendorId: this.dvsVendorId }).subscribe({
      next: result => {
        if (!result.success) {
          this.dvsError = result.message;
          return;
        }

        this.dvsAddBrandId = null;
        this.loadDirectShip();
        this.showToast(`${brand.brandName} now belongs to this vendor.`);
      },
      error: error => (this.dvsError = this.dvsFailure(error, 'The server could not move the brand.'))
    });
  }

  private dvsFailure(error: unknown, fallback: string): string {
    return (error as { status?: number } | null)?.status === 403
      ? 'You do not have permission to change direct vendor ship settings.'
      : fallback;
  }

  
  // --- nav + toggles ---
  setSection(id: string): void { this.activeSection = id; }

  /* ---- Computyme's terms, shown inside the Terms & Financials cards ---- */
  cty: VendorBillingComputyme | null = null;
  ctyPrograms: VendorBillingProgram[] = [];

  private loadComputymeTerms(): void {
    this.cty = null;
    this.ctyPrograms = [];
    this.dataService.vendorBilling(this.id).subscribe({
      next: b => { this.cty = b?.computyme ?? null; this.ctyPrograms = b?.programs ?? []; },
      error: () => { this.cty = null; }
    });
  }

  /** a stored surcharge read as tenths of a percent (35 = 3.5%) */
  surchargePct(v: string | null | undefined): string | null {
    const n = parseFloat(v || '');
    return isNaN(n) || !Number.isInteger(n) || n === 0 ? null : `${n / 10}%`;
  }

  /* ---- find another vendor without leaving the desk ---- */
  switchPick: any = null;
  switchMatches: { id: number; label: string }[] = [];
  private switchAll: { id: number; label: string }[] | null = null;

  findVendors(e: { query: string }): void {
    const q = (e?.query || '').trim().toLowerCase();
    const run = () => this.switchMatches = (this.switchAll || [])
      .filter(v => !q || v.label.toLowerCase().includes(q)).slice(0, 25);
    if (this.switchAll) { run(); return; }
    this.dataService.getVendors().subscribe({
      next: list => { this.switchAll = (list || []).map(v => ({ id: +v.id, label: `${v.name} (${v.id})` })).sort((a, b) => a.label.localeCompare(b.label)); run(); },
      error: () => this.switchMatches = []
    });
  }

  switchTo(e: any): void {
    const pick = e?.value ?? e;
    const id = Number(pick?.id);
    this.switchPick = null;
    if (!id || id === this.id) return;
    this.router.navigate(['/vendor-card'], { queryParams: { vendorId: id, section: this.activeSection }, replaceUrl: false });
    this.vendorId = id;
    this.loadVendorCard();
    this.loadDirectShip();
  }

  /** "Pin to home" for the drawer on screen */
  get homePin(): HomePin | null {
    if (!this.id || !this.vendor?.name) return null;
    const label = this.navSections.find(n => n.id === this.activeSection)?.label || this.activeSection;
    return stablePin({
      id: `vendor:${this.id}:${this.activeSection}`, label: `${this.vendor.name} · ${label}`, sub: `Vendor Desk · ${label}`,
      icon: 'pi pi-briefcase', route: '/vendor-card', query: { vendorId: String(this.id), section: this.activeSection }
    });
  }

  toggleLive(): void {
    this.dataService.toggleVendorActive(this.id).subscribe({
      next: () => {
        this.live = !this.live;
        this.showToast(this.live ? 'Vendor active' : 'Vendor set inactive');
        this.loadAudit();
      },
      error: () => this.showToast('Could not update vendor status')
    });
  }

  toggleWeb(): void {
    this.dataService.toggleVendorWebStatus(this.id).subscribe({
      next: () => {
    this.onWeb = !this.onWeb;
    this.showToast(this.onWeb ? 'Vendor is live on web' : 'Vendor hidden from web');
      },
      error: () => this.showToast('Could not update web status')
    });
  }

  // --- Terms & Financials (one dialog per card) ---
  openEditDiscountSplit(): void {
    this.clearFormErrors();
    this.discountDraft = { ...this.terms };
    this.discountDialogVisible = true;
  }
  saveDiscountSplit(): void {
    this.dataService.saveVendorTerms(this.id, this.discountDraft).subscribe({
      next: () => {
        this.terms = { ...this.discountDraft };
        this.discountDialogVisible = false;
        this.showToast('Discount split saved');
        this.buildOverviewTiles();
        this.loadAudit();
      },
      error: err => this.handleSaveError(err, 'Could not save discount split')
    });
  }

  openEditPayableTerms(): void {
    this.clearFormErrors();
    this.payableDraft = { ...this.terms };
    this.payableDialogVisible = true;
  }
  savePayableTerms(): void {
    this.dataService.saveVendorTerms(this.id, this.payableDraft).subscribe({
      next: () => {
        this.terms = { ...this.payableDraft };
        this.payableDialogVisible = false;
        this.showToast('Payable terms saved');
        this.buildOverviewTiles();
        this.loadAudit();
      },
      error: err => this.handleSaveError(err, 'Could not save payable terms')
    });
  }

  openEditOrderingMargin(): void {
    this.clearFormErrors();
    this.orderingDraft = { ...this.terms };
    this.orderingDialogVisible = true;
  }
  saveOrderingMargin(): void {
    this.dataService.saveVendorTerms(this.id, this.orderingDraft).subscribe({
      next: () => {
        this.terms = { ...this.orderingDraft };
        this.orderingDialogVisible = false;
        this.showToast('Ordering & margin saved');
        this.buildOverviewTiles();
        this.loadAudit();
      },
      error: err => this.handleSaveError(err, 'Could not save ordering & margin')
    });
  }

  // --- Brand ---
  openAddBrand(): void {
    this.clearFormErrors();
    this.newBrandName = '';
    this.brandDialogVisible = true;
  }
  saveBrand(): void {
    const name = this.newBrandName.trim();
    if (!name) return;
    this.dataService.addVendorBrand(this.id, name).subscribe({
      next: () => {
        this.brands = [...this.brands, name];
        this.brandDialogVisible = false;
        this.showToast('Brand added');
        this.loadAudit();
      },
      error: err => this.handleSaveError(err, 'Could not add brand')
    });
  }

  // --- Contact groups + contacts ---
  openAddContactGroup(): void {
    this.clearFormErrors();
    this.newGroupName = '';
    this.contactGroupDialogVisible = true;
  }
  saveContactGroup(): void {
    const name = this.newGroupName.trim();
    if (!name) return;
    this.dataService.addVendorContactGroup(this.id, name).subscribe({
      next: () => {
        this.contactGroupDialogVisible = false;
        this.showToast('Contact group added');
        this.loadContacts();
        this.loadAudit();
      },
      error: err => this.handleSaveError(err, 'Could not add contact group')
    });
  }

  openAddContact(groupId: number): void {
    this.clearFormErrors();
    this.editingContactId = null;
    this.contactDraft = { vendorContactGroupId: groupId, isPrimary: false };
    this.contactDialogVisible = true;
  }
  openEditContact(p: Person, groupId: number): void {
    this.clearFormErrors();
    this.editingContactId = p.id;
    this.contactDraft = {
      vendorContactGroupId: groupId, name: p.name, title: p.title, email: p.email, phone: p.phone, isPrimary: !!p.primary
    };
    this.contactDialogVisible = true;
  }
  saveContact(): void {
    if (!this.contactDraft.name?.trim()) return;

    const onSuccess = () => {
      this.contactDialogVisible = false;
      this.showToast(this.editingContactId ? 'Contact updated' : 'Contact added');
      this.loadContacts();
      this.loadAudit();
    };
    const onError = (err: any) => this.handleSaveError(err, this.editingContactId ? 'Could not update contact' : 'Could not add contact');

    if (this.editingContactId) {
      this.dataService.updateVendorContact(this.editingContactId, this.contactDraft).subscribe({ next: onSuccess, error: onError });
    } else {
      this.dataService.addVendorContact(this.id, this.contactDraft).subscribe({ next: onSuccess, error: onError });
    }
  }

  // --- Contracts ---
  openAddContract(): void {
    this.clearFormErrors();
    this.editingContractId = null;
    this.contractDraft = { status: 'draft' };
    this.contractDialogVisible = true;
  }
  openEditContract(c: Contract): void {
    this.clearFormErrors();
    this.editingContractId = c.id;
    this.contractDraft = {
      name: c.name, contractType: c.type, startDate: c.start === '—' ? undefined : c.start,
      endDate: c.end === '—' ? undefined : c.end, valueText: c.value === '—' ? undefined : c.value, status: c.status
    };
    this.contractDialogVisible = true;
  }
  saveContract(): void {
    if (!this.contractDraft.name?.trim()) return;

    const onSuccess = () => {
      this.contractDialogVisible = false;
      this.showToast(this.editingContractId ? 'Contract updated' : 'Contract added');
      this.loadContracts();
      this.loadAudit();
    };
    const onError = (err: any) => this.handleSaveError(err, this.editingContractId ? 'Could not update contract' : 'Could not add contract');

    if (this.editingContractId) {
      this.dataService.updateVendorContract(this.editingContractId, this.contractDraft).subscribe({ next: onSuccess, error: onError });
    } else {
      this.dataService.addVendorContract(this.id, this.contractDraft).subscribe({ next: onSuccess, error: onError });
    }
  }

  // --- Price lists ---
  openAddPriceList(): void {
    this.clearFormErrors();
    this.priceListDraft = { currency: 'USD', status: 'draft', skuCount: 0 };
    this.priceListDialogVisible = true;
  }
  savePriceList(): void {
    if (!this.priceListDraft.name?.trim()) return;
    this.dataService.addVendorPriceList(this.id, this.priceListDraft).subscribe({
      next: () => {
        this.priceListDialogVisible = false;
        this.showToast('Price list added');
        this.loadPriceLists();
        this.loadAudit();
      },
      error: err => this.handleSaveError(err, 'Could not add price list')
    });
  }

  // --- Uploaded files (contracts / price lists) ---
  private loadFiles(category: VendorFileCategory): void {
    this.dataService.getVendorFiles(this.id, category).subscribe({
      next: list => this.files[category] = list || [],
      error: () => this.showToast('Could not load files')
    });
  }

  uploadFiles(category: VendorFileCategory, input: HTMLInputElement): void {
    const picked = Array.from(input.files || []);
    input.value = ''; // allow re-selecting the same file later
    if (!picked.length) return;

    this.uploadingFiles[category] = true;
    this.dataService.uploadVendorFiles(this.id, category, picked).subscribe({
      next: res => {
        this.uploadingFiles[category] = false;
        const n = res?.uploaded?.length ?? picked.length;
        this.showToast(`${n} file${n === 1 ? '' : 's'} uploaded`);
        this.loadFiles(category);
        this.loadAudit();
      },
      error: () => {
        this.uploadingFiles[category] = false;
        this.showToast('Upload failed');
        this.loadFiles(category);
      }
    });
  }

  downloadFile(category: VendorFileCategory, f: VendorFileApi, ev?: Event): void {
    ev?.preventDefault();
    this.dataService.downloadVendorFile(this.id, category, f.fileName).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = f.fileName;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.showToast('Could not download file')
    });
  }

  deleteFile(category: VendorFileCategory, f: VendorFileApi): void {
    this.confirmationService.confirm({
      key: 'file-delete',
      header: 'Delete file',
      icon: 'pi pi-exclamation-triangle',
      message: `Delete "${f.fileName}"? This cannot be undone.`,
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => {
        this.dataService.deleteVendorFile(this.id, category, f.fileName).subscribe({
          next: () => {
            this.files[category] = this.files[category].filter(x => x.fileName !== f.fileName);
            this.showToast('File deleted');
            this.loadAudit();
          },
          error: () => this.showToast('Could not delete file')
        });
      }
    });
  }

  fileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  fileIcon(name: string): string {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return 'pi pi-file-pdf';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'pi pi-file-excel';
    if (['doc', 'docx'].includes(ext)) return 'pi pi-file-word';
    if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return 'pi pi-image';
    return 'pi pi-file';
  }

  // --- Policies ---
  openEditFreightPolicy(): void {
    this.clearFormErrors();
    this.freightDraft = { ...this.freightPolicy };
    this.freightDialogVisible = true;
  }
  saveFreightPolicy(): void {
    this.dataService.saveVendorFreightPolicy(this.id, this.freightDraft).subscribe({
      next: () => {
        this.freightPolicy = { ...this.freightDraft };
        this.freightDialogVisible = false;
        this.showToast('Freight policy saved');
        this.buildOverviewTiles();
        this.loadAudit();
      },
      error: err => this.handleSaveError(err, 'Could not save freight policy')
    });
  }

  openEditShippingPolicy(): void {
    this.clearFormErrors();
    this.shippingDraft = { ...this.shippingPolicy };
    this.shippingDialogVisible = true;
  }
  saveShippingPolicy(): void {
    this.dataService.saveVendorShippingPolicy(this.id, this.shippingDraft).subscribe({
      next: () => {
        this.shippingPolicy = { ...this.shippingDraft };
        this.shippingDialogVisible = false;
        this.showToast('Free shipping policy saved');
        this.buildOverviewTiles();
        this.loadAudit();
      },
      error: err => this.handleSaveError(err, 'Could not save shipping policy')
    });
  }

  openEditReturnPolicy(): void {
    this.clearFormErrors();
    this.returnDraft = { ...this.returnPolicy };
    this.returnDialogVisible = true;
  }
  saveReturnPolicy(): void {
    this.dataService.saveVendorReturnPolicy(this.id, this.returnDraft).subscribe({
      next: () => {
        this.returnPolicy = { ...this.returnDraft };
        this.returnDialogVisible = false;
        this.showToast('Return policy saved');
        this.buildOverviewTiles();
        this.loadAudit();
      },
      error: err => this.handleSaveError(err, 'Could not save return policy')
    });
  }



  // --- Custom fields ---
  openEditCustomFields(section: string): void {
    this.clearFormErrors();
    this.customFieldSection = section;
    this.customFieldDrafts = {};
    for (const f of this.customFor(section)) {
      this.customFieldDrafts[f.defId] = this.toDraftValue(f);
    }
    this.customFieldDialogVisible = true;
  }
  saveCustomFields(): void {
    const changed = this.customFor(this.customFieldSection)
      .map(f => ({ f, value: this.fromDraftValue(f, this.customFieldDrafts[f.defId]) }))
      .filter(x => x.value !== (x.f.value || null));

    if (!changed.length) {
      this.customFieldDialogVisible = false;
      return;
    }

    this.savingCustomFields = true;
    forkJoin(changed.map(x => this.dataService.saveVendorCustomFieldValue(this.id, x.f.defId, x.value))).subscribe({
      next: () => {
        this.savingCustomFields = false;
        this.customFieldDialogVisible = false;
        this.showToast('Custom fields saved');
        this.loadCustomFields();
        this.loadAudit();
      },
      error: err => {
        this.savingCustomFields = false;
        // some saves may have landed before the failure
        this.loadCustomFields();
        this.handleSaveError(err, 'Could not save custom fields');
      }
    });
  }

  private toDraftValue(f: CustomField): any {
    switch (f.type) {
      case 'Boolean': return f.value === 'true';
      case 'Number': return f.value === '' ? null : +f.value;
      default: return f.value;
    }
  }

  private fromDraftValue(f: CustomField, draft: any): string | null {
    if (f.type === 'Boolean') return draft ? 'true' : 'false';
    if (draft === null || draft === undefined) return null;
    const s = String(draft).trim();
    return s === '' ? null : s;
  }

  customDisplay(f: CustomField): string {
    if (!f.value) return '—';
    if (f.type === 'Boolean') return f.value === 'true' ? 'Yes' : 'No';
    return f.value;
  }

  customSectionLabel(section: string): string {
    return this.navSections.find(n => n.id === section)?.label || section;
  }

  // --- everything else is still a stub ---
  stub(msg = "This flow isn't wired up yet — stub"): void { this.showToast(msg); }
  showToast(msg: string): void {
    this.toastMsg = msg;
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => (this.toastMsg = ''), 2400);
  }

  // --- validation error handling (ASP.NET ValidationProblemDetails: { errors: { Field: [msg, ...] } }) ---
  clearFormErrors(): void {
    this.formErrors = {};
  }

  private handleSaveError(err: any, fallbackMsg: string): void {
    const apiErrors = err?.error?.errors;
    if (apiErrors && typeof apiErrors === 'object') {
      const parsed: { [field: string]: string } = {};
      for (const key of Object.keys(apiErrors)) {
        const messages = apiErrors[key];
        parsed[key.toLowerCase()] = Array.isArray(messages) ? messages[0] : String(messages);
      }
      this.formErrors = parsed;
      this.showToast('Please fix the highlighted fields');
    } else {
      this.formErrors = {};
      this.showToast(fallbackMsg);
    }
  }

  fieldError(field: string): string {
    return this.formErrors[field.toLowerCase()] || '';
  }

  // --- template helpers ---
  brand(i: number) { return this.brandColors[i % this.brandColors.length]; }

  initials(n: string): string {
    return n === 'System' ? 'SY' : (n || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }
  customFor(section: string): CustomField[] { return this.customFields.filter(f => f.section === section); }
  recent(): AuditEntry[] { return this.audit.slice(0, 3); }
  activeRebates(): Rebate[] { return this.rebates.filter(r => r.state === 'RUNNING'); }
  rebatesLinkedText(): string { return this.rebateLinked.map(v => `${v.vendorName} (${v.rail === 'PP' ? 'price protection' : 'instant rebates'})`).join(', '); }
  status(s: string) { return this.statusMap[s] || this.statusMap['draft']; }
  elig(e: string) { return this.eligMap[e] || this.eligMap['all']; }
  secColor(s: string) { return this.sectionColor[s] || { fg: this.P.sub, bg: '#eef1f5' }; }

  brandsText(): string {
    if (!this.brands.length) return '—';
    if (this.brands.length === 1) return this.brands[0];
    return `${this.brands.slice(0, -1).join(', ')} and ${this.brands[this.brands.length - 1]}`;
  }

  proSplitWidthPct(): number {
    const pro = this.terms.proDiscountPct || 0;
    const member = this.terms.memberDiscountPct || 0;
    const total = pro + member;
    return total > 0 ? Math.round((pro / total) * 100) : 50;
  }

  private dateOnly(iso?: string): string {
    return iso ? iso.slice(0, 10) : '—';
  }

  timeAgo(iso?: string): string {
    if (!iso) return '—';
    const diffMs = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diffMs / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return '1d ago';
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }

  private buildOverviewTiles(): void {
    const totalContacts = this.contacts.reduce((a, g) => a + g.people.length, 0);
    const primaryByGroup = this.contacts
      .map(g => ({ group: g.group, person: g.people.find(p => p.primary) || g.people[0] }))
      .filter(x => !!x.person);

    const activeContracts = this.contracts.filter(c => c.status === 'active');
    const expiringContracts = this.contracts.filter(c => c.status === 'expiring');

    const activeRebates = this.rebates.filter(r => r.state === 'RUNNING');
    const scheduledRebates = this.rebates.filter(r => r.state === 'UPCOMING');

    this.overviewTiles = [
      {
        id: 'terms', icon: 'pi pi-receipt', title: 'Terms & Financials', color: 0,
        lines: [
          [this.terms.paymentTerms, this.terms.earlyPayDiscountText].filter(Boolean).join(' · ') || 'Terms not set',
          `PRO ${this.terms.proDiscountPct ?? 0}% / Member ${this.terms.memberDiscountPct ?? 0}%`,
          [this.terms.fobPoint, this.terms.currency].filter(Boolean).join(' · ') || '—'
        ]
      },
      {
        id: 'contacts', icon: 'pi pi-users', title: 'Contacts', color: 1,
        lines: [
          `${totalContacts} people across ${this.contacts.length} roles`,
          ...primaryByGroup.slice(0, 2).map(x => `${x.group}: ${x.person.name}`)
        ]
      },
      {
        id: 'contracts', icon: 'pi pi-file', title: 'Contracts', color: 3,
        lines: [
          `${activeContracts.length} active · ${expiringContracts.length} expiring`,
          this.contracts[0] ? this.contracts[0].name : 'No contracts on file',
          expiringContracts[0] ? `${expiringContracts[0].name} renews soon` : ''
        ].filter(Boolean)
      },
      {
        id: 'pricelists', icon: 'pi pi-tags', title: 'Price Lists', color: 2,
        lines: [
          `${this.lists.length} lists`,
          this.lists[0] ? `${this.lists[0].name} effective ${this.lists[0].eff}` : 'No price lists on file'
        ]
      },
      {
        id: 'policies', icon: 'pi pi-truck', title: 'Policies', color: 0,
        lines: [
          this.shippingPolicy.freeFreightThreshold ? `Free freight over $${this.shippingPolicy.freeFreightThreshold}` : 'No free-freight threshold set',
          this.returnPolicy.returnWindowDays ? `Returns: ${this.returnPolicy.returnWindowDays}d · ${this.returnPolicy.restockingFeePct ?? 0}% restock` : 'No return policy set',
          this.returnPolicy.rmaRequired ? 'RMA required' : 'RMA not required'
        ]
      },
      {
        id: 'rebates', icon: 'pi pi-ticket', title: 'Instant Rebates', color: 1,
        lines: [
          `${activeRebates.length} running · ${scheduledRebates.length} starting later`,
          this.rebateSummary.liability ? `Liability ${this.rebateSummary.liability.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} not billed` : 'No liability',
          this.rebateLinked.length ? '' : 'Not linked to a rebate vendor'
        ].filter(Boolean)
      }
    ];
  }
}
