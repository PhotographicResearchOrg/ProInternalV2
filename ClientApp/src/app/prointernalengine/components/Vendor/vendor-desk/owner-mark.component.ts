import { Component, Input } from '@angular/core';
import { DataOwner } from 'src/app/models/vendor/vendor-desk.models';

/** One mark per owner, used on every screen that shows data Computyme or SQL masters.
 *  lock = Computyme is master (read only here) · database = SQL is master (edit here)
 *  plus = PIV2 extension (only in PIV2) · split = part of each */
export const OWNER_INFO: Record<DataOwner, { icon: string; label: string; tip: string; cls: string }> = {
  COMPUTYME: { icon: 'pi pi-lock', label: 'Computyme master', tip: 'Computyme is master. Shown here read only, from the EDA mirror.', cls: 'om-cty' },
  SQL: { icon: 'pi pi-database', label: 'SQL master', tip: 'SQL is master. Edited here; the B2B site and PIV2 read it.', cls: 'om-sql' },
  MIXED: { icon: 'pi pi-arrows-h', label: 'Mixed', tip: 'Part Computyme (locked), part SQL or PIV2 extension.', cls: 'om-mix' },
  EXTENSION: { icon: 'pi pi-plus-circle', label: 'PIV2 extension', tip: 'Exists only in PIV2. Computyme has nothing like it.', cls: 'om-ext' }
};

@Component({
  selector: 'app-owner-mark',
  template: `
    <span class="om" [ngClass]="info.cls" [class.compact]="compact" [pTooltip]="info.tip" tooltipPosition="top">
      <i [class]="info.icon"></i><span *ngIf="!compact">{{ info.label }}</span>
    </span>`,
  styles: [`
    .om { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; line-height: 1;
          padding: 4px 8px; border-radius: 999px; white-space: nowrap; border: 1px solid transparent; }
    .om i { font-size: 11px; }
    .om.compact { padding: 3px 5px; }
    .om-cty { color: #475569; background: #eef1f5; border-color: #d9dee6; }
    .om-sql { color: #0e7c73; background: #dff1ef; border-color: #b7e0dc; }
    .om-mix { color: #a15c07; background: #fbeecb; border-color: #f0d79a; }
    .om-ext { color: #5b4bb5; background: #e9e6f7; border-color: #cfc8ee; }
  `]
})
export class OwnerMarkComponent {
  @Input() owner: DataOwner = 'COMPUTYME';
  @Input() compact = false;
  get info() { return OWNER_INFO[this.owner] || OWNER_INFO.COMPUTYME; }
}

@Component({
  selector: 'app-owner-legend',
  template: `
    <div class="legend">
      <span class="k">Who is master</span>
      <span *ngFor="let o of owners" class="it">
        <app-owner-mark [owner]="o"></app-owner-mark>
        <span class="t">{{ text[o] }}</span>
      </span>
    </div>`,
  styles: [`
    .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; font-size: 12px; color: #5c6b81; }
    .k { font-weight: 700; text-transform: uppercase; letter-spacing: .06em; font-size: 10.5px; color: #8a97ab; }
    .it { display: inline-flex; align-items: center; gap: 6px; }
    /* phones: the four marks on one line, the explanation is in each mark's tooltip */
    @media (max-width: 760px) { .legend { gap: 6px; } .t { display: none; } }
  `]
})
export class OwnerLegendComponent {
  owners: DataOwner[] = ['COMPUTYME', 'SQL', 'EXTENSION', 'MIXED'];
  text: Record<DataOwner, string> = {
    COMPUTYME: 'read only until cut over',
    SQL: 'edit here',
    EXTENSION: 'only in PIV2',
    MIXED: 'part of each'
  };
}
