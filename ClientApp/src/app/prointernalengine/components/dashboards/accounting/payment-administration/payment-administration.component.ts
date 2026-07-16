import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ============================================================================
// MODELS (kept in this file — no separate service/model layer, per request)
// ============================================================================

export type PaymentRail = 'EZPay' | 'PromptPay' | 'Prepaid';
export type ScreenId =
  | 'dashboard' | 'members' | 'memberDetail'
  | 'ezpay' | 'promptpay'
  | 'runQueue' | 'runDetail'
  | 'recon' | 'reportPaths' | 'ccQueue' | 'schedule'
  | 'accounts' | 'customFields'
  | 'audit';

export interface StatCard { label: string; value: string; sub: string; alert?: boolean; target: ScreenId; }
export interface MemberGross { accountId: string; name: string; gross: number; proDiscount: number; ezpayDiscount: number; netNet: number; rail: PaymentRail; }
export interface InvoiceRow {
  invoiceId: string; accountId: string; vendor: string; postedDate: Date; gross: number;
  proDiscountPct: number | null; proDiscountAmt: number; ezpayDiscountPct: number | null; ezpayDiscountAmt: number;
  net: number; status: 'OnTerms' | 'Late' | 'Overdue' | 'Forfeited'; rail: PaymentRail;
}
export interface AccountSnapshot {
  lastRunDate: Date; lastRunAmount: number; lastRunStatus: 'Posted' | 'Exception';
  currentRunDate: Date; currentRunAmount: number; currentRunStatus: 'QueuedOpenRun' | 'NotQueued';
  overdueAmount: number; overdueInvoiceCount: number;
}
export interface AccountSetting { accountId: string; name: string; rail: PaymentRail; included: boolean; reason: string; }
export interface CustomFieldDef { id: string; fieldName: string; type: 'Text' | 'YesNo' | 'Number' | 'Dropdown' | 'Date'; appliesTo: 'Account' | 'Invoice' | 'BillRun'; defaultValue: string | null; required: boolean; }
export interface BillRunAccountGroup {
  accountId: string; name: string; rail: PaymentRail; invoiceCount: number;
  gross: number; proDiscount: number; ezpayDiscount: number; net: number; invoices: InvoiceRow[];
}
export interface BillRun {
  runId: string; billDate: Date; promptPayNet: number; ezpayNet: number; totalNet: number;
  status: 'OpenForEdit' | 'PendingApproval' | 'Submitted' | 'Reconciled' | 'HadExceptions';
  promptPayPaidDate: Date; ezpayPaidDate: Date;
  promptPayAccounts: BillRunAccountGroup[]; ezpayAccounts: BillRunAccountGroup[];
}
export interface RunExclusion { targetId: string; targetLabel: string; type: 'Account' | 'Invoice'; amount: number; reason: string; excludedBy: string; }
export interface ReconException { invoiceId: string; accountId: string; electedAmount: number; postedAmount: number; diff: number; reason: string; resolutionStatus: 'Open' | 'Resolved'; resolutionNote: string; }
export interface HistoryRunDetail { runId: string; skipped: { accountId: string; reason: string; amount: number }[]; sent: number; posted: number; exceptions: ReconException[]; }
export interface ReportPaths { sourceFolder: string; destinationFolder: string; consolidatedFolder: string; }
export interface AuditEntry { actor: string; message: string; timestamp: Date; category: 'Override' | 'BillRun' | 'Account' | 'Invoice' | 'System'; }
export interface PrepaidAccount { accountId: string; name: string; paymentMethod: 'CC' | 'ACH' | 'Check'; currentBalance: number; spentThisPeriod: number; ytdSpend: number; }
export interface ScheduleRule { id: string; label: string; cadence: string; runTime: string; mode: 'Manual' | 'Auto'; status: 'Active' | 'Scheduled'; }
export interface DrawCapInfo { dailyMax: number; usedToday: number; primaryAmount: number; primaryCount: number; overflowAmount: number; overflowCount: number; overflowDate: Date; }
export interface NachaSettings { companyId: string; secCode: 'CCD' | 'PPD'; destinationRouting: string; originatingDfiId: string; }

// ============================================================================
// COMPONENT
// ============================================================================

@Component({
  selector: 'app-payment-administration',
  templateUrl: './payment-administration.component.html',
  styleUrls: ['./payment-administration.component.scss']
})
export class PaymentAdministrationComponent {

  // ---- toast ----
  toastVisible = false;
  toastMessage = '';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  showToast(message: string): void {
    this.toastMessage = message;
    this.toastVisible = true;
    if (this.toastTimer) { clearTimeout(this.toastTimer); }
    this.toastTimer = setTimeout(() => { this.toastVisible = false; }, 2800);
  }

