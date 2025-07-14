import { Component , Output, EventEmitter} from '@angular/core';
import { ShippingerrorsComponent } from 'src/app/prointernalengine/components/dashboards/warehouse/shippingerrors/shippingerrors.component';
import { DataService } from 'src/app/services/data.service';
import { MessageService } from 'primeng/api';
import { ShippingErrorRecord, ShippingErrorProduct, PackingSlipData, PackingSlipHeader, PackingSlipProduct } from 'src/app/models/WH/ShippingErrorRecord';
import { AuthService } from 'src/app/services/auth.service'; 


@Component({
  selector: 'app-shippingerrorbrm',
  templateUrl: '../../warehouse/shippingerrors/shippingerrors.component.html',
  styleUrls: ['../../warehouse/shippingerrors/shippingerrors.component.scss']
})

export class ShippingerrorbrmComponent extends ShippingerrorsComponent {

  @Output() errorCountChanged = new EventEmitter<number>();

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
        this.shippingErrors = data.filter(error =>
          error.products?.some(p => (p as any).isBRMProduct)
        );
        this.filteredShippingErrors = this.shippingErrors;


        // Emit count to parent
        this.errorCountChanged.emit(this.filteredShippingErrors.length);

      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load shipping errors.' });
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
