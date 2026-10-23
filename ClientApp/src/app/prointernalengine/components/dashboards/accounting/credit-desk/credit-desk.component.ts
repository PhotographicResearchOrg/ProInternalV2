import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import { DataService } from 'src/app/services/data.service';
import { AccountingService } from 'src/app/services/AccountingService';
import { HomePin, stablePin } from 'src/app/services/home-pin.service';
import { CreditComputymeOrder, CreditComputymeOrderLine, CreditMember, CreditMemberRow, CreditVendorApproval, CreditWebOrder } from 'src/app/models/accounting/credit-desk.models';

type ListFilter = 'held' | 'over' | 'pastdue' | 'hold' | 'credits' | 'all';
type Tab = 'orders' | 'invoices' | 'computyme' | 'backorders' | 'vendorpos' | 'credits' | 'notes';
type ApprovalWindow = 60 | 'all';
type ApprovalResult = 'all' | 'approved' | 'declined';
type ApprovalSort = 'requested' | 'member' | 'vendor' | 'po' | 'amount' | 'code' | 'result' | 'by';
export interface PostedInvoice { invoice: string; posted: string | null; }
export interface CmOrderStatus { label: string; css: string; detail?: string; }

/** Credit Desk: /credit (every member) and /credit?account=1747 (one member).
 *  Replaces old ProInternal /CreditApproval. Limit, balance, aging and credit hold are Computyme's (read only);
 *  releasing a held B2B order sets Orders.HoldOverride = 1 through the Order Toolbench's override. */
@Component({
  selector: 'app-credit-desk',
  templateUrl: './credit-desk.component.html',
  styleUrls: ['../../../MemberManagement/member-desk/member-desk.component.scss', './credit-desk.component.scss'],
  providers: [MessageService]
})
export class CreditDeskComponent implements OnInit, OnDestroy {
  private subs = new Subscription();

  // list
  members: CreditMemberRow[] = [];
  canOverride = false;
  /** member cutover switch (Member:SqlIsMaster): limit and credit hold are SQL's when true */
  sqlIsMaster = false;
  listLoading = false;
  filter: ListFilter = 'held';
  search = '';
  hideZero = true;

  // one member
  accountNumber: string | null = null;
  member: CreditMember | null = null;
  loading = false;
  tab: Tab = 'orders';
  noteText = '';
  savingNote = false;

  // vendor approvals (member tab and the all-members view): rolling 60 days unless "All"
  apWindow: ApprovalWindow = 60;
  apResult: ApprovalResult = 'all';
  apSearch = '';
  apSort: ApprovalSort = 'requested';
  apDesc = true;
  allApprovals: CreditVendorApproval[] = [];
  allApprovalsLoaded: ApprovalWindow | null = null;
  apLoading = false;

  // Computyme orders: which rows are open to show their lines
  expanded = new Set<string>();
  cmView: 'open' | 'billed' | 'all' = 'open';
  pdfLoading: string | null = null;

  // release modal
  release: { order: CreditWebOrder; reason: string; touched: boolean; saving: boolean } | null = null;

  constructor(private data: DataService, private accounting: AccountingService, private route: ActivatedRoute, public router: Router, private toast: MessageService) {}

  ngOnInit(): void {
    /* one route (/credit) so Security Admin needs just one entry; ?account=1747 opens a member */
    this.subs.add(this.route.queryParamMap.subscribe(p => {
      this.accountNumber = p.get('account');
      if (this.accountNumber) {
        const t = p.get('tab') as Tab | null;
        this.tab = t && this.tabs.some(x => x.key === t) ? t : 'orders';
        this.loadMember();
      } else {
        this.member = null;
        const f = p.get('filter') as ListFilter | null;
        if (f && ['held', 'over', 'pastdue', 'hold', 'credits', 'all'].includes(f)) this.filter = f;
        if (!this.members.length) this.loadList();
        if (this.filter === 'credits') this.loadAllApprovals();
      }
    }));
  }
  ngOnDestroy(): void { this.subs.unsubscribe(); }

