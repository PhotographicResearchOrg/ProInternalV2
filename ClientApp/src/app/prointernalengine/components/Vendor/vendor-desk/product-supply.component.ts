import { Component, Input, OnChanges } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { ProductSupply } from 'src/app/models/vendor/vendor-desk.models';

/** Product page header strip: who the product is bought from, its brand's vendor, its class,
 *  its suspend status and stock by warehouse. All Computyme (read only) except the brand's vendor (SQL). */
@Component({
  selector: 'app-product-supply',
  template: `
    <div class="sup" *ngIf="supply?.vendor as v">
      <span class="it" [pTooltip]="'Who the product is bought from (Computyme actual vendor). Read only until product maintenance cuts over.'" tooltipPosition="bottom">
        <i class="pi pi-lock lk"></i><span class="k">Vendor</span>
        <a *ngIf="v.vendorId; else novend" class="val" [href]="'#/vendor-card?vendorId=' + v.vendorId">{{ v.vendorId }} · {{ v.vendorName || '?' }}</a>
        <ng-template #novend><span class="val muted">not set</span></ng-template>
      </span>
      <span class="it warn" *ngIf="v.vendorsDiffer" [pTooltip]="'The brand points at a different vendor (Brands & vendors). The B2B vendor filter uses the brand\\'s vendor.'" tooltipPosition="bottom">
        <i class="pi pi-exclamation-triangle"></i><span class="k">Brand's vendor</span><span class="val">{{ v.brandVendorId }} · {{ v.brandVendorName || '?' }}</span>
      </span>
      <span class="it" *ngIf="v.classNo != null" [pTooltip]="'Computyme vendor group: a product class, not a vendor.'" tooltipPosition="bottom">
        <i class="pi pi-lock lk"></i><span class="k">Class</span><span class="val">{{ v.classNo }} · {{ v.className || '?' }}</span>
      </span>
      <span class="it" [class.warn]="v.suspendStatus === '1' || v.suspendStatus === '2'" [class.bad]="v.suspendStatus === '3'" *ngIf="v.suspendStatus"
            [pTooltip]="v.suspendMeaning || ''" tooltipPosition="bottom">
        <i class="pi pi-ban"></i><span class="k">Suspended</span><span class="val">{{ v.suspendStatus }}</span>
      </span>
      <ng-container *ngFor="let w of supply?.warehouses">
        <span class="it stock" [pTooltip]="w.name + (w.city ? ', ' + w.city + (w.state ? ' ' + w.state : '') : '')" tooltipPosition="bottom">
          <i class="pi pi-building"></i><span class="k">{{ w.warehouseCode }}</span>
          <ng-container *ngIf="w.hasStockFeed; else nofeed">
            <span class="val" *ngIf="w.shipsDirectMarker">ships direct (99999)</span>
            <span class="val" *ngIf="!w.shipsDirectMarker">{{ (w.onHand ?? 0) | number }} on hand</span>
            <span class="sub" *ngIf="w.binPrimary || w.binSecondary">bin {{ w.binPrimary || '—' }}{{ w.binSecondary ? ' / ' + w.binSecondary : '' }}</span>
            <span class="sub" *ngIf="w.memberOrdersWaiting">{{ w.memberOrdersWaiting | number }} waiting</span>
            <span class="sub" *ngIf="w.onOrder">{{ w.onOrder | number }} on order</span>
            <span class="sub" *ngIf="w.stockDue">due {{ w.stockDue | date:'MMM d' }}</span>
          </ng-container>
          <ng-template #nofeed><span class="sub">no stock feed yet</span></ng-template>
        </span>
      </ng-container>
    </div>`,
  styles: [`
    .sup { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .it { display: inline-flex; align-items: baseline; gap: 6px; font-size: 12px; background: #f3f5f8; border: 1px solid #e3e7ed;
          border-radius: 8px; padding: 4px 8px; color: #1a2434; max-width: 100%; }
    .it i { font-size: 11px; color: #8a97ab; align-self: center; }
    .it .k { font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: #8a97ab; font-weight: 700; }
    .it .val { font-weight: 600; color: #1a2434; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a.val:hover { text-decoration: underline; }
    .it .sub { color: #5c6b81; }
    .it .muted { color: #8a97ab; font-weight: 500; }
    .it.warn { background: #fbeecb; border-color: #f0d79a; } .it.warn i { color: #a15c07; }
    .it.bad { background: #fbe1de; border-color: #f2b8b1; } .it.bad i { color: #b4231f; }
  `]
})
export class ProductSupplyComponent implements OnChanges {
  @Input() productId: number | string | null = null;
  supply: ProductSupply | null = null;

  constructor(private data: DataService) { }

  ngOnChanges(): void {
    const id = Number(this.productId);
    if (!id) { this.supply = null; return; }
    this.data.productSupply(id).subscribe({ next: s => this.supply = s, error: () => this.supply = null });
  }
}
