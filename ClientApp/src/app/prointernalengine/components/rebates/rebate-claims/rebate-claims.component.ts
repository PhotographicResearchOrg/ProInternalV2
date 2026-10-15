import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { Rail, RebateDeskService, apiMessage, saveBlob } from 'src/app/services/rebate-desk.service';
import { CLAIM_COLS, col, downloadXlsx, fetchAllPages } from '../shared/rebate-excel';

type Pending = { kind: 'resend' | 'invoice' } | null;

/*
 * Claims (accounting) on one rail.
 *   Claims       find a claim; resend its credit to Computyme (refused when AR
 *                already shows it), recreate or reprint the credit invoice
 *   Debit memos  bill approved claims back to the vendor: choose vendors and
 *                dates, tick claims, enter the DM number, email the letter
 *                with the CSV and any support files
 */
@Component({
  selector: 'app-rebate-claims',
  templateUrl: './rebate-claims.component.html',
  styleUrls: ['../shared/rebate-desk.shared.scss']
})
export class RebateClaimsComponent implements OnChanges {
  @Input() rail: Rail = 'IR';
  @Input() tab: 'claims' | 'memos' = 'claims';

  vendors: any[] = [];

  /* ---- claims ---- */
  filter = { q: '', vendorId: null as number | null, state: 'APPROVED', from: '', to: '' };
  page = 1;
  pageSize = 50;
  total = 0;
  rows: any[] = [];
  claim: any = null;
  detail: { decisions: any[]; lines: any[]; arCredits: any[]; history: any[] } | null = null;

  /* ---- debit memos ---- */
  memoVendorIds: number[] = [];
  memoFrom = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().substring(0, 10);
  memoTo = new Date().toISOString().substring(0, 10);
  candidates: any[] = [];
  chosen = new Set<number>();
  letter = '';
  memo = { dm: '', emailTo: '', ref1: '', ref2: '', sendEmail: true };
  supportFiles: File[] = [];
  memos: any[] = [];

  pending: Pending = null;
  loading = false;
  busy = false;
  error = '';
  notice = '';