  get homePin(): HomePin {
    const h = this.member?.header;
    if (this.accountNumber && h) {
      return stablePin({ id: `credit:${h.accountNumber}`, label: h.name, sub: `Credit Desk · ${h.accountNumber}`, icon: 'pi pi-shield', route: '/credit', query: { account: h.accountNumber } });
    }
    return stablePin({ id: 'credit', label: 'Credit Desk', sub: 'Accounting', icon: 'pi pi-shield', route: '/credit', query: this.filter !== 'held' ? { filter: this.filter } : undefined });
  }

  // ------------------------------------------------------------ list
  loadList(): void {
    this.listLoading = true;
    this.data.creditMembers().subscribe({
      next: r => { this.members = r?.members ?? []; this.canOverride = !!r?.canOverride; this.sqlIsMaster = !!r?.sqlIsMaster; this.listLoading = false; },
      error: e => { this.listLoading = false; this.fail(e, 'Could not load members'); }
    });
  }

  overLimit(m: { available?: number | null; limit?: number | null }): boolean { return m.available != null && m.limit != null && m.available < 0; }
  private matches(m: CreditMemberRow, f: ListFilter): boolean {
    switch (f) {
      case 'held': return m.heldOrders > 0;
      case 'over': return this.overLimit(m);
      case 'pastdue': return (m.pastDue ?? 0) > 0.5;
      case 'hold': return m.onHold;
      case 'credits': return m.pendingVendorCreditCount > 0;
      default: return true;
    }
  }
  count(f: ListFilter): number { return this.members.filter(m => this.matches(m, f)).length; }
  sum(f: ListFilter, key: 'heldValue' | 'pastDue' | 'pendingVendorCredits' | 'available'): number {
    return this.members.filter(m => this.matches(m, f)).reduce((a, m) => a + Math.abs(Number(m[key] ?? 0)), 0);
  }
  get shown(): CreditMemberRow[] {
    const q = this.search.trim().toLowerCase();
    return this.members
      .filter(m => this.matches(m, this.filter))
      .filter(m => this.filter !== 'all' || !this.hideZero || (m.balance ?? 0) !== 0 || m.webOrders > 0 || (m.openOrders ?? 0) !== 0)
      .filter(m => !q || (m.name || '').toLowerCase().includes(q) || m.accountNumber.includes(q));
  }
  setFilter(f: ListFilter): void {
    this.filter = f;
    if (f === 'credits') this.loadAllApprovals();
  }
  open(m: CreditMemberRow): void { this.router.navigate(['/credit'], { queryParams: { account: m.accountNumber } }); }
  back(): void { this.router.navigate(['/credit'], { queryParams: this.filter !== 'held' ? { filter: this.filter } : {} }); }

  // ------------------------------------------------------------ vendor approvals
  loadAllApprovals(force = false): void {
    if (!force && this.allApprovalsLoaded === this.apWindow) return;
    this.apLoading = true;
    const w = this.apWindow;
    this.data.creditVendorApprovals(w).subscribe({
      next: r => { this.allApprovals = r ?? []; this.allApprovalsLoaded = w; this.apLoading = false; },
      error: e => { this.apLoading = false; this.fail(e, 'Could not load vendor approvals'); }
    });
  }
  setWindow(w: ApprovalWindow): void {
    this.apWindow = w;
    if (!this.accountNumber) this.loadAllApprovals();
  }
  sortBy(k: ApprovalSort): void {
    if (this.apSort === k) this.apDesc = !this.apDesc;
    else { this.apSort = k; this.apDesc = k === 'requested' || k === 'amount'; }
  }
  sortIcon(k: ApprovalSort): string { return this.apSort !== k ? 'pi pi-sort-alt' : this.apDesc ? 'pi pi-sort-amount-down' : 'pi pi-sort-amount-up-alt'; }