  // ---- nav ----
  currentScreen: ScreenId = 'dashboard';
  runQueueTab: 'open' | 'history' = 'open';
  runDetailTab: 'edit' | 'review' = 'edit';
  expanded = new Set<string>();

  go(screen: ScreenId): void { this.currentScreen = screen; window.scrollTo(0, 0); }
  toggleExpand(id: string): void { if (this.expanded.has(id)) { this.expanded.delete(id); } else { this.expanded.add(id); } }
  isExpanded(id: string): boolean { return this.expanded.has(id); }

  // ==========================================================================
  // DASHBOARD
  // ==========================================================================

  statCards: StatCard[] = [
    { label: 'Open EZPay', value: '$84,220', sub: '212 invoices · incl. 34 autopay', target: 'ezpay' },
    { label: 'Open Prompt Pay', value: '$41,960', sub: '96 invoices · mandatory', target: 'promptpay' },
    { label: 'Next Bill Run', value: 'Fri 07/17', sub: 'both rails', target: 'runQueue' },
    { label: 'Recon Exceptions', value: '3', sub: 'this run · kicked out', alert: true, target: 'recon' },
    { label: 'Run Awaiting Review', value: '07/17 Open', sub: 'not yet submitted', target: 'runQueue' },
  ];
  priorWeekCount = 47;
  autopayAccountCount = 34;
  autopayAmount = 18240.00;

  // ==========================================================================
  // MEMBER GROSS $
  // ==========================================================================

  memberGrossList: MemberGross[] = [
    { accountId: '3620', name: 'Michaels Camera Video', gross: 14220, proDiscount: 310, ezpayDiscount: 139.10, netNet: 13770.90, rail: 'EZPay' },
    { accountId: '3767', name: 'Dons Photo', gross: 9840, proDiscount: 0, ezpayDiscount: 98.40, netNet: 9741.60, rail: 'EZPay' },
    { accountId: '3739', name: 'Gosselin Photo Video', gross: 6105.50, proDiscount: 185, ezpayDiscount: 0, netNet: 5920.50, rail: 'PromptPay' },
  ];
  memberSearchTerm = '';
  get filteredMemberGross(): MemberGross[] {
    const t = this.memberSearchTerm.trim().toLowerCase();
    if (!t) { return this.memberGrossList; }
    return this.memberGrossList.filter(m => m.accountId.toLowerCase().includes(t) || m.name.toLowerCase().includes(t));
  }

  selectedMember: MemberGross | null = null;
  selectedMemberInvoices: InvoiceRow[] = [];
  selectedMemberSnapshot: AccountSnapshot | null = null;

  private invoicesByAccount: Record<string, InvoiceRow[]> = {
    '3620': [
      { invoiceId: '3620-88214', accountId: '3620', vendor: 'Sony', postedDate: new Date('2026-07-09'), gross: 3120, proDiscountPct: null, proDiscountAmt: 60, ezpayDiscountPct: 1, ezpayDiscountAmt: 30.60, net: 3029.40, status: 'OnTerms', rail: 'EZPay' },
      { invoiceId: '3620-88219', accountId: '3620', vendor: 'Panasonic', postedDate: new Date('2026-07-10'), gross: 5410, proDiscountPct: null, proDiscountAmt: 0, ezpayDiscountPct: 1, ezpayDiscountAmt: 54.10, net: 5355.90, status: 'OnTerms', rail: 'EZPay' },
      { invoiceId: '3620-88240', accountId: '3620', vendor: 'SmallRig', postedDate: new Date('2026-06-20'), gross: 640, proDiscountPct: null, proDiscountAmt: 0, ezpayDiscountPct: null, ezpayDiscountAmt: 0, net: 640, status: 'Overdue', rail: 'EZPay' },
    ],
    '3767': [
      { invoiceId: '3767-77021', accountId: '3767', vendor: 'Thypoch', postedDate: new Date('2026-07-10'), gross: 980, proDiscountPct: null, proDiscountAmt: 0, ezpayDiscountPct: 1, ezpayDiscountAmt: 9.80, net: 970.20, status: 'OnTerms', rail: 'EZPay' },
      { invoiceId: '3767-77030', accountId: '3767', vendor: 'Thypoch', postedDate: new Date('2026-07-11'), gross: 8860, proDiscountPct: null, proDiscountAmt: 0, ezpayDiscountPct: 1, ezpayDiscountAmt: 88.60, net: 8771.40, status: 'OnTerms', rail: 'EZPay' },
    ],
    '3739': [
      { invoiceId: '3739-90112', accountId: '3739', vendor: 'Sony Lenses', postedDate: new Date('2026-07-11'), gross: 3105.50, proDiscountPct: 6, proDiscountAmt: 186.33, ezpayDiscountPct: null, ezpayDiscountAmt: 0, net: 2919.17, status: 'OnTerms', rail: 'PromptPay' },
    ],
  };

