// ============================================================================
// PAYMENT ADMINISTRATION — SHARED MODELS (v2 — matches approved skeleton)
// ============================================================================

export type PaymentRail = 'EZPay' | 'PromptPay';

export type ScreenId =
  | 'dashboard' | 'members' | 'memberDetail'
  | 'ezpay' | 'promptpay'
  | 'runQueue' | 'runDetail'
  | 'recon' | 'reportPaths' | 'ccQueue'
  | 'accounts' | 'customFields'
  | 'audit';

export interface StatCard {
  label: string;
  value: string;
  sub: string;
  alert?: boolean;
  target: ScreenId;
}

export interface MemberGross {
  accountId: string;
  name: string;
  gross: number;
  proDiscount: number;
  ezpayDiscount: number;
  netNet: number;
  rail: PaymentRail;
}

export interface InvoiceRow {
  invoiceId: string;
  accountId: string;
  vendor: string;
  postedDate: Date;
  gross: number;
  proDiscountPct: number | null;
  proDiscountAmt: number;
  ezpayDiscountPct: number | null; // null = not applicable / not eligible
  ezpayDiscountAmt: number;
  net: number;
  status: 'OnTerms' | 'Late' | 'Overdue' | 'Forfeited';
  rail: PaymentRail;
}

export interface AccountSnapshot {
  lastRunDate: Date;
  lastRunAmount: number;
  lastRunStatus: 'Posted' | 'Exception';
  currentRunDate: Date;
  currentRunAmount: number;
  currentRunStatus: 'QueuedOpenRun' | 'NotQueued';
  overdueAmount: number;
  overdueInvoiceCount: number;
}

export interface AccountSetting {
  accountId: string;
  name: string;
  rail: PaymentRail;
  included: boolean;
  reason: string;
}

export interface CustomFieldDef {
  id: string;
  fieldName: string;
  type: 'Text' | 'YesNo' | 'Number' | 'Dropdown' | 'Date';
  appliesTo: 'Account' | 'Invoice' | 'BillRun';
  defaultValue: string | null;
  required: boolean;
}

export interface PaymentOverride {
  invoiceId: string;
  overrideType: 'PRO Discount' | 'EZPay Discount';
  originalValue: string;
  overrideValue: string;
  reason: string;
}

export interface BillRunAccountGroup {
  accountId: string;
  name: string;
  rail: PaymentRail;
  invoiceCount: number;
  gross: number;
  proDiscount: number;
  ezpayDiscount: number;
  net: number;
  invoices: InvoiceRow[];
}

export interface BillRun {
  runId: string;
  billDate: Date;
  promptPayNet: number;
  ezpayNet: number;
  totalNet: number;
  status: 'OpenForEdit' | 'PendingApproval' | 'Submitted' | 'Reconciled' | 'HadExceptions';
  promptPayPaidDate: Date;
  ezpayPaidDate: Date;
  promptPayAccounts: BillRunAccountGroup[];
  ezpayAccounts: BillRunAccountGroup[];
}

export interface RunExclusion {
  targetId: string;    // accountId or invoiceId
  targetLabel: string;
  type: 'Account' | 'Invoice';
  amount: number;
  reason: string;
  excludedBy: string;
}

export interface HistoryRunDetail {
  runId: string;
  billDate: Date;
  totalNet: number;
  status: BillRun['status'];
  skipped: { accountId: string; reason: string; amount: number }[];
  sent: number;
  posted: number;
  exceptions: ReconException[];
}

export interface ReconException {
  invoiceId: string;
  accountId: string;
  electedAmount: number;
  postedAmount: number;
  diff: number;
  reason: string;
  resolutionStatus: 'Open' | 'Resolved';
  resolutionNote: string;
}

export interface ReportPaths {
  sourceFolder: string;
  destinationFolder: string;
  consolidatedFolder: string;
}

export interface AuditEntry {
  actor: string;
  message: string;
  timestamp: Date;
  category: 'Override' | 'BillRun' | 'Account' | 'Invoice' | 'System';
}