  private inWindow(a: CreditVendorApproval): boolean {
    if (this.apWindow === 'all') return true;
    const cut = new Date(); cut.setHours(0, 0, 0, 0); cut.setDate(cut.getDate() - this.apWindow);
    return new Date(a.requested) >= cut;
  }
  private approvalFilter(rows: CreditVendorApproval[], windowed: boolean): CreditVendorApproval[] {
    const q = this.apSearch.trim().toLowerCase();
    const val = (a: CreditVendorApproval): any => {
      switch (this.apSort) {
        case 'member': return (a.memberName || a.accountNumber || '').toLowerCase();
        case 'vendor': return (a.vendorName || a.vendorId || '').toLowerCase();
        case 'po': return (a.po || '').toLowerCase();
        case 'amount': return a.amount ?? 0;
        case 'code': return a.declined ? '' : (a.authorizationCode || '').toLowerCase();
        case 'result': return a.declined ? 1 : 0;
        case 'by': return (a.requestedBy || '').toLowerCase();
        default: return new Date(a.requested).getTime();
      }
    };
    const dir = this.apDesc ? -1 : 1;
    return rows
      .filter(a => !windowed || this.inWindow(a))
      .filter(a => this.apResult === 'all' || (this.apResult === 'declined') === a.declined)
      .filter(a => !q || [a.accountNumber, a.memberName, a.vendorId, a.vendorName, a.po, a.authorizationCode, a.requestedBy]
        .some(x => (x || '').toString().toLowerCase().includes(q)))
      .sort((x, y) => { const a = val(x), b = val(y); return a < b ? -dir : a > b ? dir : 0; });
  }
  /** member tab: every approval came back, the window is applied here */
  get memberApprovals(): CreditVendorApproval[] { return this.approvalFilter(this.member?.vendorApprovals ?? [], true); }
  /** all-members view: the API already applied the window */
  get shownApprovals(): CreditVendorApproval[] { return this.approvalFilter(this.allApprovals, false); }
  approvalTotals(rows: CreditVendorApproval[]): { approved: number; approvedValue: number; declined: number } {
    return rows.reduce((t, a) => { if (a.declined) t.declined++; else { t.approved++; t.approvedValue += a.amount ?? 0; } return t; },
      { approved: 0, approvedValue: 0, declined: 0 });
  }
  get memberApprovalsInWindow(): number { return (this.member?.vendorApprovals ?? []).filter(a => this.inWindow(a)).length; }