  private snapshotsByAccount: Record<string, AccountSnapshot> = {
    '3620': { lastRunDate: new Date('2026-07-10'), lastRunAmount: 9410.20, lastRunStatus: 'Posted', currentRunDate: new Date('2026-07-17'), currentRunAmount: 13770.90, currentRunStatus: 'QueuedOpenRun', overdueAmount: 640, overdueInvoiceCount: 1 },
    '3767': { lastRunDate: new Date('2026-07-10'), lastRunAmount: 3200, lastRunStatus: 'Posted', currentRunDate: new Date('2026-07-17'), currentRunAmount: 9741.60, currentRunStatus: 'QueuedOpenRun', overdueAmount: 0, overdueInvoiceCount: 0 },
    '3739': { lastRunDate: new Date('2026-07-10'), lastRunAmount: 2800, lastRunStatus: 'Posted', currentRunDate: new Date('2026-07-17'), currentRunAmount: 2919.17, currentRunStatus: 'QueuedOpenRun', overdueAmount: 0, overdueInvoiceCount: 0 },
  };

  openMember(member: MemberGross): void {
    this.selectedMember = member;
    this.selectedMemberInvoices = this.invoicesByAccount[member.accountId] ?? [];
    this.selectedMemberSnapshot = this.snapshotsByAccount[member.accountId] ?? null;
    this.go('memberDetail');
  }

  // ==========================================================================
  // INVOICE DEEP DIVE
  // ==========================================================================

  invoiceModalVisible = false;
  activeInvoice: InvoiceRow | null = null;
  activeInvoiceAudit: AuditEntry[] = [];

  openInvoice(invoice: InvoiceRow): void {
    this.activeInvoice = invoice;
    this.activeInvoiceAudit = [
      { actor: 'M. Klass', message: 'Included in 07/17/2026 run', timestamp: new Date('2026-07-15T06:02:00'), category: 'BillRun' },
    ];
    this.invoiceModalVisible = true;
  }
  closeInvoiceModal(): void { this.invoiceModalVisible = false; this.activeInvoice = null; }
  emailInvoice(invoice: InvoiceRow | null): void {
    if (!invoice) { return; }
    this.showToast(`Invoice ${invoice.invoiceId} emailed to member contact.`);
    this.closeInvoiceModal();
  }

  // ==========================================================================
  // EZPAY / PROMPT PAY MANAGEMENT
  // ==========================================================================

  ezpayInvoices: InvoiceRow[] = [
    { invoiceId: '3620-88214', accountId: '3620', vendor: 'Sony', postedDate: new Date('2026-07-09'), gross: 3120, proDiscountPct: null, proDiscountAmt: 60, ezpayDiscountPct: 1, ezpayDiscountAmt: 30.60, net: 3029.40, status: 'OnTerms', rail: 'EZPay' },
    { invoiceId: '3767-77021', accountId: '3767', vendor: 'Thypoch', postedDate: new Date('2026-07-10'), gross: 980, proDiscountPct: null, proDiscountAmt: 0, ezpayDiscountPct: 1, ezpayDiscountAmt: 9.80, net: 970.20, status: 'OnTerms', rail: 'EZPay' },
    { invoiceId: '3620-88240', accountId: '3620', vendor: 'SmallRig', postedDate: new Date('2026-06-20'), gross: 640, proDiscountPct: null, proDiscountAmt: 0, ezpayDiscountPct: null, ezpayDiscountAmt: 0, net: 640, status: 'Late', rail: 'EZPay' },
  ];
  promptPayInvoices: InvoiceRow[] = [
    { invoiceId: '3739-90112', accountId: '3739', vendor: 'Sony Lenses', postedDate: new Date('2026-07-11'), gross: 3105.50, proDiscountPct: 6, proDiscountAmt: 186.33, ezpayDiscountPct: null, ezpayDiscountAmt: 0, net: 2919.17, status: 'OnTerms', rail: 'PromptPay' },
    { invoiceId: '8316-40021', accountId: '8316', vendor: 'Nanuk Cases', postedDate: new Date('2026-07-08'), gross: 990, proDiscountPct: null, proDiscountAmt: 0, ezpayDiscountPct: null, ezpayDiscountAmt: 0, net: 990, status: 'Forfeited', rail: 'PromptPay' },
  ];

