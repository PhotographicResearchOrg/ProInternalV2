import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { DataService } from 'src/app/services/data.service';
import * as XLSX from 'xlsx';
import { HomePin, stablePin } from 'src/app/services/home-pin.service';
import {
  AccessRule, DOCUMENT_TYPES, MEMBER_TYPES, MemberBrandExclusion, MemberDetail, MemberDocument, MemberGrant, MemberLocation,
  MemberListItem, MemberMapViolation
} from 'src/app/models/member/member-desk.models';

/** Member Desk: /members (search) and /members/:accountNumber (one member). */
@Component({
  selector: 'app-member-desk',
  templateUrl: './member-desk.component.html',
  styleUrls: ['./member-desk.component.scss'],
  providers: [MessageService]
})
export class MemberDeskComponent implements OnInit, OnDestroy {
  readonly memberTypes = MEMBER_TYPES;
  readonly documentTypes = DOCUMENT_TYPES;
  readonly statusOptions = [{ label: 'Active', value: 'ACTIVE' }, { label: 'Inactive', value: 'INACTIVE' }];
  readonly roleOptions = [{ label: 'None', value: null }, { label: 'Distributor (bills child accounts)', value: 'DISTRIBUTOR' }, { label: 'HQ', value: 'HQ' }];
  readonly paymentOptions = [
    { label: 'Terms (extended credit)', value: 0 },
    { label: 'Card only', value: 1 },
    { label: 'Terms or card', value: 2 }
  ];
  readonly defaultOptions = [{ label: 'Terms', value: 0 }, { label: 'Card', value: 1 }];
  readonly duesOptions = [{ label: 'Not set', value: null }, { label: 'Monthly', value: 'MONTHLY' }, { label: 'Annual', value: 'ANNUAL' }, { label: 'Prepaid', value: 'PREPAID' }, { label: 'Negotiated terms', value: 'TERMS' }];
  readonly rebateOptions = [{ label: 'Standard rule', value: null }, { label: 'Always eligible', value: 'ELIGIBLE' }, { label: 'Never eligible', value: 'NOT_ELIGIBLE' }];
  readonly payoutOptions = [{ label: 'Not set', value: null }, { label: 'ACH', value: 'ACH' }, { label: 'Check', value: 'CHECK' }];
  readonly centerOptions = [{ label: 'By country (standard)', value: null }, { label: 'PA warehouse', value: 'PA' }, { label: 'Netherlands 3PL', value: 'NL' }];
  readonly currencyOptions = ['USD', 'CAD', 'EUR', 'GBP', 'AUD'].map(c => ({ label: c, value: c }));
  readonly languageOptions = [
    { label: 'English', value: 'en' }, { label: 'French (Canada)', value: 'fr-CA' }, { label: 'French', value: 'fr' },
    { label: 'German', value: 'de' }, { label: 'Spanish', value: 'es' }, { label: 'Italian', value: 'it' }, { label: 'Dutch', value: 'nl' }
  ];

  readonly tabs = [
    { key: 'profile', label: 'Profile', icon: 'pi pi-id-card' },
    { key: 'locations', label: 'Locations', icon: 'pi pi-map-marker' },
    { key: 'payment', label: 'Payment & Credit', icon: 'pi pi-credit-card' },
    { key: 'market', label: 'Market', icon: 'pi pi-globe' },
    { key: 'programs', label: 'Programs', icon: 'pi pi-percentage' },
    { key: 'access', label: 'Access', icon: 'pi pi-shield' },
    { key: 'documents', label: 'Documents', icon: 'pi pi-file' },
    { key: 'map', label: 'MAP', icon: 'pi pi-flag' },
    { key: 'related', label: 'Related', icon: 'pi pi-sitemap' },
    { key: 'history', label: 'History', icon: 'pi pi-history' }
  ];

  // list mode
  accountNumber: string | null = null;
  typeFilter: 0 | 1 | 2 | 3 = 0;
  statusFilter: 'ALL' | 'HOLD' = 'ALL';
  /** OnWeb = 0 means no longer with PRO: hidden and left out of the counts unless switched on. */
  showInactive = false;
  term = '';
  results: MemberListItem[] = [];
  searching = false;
  private search$ = new Subject<string>();

