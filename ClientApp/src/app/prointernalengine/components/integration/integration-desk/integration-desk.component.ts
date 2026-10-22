import { HomePin, stablePin } from 'src/app/services/home-pin.service';
import { Component, HostListener, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';
import {
  IntegrationMessageDetail,
  IntegrationMessageRow,
  IntegrationService,
  IntegrationSummaryRow
} from 'src/app/services/integration.service';

/* A rail entry: one status view of the outbox. */
interface RailView {
  key: string;
  label: string;
  icon: string;
  status: string;          // '' = needs attention (rejected, failed, overdue)
  count: (t: Totals) => number;
}

interface Totals {
  needsAttention: number;
  overdue: number;
  rejected: number;
  failed: number;
  awaitingAnswer: number;
  queued: number;
  acknowledgedToday: number;
}

type PendingAction = { kind: 'resend' | 'cancel'; messageId: number } | null;

/*
 * Integration desk: every message PRO sends to another system, for every
 * domain, and the answer to each. Follows the desk standard: a rail of
 * views with counts, a header with the key numbers, a finder, and one
 * record open at a time. Resend and cancel need a reason, recorded in
 * the message's history.
 */
@Component({
  selector: 'app-integration-desk',
  templateUrl: './integration-desk.component.html',
  styleUrls: ['./integration-desk.component.scss']
})
export class IntegrationDeskComponent implements OnInit {
  readonly views: RailView[] = [
    { key: 'attention', label: 'Needs attention', icon: 'pi pi-exclamation-triangle', status: '', count: t => t.needsAttention },
    { key: 'overdue', label: 'Overdue', icon: 'pi pi-clock', status: 'OVERDUE', count: t => t.overdue },
    { key: 'rejected', label: 'Rejected', icon: 'pi pi-times-circle', status: 'REJECTED', count: t => t.rejected },
    { key: 'failed', label: 'Failed to send', icon: 'pi pi-bolt', status: 'FAILED', count: t => t.failed },
    { key: 'sent', label: 'Awaiting answer', icon: 'pi pi-send', status: 'SENT', count: t => t.awaitingAnswer },
    { key: 'queued', label: 'Queued', icon: 'pi pi-inbox', status: 'QUEUED', count: t => t.queued },
    { key: 'ack', label: 'Acknowledged', icon: 'pi pi-check-circle', status: 'ACKNOWLEDGED', count: t => t.acknowledgedToday },
    { key: 'cancelled', label: 'Cancelled', icon: 'pi pi-ban', status: 'CANCELLED', count: () => 0 }
  ];

  activeView = this.views[0];

  summary: IntegrationSummaryRow[] = [];
  totals: Totals = { needsAttention: 0, overdue: 0, rejected: 0, failed: 0, awaitingAnswer: 0, queued: 0, acknowledgedToday: 0 };

  domains: string[] = [];
  destinations: string[] = [];

  domain = '';
  destination = '';
  query = '';
  page = 1;
  readonly pageSize = 50;

  rows: IntegrationMessageRow[] = [];
  total = 0;
  loading = false;
  error = '';

  selected: IntegrationMessageDetail | null = null;
  detailLoading = false;
  detailTab: 'answers' | 'history' | 'payload' = 'answers';

  pending: PendingAction = null;
  reason = '';
  acting = false;
  actionError = '';
  notice = '';

  constructor(private integration: IntegrationService) {}

  /** "Pin to home": the Integration Desk */
  readonly homePin: HomePin = stablePin({ id: 'integration', label: 'Integration Desk', sub: 'Admin', icon: 'pi pi-sync', route: '/integration' });

  ngOnInit(): void {
    this.refresh();
  }

  /* "/" jumps to search, as on the other desks. */
  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
    if (e.key === '/' && !typing) {
      e.preventDefault();
      document.getElementById('integration-search')?.focus();
    }
    if (e.key === 'Escape' && this.pending) {
      this.closeAction();
    }
  }

  refresh(): void {
    this.integration.summary().subscribe({
      next: rows => {
        this.summary = rows;
        this.domains = [...new Set(rows.map(r => r.domain))].sort();
        this.destinations = [...new Set(rows.map(r => r.destination))].sort();
        const sum = (f: (r: IntegrationSummaryRow) => number) => rows.reduce((a, r) => a + f(r), 0);
        this.totals = {
          overdue: sum(r => r.overdue),
          rejected: sum(r => r.rejected),
          failed: sum(r => r.failed),
          awaitingAnswer: sum(r => r.awaitingAnswer),
          queued: sum(r => r.queued),
          acknowledgedToday: sum(r => r.acknowledgedToday),
          needsAttention: sum(r => r.overdue + r.rejected + r.failed)
        };
      },
      error: () => (this.error = 'Could not load the outbox summary.')
    });
    this.search();
  }

  pickView(view: RailView): void {
    this.activeView = view;
    this.page = 1;
    this.search();
  }

  pickDestination(row: IntegrationSummaryRow): void {
    this.domain = row.domain;
    this.destination = row.destination;
    this.page = 1;
    this.search();
  }

  clearFilters(): void {
    this.domain = '';
    this.destination = '';
    this.query = '';
    this.page = 1;
    this.search();
  }

  search(): void {
    this.loading = true;
    this.error = '';
    this.integration
      .search({
        domain: this.domain,
        destination: this.destination,
        status: this.activeView.status,
        q: this.query.trim(),
        page: this.page,
        pageSize: this.pageSize
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: r => {
          this.rows = r.rows;
          this.total = r.total;
        },
        error: () => (this.error = 'Could not load messages.')
      });
  }

  get pages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  goPage(p: number): void {
    if (p < 1 || p > this.pages) return;
    this.page = p;
    this.search();
  }

  open(row: IntegrationMessageRow): void {
    this.detailLoading = true;
    this.detailTab = 'answers';
    this.integration
      .get(row.messageId)
      .pipe(finalize(() => (this.detailLoading = false)))
      .subscribe({
        next: d => (this.selected = d),
        error: () => (this.error = `Could not open message ${row.messageId}.`)
      });
  }

  close(): void {
    this.selected = null;
    this.closeAction();
  }

  canResend(status: string): boolean {
    return status === 'FAILED' || status === 'REJECTED' || status === 'OVERDUE';
  }

  canCancel(status: string): boolean {
    return status === 'QUEUED' || this.canResend(status);
  }

  startAction(kind: 'resend' | 'cancel', messageId: number): void {
    this.pending = { kind, messageId };
    this.reason = '';
    this.actionError = '';
  }

  closeAction(): void {
    this.pending = null;
    this.reason = '';
    this.actionError = '';
  }

  confirmAction(): void {
    if (!this.pending) return;
    if (this.reason.trim().length < 5) {
      this.actionError = 'Say why, in a few words. It goes in the message history.';
      return;
    }
    const { kind, messageId } = this.pending;
    const call = kind === 'resend'
      ? this.integration.resend(messageId, this.reason.trim())
      : this.integration.cancel(messageId, this.reason.trim());

    this.acting = true;
    call.pipe(finalize(() => (this.acting = false))).subscribe({
      next: r => {
        if (!r.success) {
          this.actionError = r.message || 'The action was refused.';
          return;
        }
        this.notice = kind === 'resend' ? `Message ${messageId} queued to send again.` : `Message ${messageId} cancelled.`;
        this.closeAction();
        this.refresh();
        if (this.selected?.messageId === messageId) this.open(this.selected);
      },
      error: e => (this.actionError = e?.error?.message || 'The action failed.')
    });
  }

  dispatchNow(): void {
    this.acting = true;
    this.integration
      .dispatchNow()
      .pipe(finalize(() => (this.acting = false)))
      .subscribe({
        next: r => {
          this.notice = r.sent === 1 ? '1 message sent.' : `${r.sent} messages sent.`;
          this.refresh();
        },
        error: () => (this.error = 'Send now failed.')
      });
  }

  /* Pretty-print a stored JSON string; falls back to the raw text. */
  pretty(json: string | null | undefined): string {
    if (!json) return '';
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  }

  statusClass(status: string): string {
    switch (status) {
      case 'ACKNOWLEDGED': return 'ok';
      case 'REJECTED':
      case 'FAILED': return 'bad';
      case 'OVERDUE': return 'warn';
      case 'SENT':
      case 'QUEUED': return 'info';
      default: return 'quiet';
    }
  }

  label(row: IntegrationMessageRow): string {
    return row.entityLabel ? `${row.entityId} · ${row.entityLabel}` : row.entityId;
  }

  trackRow(_: number, r: IntegrationMessageRow): number {
    return r.messageId;
  }
}