  get ezpayTotals() {
    return {
      gross: this.ezpayInvoices.reduce((s, i) => s + i.gross, 0),
      proDisc: this.ezpayInvoices.reduce((s, i) => s + i.proDiscountAmt, 0),
      ezpayDisc: this.ezpayInvoices.reduce((s, i) => s + i.ezpayDiscountAmt, 0),
      net: this.ezpayInvoices.reduce((s, i) => s + i.net, 0),
    };
  }
  get promptPayTotals() {
    return {
      gross: this.promptPayInvoices.reduce((s, i) => s + i.gross, 0),
      proDisc: this.promptPayInvoices.reduce((s, i) => s + i.proDiscountAmt, 0),
      net: this.promptPayInvoices.reduce((s, i) => s + i.net, 0),
    };
  }

  exportRailReport(rail: PaymentRail, format: 'pdf' | 'excel'): void {
    this.showToast(`Exporting ${rail} report as ${format.toUpperCase()}…`);
  }

  // ==========================================================================
  // OVERRIDES
  // ==========================================================================

  overrideModalVisible = false;
  overrideTarget: { invoiceId: string; type: 'PRO Discount' | 'EZPay Discount'; currentValue: string } | null = null;
  overrideNewValue = '';
  overrideReason = '';

  openOverride(invoiceId: string, type: 'PRO Discount' | 'EZPay Discount', currentValue: string): void {
    this.overrideTarget = { invoiceId, type, currentValue };
    this.overrideNewValue = ''; this.overrideReason = '';
    this.overrideModalVisible = true;
  }
  saveOverride(): void {
    if (!this.overrideReason.trim()) { this.showToast('A reason is required for the audit log.'); return; }
    this.showToast(`${this.overrideTarget?.type} updated and logged to Audit.`);
    this.overrideModalVisible = false;
  }

  // ==========================================================================
  // BILL RUNS
  // ==========================================================================

  openRuns: BillRun[] = [{
    runId: 'R-20260717', billDate: new Date('2026-07-17'), promptPayNet: 41960, ezpayNet: 82072.55, totalNet: 124032.55,
    status: 'OpenForEdit', promptPayPaidDate: new Date('2026-07-17'), ezpayPaidDate: new Date('2026-07-17'),
    promptPayAccounts: [
      {
        accountId: '3739', name: 'Gosselin Photo', rail: 'PromptPay', invoiceCount: 1,
        gross: 3105.50, proDiscount: 186.33, ezpayDiscount: 0, net: 2919.17,
        invoices: [
          { invoiceId: '3739-90112', accountId: '3739', vendor: 'Sony Lenses', postedDate: new Date('2026-07-11'), gross: 3105.50, proDiscountPct: 6, proDiscountAmt: 186.33, ezpayDiscountPct: null, ezpayDiscountAmt: 0, net: 2919.17, status: 'OnTerms', rail: 'PromptPay' }
        ]
      },
      {
        accountId: '3774', name: 'McBain', rail: 'PromptPay', invoiceCount: 1,
        gross: 990, proDiscount: 0, ezpayDiscount: 0, net: 990,
        invoices: [
          { invoiceId: '3774-55310', accountId: '3774', vendor: 'Nanuk Cases', postedDate: new Date('2026-07-08'), gross: 990, proDiscountPct: null, proDiscountAmt: 0, ezpayDiscountPct: null, ezpayDiscountAmt: 0, net: 990, status: 'Forfeited', rail: 'PromptPay' }
        ]
      }
    ],
    ezpayAccounts: [
      {
        accountId: '3620', name: 'Michaels Camera', rail: 'EZPay', invoiceCount: 3,
        gross: 14220, proDiscount: 310, ezpayDiscount: 139.10, net: 13770.90,
        invoices: [
          { invoiceId: '3620-88214', accountId: '3620', vendor: 'Sony', postedDate: new Date('2026-07-09'), gross: 3120, proDiscountPct: null, proDiscountAmt: 60, ezpayDiscountPct: 1, ezpayDiscountAmt: 30.60, net: 3029.40, status: 'OnTerms', rail: 'EZPay' },
          { invoiceId: '3620-88219', accountId: '3620', vendor: 'Panasonic', postedDate: new Date('2026-07-10'), gross: 5410, proDiscountPct: null, proDiscountAmt: 0, ezpayDiscountPct: 1, ezpayDiscountAmt: 54.10, net: 5355.90, status: 'OnTerms', rail: 'EZPay' },
          { invoiceId: '3620-88240', accountId: '3620', vendor: 'SmallRig', postedDate: new Date('2026-06-20'), gross: 640, proDiscountPct: null, proDiscountAmt: 0, ezpayDiscountPct: null, ezpayDiscountAmt: 0, net: 640, status: 'Late', rail: 'EZPay' }
        ]
      },
      {
        accountId: '3767', name: 'Dons Photo', rail: 'EZPay', invoiceCount: 2,
        gross: 9840, proDiscount: 0, ezpayDiscount: 98.40, net: 9741.60,
        invoices: [
          { invoiceId: '3767-77021', accountId: '3767', vendor: 'Thypoch', postedDate: new Date('2026-07-10'), gross: 980, proDiscountPct: null, proDiscountAmt: 0, ezpayDiscountPct: 1, ezpayDiscountAmt: 9.80, net: 970.20, status: 'OnTerms', rail: 'EZPay' },
          { invoiceId: '3767-77030', accountId: '3767', vendor: 'Thypoch', postedDate: new Date('2026-07-11'), gross: 8860, proDiscountPct: null, proDiscountAmt: 0, ezpayDiscountPct: 1, ezpayDiscountAmt: 88.60, net: 8771.40, status: 'OnTerms', rail: 'EZPay' }
        ]
      }
    ]
  }];