  // detail mode
  tab = 'profile';
  detail: MemberDetail | null = null;
  form: any = null;
  loading = false;
  saving = false;
  activeRules: AccessRule[] = [];

  brands: { brandId: number; brandName: string }[] = [];
  blockBrandId: number | null = null;

  grantCode: string | null = null;
  grantReason = '';

  uploadFile: File | null = null;
  uploadType = 'RESALE_CERT';
  uploadTitle = '';
  uploadExpires = '';
  uploading = false;

  violation = { productCode: '', startDate: this.usDate(this.today()), penaltyDays: 30, note: '' };

  // MAP product look-up
  productTerm = '';
  productResults: { productCode: string; modelName: string; brandName: string }[] = [];
  productPicked: { productCode: string; modelName: string; brandName: string } | null = null;
  private product$ = new Subject<string>();

  // Locations filters
  locationType = 'ALL';
  locationSearch = '';
  showInactiveLocations = false;

  exporting = false;

  /** One reason modal for revoke / reject / end penalty / remove document. */
  reasonModal: {
    eyebrow: string; title: string; subtitle: string; warning: string; label: string;
    confirmLabel: string; danger: boolean; required: boolean; note: string; touched: boolean;
    action: (note: string) => void;
  } | null = null;

  private subs = new Subscription();

  constructor(
    private data: DataService,
    private route: ActivatedRoute,
    private router: Router,
    private messages: MessageService
  ) {}

  ngOnInit(): void {
    this.subs.add(this.search$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(t => { this.searching = true; return this.data.memberSearch(t); })
    ).subscribe({
      next: r => { this.results = r; this.searching = false; },
      error: e => { this.searching = false; this.fail(e); }
    }));

    this.subs.add(this.route.paramMap.subscribe(p => {
      this.accountNumber = p.get('accountNumber');
      if (this.accountNumber) {
        this.tab = 'profile';
        this.load();
      } else {
        this.detail = null;
        this.search$.next(this.term);
      }
    }));

    this.data.accessRules().subscribe({ next: r => this.activeRules = r.filter(x => x.status === 'ACTIVE'), error: () => {} });
    this.data.memberBrands().subscribe({ next: b => this.brands = b, error: () => {} });

