import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { RebateDeskService, apiMessage } from 'src/app/services/rebate-desk.service';
import { col, downloadXlsx } from './rebate-excel';
import { rdSorts } from './rebate-sort';
import { DEFAULT_MONTHS, windowStart } from './rebate-window.component';

type Pending =
  | { kind: 'resubmit'; claim: any }
  | { kind: 'confirm'; claim: any }
  | { kind: 'remove-file'; claim: any; fileName: string }
  | null;

/* Instant-rebate claims that need support (status 3) or were declined (status 2), one row per claim.
   Open a claim for its lines, support files and timeline; add or remove files, send it back to the
   approval queue, or confirm the decline. Used on the Rebate Desk and on the BRM dashboard. */
@Component({
  selector: 'app-rebate-declines',
  templateUrl: './rebate-declines.component.html',
  styleUrls: ['./rebate-desk.shared.scss']
})
export class RebateDeclinesComponent implements OnInit, OnChanges {
  @Input() title = 'Needs support and declined';
  /* Member numbers to show (the BRM's accounts); empty or null = everyone. */
  @Input() accountFilter: string[] | null = null;
  @Input() canInvestigate = false;
  @Input() canOpenClaim = false;
  @Output() investigate = new EventEmitter<{ memberId: number }>();
  @Output() openClaim = new EventEmitter<number>();
  /* After anything changes a claim (so a host can refresh notifications). */
  @Output() changed = new EventEmitter<{ kind: string; orderId: number }>();

  readonly sorts = rdSorts();
  readonly sortEmail = (d: any) => d.email || d.eMail;

  declines: any[] = [];
  declineQ = '';
  declineTake = 100;
  declineStatus: 2 | 3 = 3;
  declineMonths = DEFAULT_MONTHS;
  loaded = false;
  notice = '';
  error = '';
  busy = false;
  pending: Pending = null;

  declineOpen: any = null;
  declineLines: any[] = [];
  declineLinesFor: number | null = null;
  dropOver = false;
  uploadingFor: number | null = null;
  timelineVersion = 0;

  private cache: { src: any[]; key: string; out: any[] } | null = null;

  constructor(private desk: RebateDeskService) {}

