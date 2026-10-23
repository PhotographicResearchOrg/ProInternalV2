/* Credit Desk (api/creditdesk). Money in dollars. Limit, balance, aging, open orders and credit hold are Computyme's. */
export interface CreditMemberRow {
  accountNumber: string; name: string; memberType?: number | null; onWeb: boolean; inComputyme: boolean;
  limit?: number | null; balance?: number | null; pastDue?: number | null; days90?: number | null; openOrders?: number | null;
  vendorExposure: number; vendorBilled: number; available?: number | null; ytdSales?: number | null; highCredit?: number | null;
  onHold: boolean; limitSource: 'COMPUTYME' | 'SQL'; webOrders: number; webValue: number; heldOrders: number; heldValue: number;
  pendingVendorCredits: number; pendingVendorCreditCount: number; lastNoteAt?: string | null;
}
export interface CreditMemberList { members: CreditMemberRow[]; canOverride: boolean; sqlIsMaster: boolean; }

export interface CreditHeader {
  accountNumber: string; name: string; computymeName?: string | null; memberType?: number | null; onWeb: boolean;
  phone?: string | null; email?: string | null; inComputyme: boolean;
  limit?: number | null; computymeLimit?: number | null; sqlLimit?: number | null; limitSource: 'COMPUTYME' | 'SQL';
  balance?: number | null; currentDue?: number | null; days30?: number | null; days60?: number | null; days90?: number | null;
  pastDue?: number | null; openOrders?: number | null; vendorExposure: number; vendorBilled: number; available?: number | null;
  shippingSoon: number; openInvoices: number; allocated: number; ezPayInTransit: number; invoiceAvailable?: number | null;
  highCredit?: number | null; currentYearHigh?: number | null; ytdSales?: number | null; investment?: number | null;
  onHold: boolean; creditStatus?: string | null; computymeOnHold: boolean; sqlHoldSince?: string | null; sqlHoldReason?: string | null;
}
export interface CreditInvoice { invoiceKey: string; invoice: string; posted?: string | null; invoiceDate?: string | null; terms?: string | null; po?: string | null; vendorInvoice?: string | null; vendorName?: string | null; gross?: number | null; discountPct?: number | null; ageDays?: number | null; }
export interface CreditWebOrder { orderId: number; po?: string | null; entered: string; total?: number | null; lines: number; autoHold: boolean; holdOverride: boolean; held: boolean; orderedBy?: string | null; }
export interface CreditComputymeOrder { orderKey: string; po?: string | null; shipDate?: string | null; code?: string | null; webOrder?: string | null; total?: number | null; lines: number; shipsSoon: boolean; }
export interface CreditBackorder { backorderKey: string; po?: string | null; ordered?: string | null; shipDate?: string | null; productCode?: string | null; description?: string | null; quantity?: number | null; allocatedQty?: number | null; unitNet?: number | null; allocatedValue?: number | null; countsNow: boolean; }
export interface CreditVendorPo { vendorId?: string | null; vendorName?: string | null; po?: string | null; poDate?: string | null; amount?: number | null; billed?: number | null; net?: number | null; authorizationCode?: string | null; approvalId?: number | null; approvedOn?: string | null; }
export interface CreditVendorApproval { approvalId: number; requested: string; vendorId?: string | null; vendorName?: string | null; po?: string | null; amount: number; authorizationCode?: string | null; requestedBy?: string | null; declined: boolean; }
export interface CreditNote { id: number; kind: 'NOTE' | 'OVERRIDE' | 'REVIEWED'; orderId?: number | null; note: string; createdBy?: string | null; createdAt: string; }
export interface CreditMember {
  header: CreditHeader; invoices: CreditInvoice[]; webOrders: CreditWebOrder[]; computymeOrders: CreditComputymeOrder[];
  backorders: CreditBackorder[]; vendorPos: CreditVendorPo[]; vendorApprovals: CreditVendorApproval[]; notes: CreditNote[]; canOverride: boolean; sqlIsMaster: boolean;
}

/* Accounting desk: positive pay (api/creditdesk/positive-pay) */
export interface PositivePayTotals { weekStart: string; weekEnd: string; dueFriday: string; invoices: number; members: number; invoiced: number; paid: number; stillOwed: number; membersOwing: number; }
export interface PositivePayMember { accountNumber: string; name?: string | null; invoices: number; invoiced: number; paid: number; stillOwed: number; }
export interface PositivePay { totals?: PositivePayTotals | null; members: PositivePayMember[]; }