    this.subs.add(this.product$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(t => this.data.memberProductLookup(t))
    ).subscribe({ next: r => this.productResults = r, error: () => this.productResults = [] }));
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  // ------------------------------------------------------------ list
  onSearch(term: string): void { this.term = term; this.search$.next(term); }
  /** "Pin to home": the member on screen, else the desk */
  get homePin(): HomePin {
    const h = this.detail?.header;
    if (this.accountNumber && h?.name) {
      return stablePin({ id: `member:${h.accountNumber}`, label: h.name, sub: `Member Desk · ${h.accountNumber}`, icon: 'pi pi-id-card', route: `/members/${h.accountNumber}` });
    }
    return stablePin({ id: 'members', label: 'Member Desk', sub: 'Account Management', icon: 'pi pi-id-card', route: '/members' });
  }

  open(m: MemberListItem): void { this.router.navigate(['/members', m.accountNumber]); }
  back(): void { this.router.navigate(['/members']); }

  get filtered(): MemberListItem[] {
    return this.visible.filter(m =>
      (!this.typeFilter || m.memberType === this.typeFilter) &&
      (this.statusFilter === 'ALL' || m.onCreditHold));
  }
  private get visible(): MemberListItem[] { return this.showInactive ? this.results : this.results.filter(m => m.status !== 'INACTIVE'); }
  get inactiveCount(): number { return this.results.filter(m => m.status === 'INACTIVE').length; }
  countType(t: number): number { return t ? this.visible.filter(m => m.memberType === t).length : this.visible.length; }

  typeLabel(t?: number | null): string { return t ? (this.memberTypes[t] ?? `Type ${t}`) : '—'; }

  // ------------------------------------------------------------ detail
  load(): void {
    if (!this.accountNumber) return;
    this.loading = true;
    this.data.memberGet(this.accountNumber).subscribe({
      next: d => this.setDetail(d),
      error: e => { this.loading = false; this.fail(e); }
    });
  }

  private setDetail(d: MemberDetail): void {
    this.detail = d;
    const h = d.header;
    this.form = {
      name: h.name, legalName: h.legalName, status: h.status, portalEnabled: h.portalEnabled,
      joinDate: this.usDate(h.joinDate), phone: h.phone, fax: h.fax, email: h.email, website: h.website,
      accountRole: h.accountRole ?? null, parentAccountNumber: h.parentAccountNumber ?? '', billToParent: h.billToParent,
      previousAccountNumber: h.previousAccountNumber ?? '',
      paymentMethod: h.paymentMethod ?? 1, defaultPaymentMethod: h.defaultPaymentMethod ?? null,
      paymentMethodReason: h.paymentMethodReason ?? '',
      priceCountry: h.priceCountry ?? this.isoGuess(h.country), currencyCode: h.currencyCode ?? 'USD',
      languageCode: h.languageCode ?? 'en', fulfillmentCenter: h.fulfillmentCenter ?? null,
      markupExempt: h.markupExempt, markupExemptReason: h.markupExemptReason ?? '',
      duesFrequency: h.duesFrequency ?? null, instantRebateOverride: h.instantRebateOverride ?? null,
      patronagePayoutMethod: h.patronagePayoutMethod ?? null,
      creditLimit: h.creditLimit, creditHoldSince: this.usDate(h.creditHoldSince), creditHoldReason: h.creditHoldReason ?? '',
      ezPayAllowed: h.ezPayAllowed, duesEnrolled: h.duesEnrolled, shippingZone: h.shippingZone, airDuringPeak: h.airDuringPeak
    };
    this.loading = false;
  }

  tabCount(key: string): number | null {
    const d = this.detail;
    if (!d) return null;
    switch (key) {
      case 'locations': return d.locations.length;
      case 'access': return d.brandExclusions.length;
      case 'documents': return d.documents.length;
      case 'map': return d.mapViolations.filter(v => v.isActive).length;
      case 'related': return d.related.length;
      default: return null;
    }
  }
  get visibleTabs() { return this.tabs.filter(t => t.key !== 'related' || !!this.detail?.related.length); }
  get pendingDocuments(): number { return this.detail?.documents.filter(d => d.reviewStatus === 'PENDING').length ?? 0; }
  get expiredDocuments(): number { return this.detail?.documents.filter(d => this.expired(d)).length ?? 0; }
  get activeViolations(): number { return this.detail?.mapViolations.filter(v => v.isActive).length ?? 0; }
  paymentLabel(v?: number | null): string { return this.paymentOptions.find(o => o.value === v)?.label ?? '—'; }

  /** Computyme owns these fields until cutover (Member:SqlIsMaster). */
  get locked(): boolean { return !this.detail?.header.sqlIsMaster; }

  get defaultCenter(): string {
    const c = (this.form?.priceCountry || 'US').toUpperCase();
    return ['US', 'CA'].includes(c) ? 'PA' : 'NL';
  }

  save(): void {
    if (!this.detail || !this.form) return;
    const f = this.form;
    const body = {
      ...f,
      portalEnabled: f.status === 'ACTIVE',
      parentAccountNumber: f.parentAccountNumber || null,
      previousAccountNumber: f.previousAccountNumber || null,
      priceCountry: f.priceCountry ? String(f.priceCountry).toUpperCase() : null,
      joinDate: this.isoDate(f.joinDate),
      creditHoldSince: this.isoDate(f.creditHoldSince),
      accountRole: this.showBilling ? f.accountRole : null,
      defaultPaymentMethod: f.paymentMethod === 2 ? f.defaultPaymentMethod : null,
      paymentMethodReason: f.paymentMethod === 1 ? (f.paymentMethodReason || null) : null,
      markupExemptReason: f.markupExempt ? f.markupExemptReason : null
    };
    this.saving = true;
    this.data.memberSave(this.detail.header.accountNumber, body).subscribe({
      next: d => { this.saving = false; this.setDetail(d); this.ok('Saved'); },
      error: e => { this.saving = false; this.fail(e); }
    });
  }

  // ------------------------------------------------------------ access
  addGrant(): void {
    if (!this.detail || !this.grantCode || this.grantReason.trim().length < 3) {
      this.warn('Choose a rule and give a reason.');
      return;
    }
    this.data.grantMemberAccess(this.detail.header.accountNumber, this.grantCode, this.grantReason.trim()).subscribe({
      next: d => { this.setDetail(d); this.grantCode = null; this.grantReason = ''; this.ok('Grant added'); },
      error: e => this.fail(e)
    });
  }

  revoke(g: MemberGrant): void {
    this.askReason({
      eyebrow: 'Access', title: `Revoke ${g.name}`, subtitle: `Account ${this.detail?.header.accountNumber}`,
      warning: 'The rule applies to this member again straight away.', label: 'Note (optional)',
      confirmLabel: 'Revoke grant', danger: true, required: false,
      action: () => this.data.revokeMemberAccess(g.memberAuthorizationId).subscribe({ next: () => { this.load(); this.ok('Grant revoked'); }, error: e => this.fail(e) })
    });
  }

  /** Lift every block on this brand: rule blocks get a grant (reason kept), hand-set blocks are removed. */
  allowBrand(x: MemberBrandExclusion): void {
    const name = x.brandName || 'Brand ' + x.brandId;
    const byRule = x.source === 'RULE';
    this.askReason({
      eyebrow: 'Access', title: `Allow ${name}`, subtitle: `Account ${this.detail?.header.accountNumber}`,
      warning: byRule
        ? `Blocked by rule ${x.ruleCodes}. This member gets a grant and can buy ${name} straight away; the rule still applies to everyone else.`
        : `This block was set by hand. Removing it lets the member buy ${name} straight away.`,
      label: 'Why is this member allowed? (kept in the access history)',
      confirmLabel: `Allow ${name}`, danger: false, required: true,
      action: note => this.data.allowMemberBrand(this.detail!.header.accountNumber, x.brandId, note || null).subscribe({
        next: d => { this.setDetail(d); this.ok(`${name} allowed`); },
        error: e => this.fail(e)
      })
    });
  }

  blockBrand(): void {
    if (!this.detail || !this.blockBrandId) { this.warn('Choose a brand.'); return; }
    const brandId = this.blockBrandId;
    const name = this.brands.find(b => b.brandId === brandId)?.brandName ?? 'Brand';
    this.askReason({
      eyebrow: 'Access', title: `Block ${name}`, subtitle: `Account ${this.detail.header.accountNumber}`,
      warning: `This member can no longer buy ${name}. The block stays until someone allows it again.`,
      label: 'Why is it blocked? (kept in the access history)',
      confirmLabel: `Block ${name}`, danger: true, required: true,
      action: note => this.data.blockMemberBrand(this.detail!.header.accountNumber, brandId, note).subscribe({
        next: d => { this.setDetail(d); this.blockBrandId = null; this.ok(`${name} blocked`); },
        error: e => this.fail(e)
      })
    });
  }

  readonly logLabels: { [k: string]: { text: string; css: string } } = {
    BRAND_BLOCK:        { text: 'Blocked',          css: 'status-hold' },
    BRAND_UNBLOCK:      { text: 'Unblocked',        css: 'status-ready' },
    GRANT_ADD:          { text: 'Exemption granted', css: 'status-ready' },
    GRANT_REVOKE:       { text: 'Exemption revoked', css: 'status-exception' },
    RULE_BLOCK_ADDED:   { text: 'Rule blocked',     css: 'status-progress' },
    RULE_BLOCK_REMOVED: { text: 'Rule lifted',      css: 'status-progress' },
    RULE_SAVE:          { text: 'Rule changed',     css: 'status-violet' },
    PROFILE_CHANGE:     { text: 'Changed',          css: '' }
  };
  logLabel(a: string) { return this.logLabels[a] ?? { text: a, css: '' }; }

  historyFilter: 'ALL' | 'ACCESS' | 'PROFILE' = 'ALL';
  get history() {
    const log = this.detail?.accessLog ?? [];
    if (this.historyFilter === 'PROFILE') return log.filter(h => h.action === 'PROFILE_CHANGE');
    if (this.historyFilter === 'ACCESS') return log.filter(h => h.action !== 'PROFILE_CHANGE');
    return log;
  }

  get blockableBrands() {
    const blocked = new Set((this.detail?.brandExclusions ?? []).map(x => x.brandId));
    return this.brands.filter(b => !blocked.has(b.brandId));
  }

  get ruleExclusions() { return this.detail?.brandExclusions.filter(x => x.source === 'RULE') ?? []; }
  get manualExclusions() { return this.detail?.brandExclusions.filter(x => x.source === 'MANUAL') ?? []; }
  get activeGrants() { return this.detail?.grants.filter(g => g.status === 'ACTIVE') ?? []; }
  get legacyGrants() { return this.detail?.grants.filter(g => g.status !== 'ACTIVE') ?? []; }

  // ------------------------------------------------------------ documents
  onFile(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    this.uploadFile = input.files && input.files.length ? input.files[0] : null;
  }

  upload(): void {
    if (!this.detail || !this.uploadFile) { this.warn('Choose a file.'); return; }
    this.uploading = true;
    this.data.uploadMemberDocument(this.detail.header.accountNumber, this.uploadFile, this.uploadType, this.uploadTitle, this.isoDate(this.uploadExpires)).subscribe({
      next: () => { this.uploading = false; this.uploadFile = null; this.uploadTitle = ''; this.uploadExpires = ''; this.load(); this.ok('Uploaded'); },
      error: e => { this.uploading = false; this.fail(e); }
    });
  }

  view(d: MemberDocument): void {
    this.data.memberDocumentUrl(d.documentId).subscribe({ next: r => window.open(r.url, '_blank'), error: e => this.fail(e) });
  }

  approve(d: MemberDocument): void {
    this.data.reviewMemberDocument(d.documentId, 'APPROVED', null).subscribe({ next: () => this.load(), error: e => this.fail(e) });
  }

  reject(d: MemberDocument): void {
    this.askReason({
      eyebrow: 'Documents', title: 'Reject document', subtitle: d.title || d.fileName,
      warning: 'Accounting will see the reason on the member.', label: 'Why is it rejected?',
      confirmLabel: 'Reject document', danger: true, required: true,
      action: note => this.data.reviewMemberDocument(d.documentId, 'REJECTED', note).subscribe({ next: () => this.load(), error: e => this.fail(e) })
    });
  }

  removeDocument(d: MemberDocument): void {
    this.askReason({
      eyebrow: 'Documents', title: 'Remove document', subtitle: d.title || d.fileName,
      warning: 'It comes off this member. The file is kept for the record.', label: 'Note (optional)',
      confirmLabel: 'Remove', danger: true, required: false,
      action: () => this.data.deleteMemberDocument(d.documentId).subscribe({ next: () => this.load(), error: e => this.fail(e) })
    });
  }

  docLabel(t: string): string { return this.documentTypes.find(x => x.value === t)?.label ?? t; }
  expired(d: MemberDocument): boolean { return !!d.expiresOn && d.expiresOn.substring(0, 10) < this.today(); }

  // ------------------------------------------------------------ MAP
  addViolation(): void {
    if (!this.detail || !this.violation.productCode.trim()) { this.warn('Find the product first.'); return; }
    this.data.addMemberMapViolation(this.detail.header.accountNumber, {
      productCode: this.violation.productCode.trim(),
      startDate: this.isoDate(this.violation.startDate) ?? this.today(),
      penaltyDays: this.violation.penaltyDays,
      note: this.violation.note || undefined
    }).subscribe({
      next: d => { this.setDetail(d); this.violation = { productCode: '', startDate: this.usDate(this.today()), penaltyDays: 30, note: '' }; this.clearProduct(); this.ok('Violation recorded'); },
      error: e => this.fail(e)
    });
  }

  endViolation(v: MemberMapViolation): void {
    this.askReason({
      eyebrow: 'MAP', title: `End penalty on ${v.productCode}`, subtitle: `Blocked until ${v.endDate?.substring(0, 10)}`,
      warning: 'The member can order this product again today.', label: 'Why is it ending early?',
      confirmLabel: 'End penalty', danger: false, required: true,
      action: note => this.data.endMemberMapViolation(v.violationId, this.today(), note).subscribe({ next: () => this.load(), error: e => this.fail(e) })
    });
  }

  onProductTerm(t: string): void {
    this.productTerm = t;
    this.productPicked = null;
    this.violation.productCode = '';
    if ((t || '').trim().length >= 2) this.product$.next(t.trim()); else this.productResults = [];
  }
  pickProduct(p: { productCode: string; modelName: string; brandName: string }): void {
    this.productPicked = p;
    this.violation.productCode = p.productCode;
    this.productTerm = p.productCode;
    this.productResults = [];
  }
  clearProduct(): void { this.productPicked = null; this.productTerm = ''; this.productResults = []; this.violation.productCode = ''; }

  // ------------------------------------------------------------ profile helpers
  /** Billing roll-up only matters for distributors and the accounts billed through them. */
  get showBilling(): boolean {
    const h = this.detail?.header;
    return !!h && (h.memberType === 2 || !!this.form?.accountRole || !!this.form?.parentAccountNumber || !!this.detail?.related.some(r => r.relation === 'CHILD'));
  }
  get isClient(): boolean { return this.detail?.header.memberType === 3; }

  // ------------------------------------------------------------ locations
  /** Computyme ship-to code: 00 = the default address in ARMST, 01+ = extra ship-tos from the mapping table. */
  shipToCode(l: MemberLocation): string | null {
    if (l.computymeShipTo !== null && l.computymeShipTo !== undefined) return String(l.computymeShipTo).padStart(2, '0');
    return l.isDefaultShipTo ? '00' : null;
  }
  get locationTypes(): { name: string; count: number }[] {
    const all = (this.detail?.locations ?? []).filter(l => this.showInactiveLocations || l.isActive);
    const m = new Map<string, number>();
    all.forEach(l => m.set(l.addressTypeName || 'Other', (m.get(l.addressTypeName || 'Other') ?? 0) + 1));
    return [{ name: 'ALL', count: all.length }, ...Array.from(m.entries()).sort().map(([name, count]) => ({ name, count }))];
  }
  get filteredLocations(): MemberLocation[] {
    const q = this.locationSearch.trim().toLowerCase();
    return (this.detail?.locations ?? [])
      .filter(l => this.showInactiveLocations || l.isActive)
      .filter(l => this.locationType === 'ALL' || (l.addressTypeName || 'Other') === this.locationType)
      .filter(l => !q || [l.companyName, l.address1, l.address2, l.city, l.state, l.zip, this.shipToCode(l)]
                          .some(v => (v || '').toString().toLowerCase().includes(q)));
  }
  get inactiveLocationCount(): number { return (this.detail?.locations ?? []).filter(l => !l.isActive).length; }
  /** Only shipping addresses go to Computyme as ship-tos; stores and private/user addresses never do. */
  isShipping(l: MemberLocation): boolean { return /ship/i.test(l.addressTypeName || ''); }
  /** An active shipping address with no row in AddressShipToMap (so no Computyme ship-to number). */
  needsMapping(l: MemberLocation): boolean { return l.isActive && !l.isBillTo && this.isShipping(l) && this.shipToCode(l) === null; }
  get unmappedCount(): number { return (this.detail?.locations ?? []).filter(l => this.needsMapping(l)).length; }

  // ------------------------------------------------------------ Excel downloads
  exportList(): void {
    this.exporting = true;
    const keep = new Set(this.filtered.map(m => m.accountNumber));
    this.data.memberExport().subscribe({
      next: rows => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, this.sheet(rows.filter(r => keep.has(String(r['Account'])))), 'Members');
        XLSX.writeFile(wb, `Members_${this.today()}.xlsx`);
        this.exporting = false;
      },
      error: e => { this.exporting = false; this.fail(e); }
    });
  }

  exportMember(): void {
    const d = this.detail;
    if (!d) return;
    const h = d.header;
    const profile: [string, any][] = [
      ['Account', h.accountNumber], ['Name', h.name], ['Legal name', h.legalName], ['Type', this.typeLabel(h.memberType)],
      ['Role', h.accountRole], ['Status', h.status === 'ACTIVE' ? 'Active' : 'Inactive'], ['Join date', this.dateOnly(h.joinDate)],
      ['Phone', h.phone], ['Fax', h.fax], ['Email', h.email], ['Website', h.website],
      ['Bill-to', [h.address1, h.address2, h.city, h.state, h.zip, h.country].filter(x => !!x).join(', ')],
      ['Parent account', h.parentAccountNumber], ['Invoices to parent', h.billToParent ? 'Yes' : ''], ['Previous account', h.previousAccountNumber],
      ['Payment method', this.paymentLabel(h.paymentMethod)], ['Why card only', h.paymentMethodReason], ['Terms', h.terms],
      ['Credit limit', h.creditLimit], ['Credit hold since', this.dateOnly(h.creditHoldSince)], ['Credit hold reason', h.creditHoldReason],
      ['EZPay', h.ezPayAllowed ? 'Yes' : ''], ['Price country', h.priceCountry], ['Currency', h.currencyCode], ['Language', h.languageCode],
      ['Fulfillment center', h.fulfillmentCenter ?? 'By country'], ['Shipping zone', h.shippingZone], ['Air during peak', h.airDuringPeak ? 'Yes' : ''],
      ['Client markup exempt', h.markupExempt ? 'Yes' : ''], ['Markup exempt reason', h.markupExemptReason],
      ['Dues', h.duesFrequency], ['Instant rebates', h.instantRebateOverride ?? 'Standard rule'], ['Patronage payout', h.patronagePayoutMethod],
      ['Custom catalog', h.hasCustomCatalog ? 'Yes' : ''], ['Created', this.dateOnly(h.enterDate)], ['Updated', h.updateDate], ['Updated by', h.updatedBy]
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Field', 'Value'], ...profile]), 'Profile');
    XLSX.utils.book_append_sheet(wb, this.sheet(d.locations.map(l => ({
      'Ship-to': this.shipToCode(l) ?? '', 'Type': l.addressTypeName, 'Name': l.companyName, 'Address': l.address1, 'Address 2': l.address2,
      'City': l.city, 'State': l.state, 'Zip': l.zip, 'Country': l.country, 'Bill-to': l.isBillTo ? 'Yes' : '', 'Active': l.isActive ? 'Yes' : 'No' }))), 'Locations');
    XLSX.utils.book_append_sheet(wb, this.sheet(d.contacts.map(c => ({ 'Role': c.role, 'First': c.firstName, 'Last': c.lastName, 'Email': c.email, 'Phone': c.phone }))), 'Contacts');
    XLSX.utils.book_append_sheet(wb, this.sheet(d.brandExclusions.map(x => ({ 'Brand': x.brandName, 'Source': x.source === 'RULE' ? 'Rule' : 'By hand', 'Rule': x.ruleCodes }))), 'Blocked brands');
    XLSX.utils.book_append_sheet(wb, this.sheet(d.grants.map(g => ({ 'Rule': g.code, 'Name': g.name, 'Status': g.status, 'Reason': g.reason, 'Granted by': g.grantedBy, 'Granted on': this.dateOnly(g.grantedOn) }))), 'Exemptions');
    XLSX.utils.book_append_sheet(wb, this.sheet(d.documents.map(x => ({ 'Type': this.docLabel(x.documentType), 'Title': x.title, 'File': x.fileName, 'Uploaded': this.dateOnly(x.uploadedAt), 'By': x.uploadedBy, 'Expires': this.dateOnly(x.expiresOn), 'Review': x.reviewStatus, 'Note': x.reviewNote }))), 'Documents');
    XLSX.utils.book_append_sheet(wb, this.sheet(d.mapViolations.map(v => ({ 'Product': v.productCode, 'Model': v.modelName, 'Start': this.dateOnly(v.startDate), 'End': this.dateOnly(v.endDate), 'Days': v.penaltyDays, 'Active': v.isActive ? 'Yes' : '', 'Note': v.note, 'By': v.createdBy }))), 'MAP');
    XLSX.utils.book_append_sheet(wb, this.sheet((d.accessLog ?? []).map(x => ({ 'When (UTC)': x.loggedAt, 'What': this.logLabel(x.action).text, 'Brand': x.brandName, 'Rule': x.ruleCode, 'Detail': x.detail, 'Who': x.changedBy }))), 'History');
    XLSX.writeFile(wb, `Member_${h.accountNumber}_${this.today()}.xlsx`);
  }

  exportLocations(): void {
    const d = this.detail;
    if (!d) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, this.sheet(this.filteredLocations.map(l => ({
      'Ship-to': this.shipToCode(l) ?? '', 'Type': l.addressTypeName, 'Name': l.companyName, 'Address': l.address1, 'Address 2': l.address2,
      'City': l.city, 'State': l.state, 'Zip': l.zip, 'Country': l.country, 'Bill-to': l.isBillTo ? 'Yes' : '', 'Active': l.isActive ? 'Yes' : 'No' }))), 'Locations');
    XLSX.writeFile(wb, `Locations_${d.header.accountNumber}_${this.today()}.xlsx`);
  }

  /** Sheet with headers even when there are no rows. */
  private sheet(rows: { [k: string]: any }[]): XLSX.WorkSheet {
    return rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([['(none)']]);
  }

  // ------------------------------------------------------------ reason modal
  private askReason(m: Omit<NonNullable<MemberDeskComponent['reasonModal']>, 'note' | 'touched'>): void {
    this.reasonModal = { ...m, note: '', touched: false };
  }
  confirmReason(): void {
    const m = this.reasonModal;
    if (!m) return;
    m.touched = true;
    if (m.required && m.note.trim().length < 3) return;
    this.reasonModal = null;
    m.action(m.note.trim());
  }

  // ------------------------------------------------------------ helpers
  today(): string { return new Date().toISOString().substring(0, 10); }
  dateOnly(v?: string | null): string { return v ? v.substring(0, 10) : ''; }
  /** ISO (yyyy-mm-dd...) -> mm/dd/yyyy for the date pickers. */
  usDate(v?: string | null): string { return v ? `${v.substring(5, 7)}/${v.substring(8, 10)}/${v.substring(0, 4)}` : ''; }
  /** mm/dd/yyyy from a date picker -> yyyy-mm-dd for the API; null when empty or unreadable. */
  isoDate(v?: string | null): string | null {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((v || '').trim());
    return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
  }
  private isoGuess(country?: string): string {
    const c = (country || '').trim().toUpperCase();
    if (['US', 'USA', 'U.S.A', 'UNITED STATES', 'UNITED STATES OF AMERICA', 'ESTADOS UNIDOS'].includes(c)) return 'US';
    if (['CA', 'CANADA'].includes(c)) return 'CA';
    if (['UK', 'GB', 'ENGLAND', 'UNITED KINGDOM'].includes(c)) return 'GB';
    if (['AU', 'AUSTRALIA'].includes(c)) return 'AU';
    return c.length === 2 ? c : 'US';
  }
  private ok(summary: string): void { this.messages.add({ severity: 'success', summary, life: 2500 }); }
  private warn(summary: string): void { this.messages.add({ severity: 'warn', summary, life: 4000 }); }
  private fail(e: HttpErrorResponse): void {
    const detail = e?.error?.message ?? e?.message ?? 'Something went wrong';
    this.messages.add({ severity: 'error', summary: 'Not saved', detail, life: 6000 });
  }
}
