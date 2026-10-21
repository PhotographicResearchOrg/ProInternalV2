import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { RebateDeskService, apiMessage } from 'src/app/services/rebate-desk.service';

/* Every step on one instant-rebate claim, oldest first, and who has it now (piv2.Claim_Timeline). */
export const BALL_LABELS: Record<string, string> = {
  PRO: 'PRO (approval queue)', PRO_REVIEW: 'PRO (being reviewed)', DEALER: 'Dealer / BRM (support asked)', ACCOUNTING: 'Accounting',
  PRO_BILLING: 'PRO (bill the vendor)', VENDOR: 'Vendor (billed)', CLOSED: 'Closed', DONE: 'Done', UNKNOWN: 'Unknown'
};

@Component({
  selector: 'app-claim-timeline',
  template: `
    <div class="tl" *ngIf="orderId">
      <div class="tl-now" *ngIf="now" [ngClass]="'b-' + (now.holder || 'UNKNOWN').toLowerCase()">
        <span class="lbl">With</span><b>{{ ballLabel(now.holder) }}</b>
        <span class="grow">{{ now.note }}</span>
        <span class="sub" *ngIf="now.since">since {{ now.since | date:'MM/dd/yy h:mm a' }} · {{ age(now.since) }}</span>
      </div>
      <div class="sub" *ngIf="loading"><i class="pi pi-spin pi-spinner"></i> Loading the timeline…</div>
      <div class="error" *ngIf="error"><i class="pi pi-exclamation-circle"></i> {{ error }}</div>
      <ol class="tl-steps" *ngIf="steps.length">
        <li *ngFor="let s of steps" [ngClass]="'k-' + kindClass(s.kind)">
          <div class="tl-when mono">{{ s.at ? (s.at | date:'MM/dd/yy h:mm a') : 'date not recorded' }}</div>
          <div class="tl-what">
            <div>{{ s.text }}</div>
            <div class="sub">
              <span *ngIf="s.actor">{{ s.actor }} · </span><span>{{ s.source }}</span>
              <span *ngIf="s.ball"> · then with <b>{{ ballLabel(s.ball) }}</b></span>
            </div>
          </div>
        </li>
      </ol>
      <div class="sub" *ngIf="!loading && !steps.length && !error">Nothing recorded for this claim.</div>
      <div class="tl-add" *ngIf="canNote">
        <textarea class="in" rows="2" maxlength="500" [(ngModel)]="note" placeholder="Add a note to this claim (who you spoke to, what's next…)"></textarea>
        <div class="tl-add-bar">
          <span class="sub">{{ note.length }}/500 · notes can't be edited, add another to correct one</span>
          <button type="button" class="btn primary" (click)="addNote()" [disabled]="saving || !note.trim()">
            <i class="pi" [class.pi-comment]="!saving" [class.pi-spin]="saving" [class.pi-spinner]="saving"></i> {{ saving ? 'Saving…' : 'Add note' }}</button>
        </div>
      </div>
    </div>`,
  styleUrls: ['./rebate-desk.shared.scss']
})
export class ClaimTimelineComponent implements OnChanges {
  @Input() orderId: number | null = null;
  /* Bump to reload after an action on the claim. */
  @Input() version = 0;
  /* Show the Add note box. */
  @Input() canNote = false;
  note = '';
  saving = false;

  steps: any[] = [];
  now: any = null;
  loading = false;
  error = '';
  hasLog = false;

  constructor(private desk: RebateDeskService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orderId'] || changes['version']) this.load();
  }

  load(): void {
    this.steps = []; this.now = null; this.error = '';
    if (!this.orderId) return;
    this.loading = true;
    this.desk.claimTimeline(this.orderId).subscribe({
      next: r => {
        this.steps = r.steps || [];
        this.now = r.now;
        this.hasLog = this.steps.some(s => s.source === 'Log');
        this.loading = false;
      },
      error: e => { this.error = apiMessage(e); this.loading = false; }
    });
  }

  addNote(): void {
    const text = this.note.trim();
    if (!text || !this.orderId || this.saving) return;
    this.saving = true;
    this.error = '';
    this.desk.claimNote(this.orderId, text).subscribe({
      next: () => { this.saving = false; this.note = ''; this.load(); },
      error: e => { this.saving = false; this.error = apiMessage(e); }
    });
  }

  ballLabel(b: string | null): string { return b ? (BALL_LABELS[b] ?? b) : ''; }

  kindClass(k: string): string {
    if (!k) return 'other';
    if (/DECLIN/.test(k)) return 'bad';
    if (/SUPPORT|BRM/.test(k)) return 'warn';
    if (/APPROV|CREDIT|POSTED|DEBIT|DM_/.test(k)) return 'ok';
    if (/FILE/.test(k)) return 'file';
    if (/NOTE/.test(k)) return 'note';
    return 'other';
  }

  age(d: string): string {
    const ms = Date.now() - new Date(d).getTime();
    if (!(ms >= 0)) return '';
    const days = Math.floor(ms / 86400000);
    if (days >= 1) return days === 1 ? '1 day' : `${days} days`;
    const h = Math.floor(ms / 3600000);
    return h >= 1 ? `${h} h` : 'just now';
  }
}
