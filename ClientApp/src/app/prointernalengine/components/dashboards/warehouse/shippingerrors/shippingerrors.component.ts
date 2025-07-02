import * as XLSX from 'xlsx';
import { Component, ViewChild } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { ShippingErrorRecord, ShippingErrorProduct, PackingSlipData, PackingSlipHeader, PackingSlipProduct } from 'src/app/models/WH/ShippingErrorRecord';
import { SidebarModule } from 'primeng/sidebar';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';


type UIShippingErrorProduct = ShippingErrorProduct & {
  selectedDisposition?: string;
  brmMessage?: string;
  validationError?: 'disposition' | 'brm' | null;
  dispositions?: { label: string; value: string }[];
};


@Component({
  selector: 'app-shippingerrors',
  templateUrl: './shippingerrors.component.html',
  styleUrls: ['./shippingerrors.component.scss']
})


export class ShippingerrorsComponent {
  shippingErrors: ShippingErrorRecord[] = [];
  expandedErrorId: number | null = null;
  loadingIds: { [id: number]: boolean } = {};
  now: Date = new Date();
  showPackingSlip: boolean = false;
  packingSlipHeader: any = null;
  packingSlipProducts: any[] = [];
  packingSlipData: PackingSlipData | null = null;
  filteredShippingErrors: ShippingErrorRecord[] = []; // This will hold the filtered results
  isExporting: boolean = false; // For controlling the spinner
  selectedErrorDetails: ShippingErrorProduct[] = [];

  public dispositionsMap: { [key: string]: any[] } = {
    'Overage': [
      { label: 'Issue RA + charge items + update inventory', value: '0' },
      { label: 'Charge for items - update inventory', value: '1' },
      { label: 'Charge for items - do not update inventory', value: '2' },
      { label: 'Issue RA and charge items and do not update inventory', value: '3' },
      { label: 'BRM Soft Touch', value: '9' }
    ],
    'Shortage': [
      { label: 'Issue credit and update inventory', value: '4' },
      { label: 'Issue credit and do not update inventory', value: '5' },
      { label: 'BRM Soft Touch', value: '9' }
    ],
    'Damaged': [
      { label: 'Issue credit', value: '6' },
      { label: 'Issue RA', value: '7' },
      { label: 'Issue 50% credit to keep item as display', value: '8' },
      { label: 'BRM Soft Touch', value: '9' }
    ],
    'Forward': [
      { label: 'Complete - Order Forwarded', value: '11' }
    ],
    'Call Me': [
      { label: 'Complete - BRM call requested', value: '12' }
    ],
    'DidNotOrder': [  // Add this section for DidNotOrder
      { label: 'Issue RA + charge items + update inventory', value: '0' },
      { label: 'Charge for items - update inventory', value: '1' },
      { label: 'Charge for items - do not update inventory', value: '2' },
      { label: 'Issue RA and charge items and do not update inventory', value: '3' },
      { label: 'BRM Soft Touch', value: '9' }
    ]
  };



  @ViewChild('dtShippingErrors') dtShippingErrors!: Table;

  constructor(
    private dataService: DataService,
    private messageService: MessageService
  ) { }

  ngOnInit() {
    this.loadData();
  }


