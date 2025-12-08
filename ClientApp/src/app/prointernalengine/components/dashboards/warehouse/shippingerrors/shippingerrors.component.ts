import * as XLSX from 'xlsx';
import { Component, ViewChild } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { ShippingErrorRecord, ShippingErrorProduct, PackingSlipData, PackingSlipHeader, PackingSlipProduct } from 'src/app/models/WH/ShippingErrorRecord';
import { SidebarModule } from 'primeng/sidebar';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ShippingerrorbrmComponent } from 'src/app/prointernalengine/components/dashboards/BRM/shippingerrorbrm/shippingerrorbrm.component';


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
      { label: 'BRM Soft Touch', value: '9' }
    ],
    'Forward': [
      { label: 'Complete - Order Forwarded', value: '11' }
    ],
    'Call Me': [
      { label: 'Complete - BRM call requested', value: '12' },
        { label: 'BRM Soft Touch', value: '9' } // Add this line
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
    protected dataService: DataService,
    protected messageService: MessageService
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


  hasBRMProduct(error: ShippingErrorRecord): boolean {
    return error.products?.some(p => (p as any).isBRMProduct) ?? false;
  }


  filterByStatus(status: string): void {
    if (status === 'BRM') {
      this.filterByBRM();
      return;
    }
    // Filter based on the status selected (Open, Closed, or Deleted)
    this.filteredShippingErrors = this.shippingErrors.filter(error => error.status === status);
  }

  resetFilter(): void {
    this.filteredShippingErrors = this.shippingErrors; // Reset the filter
  }



  markProductComplete(errorId: number, product: any): void {
    const payload = {
      errorId: errorId,
      productCode: product.productCode
    };

  }



  //toggleRow(error: ShippingErrorRecord) {
  //  if (this.expandedErrorId === error.id) {
  //    this.expandedErrorId = null;
  //    return;
  //  }
  //  this.expandedErrorId = error.id;
  //  const index = this.shippingErrors.findIndex(e => e.id === error.id);
  //  if (index === -1) return;
  //  const products = error.products || [];
  //  const isEditable = error.status === 'Open';  //  define this!
  //  products.forEach(p => {
  //    const disp = String(p.Disposition || '');

  //    (p as any).dispositions = this.dispositionsMap[p.errorType] || [
  //      { label: 'No Action', value: 'NoAction' }
  //    ];
  //    //(p as any).selectedDisposition = (p as any).disposition != null ? String((p as any).disposition) : '';
  //    (p as any).selectedDisposition = (p.Disposition != null && String(p.Disposition).trim() !== '')
  //      ? String(p.Disposition)
  //      : '';
  //    (p as any).brmMessage = p.customMessage || '';
  //    (p as any).validationError = null;
  //    (p as any).isBRMDisposition = disp === '9' && !!p.customMessage?.trim();
  //    (p as any).readOnly = !isEditable;
  //  }); 
  //  this.shippingErrors[index].products = products;
  //}



  toggleRow(error: ShippingErrorRecord) {

    console.log('Raw Products for Error', error.id, error.products);


    if (this.expandedErrorId === error.id) {
      this.expandedErrorId = null;
      return;
    }

    this.expandedErrorId = error.id;
    const index = this.shippingErrors.findIndex(e => e.id === error.id);
    if (index === -1) return;

    const products = error.products || [];
    const isEditable = error.status === 'Open';

    products.forEach(p => {
      const dispositionValue = p.disposition != null ? String(p.disposition) : '';

      const rawOptions = this.dispositionsMap[p.errorType] || [
        { label: 'No Action', value: 'NoAction' }
      ];

      const normalizedOptions = rawOptions.map(opt => ({
        label: opt.label,
        value: String(opt.value).trim()
      }));

      const match = normalizedOptions.find(o => o.value === dispositionValue);

      console.log({
        productCode: p.productCode,
        dispositionValue,
        matched: !!match,
        options: normalizedOptions.map(o => o.value)
      });

      (p as any).dispositions = normalizedOptions;
      (p as any).selectedDisposition = match ? dispositionValue : null;
      (p as any).brmMessage = p.customMessage || '';
      (p as any).validationError = null;
      (p as any).isBRMDisposition = dispositionValue === '9' && !!p.customMessage?.trim();
      (p as any).readOnly = !isEditable;
    });



    this.shippingErrors[index].products = products;



  }




  allProductsClosed(error: ShippingErrorRecord): boolean {
    return error.products?.every(p =>
      p.disposition != null && String(p.disposition).trim() !== ''
    ) ?? false;
  }





  filterByBRM(): void {
    this.filteredShippingErrors = this.shippingErrors.filter(error =>
      error.products?.some(p => (p as any).isBRMProduct)
    );
  }

  validateErrorRecord(error: ShippingErrorRecord): boolean {
    let isValid = true;

    const products = error.products as UIShippingErrorProduct[];

    for (const product of products) {
      product.validationError = null;

      const disposition = product.selectedDisposition || String(product.disposition || '');

      if (!disposition.trim()) {
        product.validationError = 'disposition';
        isValid = false;
      } else if (
        disposition === '9' &&
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


      const customMessage = product.brmMessage && product.selectedDisposition === '9' ? product.brmMessage.trim() : "NA"; // Only set if selectedDisposition is "9"

     


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
        this.loadData(); // ✅ Refresh data
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

        //this.packingSlipProducts = (data.products || []).sort((a, b) =>
        //  b.productCode.localeCompare(a.productCode)
        //);

        this.packingSlipProducts = (data.products || []).sort((a, b) =>
          Number(b.productCode) - Number(a.productCode)
        );

        // Now load the error details too
        this.dataService.getShippingErrorDetails(shippingErrorId).subscribe({
          next: (errorDetails) => {


            //this.selectedErrorDetails = (errorDetails.products || []).sort((a, b) =>
            //  b.productCode.localeCompare(a.productCode)
            //);

            this.selectedErrorDetails = (errorDetails.products || []).sort((a, b) =>
              Number(b.productCode) - Number(a.productCode)
            );

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

  hasDamaged(error: ShippingErrorRecord): boolean {
    return error.products?.some(p => p.errorType === 'Damaged') ?? false;
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



  shouldShowPrintRA(error: ShippingErrorRecord): boolean {
    const hasRAStatus = error.rmaStatus === 'RMA Requested';
    const hasRAProduct = error.products?.some(p =>
      [0, 3, 7].includes(Number(p.disposition ?? -1))
    );

    return hasRAStatus || hasRAProduct;
  }



  printRA(error: ShippingErrorRecord): void {
    const qualifying = error.products?.filter(p =>
      [0,3,7].includes(Number(p.disposition ?? -1)) // default to -1 if undefined
    ) || [];

    if (!qualifying.length) {
      this.messageService.add({
        severity: 'info',
        summary: 'No RA Required',
        detail: `No returnable products found for Error #${error.id}`
      });
      return;
    }

    const raWindow = window.open('', '_blank', 'width=800,height=600');
    if (!raWindow) return;

    const html = this.buildRAHtml(error, qualifying);
    raWindow.document.write(html);
    raWindow.document.close();
    raWindow.focus();
    raWindow.print();
  }

  buildRAHtml(error: ShippingErrorRecord, products: ShippingErrorProduct[]): string {
    return `
    <html>
      <head>
        <title>RA #${error.id}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
          .header { display: flex; justify-content: space-between; }
          .return-address { text-align: right; font-size: 14px; line-height: 1.6; }
          h2 { border-bottom: 1px solid #000; padding-bottom: 5px; margin-top: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          .instructions { margin-top: 20px; padding: 10px; background-color: #f0f0f0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h2>Return Authorization (RA)</h2>
            <p><strong>RA #: </strong> ${error.id}</p>
            <p><strong>Submitted By:</strong> ${error.contactName} (${error.contactEmail})</p>
            <p><strong>Account:</strong> ${error.companyName}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          <div class="return-address">
            <strong>Return To:</strong><br/>
            Pro Warehouse<br/>
            Attn: Promaster Customer Returns<br/>
            2950 Turnpike Drive<br/>
            Hatboro, PA 19040<br/>
            Phone: (800) 906-3614<br/>
            Email: custserv@promaster.com
          </div>
        </div>

        <div class="instructions">
          <strong>Instructions:</strong><br/>
          Please include this RA form inside the return box and write the RA number on the outside of the box. Returns must be received by <strong>${this.getDatePlusDays(30)}</strong>.
        </div>

        <h3>Return Items</h3>
        <table>
          <thead>
            <tr>
              <th>Product Code</th>
              <th>Description</th>
              <th>Quantity</th>
              <th>Error Type</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td>${p.productCode}</td>
                <td>${p.productDescription}</td>
                <td>${p.quantity}</td>
                <td>${p.errorType}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;
  }
  getDatePlusDays(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString();
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