  historyRuns: BillRun[] = [
    { runId: 'R-20260710', billDate: new Date('2026-07-10'), promptPayNet: 38110, ezpayNet: 80300.20, totalNet: 118410.20, status: 'Reconciled', promptPayPaidDate: new Date('2026-07-10'), ezpayPaidDate: new Date('2026-07-10'), promptPayAccounts: [], ezpayAccounts: [] },
    { runId: 'R-20260703', billDate: new Date('2026-07-03'), promptPayNet: 29884, ezpayNet: 60120, totalNet: 90004, status: 'HadExceptions', promptPayPaidDate: new Date('2026-07-03'), ezpayPaidDate: new Date('2026-07-03'), promptPayAccounts: [], ezpayAccounts: [] },
  ];

  private historyDetail: Record<string, HistoryRunDetail> = {
    'R-20260710': {
      runId: 'R-20260710',
      skipped: [{ accountId: '8442', reason: 'Vacation hold — member requested', amount: 610 }],
      sent: 291, posted: 291, exceptions: []
    },
    'R-20260703': {
      runId: 'R-20260703',
      skipped: [{ accountId: '7987', reason: 'Disputed invoice — held for review', amount: 1240 }],
      sent: 204, posted: 201,
      exceptions: [
        { invoiceId: '7340-51120', accountId: '7340', electedAmount: 318, postedAmount: 0, diff: 318, reason: 'Amount mismatch', resolutionStatus: 'Resolved', resolutionNote: 'Reprocessed 07/05 — posted correctly' },
        { invoiceId: '6210-44018', accountId: '6210', electedAmount: 540, postedAmount: 0, diff: 540, reason: 'Duplicate receipt #', resolutionStatus: 'Resolved', resolutionNote: 'Duplicate voided, resubmitted 07/06' },
        { invoiceId: '9100-30044', accountId: '9100', electedAmount: 382, postedAmount: 0, diff: 382, reason: 'Account not found (dest.)', resolutionStatus: 'Open', resolutionNote: 'Awaiting Computyme account setup' },
      ]
    }
  };
  getHistoryDetail(run: BillRun): HistoryRunDetail | undefined { return this.historyDetail[run.runId]; }

  runQueueTabSet(tab: 'open' | 'history'): void { this.runQueueTab = tab; }

  buildNewRun(): void {
    if (this.openRuns[0]) { this.openRun(this.openRuns[0]); }
  }

  activeRun: BillRun | null = null;
  runAudit: AuditEntry[] = [];
  queueSearchTerm = '';

  openRun(run: BillRun): void {
    this.activeRun = run;
    this.runDetailTab = 'edit';
    this.runAudit = [{ actor: 'M. Klass', message: `Built run ${run.runId} — 308 records across both rails`, timestamp: new Date('2026-07-15T06:02:00'), category: 'BillRun' }];
    this.go('runDetail');
  }
  runDetailTabSet(tab: 'edit' | 'review'): void { this.runDetailTab = tab; }
  promptPayInvoiceCount(run: BillRun): number { return run.promptPayAccounts.reduce((s, a) => s + a.invoiceCount, 0); }
  ezpayInvoiceCount(run: BillRun): number { return run.ezpayAccounts.reduce((s, a) => s + a.invoiceCount, 0); }