  loadData(): void {
    // Call the service to load the data
    this.dataService.getShippingErrors().subscribe({
      next: (data) => {
        this.shippingErrors = data;
        this.filterByStatus('Open'); // Default to showing only 'Open' records
      },
      error: (err) => {
        console.error('Error loading shipping errors:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load shipping errors.' });
      }
    });
  }


  filterByStatus(status: string): void {
    // Filter based on the status selected (Open, Closed, or Deleted)
    this.filteredShippingErrors = this.shippingErrors.filter(error => error.status === status);
  }

  resetFilter(): void {
    this.filteredShippingErrors = this.shippingErrors; // Reset the filter
  }


  toggleRow(error: ShippingErrorRecord) {
    if (this.expandedErrorId === error.id) {
      this.expandedErrorId = null;
      return;
    }

    this.expandedErrorId = error.id;

    if (!error.products || error.products.length === 0) {
      this.loadingIds[error.id] = true;

      this.dataService.getShippingErrorDetails(error.id).subscribe({
        next: (record) => {
          console.log('Shipping Error Details:', record);
          const index = this.shippingErrors.findIndex(e => e.id === error.id);
          if (index !== -1) {
            const products: (ShippingErrorProduct & {
              dispositions?: any[];
              selectedDisposition?: string;
              brmMessage?: string;
              validationError?: 'disposition' | 'brm' | null;
            })[] = record.products || [];

            products.forEach(p => {
              p.dispositions = this.dispositionsMap[p.errorType] || [
                { label: 'No Action', value: 'NoAction' }
              ];
              p.selectedDisposition = undefined;
              p.brmMessage = '';
              p.validationError = null;
            });

            this.shippingErrors[index].products = products;
          }
          this.loadingIds[error.id] = false;
        },
        error: () => {
          this.loadingIds[error.id] = false;
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load product details.' });
        }
      });
    }
  }



  validateErrorRecord(error: ShippingErrorRecord): boolean {
    let isValid = true;

    const products = error.products as UIShippingErrorProduct[];

    for (const product of products) {
      product.validationError = null;

 
      if (!product.selectedDisposition) {
        product.validationError = 'disposition';
        isValid = false;
      } else if (
        product.selectedDisposition === '9' &&
        (!product.brmMessage || product.brmMessage.trim() === '')
      ) {
        product.validationError = 'brm';
        isValid = false;
      }
    }
    return isValid;
  }




  isLoading(id: number): boolean {
    return !!this.loadingIds[id];
  }

  onGlobalFilter(table: Table, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    table.filterGlobal(value, 'contains');
  }


  processShippingError(error: ShippingErrorRecord) {
    // Validate the error before proceeding
    if (!this.validateErrorRecord(error)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Failed',
        detail: 'Please select a disposition for all products. BRM message is required when "BRM Soft Touch" is selected.'
      });
      return; // Stop further execution if validation fails
    }

      // Prepare the payload data to send to the backend
      const payload = error.products?.map((product: any) => {

      const customMessage = product.brmMessage && product.selectedDisposition === '9' ? product.brmMessage.trim() : null; // Only set if selectedDisposition is "9"

     


      return {
        productCode: product.productCode,
        Disposition: product.selectedDisposition,
        customMessage: customMessage, 
        errorID: error.id     
      };
    }) || []; // Default to an empty array if no products are present


    // Log the complete payload
    console.log("Final payload:", payload);


    // Call the backend API to process the shipping errors
    this.dataService.processShippingErrors(payload).subscribe({
      next: () => {
        // Success message
        this.messageService.add({
          severity: 'success',
          summary: 'Processed',
          detail: `Shipping error #${error.id} processed successfully.`
        });
      },
      error: (err) => {
        // Error handling message
        console.error('Error processing shipping error:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: `Failed to process shipping error #${error.id}. Please try again.`
        });
      }
    });
  }




  viewPackingSlip(shippingErrorId: number): void {
    // Get both packing slip and error details
    this.dataService.getPackingSlip(shippingErrorId).subscribe({
      next: (data: PackingSlipData) => {
        this.packingSlipHeader = data.header;
        this.packingSlipProducts = data.products;

        // Now load the error details too
        this.dataService.getShippingErrorDetails(shippingErrorId).subscribe({
          next: (errorDetails) => {
            this.selectedErrorDetails = errorDetails.products || [];
            this.showPackingSlip = true;
          },
          error: (err) => {
            console.error('Error fetching error details:', err);
            this.selectedErrorDetails = [];
            this.showPackingSlip = true; // Still open the sidebar with what we have
          }
        });
      },
      error: (err) => {
        console.error('Error fetching packing slip:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load packing slip.'
        });
        this.showPackingSlip = false;
      }
    });
  }


  closePackingSlip(): void {
    this.showPackingSlip = false;
  }

  isInErrorList(productCode: string): boolean {
    return this.selectedErrorDetails?.some(e => e.productCode === productCode);
  }
  printPackingSlip() {

    const content = document.getElementById('packing-slip-content');
    if (!content) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(`
    <html>
      <head>
        <title>Packing Slip</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 1rem; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 6px; text-align: left; font-size: 13px; }
          th { background-color: #f5f5f5; }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
    </html>
  `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }






  exportErrors() {

    this.isExporting = true;  // Show the spinner


    const visibleErrors: ShippingErrorRecord[] =
      this.dtShippingErrors.filteredValue || this.shippingErrors;

    // Combine the data from all models
    const allData: any[] = [];

    for (const error of visibleErrors) {
      const errorData: any = {
        ...error, // Start with the shipping error data
        products: [] // This will hold the products and packing slip data
      };

      this.dataService.getShippingErrorDetails(error.id).subscribe({
        next: (errorDetails) => {
          // Merge the error details into the shipping error data
          errorData.products = errorDetails.products || [];

          // Now call getPackingSlip for the current error
          this.dataService.getPackingSlip(error.id).subscribe({
            next: (packingSlipData) => {
              // Merge packing slip data with the error's product data
              const productsWithPackingSlip = errorData.products.map((product: any) => {
                const packingSlipProduct = packingSlipData.products?.find((p: any) => p.productCode === product.productCode);
                return {
                  ...product,
                  quantityOrdered: packingSlipProduct?.quantityOrdered || 0,
                  quantityShipped: packingSlipProduct?.quantityShipped || 0,
                };
              });

              // Add the updated products with packing slip to the error data
              errorData.products = productsWithPackingSlip;

              // Push the updated error data into allData array
              allData.push(errorData);
            },
            error: (err) => {
              console.error('Error fetching packing slip for shipping error:', error.id, err);
              // If packing slip is not available, continue to next step
              allData.push(errorData); // Add error data without packing slip
            }
          });
        },
        error: (err) => {
          console.error('Error fetching details for shipping error:', error.id, err);
          // Continue processing other errors even if one fails
          allData.push(errorData); // Add error data without products
        }
      });
    }

    // After processing all records, export the data
    setTimeout(() => {
      this.exportToExcel(allData); // Export data after requests finish
    }, 5000); // Timeout to allow async calls to finish
  }

  exportToExcel(data: any[]) {
    const flatData = data.map((error: any) => {
      return error.products.map((product: any) => ({
        ShippingErrorID: error.id,
        Company: error.companyName,
        Account: error.account,
        Status: error.status,
        DateSubmitted: error.dateSubmitted,
        ContactName: error.contactName,
        ContactEmail: error.contactEmail,
        ContactPhone: error.contactPhone,
        RMAStatus: error.rmaStatus,
        ProductCode: product.productCode,
        ProductDescription: product.productDescription,
        Quantity: product.quantity,
        ErrorType: product.errorType,
        Cost: product.cost,
        Serial: product.serial,
        QuantityOrdered: product.quantityOrdered,
        QuantityShipped: product.quantityShipped
      }));
    }).flat();

    // Create worksheet from the flat data
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(flatData);
    const wb: XLSX.WorkBook = { Sheets: { 'data': ws }, SheetNames: ['data'] };

    // Write file
    XLSX.writeFile(wb, 'ShippingErrors.xlsx');

    this.isExporting = false; // Hide the spinner after export is done
  }
}

