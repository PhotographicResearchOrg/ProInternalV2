import { Component , Output, EventEmitter} from '@angular/core';
import { ShippingerrorsComponent } from 'src/app/prointernalengine/components/dashboards/warehouse/shippingerrors/shippingerrors.component';
import { DataService } from 'src/app/services/data.service';
import { MessageService } from 'primeng/api';
import { ShippingErrorRecord, ShippingErrorProduct, PackingSlipData, PackingSlipHeader, PackingSlipProduct } from 'src/app/models/WH/ShippingErrorRecord';
import { AuthService } from 'src/app/services/auth.service';
import { rdSorts } from '../../../rebates/shared/rebate-sort';


@Component({
  selector: 'app-shippingerrorbrm',
  /* Its own template in the Rebate Desk look; the warehouse page keeps the original. */
  templateUrl: './shippingerrorbrm.component.html',
  styleUrls: ['../../../rebates/shared/rebate-desk.shared.scss', '../../warehouse/shippingerrors/shippingerrors.component.scss', './shippingerrorbrm.component.scss']
})

export class ShippingerrorbrmComponent extends ShippingerrorsComponent {

  override isBRMMode = true;

  @Output() errorCountChanged = new EventEmitter<number>();

  /* ---- desk-style list: chips, search, sorting ---- */
  readonly sorts = rdSorts();
  readonly sortSubmitted = (e: any) => { const d = new Date(e.dateSubmitted); return isNaN(d.getTime()) ? e.dateSubmitted : d.getTime(); };
  readonly chips = [
    { key: 'BRM', label: 'Yours (BRM)' }, { key: 'Open', label: 'Open' }, { key: 'Processed', label: 'Processed' },
    { key: 'Complete', label: 'Complete' }, { key: 'All', label: 'All' }
  ];
  chip = 'BRM';
  q = '';
  take = 50;
  trackError = (_: number, e: any) => e.id;

  private inChip(e: ShippingErrorRecord, key: string): boolean {
    if (key === 'All') return true;
    if (key === 'BRM') return this.hasBRMProduct(e);
    return e.status === key;
  }

  count(key: string): number { return this.shippingErrors.filter(e => this.inChip(e, key)).length; }

  private shownCache: { src: any; key: string; out: ShippingErrorRecord[] } | null = null;
  get shown(): ShippingErrorRecord[] {
    const q = this.q.trim().toLowerCase();
    const key = `${this.chip}|${q}`;
    if (this.shownCache && this.shownCache.src === this.shippingErrors && this.shownCache.key === key) return this.shownCache.out;
    let out = this.shippingErrors.filter(e => this.inChip(e, this.chip));
    if (q) out = out.filter(e => [e.id, e.shipnumber, e.companyName, e.account, e.contactName, e.status]
      .some(v => v != null && String(v).toLowerCase().includes(q)));
    this.shownCache = { src: this.shippingErrors, key, out };
    return out;
  }

  /* The products of an opened error, loose-typed like the original table row (it adds closed, brmMessage, ...). */
  productsOf(error: ShippingErrorRecord): any[] { return this.isLoading(error.id) ? [] : (error.products || []); }

  dispositionLabel(product: any): string {
    const v = product.selectedDisposition ?? (product.disposition != null ? String(product.disposition) : null);
    if (v == null || v === '') return 'Not set by the warehouse yet';
    return product.dispositions?.find((d: any) => String(d.value) === String(v))?.label ?? String(v);
  }

  /* The export reads the rows on screen (the base reads them from its PrimeNG table, which this view doesn't use). */
  override exportErrors() {
    (this as any).dtShippingErrors = { filteredValue: this.shown };
    super.exportErrors();
  }

  constructor(
    protected override dataService: DataService,
    protected override messageService: MessageService,
    private authService: AuthService
  ) {
    super(dataService, messageService); //  Call base constructor
  }


  override ngOnInit() {
    this.loadShippingErrors();
  }


  loadShippingErrors() {
    this.dataService.getShippingErrors().subscribe({
      next: (data) => {
        this.shippingErrors = data;

        this.filteredShippingErrors = this.shippingErrors.filter(error =>
          error.products?.some(p => (p as any).isBRMProduct)
        );

        // Emit count to parent
        this.errorCountChanged.emit(this.filteredShippingErrors.length);

      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load shipping errors.' });
      }
    });
  }



  override  sendBackToWarehouse(errorId: number, product: any): void {

    const username = this.authService.getUsername();

    if (!product.brmMessage?.trim()) {
      product.validationError = 'brm';
      return;
    }

    const payload = {
      errorId: errorId,
      productCode: product.productCode,
      reason: product.brmMessage,
      username: username
    };

    this.dataService.sendBackToWarehouse(payload).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'warn',
          summary: 'Returned',
          detail: 'Sent back to warehouse.'
        });

        this.loadShippingErrors();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to return item.'
        });
      }
    });
  }



  override markProductComplete(shippingErrorId: number, productId: number): void {

    const username = this.authService.getUsername();
 
    this.dataService.markProductComplete(shippingErrorId, productId, username).subscribe({
      next: (res) => {
        if (res?.success) {
          this.messageService.add({ severity: 'success', summary: 'Complete', detail: 'Product marked as complete.' });
          // ✅ Refresh BRM data
          this.loadShippingErrors();

          // Optional: Remove product from view or update status
          const error = this.shippingErrors.find(e => e.id === shippingErrorId);
          if (error) {
            error.products = error.products?.filter(p => p.productCode !== String(productId));



          }
        }
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to mark product complete.' });
      }
    });
  }




  // Add "Complete" action logic here later...
}