  runBulkAction(rail: PaymentRail, action: string, scope?: { accountId?: string; invoiceId?: string }): void {
    this.showToast(action + ' — logged to Run Audit');
    this.runAudit.unshift({ actor: 'You', message: action, timestamp: new Date(), category: 'BillRun' });
  }

  setPaidDate(rail: PaymentRail, dateStr: string): void {
    if (!this.activeRun) { return; }
    const date = new Date(dateStr);
    if (rail === 'PromptPay') { this.activeRun.promptPayPaidDate = date; } else { this.activeRun.ezpayPaidDate = date; }
    this.showToast(`${rail} paid date set to ${date.toLocaleDateString()}.`);
  }

  submitRun(): void {
    this.showToast('Run submitted to Computyme — reconciliation pending.');
    this.go('recon');
  }

  // ---- Manage Queue (combined view of both rails on the current/first open run) ----
  get queueRun(): BillRun | null { return this.activeRun ?? this.openRuns[0] ?? null; }
  get queueAccounts(): BillRunAccountGroup[] {
    const run = this.queueRun;
    if (!run) { return []; }
    const all = [...run.promptPayAccounts, ...run.ezpayAccounts];
    const t = this.queueSearchTerm.trim().toLowerCase();
    if (!t) { return all; }
    return all.filter(a => a.accountId.toLowerCase().includes(t) || a.name.toLowerCase().includes(t));
  }
  queueSelected = new Set<string>();
  toggleQueueSelect(accountId: string): void { if (this.queueSelected.has(accountId)) { this.queueSelected.delete(accountId); } else { this.queueSelected.add(accountId); } }
  toggleQueueSelectAll(checked: boolean): void {
    this.queueSelected.clear();
    if (checked) { this.queueAccounts.forEach(a => this.queueSelected.add(a.accountId)); }
  }

  // ---- skip / exclude ----
  skipModalVisible = false;
  skipScope: 'account' | 'invoice' = 'account';
  skipReason = '';
  runExclusions: RunExclusion[] = [
    { targetId: '8442', targetLabel: '8442 — Regional Distributor', type: 'Account', amount: 610, reason: 'Vacation hold — member requested', excludedBy: 'M. Klass' },
    { targetId: '3620-88240', targetLabel: '3620-88240', type: 'Invoice', amount: 640, reason: 'Disputed amount — held for review', excludedBy: 'M. Klass' },
  ];
  openSkip(scope: 'account' | 'invoice', targetId?: string): void { this.skipScope = scope; this.skipReason = ''; this.skipModalVisible = true; }
  confirmSkip(): void {
    if (!this.skipReason.trim()) { this.showToast('A reason is required to remove from payment.'); return; }
    this.showToast((this.skipScope === 'invoice' ? 'Invoice removed from gross' : 'Account removed from payment') + ' — reason logged to Audit.');
    this.skipModalVisible = false;
  }
  includeInRun(exclusion: RunExclusion): void {
    this.runExclusions = this.runExclusions.filter(e => e.targetId !== exclusion.targetId);
    this.showToast(`${exclusion.targetLabel} re-included — logged to Audit.`);
  }

  // ---- add invoice to run ----
  addInvoiceModalVisible = false;
  addInvoiceSearchTerm = '';
  addInvoiceReason = '';
  addInvoiceSelectedIds = new Set<string>();
  toggleAddInvoiceSelect(id: string): void { if (this.addInvoiceSelectedIds.has(id)) { this.addInvoiceSelectedIds.delete(id); } else { this.addInvoiceSelectedIds.add(id); } }
  addInvoiceResults: InvoiceRow[] = [
    { invoiceId: '3774-55298', accountId: '3774', vendor: 'McBain', postedDate: new Date('2026-06-12'), gross: 412, proDiscountPct: null, proDiscountAmt: 0, ezpayDiscountPct: null, ezpayDiscountAmt: 0, net: 412, status: 'OnTerms', rail: 'PromptPay' },
    { invoiceId: '3620-88180', accountId: '3620', vendor: 'Michaels Camera', postedDate: new Date('2026-05-29'), gross: 1205, proDiscountPct: null, proDiscountAmt: 0, ezpayDiscountPct: null, ezpayDiscountAmt: 0, net: 1205, status: 'OnTerms', rail: 'EZPay' },
    { invoiceId: '3767-76988', accountId: '3767', vendor: 'Dons Photo', postedDate: new Date('2026-06-05'), gross: 318, proDiscountPct: null, proDiscountAmt: 0, ezpayDiscountPct: null, ezpayDiscountAmt: 0, net: 318, status: 'OnTerms', rail: 'EZPay' },
  ];
  openAddInvoice(): void { this.addInvoiceSearchTerm = ''; this.addInvoiceReason = ''; this.addInvoiceSelectedIds.clear(); this.addInvoiceModalVisible = true; }
  confirmAddInvoice(): void {
    if (!this.addInvoiceReason.trim()) { this.showToast('A reason is required to pull an invoice into this run.'); return; }
    this.showToast('Selected invoice(s) added to the run — logged to Audit.');
    this.addInvoiceModalVisible = false;
  }

