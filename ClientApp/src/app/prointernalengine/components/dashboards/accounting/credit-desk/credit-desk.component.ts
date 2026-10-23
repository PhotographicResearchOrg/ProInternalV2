import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import { DataService } from 'src/app/services/data.service';
import { HomePin, stablePin } from 'src/app/services/home-pin.service';
import { CreditMember, CreditMemberRow, CreditWebOrder } from 'src/app/models/accounting/credit-desk.models';

type ListFilter = 'held' | 'over' | 'pastdue' | 'hold' | 'credits' | 'all';
type Tab = 'orders' | 'invoices' | 'computyme' | 'backorders' | 'vendorpos' | 'credits' | 'notes';

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

  // release modal
  release: { order: CreditWebOrder; reason: string; touched: boolean; saving: boolean } | null = null;

  constructor(private data: DataService, private route: ActivatedRoute, private router: Router, private toast: MessageService) {}

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
      next: r => { this.members = r?.members ?? []; this.canOverride = !!r?.canOverride; this.listLoading = false; },
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
  setFilter(f: ListFilter): void { this.filter = f; }
  open(m: CreditMemberRow): void { this.router.navigate(['/credit'], { queryParams: { account: m.accountNumber } }); }
  back(): void { this.router.navigate(['/credit'], { queryParams: this.filter !== 'held' ? { filter: this.filter } : {} }); }

  // ------------------------------------------------------------ one member
  loadMember(): void {
    if (!this.accountNumber) return;
    this.loading = true;
    this.data.creditMember(this.accountNumber).subscribe({
      next: m => {
        this.member = m; this.canOverride = !!m?.canOverride; this.loading = false;
        if (this.tab === 'orders' && !m.webOrders.length && m.invoices.length) this.tab = 'invoices';
      },
      error: e => { this.loading = false; this.member = null; this.fail(e, 'Could not load the member'); }
    });
  }

  readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'orders', label: 'B2B orders', icon: 'pi pi-shopping-cart' },
    { key: 'invoices', label: 'Open invoices', icon: 'pi pi-file' },
    { key: 'computyme', label: 'Computyme orders', icon: 'pi pi-box' },
    { key: 'backorders', label: 'Backorders', icon: 'pi pi-clock' },
    { key: 'vendorpos', label: 'Vendor POs', icon: 'pi pi-truck' },
    { key: 'credits', label: 'Vendor credits', icon: 'pi pi-check-square' },
    { key: 'notes', label: 'Notes', icon: 'pi pi-comment' }
  ];
  tabCount(t: Tab): number {
    const m = this.member;
    if (!m) return 0;
    switch (t) {
      case 'orders': return m.webOrders.length;
      case 'invoices': return m.invoices.length;
      case 'computyme': return m.computymeOrders.length;
      case 'backorders': return m.backorders.length;
      case 'vendorpos': return m.vendorPos.length;
      case 'credits': return m.vendorApprovals.length;
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
      'Credit hold (Computyme)': m.onHold ? 'Yes' : '', 'B2B orders': m.webOrders, 'Held orders': m.heldOrders, 'Held value': m.heldValue,
      'Vendor credits pending': m.pendingVendorCredits, 'YTD sales': m.ytdSales, 'Last note': m.lastNoteAt ? new Date(m.lastNoteAt).toLocaleDateString() : ''
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
      ['Account', h.accountNumber], ['Member', h.name], ['Credit hold (Computyme)', h.onHold ? 'Yes' : 'No'],
      ['Limit', h.limit], ['Balance', h.balance], ['Current', h.currentDue], ['30 days', h.days30], ['60 days', h.days60], ['90+ days', h.days90],
      ['Open orders (Computyme)', h.openOrders], ['Vendor exposure', h.vendorExposure], ['Vendor billed', h.vendorBilled], ['Available', h.available],
      ['Shipping in 5 days', h.shippingSoon], ['Open invoices', h.openInvoices], ['Allocated backorders', h.allocated], ['EZPay in transit', h.ezPayInTransit],
      ['Invoice available', h.invoiceAvailable], ['High credit', h.highCredit], ['High this year', h.currentYearHigh], ['YTD sales', h.ytdSales], ['Investment', h.investment]
    ]), 'Summary');
    XLSX.utils.book_append_sheet(wb, this.sheet(m.webOrders.map(o => ({ 'Order': o.orderId, 'PO': o.po, 'Entered': this.d(o.entered), 'Lines': o.lines, 'Total': o.total, 'Held': o.held ? 'Yes' : '', 'Released': o.holdOverride ? 'Yes' : '', 'Ordered by': o.orderedBy }))), 'B2B orders');
    XLSX.utils.book_append_sheet(wb, this.sheet(m.invoices.map(i => ({ 'Invoice': i.invoice, 'Posted': this.d(i.posted), 'Age (days)': i.ageDays, 'Terms': i.terms, 'PO': i.po, 'Vendor': i.vendorName, 'Vendor invoice': i.vendorInvoice, 'Gross': i.gross, 'Discount %': i.discountPct }))), 'Open invoices');
    XLSX.utils.book_append_sheet(wb, this.sheet(m.computymeOrders.map(o => ({ 'Order': o.orderKey, 'PO': o.po, 'Ship': this.d(o.shipDate), 'Lines': o.lines, 'Total': o.total, 'Ships in 5 days': o.shipsSoon ? 'Yes' : '' }))), 'Computyme orders');
    XLSX.utils.book_append_sheet(wb, this.sheet(m.backorders.map(b => ({ 'Backorder': b.backorderKey, 'PO': b.po, 'Product': b.productCode, 'Description': b.description, 'Qty': b.quantity, 'Allocated': b.allocatedQty, 'Unit net': b.unitNet, 'Allocated value': b.allocatedValue, 'Ship': this.d(b.shipDate), 'Counts now': b.countsNow ? 'Yes' : '' }))), 'Backorders');
    XLSX.utils.book_append_sheet(wb, this.sheet(m.vendorPos.map(v => ({ 'Vendor': v.vendorId, 'Vendor name': v.vendorName, 'PO': v.po, 'Date': this.d(v.poDate), 'Amount': v.amount, 'Billed': v.billed, 'Net': v.net }))), 'Vendor POs');
    XLSX.utils.book_append_sheet(wb, this.sheet(m.vendorApprovals.map(a => ({ 'Requested': this.d(a.requested), 'Vendor': a.vendorName || a.vendorId, 'PO': a.po, 'Amount': a.amount, 'Auth code': a.authorizationCode, 'Declined': a.declined ? 'Yes' : '', 'By': a.requestedBy }))), 'Vendor credits');
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
