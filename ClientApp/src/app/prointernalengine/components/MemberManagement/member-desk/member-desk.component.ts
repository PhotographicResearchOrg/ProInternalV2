import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { DataService } from 'src/app/services/data.service';
import {
  AccessRule, DOCUMENT_TYPES, MEMBER_TYPES, MemberBrandExclusion, MemberDetail, MemberDocument, MemberGrant,
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
  readonly roleOptions = [{ label: 'None', value: null }, { label: 'Distributor', value: 'DISTRIBUTOR' }, { label: 'HQ', value: 'HQ' }];
  readonly paymentOptions = [
    { label: 'Terms (extended credit)', value: 0 },
    { label: 'Card only', value: 1 },
    { label: 'Terms or card', value: 2 }
  ];
  readonly defaultOptions = [{ label: 'Terms', value: 0 }, { label: 'Card', value: 1 }];
  readonly duesOptions = [{ label: 'Not set', value: null }, { label: 'Monthly', value: 'MONTHLY' }, { label: 'Annual', value: 'ANNUAL' }, { label: 'Prepaid', value: 'PREPAID' }, { label: 'Negotiated terms', value: 'TERMS' }];
  readonly rebateOptions = [{ label: 'Default for type', value: null }, { label: 'Eligible', value: 'ELIGIBLE' }, { label: 'Not eligible', value: 'NOT_ELIGIBLE' }];
  readonly payoutOptions = [{ label: 'Not set', value: null }, { label: 'ACH', value: 'ACH' }, { label: 'Check', value: 'CHECK' }];
  readonly centerOptions = [{ label: 'Default for country', value: null }, { label: 'PA warehouse', value: 'PA' }, { label: 'Netherlands 3PL', value: 'NL' }];
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

  violation = { productCode: '', startDate: this.today(), penaltyDays: 30, note: '' };

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
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  // ------------------------------------------------------------ list
  onSearch(term: string): void { this.term = term; this.search$.next(term); }
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
      joinDate: this.dateOnly(h.joinDate), phone: h.phone, fax: h.fax, email: h.email, website: h.website,
      accountRole: h.accountRole ?? null, parentAccountNumber: h.parentAccountNumber ?? '', billToParent: h.billToParent,
      previousAccountNumber: h.previousAccountNumber ?? '',
      paymentMethod: h.paymentMethod ?? 1, defaultPaymentMethod: h.defaultPaymentMethod ?? null,
      paymentMethodReason: h.paymentMethodReason ?? '',
      priceCountry: h.priceCountry ?? this.isoGuess(h.country), currencyCode: h.currencyCode ?? 'USD',
      languageCode: h.languageCode ?? 'en', fulfillmentCenter: h.fulfillmentCenter ?? null,
      markupExempt: h.markupExempt, markupExemptReason: h.markupExemptReason ?? '',
      duesFrequency: h.duesFrequency ?? null, instantRebateOverride: h.instantRebateOverride ?? null,
      patronagePayoutMethod: h.patronagePayoutMethod ?? null,
      creditLimit: h.creditLimit, creditHoldSince: this.dateOnly(h.creditHoldSince), creditHoldReason: h.creditHoldReason ?? '',
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
      joinDate: f.joinDate || null,
      creditHoldSince: f.creditHoldSince || null,
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
    this.data.uploadMemberDocument(this.detail.header.accountNumber, this.uploadFile, this.uploadType, this.uploadTitle, this.uploadExpires || null).subscribe({
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
    if (!this.detail || !this.violation.productCode.trim()) { this.warn('Enter a product code.'); return; }
    this.data.addMemberMapViolation(this.detail.header.accountNumber, {
      productCode: this.violation.productCode.trim(),
      startDate: this.violation.startDate,
      penaltyDays: this.violation.penaltyDays,
      note: this.violation.note || undefined
    }).subscribe({
      next: d => { this.setDetail(d); this.violation = { productCode: '', startDate: this.today(), penaltyDays: 30, note: '' }; this.ok('Violation recorded'); },
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
  private dateOnly(v?: string | null): string { return v ? v.substring(0, 10) : ''; }
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
