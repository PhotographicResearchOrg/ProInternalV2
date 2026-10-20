import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { Rail, RebateDeskService, apiMessage, saveBlob } from 'src/app/services/rebate-desk.service';
import { CLAIM_COLS, col, downloadXlsx, fetchAllPages } from '../shared/rebate-excel';
import { DEFAULT_MONTHS } from '../shared/rebate-window.component';

type Pending = { kind: 'resend' | 'invoice' | 'resubmit' } | null;

/*
 * Claims (accounting) on one rail.
 *   Claims       find a claim (by member, product, vendor, state; last 12 months,
 *                2 years or all history); re-post its credit to the GL (refused
 *                when AR already shows it); recreate or reprint the member's
 *                credit invoice; send a claim that needs support back to the queue
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
  /* Came from a vendor's "Bill vendor": that vendor and dates are filled in and its claims found. */
  @Input() preset: { vendorId: number; from: string; to: string } | null = null;
  /* Open Investigate on this claim's member and products. */
  @Output() investigate = new EventEmitter<{ memberId: number; modelIds: number[] }>();
  /* Came from Investigate: find this claim (any age) and open it. */
  @Input() openClaimId: number | null = null;

  investigateClaim(): void {
    if (!this.claim) return;
    const modelIds = [...new Set((this.detail?.lines ?? []).map((l: any) => +l.modelId))];
    this.investigate.emit({ memberId: +this.claim.memberId, modelIds });
  }

  vendors: any[] = [];

  /* ---- claims ---- */
  filter = { q: '', vendorId: null as number | null, state: 'APPROVED', from: '', to: '',
             months: DEFAULT_MONTHS, memberId: null as number | null, modelId: null as number | null };
  modelLabel = '';
  page = 1;
  pageSize = 50;
  total = 0;
  rows: any[] = [];
  claim: any = null;
  detail: { decisions: any[]; lines: any[]; arCredits: any[]; history: any[]; proof?: { name: string; url: string }[] } | null = null;

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
  memoMonths = DEFAULT_MONTHS;

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

  /* The states a claim can be in (and the filters). Credits post to the GL through the accounting system. */
  readonly stateChips = [
    { value: 'SUBMITTED', label: 'Not decided' }, { value: 'SUPPORT', label: 'Needs support' },
    { value: 'APPROVED', label: 'Approved, not posted' },
    { value: 'SENT', label: 'Posted to GL' }, { value: 'NOT_INVOICED', label: 'Posted, no member invoice' },
    { value: 'NOT_IN_AR', label: 'Posted, not in AR' }, { value: 'NO_DM', label: 'No debit memo' },
    { value: 'DECLINED', label: 'Declined' }, { value: '', label: 'All' }
  ];

  pickModel(m: any): void {
    this.filter.modelId = m?.modelId ?? null;
    this.modelLabel = m ? (m.description ?? m.modelNumber ?? '') : '';
    this.go(1);
  }

  clearModel(): void { this.pickModel(null); }

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
      if (!this.openClaimId) this.go(1);
      this.loadMemos();
    }
    if (changes['openClaimId'] && this.openClaimId) {
      const id = this.openClaimId;
      this.filter = { ...this.filter, q: String(id), state: '', months: 0, memberId: null, modelId: null, vendorId: null, from: '', to: '' };
      this.modelLabel = '';
      this.loading = true;
      this.desk.claims(this.rail, { ...this.filter, page: 1, pageSize: this.pageSize })
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: r => { this.rows = r.rows; this.total = r.total; const c = r.rows.find((x: any) => +x.orderId === +id); if (c) this.open(c); },
          error: e => (this.error = apiMessage(e))
        });
    }
    if (changes['preset'] && this.preset) {
      this.memoVendorIds = [this.preset.vendorId];
      this.memoFrom = this.preset.from;
      this.memoTo = this.preset.to;
      setTimeout(() => this.findCandidates());
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
    return ({ SUBMITTED: 'Not decided', SUPPORT: 'Needs support', APPROVED: 'Approved, not posted',
              SENT: 'Posted to GL', NOT_IN_AR: 'Posted, not in AR', DECLINED: 'Declined' } as any)[b] ?? b;
  }

  get pendingTitle(): string {
    if (!this.pending || !this.claim) return '';
    const id = this.claim.orderId;
    return this.pending.kind === 'resend' ? `Re-post credit for claim ${id}`
      : this.pending.kind === 'resubmit' ? `Send claim ${id} back to the queue` : `Recreate member invoice for claim ${id}`;
  }

  get pendingDetail(): string {
    if (!this.pending) return '';
    if (this.pending.kind === 'resend')
      return 'The next nightly run posts this credit to the GL again. Refused if AR already shows it, if it was posted in the last two days, or if it was re-posted in the last three.';
    if (this.pending.kind === 'resubmit')
      return 'The member has added the support asked for: the claim goes back into the approval queue (same as Resubmit on the BRM dashboard).';
    return 'Builds the member credit invoice PDF from the AR credit now and replaces the one the member sees.';
  }

  confirm(reason: string): void {
    if (!this.pending || !this.claim) return;
    this.busy = true;
    this.error = '';
    const call = this.pending.kind === 'resend' ? this.desk.resendCredit(this.rail, this.claim.orderId, reason)
      : this.pending.kind === 'resubmit' ? this.desk.resubmit(this.rail, this.claim.orderId, reason)
      : this.desk.recreateInvoice(this.rail, this.claim.orderId, reason);
    const kind = this.pending.kind;
    call.pipe(finalize(() => (this.busy = false))).subscribe({
      next: (r: any) => {
        this.pending = null;
        this.notice = kind === 'resend' ? 'Queued: the credit posts to the GL on the next nightly run.'
          : kind === 'resubmit' ? `Claim ${this.claim.orderId} is back in the approval queue.`
          : `Member invoice ${r.invoiceNumber} built${r.sharePath ? ' and published for the member' : ''}.`;
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
      error: () => (this.error = 'There is no member invoice PDF for this claim yet. Use Recreate invoice.')
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

  /* ---- vendor finder for the debit memo ---- */
  vendorQ = '';
  vendorOpen = false;

  get vendorMatches(): any[] {
    const q = this.vendorQ.trim().toLowerCase();
    return this.vendors
      .filter(v => !this.memoVendorIds.includes(v.vendorId))
      .filter(v => !q || (v.vendorName || '').toLowerCase().includes(q) || (v.parentCompany || '').toLowerCase().includes(q))
      .slice(0, 12);
  }

  get chosenVendors(): any[] {
    return this.memoVendorIds.map(id => this.vendors.find(v => v.vendorId === id) ?? { vendorId: id, vendorName: '#' + id });
  }

  addVendor(id: number): void {
    this.toggleVendor(id, true);
    this.vendorQ = '';
  }

  addFirstVendor(): void {
    const v = this.vendorMatches[0];
    if (v) this.addVendor(v.vendorId);
  }

  closeVendorsSoon(): void { setTimeout(() => (this.vendorOpen = false), 150); }

  pickParent(parent: string): void {
    if (!parent) return;
    this.memoVendorIds = [...new Set([...this.memoVendorIds, ...this.vendors.filter(v => v.parentCompany === parent).map(v => v.vendorId)])];
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

  /* ---- test run: everything goes to the test address; nothing is stamped ---- */
  testTo = (() => { try { return localStorage.getItem('rebateDesk.testTo') || ''; } catch { return ''; } })();
  rememberTestTo(): void { try { localStorage.setItem('rebateDesk.testTo', this.testTo.trim()); } catch { /* not kept */ } }

  testMemo(): void {
    if (!this.chosen.size || !this.testTo.trim()) return;
    const form = this.memoForm();
    form.append('testTo', this.testTo.trim());
    this.busy = true;
    this.error = '';
    this.desk.testDebitMemo(form).pipe(finalize(() => (this.busy = false))).subscribe({
      next: (r: any) => {
        const proof = r.proofError ? ` Proof ZIP failed: ${r.proofError}.`
          : r.proofFiles ? ` Proof ZIP: ${r.proofFiles} file(s)${r.proofMissing ? `, ${r.proofMissing} could not be read` : ''}.` : '';
        this.notice = r.emailed
          ? `Test sent to ${r.sentTo}: ${r.claims} claim(s), ${(+r.total).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.${proof} Nothing was stamped.`
          : `Test built but not emailed: ${r.emailError}.${proof} Nothing was stamped.`;
      },
      error: e => (this.error = apiMessage(e))
    });
  }

  private memoForm(): FormData {
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
    return form;
  }

  createMemo(): void {
    if (!this.memo.dm.trim() || !this.chosen.size) return;
    const form = this.memoForm();

    this.busy = true;
    this.error = '';
    this.desk.createDebitMemo(form).pipe(finalize(() => (this.busy = false))).subscribe({
      next: r => {
        const rr: any = r;
        const proof = rr.proofError ? ` Proof ZIP failed: ${rr.proofError}.`
          : rr.proofFiles ? ` Proof ZIP: ${rr.proofFiles} file(s)${rr.proofMissing ? `, ${rr.proofMissing} could not be read (listed in the ZIP)` : ''}.`
          : this.rail === 'IR' ? ' No proof files on these claims.' : '';
        this.notice = `Debit memo ${this.memo.dm} created: ${r.claims} claim(s), ${r.total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}. Member level claim detail attached.`
          + proof
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
    this.desk.debitMemos(this.rail, undefined, this.memoMonths).subscribe({ next: m => (this.memos = m), error: () => (this.memos = []) });
  }

  downloadMemo(m: any): void {
    this.desk.debitMemoCsv(m.debitMemoId).subscribe({
      next: b => saveBlob(b, `${m.debitMemo}.csv`),
      error: () => (this.error = 'The CSV could not be downloaded.')
    });
  }
}