  exportRunInvoices(run: BillRun, format: 'pdf' | 'excel'): void {
    this.showToast(`Exporting invoice detail for ${run.runId} as ${format.toUpperCase()}…`);
  }

  // ==========================================================================
  // RECONCILIATION
  // ==========================================================================

  reconAttempted = 124032.55;
  reconPosted = 122415.05;
  reconExceptions: ReconException[] = [
    { invoiceId: '3739-90099', accountId: '3739', electedAmount: 412, postedAmount: 0, diff: 412, reason: 'Account not found (dest.)', resolutionStatus: 'Open', resolutionNote: '' },
    { invoiceId: '8316-40018', accountId: '8316', electedAmount: 1205.50, postedAmount: 0, diff: 1205.50, reason: 'Duplicate receipt #', resolutionStatus: 'Open', resolutionNote: '' },
  ];
  reprocess(exception: ReconException): void {
    this.reconExceptions = this.reconExceptions.filter(e => e.invoiceId !== exception.invoiceId);
    this.showToast(`${exception.invoiceId} resent to Computyme.`);
  }
  downloadReconReport(kind: 'source' | 'destination' | 'consolidated'): void {
    this.showToast(`Downloading ${kind} recon report…`);
  }

  // ==========================================================================
  // REPORT OUTPUT LOCATIONS
  // ==========================================================================

  reportPaths: ReportPaths = {
    sourceFolder: '\\\\proserver\\payments\\recon\\source\\',
    destinationFolder: '\\\\proserver\\payments\\recon\\destination\\',
    consolidatedFolder: '\\\\proserver\\payments\\recon\\consolidated\\'
  };
  saveReportPaths(): void { this.showToast('Report output locations updated.'); }

  drawCapDailyMax = 1000000.00;
  saveDrawCap(): void { this.showToast('Daily draw cap updated.'); }

  nachaSettings: NachaSettings = { companyId: '', secCode: 'CCD', destinationRouting: '', originatingDfiId: '' };
  saveNachaSettings(): void { this.showToast('NACHA settings saved.'); }

  // ==========================================================================
  // DRAW CAP (shown on Bill Run Review)
  // ==========================================================================

  getDrawCapInfo(run: BillRun): DrawCapInfo {
    const usedToday = run.totalNet;
    const overflow = Math.max(0, usedToday - this.drawCapDailyMax);
    const primary = usedToday - overflow;
    const nextBizDay = new Date(run.billDate);
    nextBizDay.setDate(nextBizDay.getDate() + 3); // demo: Fri -> Mon-ish placeholder
    return {
      dailyMax: this.drawCapDailyMax,
      usedToday,
      primaryAmount: primary,
      primaryCount: overflow > 0 ? 0 : this.promptPayInvoiceCount(run) + this.ezpayInvoiceCount(run),
      overflowAmount: overflow,
      overflowCount: overflow > 0 ? this.promptPayInvoiceCount(run) + this.ezpayInvoiceCount(run) : 0,
      overflowDate: nextBizDay
    };
  }

  downloadAchFile(kind: 'primary' | 'secondary'): void {
    this.showToast(`Downloading ${kind === 'primary' ? 'NACHA draw file (dummy account data)' : 'secondary overflow NACHA file'}…`);
  }

  // ==========================================================================
  // PREPAID & CC
  // ==========================================================================

  prepaidAccounts: PrepaidAccount[] = [
    { accountId: '8316', name: 'Foto Electronica', paymentMethod: 'ACH', currentBalance: 4210.00, spentThisPeriod: 1890.00, ytdSpend: 18340.00 },
    { accountId: '7889', name: 'PhotoSource', paymentMethod: 'CC', currentBalance: 980.00, spentThisPeriod: 3120.00, ytdSpend: 26050.00 },
  ];
  addPrepaidAccount(): void { this.showToast('Add Prepaid Account — form placeholder'); }
  fundPrepaidBalance(account: PrepaidAccount): void { this.showToast(`Fund Balance — placeholder action for ${account.name}.`); }

