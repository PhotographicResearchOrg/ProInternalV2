import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

/*
 * Asks for the reason before a change to live rebates (turn off, change a
 * price, skip a row...). The reason is stored in the Rebate Desk history.
 */
@Component({
  selector: 'app-rebate-reason-dialog',
  template: `
    <div class="scrim" *ngIf="open" (click)="cancel()">
      <div class="dialog" (click)="$event.stopPropagation()">
        <h3>{{ title }}</h3>
        <div class="sub" *ngIf="detail">{{ detail }}</div>
        <label for="rebateReason">{{ optional ? 'Reason (optional)' : 'Reason' }}</label>
        <textarea id="rebateReason" rows="3" [(ngModel)]="reason" maxlength="500"
                  placeholder="Why? This is kept in the history."></textarea>
        <div class="err" *ngIf="error">{{ error }}</div>
        <div class="dialog-actions">
          <button type="button" class="btn ghost" (click)="cancel()" [disabled]="busy">Cancel</button>
          <button type="button" class="btn" [class.danger]="danger" [class.primary]="!danger"
                  (click)="confirm()" [disabled]="busy || (!optional && !reason.trim())">
            {{ busy ? 'Working…' : confirmLabel }}
          </button>
        </div>
      </div>
    </div>`,
  styleUrls: ['./rebate-desk.shared.scss']
})
export class RebateReasonDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() title = 'Reason';
  @Input() detail = '';
  @Input() confirmLabel = 'Confirm';
  @Input() danger = false;
  @Input() optional = false;
  @Input() busy = false;
  @Input() error = '';
  @Output() confirmed = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  reason = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open && !changes['open'].previousValue) this.reason = '';
  }

  confirm(): void {
    if (!this.optional && !this.reason.trim()) return;
    this.confirmed.emit(this.reason.trim());
  }

  cancel(): void {
    if (this.busy) return;
    this.reason = '';
    this.closed.emit();
  }

  /* Called by the parent after a successful save. */
  reset(): void {
    this.reason = '';
  }
}