  ngOnInit(): void { this.loadDeclines(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accountFilter'] && !changes['accountFilter'].firstChange) { this.cache = null; this.declineTake = 100; }
  }

  loadDeclines(): void {
    this.desk.declines(this.declineMonths).subscribe({
      next: d => {
        this.declines = d || [];
        this.loaded = true;
        if (this.declineOpen) this.declineOpen = this.declines.find(x => x.orderID === this.declineOpen.orderID) ?? null;
      },
      error: e => { this.error = apiMessage(e); this.loaded = true; }
    });
  }

  /* In the window and the account filter. */
  get declinesInWindow(): any[] {
    const start = windowStart(this.declineMonths);
    const accounts = this.accountFilter && this.accountFilter.length ? new Set(this.accountFilter.map(a => String(a).trim())) : null;
    return this.declines.filter(d =>
      (!start || String(d.processDate ?? '').substring(0, 10) >= start) &&
      (!accounts || accounts.has(String(d.memberID ?? '').trim())));
  }

  declineCount(status: number): number { return this.declinesInWindow.filter(d => d.status === status).length; }

  get declinesShown(): any[] {
    const q = this.declineQ.trim().toLowerCase();
    const key = `${q}|${this.declineStatus}|${this.declineMonths}|${(this.accountFilter || []).join(',')}`;
    if (this.cache && this.cache.src === this.declines && this.cache.key === key) return this.cache.out;
    let out = this.declinesInWindow.filter(d => d.status === this.declineStatus)
      .sort((a, b) => String(b.processDate ?? '').localeCompare(String(a.processDate ?? '')));
    if (q) out = out.filter(d => [d.orderID, d.memberID, d.memberName, d.model, d.rejectReason, d.email, d.eMail, d.vendorName]
      .some(v => v != null && String(v).toLowerCase().includes(q)));
    this.cache = { src: this.declines, key, out };
    return out;
  }

  trackDecline = (_: number, d: any) => d.orderID;

  toggleDecline(d: any): void {
    this.declineOpen = this.declineOpen?.orderID === d.orderID ? null : d;
    if (!this.declineOpen || this.declineLinesFor === +d.orderID) return;
    this.declineLines = [];
    this.declineLinesFor = +d.orderID;
    this.desk.irClaimLines(+d.orderID).subscribe({
      next: r => { if (this.declineLinesFor === +d.orderID) this.declineLines = r || []; },
      error: e => (this.error = apiMessage(e))
    });
  }
  get declineLinesTotal(): number { return this.declineLines.reduce((s, l) => s + (+l.net || 0), 0); }
  get declineUnitsTotal(): number { return this.declineLines.reduce((s, l) => s + (+l.quantity || 0), 0); }

  addDeclineFiles(d: any, list: FileList | null | undefined): void {
    if (!list || !list.length || this.uploadingFor) return;
    const form = new FormData();
    Array.from(list).forEach(f => form.append('files', f, f.name));
    this.uploadingFor = d.orderID;
    this.error = '';
    this.desk.addClaimFiles(+d.orderID, form).pipe(finalize(() => (this.uploadingFor = null))).subscribe({
      next: r => {
        const have = new Set((d.proof || []).map((f: any) => String(f.name).toLowerCase()));
        d.proof = [...(d.proof || []), ...(r.files || []).filter(f => !have.has(f.name.toLowerCase()))];
        this.notice = `${(r.files || []).length} file(s) added to claim ${d.orderID}.`;
        this.timelineVersion++;
        this.changed.emit({ kind: 'file-added', orderId: +d.orderID });
      },
      error: e => (this.error = apiMessage(e))
    });
  }

  get pendingTitle(): string {
    const p = this.pending;
    if (!p) return '';
    switch (p.kind) {
      case 'resubmit': return `Send claim ${p.claim.orderID} back to the approval queue`;
      case 'confirm': return `Confirm the decline of claim ${p.claim.orderID}`;
      case 'remove-file': return `Take ${p.fileName} off claim ${p.claim.orderID}`;
    }
  }

  get pendingDetail(): string {
    const p = this.pending;
    if (!p) return '';
    switch (p.kind) {
      case 'resubmit': return 'The member has added the support asked for. The claim goes back into the approval queue.';
      case 'confirm': return 'Second strike: the claim is declined for good (status 2) and its BRM notice closed. No email is sent.';
      case 'remove-file': return 'The file is taken off the claim and deleted from the proof share.';
    }
  }

  confirm(reason: string): void {
    const p = this.pending;
    if (!p) return;
    const id = +p.claim.orderID;
    let call: Observable<any>;
    switch (p.kind) {
      case 'resubmit': call = this.desk.irResubmit(id, reason); break;
      case 'confirm': call = this.desk.confirmDecline(id, reason); break;
      case 'remove-file': call = this.desk.removeClaimFile(id, p.fileName, reason); break;
    }
    this.busy = true;
    this.error = '';
    call.pipe(finalize(() => (this.busy = false))).subscribe({
      next: () => {
        this.pending = null;
        switch (p.kind) {
          case 'resubmit':
            this.declines = this.declines.filter(x => x !== p.claim);
            if (this.declineOpen === p.claim) this.declineOpen = null;
            this.notice = `Claim ${id} is back in the approval queue.`;
            break;
          case 'confirm':
            p.claim.status = 2;
            this.declines = [...this.declines];
            if (this.declineOpen === p.claim) this.declineOpen = null;
            this.notice = `Claim ${id} is declined for good.`;
            break;
          case 'remove-file':
            p.claim.proof = (p.claim.proof || []).filter((f: any) => f.name !== p.fileName);
            this.timelineVersion++;
            this.notice = `${p.fileName} taken off claim ${id}.`;
            break;
        }
        this.changed.emit({ kind: p.kind, orderId: id });
      },
      error: e => (this.error = apiMessage(e))
    });
  }

  exportDeclines(): void {
    downloadXlsx(this.declineStatus === 3 ? 'Claims needing support' : 'Declined claims', [{ name: this.declineStatus === 3 ? 'Needs support' : 'Declined', rows: this.declinesShown, cols: [
      col('Claim', 'orderID', 'number'), col(this.declineStatus === 3 ? 'Asked' : 'Declined', 'processDate', 'date'), col('Member', 'memberID', 'number'),
      col('Member name', 'memberName'), col('Vendor', 'vendorName'), col('Product', 'model', 'text', 40), col('Program week', 'stringProgramWeek'),
      col('Qty', 'quantity', 'number'), col('Amount', 'total', 'money'), col('Reason', 'rejectReason', 'text', 50), col('Email', (r: any) => r.email ?? r.eMail),
      col('Files', (r: any) => (r.proof || []).map((f: any) => f.name).join(', '))] }]);
  }
}
