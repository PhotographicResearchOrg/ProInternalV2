import { Component, EventEmitter, Input, Output } from '@angular/core';

/* How far back a Rebate Desk list reaches. Lists open on 12 months (fast);
   2 years and all history are one click away. The value is sent as `months` (0 = all). */
export const REBATE_WINDOWS = [
  { months: 12, label: 'Last 12 months' },
  { months: 24, label: 'Last 2 years' },
  { months: 0, label: 'All history' }
];
export const DEFAULT_MONTHS = 12;

@Component({
  selector: 'app-rebate-window',
  template: `
    <select class="in win" [ngModel]="months" (ngModelChange)="monthsChange.emit(+$event)" title="How far back this list reaches">
      <option *ngFor="let w of windows" [ngValue]="w.months">{{ w.label }}</option>
    </select>`,
  styles: [`.win { width: auto; min-width: 150px; }`]
})
export class RebateWindowComponent {
  @Input() months = DEFAULT_MONTHS;
  @Output() monthsChange = new EventEmitter<number>();
  readonly windows = REBATE_WINDOWS;
}

/* The first date inside a window, for lists filtered in the browser (yyyy-mm-dd; '' = no limit). */
export function windowStart(months: number): string {
  if (!months || months <= 0) return '';
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().substring(0, 10);
}