    /* Search as you type: runs a moment after the last key. */
  private searchTimer: any;
  searchSoon(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.go(1), 350);
  }

  exporting = false;

  /* Every claim matching the filters, not just this page. */
  async exportClaims(): Promise<void> {
    this.exporting = true;
    try {
      const rows = await fetchAllPages((page, pageSize) => this.desk.claims(this.rail, { ...this.filter, page, pageSize }));
      downloadXlsx(this.rail === 'PP' ? 'Price-protection claims' : 'Instant-rebate claims', [{ name: 'Claims', cols: CLAIM_COLS, rows }]);
    } catch (e) { this.error = apiMessage(e); } finally { this.exporting = false; }
  }

  exportCandidates(): void {
    downloadXlsx(`Debit memo ${this.memo?.dm || 'draft'}`, [{ name: 'Claims', rows: this.candidates.filter(l => this.chosen.has(l.orderId)), cols: [
      col('Claim', 'orderId', 'number'), col('Member', 'memberId', 'number'), col('Vendor', 'vendorName'), col('Decided', 'processedAt', 'date'),
      col('Product', 'description', 'text', 45), col('Catalog #', 'catalogNumber'), col('PRO code', 'proCode'), col('Program week', 'programWeek'),
      col('Qty', 'quantity', 'number'), col('Each (vendor share)', 'reimbursementAmount', 'money'), col('Extended', 'extended', 'money')] }]);
  }

  exportMemos(): void {
    downloadXlsx('Debit memos', [{ name: 'Debit memos', rows: this.memos, cols: [
      col('DM', 'debitMemo'), col('Vendor', 'vendorName'), col('Claims', 'claims', 'number'), col('Total', 'total', 'money'),
      col('Emailed', 'emailedAt', 'datetime'), col('Email to', 'emailTo'), col('Email error', 'emailError'),
      col('Reference 1', 'ref1'), col('Reference 2', 'ref2'), col('Created by', 'createdBy'), col('Created', 'createdAt', 'datetime')] }]);
  }

  constructor(private desk: RebateDeskService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rail']) {
      this.desk.vendors(this.rail).subscribe(v => (this.vendors = v));
      this.claim = null;
      this.candidates = [];
      this.go(1);
      this.loadMemos();
    }
  }

  get pages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }

  go(p: number): void {
    this.page = Math.min(Math.max(1, p), this.pages);
    this.loading = true;
    this.desk.claims(this.rail, { ...this.filter, page: this.page, pageSize: this.pageSize })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: r => { this.rows = r.rows; this.total = r.total; }, error: e => (this.error = apiMessage(e)) });
  }

  open(c: any): void {
    this.claim = c;
    this.detail = null;
    this.error = '';
    this.desk.claim(this.rail, c.orderId).subscribe({ next: d => (this.detail = d), error: e => (this.error = apiMessage(e)) });
  }

  bucketLabel(b: string): string {
    return ({ SUBMITTED: 'Not decided', APPROVED: 'Approved, not sent', HELD: 'Approved, held', SENT: 'Sent to Computyme', DECLINED: 'Declined' } as any)[b] ?? b;
  }

  get pendingTitle(): string {
    if (!this.pending || !this.claim) return '';
    return this.pending.kind === 'resend' ? `Resend credit for claim ${this.claim.orderId}` : `Recreate invoice for claim ${this.claim.orderId}`;
  }

  get pendingDetail(): string {
    if (!this.pending) return '';
    return this.pending.kind === 'resend'
      ? 'The next nightly run sends this credit to Computyme again. Refused if AR already shows it, if it was sent in the last two days, or if it was resent in the last three.'
      : 'Builds the credit invoice PDF from AR now and replaces the one members see.';
  }

  confirm(reason: string): void {
    if (!this.pending || !this.claim) return;
    this.busy = true;
    this.error = '';
    const call = this.pending.kind === 'resend'
      ? this.desk.resendCredit(this.rail, this.claim.orderId, reason)
      : this.desk.recreateInvoice(this.rail, this.claim.orderId, reason);
    const kind = this.pending.kind;
    call.pipe(finalize(() => (this.busy = false))).subscribe({
      next: (r: any) => {
        this.pending = null;
        this.notice = kind === 'resend' ? 'Queued: the credit goes to Computyme on the next nightly run.'
          : `Invoice ${r.invoiceNumber} built${r.sharePath ? ' and published for the member' : ''}.`;
        this.open(this.claim);
        this.go(this.page);
      },
      error: e => (this.error = apiMessage(e))
    });
  }

  reprint(): void {
    if (!this.claim) return;
    this.error = '';
    this.desk.reprint(this.rail, this.claim.orderId).subscribe({
      next: blob => saveBlob(blob, `claim-${this.claim.orderId}.pdf`),
      error: () => (this.error = 'There is no invoice PDF for this claim yet. Use Recreate invoice.')
    });
  }

  /* ---------------- debit memos ---------------- */

  toggleVendor(id: number, on: boolean): void {
    this.memoVendorIds = on ? [...new Set([...this.memoVendorIds, id])] : this.memoVendorIds.filter(v => v !== id);
  }

  /* The legacy screen grouped Vitec and Fuji brands; picking a parent picks its vendors. */
  get parents(): string[] {
    return [...new Set(this.vendors.map(v => v.parentCompany).filter((p: string) => !!p))];
  }

  pickParent(parent: string): void {
    this.memoVendorIds = this.vendors.filter(v => v.parentCompany === parent).map(v => v.vendorId);
  }

  findCandidates(): void {
    if (!this.memoVendorIds.length) { this.error = 'Choose at least one vendor.'; return; }
    this.loading = true;
    this.error = '';
    this.desk.debitMemoCandidates(this.rail, this.memoVendorIds, this.memoFrom, this.memoTo)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: r => {
          this.candidates = r.lines;
          this.chosen = new Set(r.lines.map(l => l.orderId));
          this.letter = r.letter;
          if (r.emailTo && !this.memo.emailTo) this.memo.emailTo = r.emailTo;
        },
        error: e => (this.error = apiMessage(e))
      });
  }

  toggleClaim(orderId: number, on: boolean): void {
    on ? this.chosen.add(orderId) : this.chosen.delete(orderId);
  }

  get chosenTotal(): number {
    return this.candidates.filter(l => this.chosen.has(l.orderId)).reduce((s, l) => s + (+l.extended || 0), 0);
  }

  get chosenCount(): number { return this.chosen.size; }

  pickSupport(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.supportFiles = input.files ? Array.from(input.files).slice(0, 10) : [];
  }

  createMemo(): void {
    if (!this.memo.dm.trim() || !this.chosen.size) return;
    const vendorNames = [...new Set(this.candidates.filter(l => this.chosen.has(l.orderId)).map(l => l.vendorName))];
    const form = new FormData();
    form.append('rail', this.rail);
    form.append('dm', this.memo.dm.trim());
    form.append('orderIds', [...this.chosen].join(','));
    form.append('vendorIds', this.memoVendorIds.join(','));
    form.append('vendorName', vendorNames.join(', '));
    form.append('emailTo', this.memo.emailTo);
    form.append('ref1', this.memo.ref1);
    form.append('ref2', this.memo.ref2);
    form.append('sendEmail', String(this.memo.sendEmail));
    this.supportFiles.forEach(f => form.append('support', f, f.name));

    this.busy = true;
    this.error = '';
    this.desk.createDebitMemo(form).pipe(finalize(() => (this.busy = false))).subscribe({
      next: r => {
        this.notice = `Debit memo ${this.memo.dm} created: ${r.claims} claim(s), ${r.total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`
          + (this.memo.sendEmail ? (r.emailed ? ' Emailed.' : ` Not emailed: ${r.emailError}. Download the CSV from the list.`) : '');
        this.candidates = [];
        this.chosen.clear();
        this.memo = { dm: '', emailTo: this.memo.emailTo, ref1: '', ref2: '', sendEmail: true };
        this.supportFiles = [];
        this.loadMemos();
      },
      error: e => (this.error = apiMessage(e))
    });
  }

  loadMemos(): void {
    this.desk.debitMemos(this.rail).subscribe({ next: m => (this.memos = m), error: () => (this.memos = []) });
  }

  downloadMemo(m: any): void {
    this.desk.debitMemoCsv(m.debitMemoId).subscribe({
      next: b => saveBlob(b, `${m.debitMemo}.csv`),
      error: () => (this.error = 'The CSV could not be downloaded.')
    });
  }
}