  exportApprovals(rows: CreditVendorApproval[], name: string): void {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, this.sheet(this.approvalRows(rows)), 'Vendor approvals');
    XLSX.writeFile(wb, `VendorApprovals_${name}_${this.apWindow === 'all' ? 'all' : this.apWindow + 'd'}_${this.today()}.xlsx`);
  }
  private approvalRows(rows: CreditVendorApproval[]): { [k: string]: any }[] {
    return rows.map(a => ({
      'Requested': this.d(a.requested), 'Account': a.accountNumber ?? this.member?.header.accountNumber, 'Member': a.memberName ?? this.member?.header.name,
      'Vendor': a.vendorId, 'Vendor name': a.vendorName, 'PO': a.po, 'Amount': a.amount,
      'Auth code': a.declined ? '' : a.authorizationCode, 'Result': a.declined ? 'Declined' : 'Approved',
      'Vendor message': a.declined ? a.authorizationCode : '', 'Processed': a.processed ? 'Yes' : '', 'Requested by': a.requestedBy
    }));
  }

  // ------------------------------------------------------------ Computyme orders
  linesOf(o: CreditComputymeOrder): CreditComputymeOrderLine[] { return (this.member?.computymeOrderLines ?? []).filter(l => l.orderKey === o.orderKey); }
  toggle(o: CreditComputymeOrder): void { this.expanded.has(o.orderKey) ? this.expanded.delete(o.orderKey) : this.expanded.add(o.orderKey); }
  /** "123456:2026-10-14,123499:2026-10-20" → invoices with the date each was posted */
  invoicesOf(o: { invoices?: string | null }): PostedInvoice[] {
    const seen = new Set<string>();
    return (o.invoices || '').split(',').map(x => x.trim()).filter(x => !!x).map(x => {
      const [invoice, posted] = x.split(':');
      return { invoice: (invoice || '').trim(), posted: posted ? posted.trim() : null };
    }).filter(i => i.invoice && !seen.has(i.invoice) && !!seen.add(i.invoice));
  }
  invoiceText(o: { invoices?: string | null }): string {
    return this.invoicesOf(o).map(i => i.posted ? `${i.invoice} (posted ${i.posted})` : i.invoice).join(', ');
  }
  /** the B2B site's status (Retailer_GetSubmittedOrders): Processed = in Computyme, not invoiced;
   *  Complete W/ BO = invoiced with a backorder still open on the PO; Completed = invoiced (in ARHIST) */
  cmStatus(o: CreditComputymeOrder): CmOrderStatus {
    const lines = this.linesOf(o);
    const due = lines.filter(l => l.backordered && l.dueDate).map(l => new Date(l.dueDate as string).getTime());
    const nextDue = due.length ? new Date(Math.min(...due)) : null;
    const dueText = o.backorderedLines ? (nextDue ? `${o.backorderedLines} backordered · next due ${nextDue.toLocaleDateString()}` : `${o.backorderedLines} backordered · no due date`) : '';
    const billedOn = o.billedOn ? new Date(o.billedOn).toLocaleDateString() : '';
    const site = o.siteStatus || (o.billed ? 'Completed' : 'Processed');
    if (site === 'Complete W/ BO') return { label: 'Complete W/ BO', css: 'status-exception', detail: [billedOn && `posted ${billedOn}`, dueText].filter(x => !!x).join(' · ') || undefined };
    if (site === 'Completed') return { label: 'Completed', css: 'status-ready', detail: billedOn ? `posted ${billedOn}` : undefined };
    const ship = o.shipDate ? new Date(o.shipDate) : null;
    const shipText = o.shipsSoon ? 'ships within 5 days' : ship ? `ship date ${ship.toLocaleDateString()}` : '';
    return { label: 'Processed', css: 'status-progress', detail: [shipText, dueText].filter(x => !!x).join(' · ') || undefined };
  }
  get cmOpen(): CreditComputymeOrder[] { return (this.member?.computymeOrders ?? []).filter(o => !o.billed); }
  get cmBilled(): CreditComputymeOrder[] { return (this.member?.computymeOrders ?? []).filter(o => o.billed); }
  get cmShown(): CreditComputymeOrder[] {
    return this.cmView === 'open' ? this.cmOpen : this.cmView === 'billed' ? this.cmBilled : (this.member?.computymeOrders ?? []);
  }
  get backorderedOrders(): number { return (this.member?.computymeOrders ?? []).filter(o => o.backorderedLines > 0).length; }

  openInvoicePdf(invoice: string, ev?: Event): void {
    ev?.stopPropagation();
    if (!invoice || this.pdfLoading) return;
    this.pdfLoading = invoice;
    this.accounting.getInvoicePdf(invoice).subscribe({
      next: blob => {
        this.pdfLoading = null;
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        const w = window.open(url, '_blank');
        if (!w) {
          const a = document.createElement('a'); a.href = url; a.download = `${invoice}.pdf`; a.click();
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      },
      error: () => { this.pdfLoading = null; this.toast.add({ severity: 'warn', summary: 'No PDF on file', detail: `Invoice ${invoice} has no PDF yet. It can be rebuilt from Credits.` }); }
    });
  }

  // ------------------------------------------------------------ one member
  loadMember(): void {
    if (!this.accountNumber) return;
    this.loading = true;
    this.data.creditMember(this.accountNumber).subscribe({
      next: m => {
        this.member = m; this.canOverride = !!m?.canOverride; this.sqlIsMaster = !!m?.sqlIsMaster; this.loading = false;
        if (this.tab === 'orders' && !m.webOrders.length && m.invoices.length) this.tab = 'invoices';
      },
      error: e => { this.loading = false; this.member = null; this.fail(e, 'Could not load the member'); }
    });
  }

  readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'orders', label: 'B2B orders', icon: 'pi pi-shopping-cart' },
    { key: 'invoices', label: 'Open invoices', icon: 'pi pi-file' },
    { key: 'computyme', label: 'Orders in Computyme', icon: 'pi pi-box' },
    { key: 'backorders', label: 'Backorders', icon: 'pi pi-clock' },
    { key: 'vendorpos', label: 'Vendor POs', icon: 'pi pi-truck' },
    { key: 'credits', label: 'Vendor approvals', icon: 'pi pi-check-square' },
    { key: 'notes', label: 'Notes', icon: 'pi pi-comment' }
  ];
  tabCount(t: Tab): number {
    const m = this.member;
    if (!m) return 0;
    switch (t) {
      case 'orders': return m.webOrders.length;
      case 'invoices': return m.invoices.length;
      case 'computyme': return this.cmOpen.length;
      case 'backorders': return m.backorders.length;
      case 'vendorpos': return m.vendorPos.length;
      case 'credits': return this.memberApprovalsInWindow;
      default: return m.notes.length;
    }
  }
  get heldOrders(): CreditWebOrder[] { return (this.member?.webOrders ?? []).filter(o => o.held); }
  get invoiceTotal(): number { return (this.member?.invoices ?? []).reduce((a, i) => a + (i.gross ?? 0), 0); }

  askRelease(o: CreditWebOrder): void { this.release = { order: o, reason: '', touched: false, saving: false }; }
  confirmRelease(): void {
    const r = this.release, h = this.member?.header;
    if (!r || !h) return;
    r.touched = true;
    if (r.reason.trim().length < 3) return;
    r.saving = true;
    this.data.creditOverride(r.order.orderId, h.accountNumber, r.reason.trim()).subscribe({
      next: () => {
        this.release = null;
        this.toast.add({ severity: 'success', summary: 'Order released', detail: `Order ${r.order.orderId} is off hold and goes on with the next run.` });
        this.loadMember();
        const row = this.members.find(x => x.accountNumber === h.accountNumber);
        if (row) { row.heldOrders = Math.max(0, row.heldOrders - 1); row.heldValue = Math.max(0, row.heldValue - (r.order.total ?? 0)); }
      },
      error: e => { r.saving = false; this.fail(e, 'The order was not released'); }
    });
  }

  addNote(kind: 'NOTE' | 'REVIEWED' = 'NOTE'): void {
    const h = this.member?.header;
    const text = kind === 'REVIEWED' ? (this.noteText.trim() || 'Reviewed') : this.noteText.trim();
    if (!h || !text) return;
    this.savingNote = true;
    this.data.creditNote(h.accountNumber, text, kind).subscribe({
      next: () => { this.savingNote = false; this.noteText = ''; this.loadMember(); if (kind === 'REVIEWED') this.toast.add({ severity: 'success', summary: 'Marked reviewed' }); },
      error: e => { this.savingNote = false; this.fail(e, 'The note was not saved'); }
    });
  }

  // ------------------------------------------------------------ exports
  exportList(): void {
    const rows = this.shown.map(m => ({
      'Account': m.accountNumber, 'Member': m.name, 'Limit': m.limit, 'Balance': m.balance, 'Past due': m.pastDue, '90+ days': m.days90,
      'Open orders': m.openOrders, 'Vendor exposure': m.vendorExposure, 'Available': m.available, 'Over limit': this.overLimit(m) ? 'Yes' : '',
      'Credit hold': m.onHold ? 'Yes' : '', 'Limit from': m.limitSource === 'SQL' ? 'SQL' : 'Computyme', 'B2B orders': m.webOrders, 'Held orders': m.heldOrders, 'Held value': m.heldValue,
      'Vendor approvals (60d)': m.pendingVendorCreditCount, 'Approved value (60d)': m.pendingVendorCredits, 'Declined (60d)': m.declinedVendorCount, 'YTD sales': m.ytdSales, 'Last note': m.lastNoteAt ? new Date(m.lastNoteAt).toLocaleDateString() : ''
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, this.sheet(rows), 'Credit');
    XLSX.writeFile(wb, `Credit_${this.filter}_${this.today()}.xlsx`);
  }

  exportMember(): void {
    const m = this.member;
    if (!m) return;
    const h = m.header;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Account', h.accountNumber], ['Member', h.name], ['Credit hold', h.onHold ? 'Yes' : 'No'], ['Limit and hold from', h.limitSource === 'SQL' ? 'SQL (Member Desk)' : 'Computyme'],
      ['Limit', h.limit], ['Limit in Computyme', h.computymeLimit], ['Limit in SQL', h.sqlLimit], ['Balance', h.balance], ['Current', h.currentDue], ['30 days', h.days30], ['60 days', h.days60], ['90+ days', h.days90],
      ['Open orders (Computyme)', h.openOrders], ['Vendor exposure', h.vendorExposure], ['Vendor billed', h.vendorBilled], ['Available', h.available],
      ['Shipping in 5 days', h.shippingSoon], ['Open invoices', h.openInvoices], ['Allocated backorders', h.allocated], ['EZPay in transit', h.ezPayInTransit],
      ['Invoice available', h.invoiceAvailable], ['High credit', h.highCredit], ['High this year', h.currentYearHigh], ['YTD sales', h.ytdSales], ['Investment', h.investment]
    ]), 'Summary');
    XLSX.utils.book_append_sheet(wb, this.sheet(m.webOrders.map(o => ({ 'Order': o.orderId, 'PO': o.po, 'Entered': this.d(o.entered), 'Lines': o.lines, 'Total': o.total, 'Held': o.held ? 'Yes' : '', 'Released': o.holdOverride ? 'Yes' : '', 'Ordered by': o.orderedBy }))), 'B2B orders');
    XLSX.utils.book_append_sheet(wb, this.sheet(m.invoices.map(i => ({ 'Invoice': i.invoice, 'Posted': this.d(i.posted), 'Age (days)': i.ageDays, 'Terms': i.terms, 'PO': i.po, 'Vendor': i.vendorName, 'Vendor invoice': i.vendorInvoice, 'Gross': i.gross, 'Discount %': i.discountPct }))), 'Open invoices');
    XLSX.utils.book_append_sheet(wb, this.sheet(m.computymeOrders.map(o => ({ 'Order': o.orderKey, 'Web order': o.webOrder, 'PO': o.po, 'Entered': this.d(o.entered), 'Ship': this.d(o.shipDate), 'Lines': o.lines, 'Backordered lines': o.backorderedLines, 'Total': o.total, 'Status': this.cmStatus(o).label, 'Last invoice posted': this.d(o.billedOn), 'Tracking': o.tracking, 'Invoices (posted)': this.invoiceText(o) }))), 'Computyme orders');
    XLSX.utils.book_append_sheet(wb, this.sheet((m.computymeOrderLines ?? []).map(l => ({ 'Order': l.orderKey, 'Line': l.line, 'Product': l.productCode, 'Description': l.description, 'Qty': l.quantity, 'Amount': l.amount, 'Backordered': l.backordered ? 'Yes' : '', 'Due': this.d(l.dueDate) }))), 'Computyme order lines');
    XLSX.utils.book_append_sheet(wb, this.sheet(m.backorders.map(b => ({ 'Backorder': b.backorderKey, 'PO': b.po, 'Product': b.productCode, 'Description': b.description, 'Qty': b.quantity, 'Allocated': b.allocatedQty, 'Unit net': b.unitNet, 'Allocated value': b.allocatedValue, 'Ship': this.d(b.shipDate), 'Counts now': b.countsNow ? 'Yes' : '', 'Invoiced on this PO (posted)': this.invoiceText(b) }))), 'Backorders');
    XLSX.utils.book_append_sheet(wb, this.sheet(m.vendorPos.map(v => ({ 'Vendor': v.vendorId, 'Vendor name': v.vendorName, 'PO': v.po, 'Date': this.d(v.poDate), 'Auth code': v.authorizationCode || '', 'Amount': v.amount, 'Billed': v.billed, 'Net': v.net }))), 'Vendor POs');
    XLSX.utils.book_append_sheet(wb, this.sheet(this.approvalRows(m.vendorApprovals)), 'Vendor approvals (all)');
    XLSX.utils.book_append_sheet(wb, this.sheet(m.notes.map(n => ({ 'When': this.d(n.createdAt), 'Type': n.kind, 'Order': n.orderId, 'Note': n.note, 'By': n.createdBy }))), 'Notes');
    XLSX.writeFile(wb, `Credit_${h.accountNumber}_${this.today()}.xlsx`);
  }

  private sheet(rows: { [k: string]: any }[]): XLSX.WorkSheet { return rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([['(none)']]); }
  private d(v?: string | null): string { return v ? new Date(v).toLocaleDateString() : ''; }
  private today(): string { return new Date().toISOString().slice(0, 10); }
  private fail(e: any, summary: string): void {
    this.toast.add({ severity: 'error', summary, detail: e?.error?.message || e?.message || 'Please try again.' });
  }
}
