import { Component, HostListener, Input } from '@angular/core';

/* What each purgatory problem means and what to do, shown from the ⓘ beside it. */
export const REBATE_DIRECTIONS: { [code: string]: { title: string; steps: string[] } } = {
  DISPOSITION: {
    title: 'How a row finds its rebate product',
    steps: [
      'The vendor SKU (with the vendor\'s catalog prefix), the UPC or the PRO code finds the PRO product.',
      'The rebate product name is built from the naming rules: IR = product name; trade-in adds "TRADE-IN TRADE-UP"; bundle and free-with-purchase add "WITH" and the stack product; coupon adds "WITH COUPON CODE"; social adds "WITH SOCIAL MEDIA".',
      'That name finds the rebate product. If none exists yet, use "Create rebate products" at the top of the upload.',
      'Several PRO products fit? Tick the right one, or tick several (colours) to put them on one rebate product.',
      'Picking a rebate product yourself overrides all of this for that row (↺ hands it back).'
    ]
  },
  AMBIGUOUS_PRODUCT: {
    title: 'Several PRO products match',
    steps: [
      'Usually the same SKU or UPC on more than one product, or one vendor line that covers several colours.',
      'One product: tick it and click Use.',
      'Several colours on one rebate: tick each colour and click Use. The first one ticked is the primary code.',
      'None of them: type the right PRO code in "PRO code(s)" and save.'
    ]
  },
  NO_PRODUCT: {
    title: 'No PRO product matches',
    steps: [
      'Check the vendor SKU and UPC on the line.',
      'PRO catalog numbers often carry a prefix (SmallRig: SR_). Set it once in Vendors → this vendor → terms, then the whole file re-matches.',
      'If the brand ids in the vendor terms are set, the product must be under one of them.',
      'Or type the PRO code(s) on the line and save.'
    ]
  },
  NO_MODEL: {
    title: 'No rebate product with this name yet',
    steps: [
      'The name shown is what the naming rules call for.',
      'Create it: "Create rebate products" at the top of the upload makes all of them at once, or "Create" on this line.',
      'Or pick an existing rebate product if it is named differently.'
    ]
  },
  MODEL_RETIRED: {
    title: 'The rebate product is retired',
    steps: ['Reactivate it in Products, or pick another rebate product for the line.']
  },
  NO_STACK: {
    title: 'Bundle or free-with-purchase without its stack product',
    steps: ['Enter the PRO code or vendor SKU of what it comes with in "Stack product(s)". Several: separate with commas.']
  },
  STACK_UNKNOWN: {
    title: 'The stack product is not found',
    steps: ['Fix the stack PRO code or SKU on the line. The vendor\'s catalog prefix applies to stack SKUs too.']
  },
  NO_DATES: { title: 'Dates are missing', steps: ['Enter start and end on the line, or set the program dates for the whole file when mapping.'] },
  DATES_REVERSED: { title: 'Start is after end', steps: ['Swap or correct the dates on the line.'] },
  BAD_REIMBURSEMENT: {
    title: 'No vendor reimbursement',
    steps: ['Enter the vendor share (what PRO claims back) on the line, or set the vendor share % in the vendor terms and re-map.']
  },
  NEGATIVE_AMOUNT: { title: 'A negative amount', steps: ['Instant rebate, MAP and PRO pad must be zero or more.'] },
  NO_TYPE: { title: 'Rebate type missing', steps: ['Choose the type on the line, or set a default type for the file when mapping.'] },
  UNKNOWN_TYPE: { title: 'Rebate type not recognised', steps: ['Choose one of IR, Trade-in Trade-up, Bundle, Coupon, Social media, Free with purchase.'] },
  DUPLICATE_IN_FILE: { title: 'The same program twice in the file', steps: ['Skip this line; the earlier one loads.'] },
  OVERLAP_IN_FILE: { title: 'Overlaps another line of this file', steps: ['Same product and type with overlapping dates. Fix the dates or skip one line.'] },
  OVERLAP: {
    title: 'Overlaps a live program',
    steps: ['A program for the same product and type is already on for some of these dates.', 'Change these dates, or turn the live one off or change its dates in Programs.']
  },
  ALREADY_LOADED: { title: 'Already loaded', steps: ['The same program is already live. Skip this line.'] }
};

@Component({
  selector: 'app-rebate-help',
  template: `
    <span class="help-wrap">
      <button type="button" class="help-icon" (click)="toggle($event)" [title]="'Directions: ' + (entry?.title || '')">
        <i class="pi pi-info-circle"></i><span *ngIf="label"> {{ label }}</span>
      </button>
      <div class="help-pop" *ngIf="open && entry" [style.top.px]="top" [style.left.px]="left" (click)="$event.stopPropagation()">
        <b>{{ entry.title }}</b>
        <ol><li *ngFor="let s of entry.steps">{{ s }}</li></ol>
      </div>
    </span>`,
  styles: [`
    .help-wrap { position: relative; display: inline-block; }
    .help-icon { border: none; background: none; cursor: pointer; color: #1d4f91; padding: 0 2px; font: inherit; font-size: 12px; }
    .help-pop { position: fixed; z-index: 1000; width: 320px; max-height: 70vh; overflow: auto; background: #fff; color: #1a2434;
      border: 1px solid #d9dee6; border-radius: 10px; padding: 10px 12px; box-shadow: 0 10px 30px rgba(20, 28, 43, .15);
      font-size: 12.5px; font-weight: 400; white-space: normal; text-align: left; }
    .help-pop ol { margin: 6px 0 0; padding-left: 18px; }
    .help-pop li { margin-bottom: 4px; }
  `]
})
export class RebateHelpComponent {
  @Input() code = 'DISPOSITION';
  @Input() label = '';
  open = false;
  top = 0;
  left = 0;

  get entry(): { title: string; steps: string[] } | undefined { return REBATE_DIRECTIONS[this.code]; }

  /* Opens below the icon, kept inside the window (it was cut off at the right edge in side panels). */
  toggle(e: Event): void {
    e.stopPropagation();
    this.open = !this.open;
    if (!this.open) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const w = 320, gap = 12;
    this.left = Math.max(gap, Math.min(r.left, window.innerWidth - w - gap));
    const below = r.bottom + 6;
    this.top = below + 260 > window.innerHeight ? Math.max(gap, r.top - 266) : below;
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onMove(): void { this.open = false; }

  @HostListener('document:click')
  close(): void { this.open = false; }
}
