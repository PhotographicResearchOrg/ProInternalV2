import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { DataService } from 'src/app/services/data.service';
import { AccessRule, AccessRuleMember, MEMBER_TYPES, SEGMENT_LABELS } from 'src/app/models/member/member-desk.models';

/** /members/access-rules: every brand access rule written out, with who it affects. */
@Component({
  selector: 'app-access-rules',
  templateUrl: './access-rules.component.html',
  styleUrls: ['./member-desk.component.scss'],
  providers: [MessageService]
})
export class AccessRulesComponent implements OnInit {
  readonly segmentLabels = SEGMENT_LABELS;
  readonly statusOptions = ['ACTIVE', 'LEGACY', 'RETIRED'].map(v => ({ label: v, value: v }));
  readonly reviewOptions = [{ label: 'Needs review', value: 'NEEDS_REVIEW' }, { label: 'Reviewed', value: 'REVIEWED' }];
  readonly segmentOptions = Object.keys(SEGMENT_LABELS).map(k => ({ label: SEGMENT_LABELS[k], value: k }));
  readonly typeOptions = [1, 2, 3].map(t => ({ label: MEMBER_TYPES[t], value: String(t) }));

  rules: AccessRule[] = [];
  loading = false;
  filter: 'ALL' | 'ACTIVE' | 'NEEDS_REVIEW' | 'LEGACY' = 'ACTIVE';

  editing: AccessRule | null = null;
  editingTypes: string[] = [];
  saving = false;

  membersOf: AccessRule | null = null;
  members: AccessRuleMember[] = [];

  constructor(private data: DataService, private messages: MessageService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.data.accessRules().subscribe({
      next: r => { this.rules = r; this.loading = false; },
      error: e => { this.loading = false; this.fail(e); }
    });
  }

  get shown(): AccessRule[] {
    switch (this.filter) {
      case 'ACTIVE': return this.rules.filter(r => r.status === 'ACTIVE');
      case 'NEEDS_REVIEW': return this.rules.filter(r => r.reviewStatus === 'NEEDS_REVIEW');
      case 'LEGACY': return this.rules.filter(r => r.status !== 'ACTIVE');
      default: return this.rules;
    }
  }

  get needsReview(): number { return this.rules.filter(r => r.reviewStatus === 'NEEDS_REVIEW').length; }
  get activeCount(): number { return this.rules.filter(r => r.status === 'ACTIVE').length; }
  get legacyCount(): number { return this.rules.filter(r => r.status !== 'ACTIVE').length; }
  get totalExcluded(): number { return this.rules.filter(r => r.status === 'ACTIVE').reduce((n, r) => n + (r.membersExcluded || 0), 0); }
  get totalGranted(): number { return this.rules.filter(r => r.status === 'ACTIVE').reduce((n, r) => n + (r.membersGranted || 0), 0); }

  hasType(t: string): boolean { return this.editingTypes.includes(t); }
  toggleType(t: string, on: boolean): void {
    this.editingTypes = on ? [...this.editingTypes.filter(x => x !== t), t] : this.editingTypes.filter(x => x !== t);
  }

  who(r: AccessRule): string {
    let s = r.segmentType === 'MEMBER_TYPE'
      ? (r.memberTypes || '').split(',').map(t => MEMBER_TYPES[+t] ?? t).join(', ')
      : SEGMENT_LABELS[r.segmentType];
    if (r.requiresCustomCatalog) s += ' with a custom catalog';
    if (r.requiresPortalEnabled) s += ' (active accounts)';
    return s;
  }

  edit(r: AccessRule): void {
    this.editing = { ...r };
    this.editingTypes = (r.memberTypes || '').split(',').filter(x => !!x);
  }

  create(): void {
    this.editing = {
      authorizationId: null, code: '', name: '', description: '', businessReason: '', status: 'ACTIVE',
      brandId: null, vendorId: null, unlocksAuthorizedPrice: false, segmentType: 'MEMBER_TYPE', memberTypes: '3',
      requiresCustomCatalog: false, requiresPortalEnabled: false, reviewStatus: 'NEEDS_REVIEW', reviewBy: null
    };
    this.editingTypes = ['3'];
  }

  save(): void {
    if (!this.editing) return;
    const r = this.editing;
    r.code = (r.code || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    r.memberTypes = r.segmentType === 'MEMBER_TYPE' ? this.editingTypes.sort().join(',') : null;
    if (r.segmentType === 'MEMBER_TYPE' && !r.memberTypes) { this.warn('Pick at least one member type.'); return; }
    if ((r.description || '').trim().length < 10) { this.warn('Describe the rule in plain English.'); return; }
    if ((r.businessReason || '').trim().length < 5) { this.warn('Say why the rule exists.'); return; }
    if (!r.brandId && !r.unlocksAuthorizedPrice && r.status === 'ACTIVE') { this.warn('An active rule needs a brand or a price unlock.'); return; }

    this.saving = true;
    this.data.saveAccessRule(r).subscribe({
      next: () => { this.saving = false; this.editing = null; this.ok('Rule saved and applied'); this.load(); },
      error: e => { this.saving = false; this.fail(e); }
    });
  }

  showMembers(r: AccessRule): void {
    this.membersOf = r;
    this.members = [];
    this.data.accessRuleMembers(r.code).subscribe({ next: m => this.members = m, error: e => this.fail(e) });
  }

  typeLabel(t?: number): string { return t ? (MEMBER_TYPES[t] ?? String(t)) : ''; }

  private ok(summary: string): void { this.messages.add({ severity: 'success', summary, life: 2500 }); }
  private warn(summary: string): void { this.messages.add({ severity: 'warn', summary, life: 4000 }); }
  private fail(e: HttpErrorResponse): void {
    this.messages.add({ severity: 'error', summary: 'Not saved', detail: e?.error?.message ?? e?.message, life: 6000 });
  }
}
