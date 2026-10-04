// src/app/accountmanagement/vendor-card/vendor-card.component.ts
//
// Vendor management dashboard. Loads real data from api/VendorCard via
// DataService. Section nav, header toggles, and the Edit/Add flows below
// are wired to the CRUD endpoints; anything without a dialog here (e.g.
// contract/price-list edit, audit filter) still shows a stub() toast.

import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DataService } from 'src/app/services/data.service';
import {
  VendorTerms, VendorFreightPolicy, VendorShippingPolicy, VendorReturnPolicy, VendorStats,
  VendorContactApi, VendorContractApi, VendorPriceListApi, VendorRebateProgramApi
} from 'src/app/models/vendor/vendor-card.model';

interface NavItem { id: string; label: string; icon: string; }
interface Tile { id: string; icon: string; title: string; lines: string[]; color: number; }
interface Person { id: number; name: string; title: string; email: string; phone: string; primary?: boolean; }
interface ContactGroup { groupId: number; group: string; color: number; people: Person[]; }
interface Contract { id: number; name: string; type: string; start: string; end: string; value: string; status: string; }
interface PriceList { name: string; eff: string; exp: string; skus: number; status: string; cur: string; }
interface Rebate {
  id: string; name: string; code: string; amount: string; eligibility: string; scope: string;
  window: string; funding: string; claim: string; status: string; web: boolean;
  rebated: number; budget: number; redemptions: number; burn: number;
}
interface AuditEntry { who: string; when: string; section: string; field: string; from: string; to: string; currentSession: boolean; }
interface CustomField { defId: number; label: string; type: string; value: string; section: string; publishable: boolean; }

@Component({
  selector: 'app-vendor-card',
  templateUrl: './vendor-card.component.html',
  styleUrls: ['./vendor-card.component.scss']
})
export class VendorCardComponent implements OnInit {

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
    { id: 'terms', label: 'Terms & Financials', icon: 'pi pi-receipt' },
    { id: 'contacts', label: 'Contacts', icon: 'pi pi-users' },
    { id: 'contracts', label: 'Contracts', icon: 'pi pi-file' },
    { id: 'pricelists', label: 'Price Lists', icon: 'pi pi-tags' },
    { id: 'policies', label: 'Policies', icon: 'pi pi-truck' },
    { id: 'rebates', label: 'Instant Rebates', icon: 'pi pi-ticket' },
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
  audit: AuditEntry[] = [];
  customFields: CustomField[] = [];

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

  // ---- dialog state: Rebate ----
  rebateDialogVisible = false;
  rebateDraft: Partial<VendorRebateProgramApi> = {};
  editingRebateId: number | null = null;

  // ---- dialog state: Custom field values (one dialog per section card) ----
  // Fields themselves are defined on the Vendor Custom Fields page; this
  // only edits this vendor's values. Drafts are keyed by definition id.
  customFieldDialogVisible = false;
  customFieldSection = '';
  customFieldDrafts: { [defId: number]: any } = {};
  savingCustomFields = false;

  constructor(private dataService: DataService, private route: ActivatedRoute) { }

  ngOnInit(): void {
    const routeId = this.route.snapshot.paramMap.get('vendorId') || this.route.snapshot.queryParamMap.get('vendorId');
    if (routeId) this.vendorId = +routeId;

    if (!this.vendorId) {
      this.showToast('No vendor selected');
      return;
    }

    this.loadVendorCard();
  }

  private get id(): number {
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
        this.live = card.isActive;
        this.onWeb = card.onWeb;
        this.terms = card.terms || { vendorId: this.id };
        this.stats = card.stats || { activeContracts: 0, priceListCount: 0, contactCount: 0 };
        this.loading = false;
        this.buildOverviewTiles();
      },
      error: () => { this.loading = false; this.showToast('Failed to load vendor'); }
    });

    this.loadContacts();
    this.loadContracts();
    this.loadPriceLists();
    this.loadPolicies();
    this.loadRebates();
    this.loadAudit();
    this.loadCustomFields();
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

  private loadRebates(): void {
    this.dataService.getVendorRebatePrograms(this.id).subscribe(list => {
      this.rebates = (list || []).map(r => ({
        id: String(r.vendorRebateProgramId), name: r.name, code: r.code || '', amount: r.amountText || '',
        eligibility: r.eligibility, scope: r.scopeText || '', window: r.windowText || '', funding: r.funding || '',
        claim: r.claimMethod || '', status: r.status, web: r.isWebVisible,
        rebated: r.rebatedAmount, budget: r.budgetAmount, redemptions: r.redemptionCount,
        burn: r.budgetAmount > 0 ? Math.round((r.rebatedAmount / r.budgetAmount) * 100) : 0
      }));
      this.buildOverviewTiles();
    });
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

  // --- nav + toggles ---
  setSection(id: string): void { this.activeSection = id; }

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

  // --- Instant rebates ---
  openAddRebate(): void {
    this.clearFormErrors();
    this.editingRebateId = null;
    this.rebateDraft = { eligibility: 'all', status: 'draft', isWebVisible: false, budgetAmount: 0 };
    this.rebateDialogVisible = true;
  }
  openEditRebate(r: Rebate): void {
    this.clearFormErrors();
    this.editingRebateId = +r.id;
    this.rebateDraft = {
      name: r.name, code: r.code, amountText: r.amount, eligibility: r.eligibility,
      scopeText: r.scope, windowText: r.window, funding: r.funding, claimMethod: r.claim,
      status: r.status, isWebVisible: r.web, budgetAmount: r.budget
    };
    this.rebateDialogVisible = true;
  }
  saveRebate(): void {
    if (!this.rebateDraft.name?.trim()) return;

    const onSuccess = () => {
      this.rebateDialogVisible = false;
      this.showToast(this.editingRebateId ? 'Rebate updated' : 'Rebate created');
      this.loadRebates();
      this.loadAudit();
    };
    const onError = (err: any) => this.handleSaveError(err, 'Could not save rebate');

    if (this.editingRebateId) {
      this.dataService.updateVendorRebateProgram(this.editingRebateId, this.rebateDraft).subscribe({ next: onSuccess, error: onError });
    } else {
      this.dataService.addVendorRebateProgram(this.id, this.rebateDraft).subscribe({ next: onSuccess, error: onError });
    }
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
  activeRebates(): Rebate[] { return this.rebates.filter(r => r.status === 'active'); }
  openLiability(): number { return this.activeRebates().reduce((a, r) => a + (r.budget - r.rebated), 0); }
  totalRedemptions(): number { return this.rebates.reduce((a, r) => a + r.redemptions, 0); }
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

    const activeRebates = this.rebates.filter(r => r.status === 'active');
    const scheduledRebates = this.rebates.filter(r => r.status === 'scheduled');

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
          `${this.rebates.length} programs · ${activeRebates.length} active now`,
          activeRebates[0] ? `${activeRebates[0].name} ${activeRebates[0].amount} live` : 'No active programs',
          scheduledRebates[0] ? `${scheduledRebates[0].name} scheduled` : ''
        ].filter(Boolean)
      }
    ];
  }
}