  ccQueue: { account: string; amount: number; requested: Date; status: string }[] = [
    { account: '3620 — Michaels Camera', amount: 3088.80, requested: new Date('2026-07-12'), status: 'Awaiting Capture' },
  ];

  // ==========================================================================
  // PAYMENT SCHEDULE
  // ==========================================================================

  scheduleRules: ScheduleRule[] = [
    { id: 'sr1', label: 'Standard weekly run', cadence: 'Every Friday', runTime: '2:00 PM', mode: 'Manual', status: 'Active' },
    { id: 'sr2', label: "Holiday auto-run — Christmas week", cadence: '12/25/2026', runTime: '9:00 AM', mode: 'Auto', status: 'Scheduled' },
    { id: 'sr3', label: "Holiday auto-run — New Year's", cadence: '01/01/2027', runTime: '9:00 AM', mode: 'Auto', status: 'Scheduled' },
  ];
  newRuleDate = '';
  newRuleTime = '09:00';
  newRuleMode: 'Manual' | 'Auto' = 'Manual';
  saveScheduleRule(): void {
    if (!this.newRuleDate) { this.showToast('Pick a date for the new rule.'); return; }
    this.scheduleRules.push({
      id: 'sr' + (this.scheduleRules.length + 1),
      label: 'New rule', cadence: this.newRuleDate, runTime: this.newRuleTime,
      mode: this.newRuleMode, status: this.newRuleMode === 'Auto' ? 'Scheduled' : 'Active'
    });
    this.showToast('Schedule rule saved.');
    this.newRuleDate = '';
  }

  // ==========================================================================
  // ACCOUNT SETTINGS
  // ==========================================================================

  accountSettings: AccountSetting[] = [
    { accountId: '7889', name: 'PhotoSource', rail: 'PromptPay', included: false, reason: 'Excluded — separate email flow' },
    { accountId: '8442', name: 'Regional Distributor', rail: 'EZPay', included: true, reason: 'Standard EZPay enrollment' },
    { accountId: '3620', name: 'Michaels Camera', rail: 'EZPay', included: true, reason: 'Standard' },
    { accountId: '3739', name: 'Gosselin Photo', rail: 'PromptPay', included: true, reason: 'Standard' },
  ];
  saveAccountSetting(setting: AccountSetting): void { this.showToast(`${setting.name} updated.`); }

  // ==========================================================================
  // CUSTOM FIELDS
  // ==========================================================================

  customFieldTab: 'Account' | 'Invoice' | 'BillRun' = 'Account';
  customFields: CustomFieldDef[] = [
    { id: 'cf1', fieldName: 'CC-on-file', type: 'YesNo', appliesTo: 'Account', defaultValue: 'No', required: false },
    { id: 'cf2', fieldName: 'Payment Contact Email', type: 'Text', appliesTo: 'Account', defaultValue: null, required: true },
  ];
  get filteredCustomFields(): CustomFieldDef[] { return this.customFields.filter(f => f.appliesTo === this.customFieldTab); }

  // ==========================================================================
  // AUDIT FEED
  // ==========================================================================

  auditFilter: 'All' | 'Override' | 'BillRun' | 'Account' | 'Invoice' = 'All';
  auditFeed: AuditEntry[] = [
    { actor: 'M. Klass', message: 'Submitted run 07/10/2026 to Computyme — $118,410.20 total', timestamp: new Date('2026-07-10T14:03:00'), category: 'BillRun' },
    { actor: 'M. Klass', message: 'Overrode PRO Discount on 8316-40021 — 0% → 3%', timestamp: new Date('2026-07-10T11:22:00'), category: 'Override' },
    { actor: 'M. Klass', message: 'Included in 07/17/2026 run', timestamp: new Date('2026-07-15T06:02:00'), category: 'BillRun' },
    { actor: 'M. Klass', message: 'Emailed invoice 3620-88214', timestamp: new Date('2026-07-09T15:10:00'), category: 'Invoice' },
  ];
  get filteredAuditFeed(): AuditEntry[] { return this.auditFilter === 'All' ? this.auditFeed : this.auditFeed.filter(a => a.category === this.auditFilter); }

  // ==========================================================================
  // MODAL CLOSE
  // ==========================================================================

  closeModal(which: 'override' | 'invoice' | 'skip' | 'addInvoice'): void {
    if (which === 'override') { this.overrideModalVisible = false; }
    if (which === 'invoice') { this.closeInvoiceModal(); }
    if (which === 'skip') { this.skipModalVisible = false; }
    if (which === 'addInvoice') { this.addInvoiceModalVisible = false; }
  }
}
