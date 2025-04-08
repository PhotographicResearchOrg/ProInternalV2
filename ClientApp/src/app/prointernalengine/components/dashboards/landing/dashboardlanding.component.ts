import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Subscription, debounceTime } from 'rxjs';
import { Product } from 'src/app/prointernalengine/api/product';
import { downloadCsv, CsvColumn } from 'src/app/services/csv.service';
import { Products } from "src/app/models/Dashboard/Products";
import { AppConfig,LayoutService,} from 'src/app/layout/service/app.layout.service';
import { ProductService } from '../../../service/product.service';
import { Table } from 'primeng/table';
import { DataService } from 'src/app/services/data.service';
import { Account } from "src/app/models/Dashboard/Account";
import { OrdersMetrics } from 'src/app/models/Dashboard/OrdersMetrics'
import { SARMetrics } from 'src/app/models/Dashboard/SARMetrics'
import { EDIMetrics } from 'src/app/models/Dashboard/EDIMetrics'
import { IRMetrics } from 'src/app/models/Dashboard/IRMetrics'
import { ShippingErrorMetrics } from 'src/app/models/Dashboard/ShippingErrorMetrics'
import { CommentsMetrics } from 'src/app/models/Dashboard/CommentsMetrics'
import { AutoCompleteModule } from 'primeng/autocomplete';
import { SpecialOrdersSummary } from 'src/app/models/Dashboard/SpecialOrdersSummary'
import { comments } from 'src/app/models/Dashboard/comments'
import { MapViolationResponse } from 'src/app/models/Dashboard/MapViolationResponse';
import { MapViolation } from 'src/app/models/Dashboard/MapViolation';

@Component({
  templateUrl: './dashboardlanding.component.html',

})
export class DashboardLandingComponent implements OnInit {

  accounts: Account[] = [];
  products: Products[] = [];

  comments: comments[] = [];

  mapViolationSubmitted = false;
  mapSubmittedAt: Date = new Date();

  filteredAccounts: Account[] = [];
  filteredProducts: Products[] = [];

  public submittedAccountSummary: Account[] = [];
  public submittedProductSummary: Products[] = [];

  selectedAccountsAdvanced: Account[] = [];
  selectedProductsAdvanced: Products[] = [];
  public existingViolations: MapViolation[] = [];

  penaltyOptions: any[] = [];
  penalty: number = 0;

  chartData: any;
  chartOptions: any;
  config: AppConfig = this.layoutService.config();
  specialOrders!: SpecialOrdersSummary[];

  public OrderMetrics: OrdersMetrics = new OrdersMetrics();
  public SARMetrics: SARMetrics = new SARMetrics();
  public EDIMetrics: EDIMetrics = new EDIMetrics();
  public IRMetrics: IRMetrics = new IRMetrics();
  public ShippingErrorMetrics: ShippingErrorMetrics = new ShippingErrorMetrics();
  public CommecntsMetric: CommentsMetrics = new CommentsMetrics();


  public SelectedAccount: Account = new Account();
  public SelectedProduct: Products = new Products();



    items!: MenuItem[];
    cols: any[] = [];
    subscription!: Subscription;
    @ViewChild('chatcontainer') chatContainerViewChild!: ElementRef;

  constructor(
    private productService: ProductService,
    public layoutService: LayoutService,
    private dataService: DataService,
   // private messageService: MessageService
  ) {
        this.subscription = this.layoutService.configUpdate$
          .pipe(debounceTime(25))
          .subscribe((config) => {
          this.chartInit();
            });
    }



      ngOnInit()
      {
      this.penaltyOptions = [
        { name: '30 Days', value: 30 },
        { name: '45 Days', value: 45 },
        { name: '60 Days', value: 60 },
        { name: 'Indefinite', value: 9999 },
      ];




        this.dataService.getComments().subscribe((data) => {
        
          this.comments = data;
       
        });


      this.dataService.getAccounts().subscribe((resp: any) => {
        this.accounts = resp;
      });

      

      this.dataService.getOrderMetrics().subscribe((resp: any) => {
      this.OrderMetrics.openOrders = resp.openOrders,
      this.OrderMetrics.onHoldOrders = resp.onHoldOrders,
      this.OrderMetrics.specialsOrders = resp.specialsOrders,
      this.OrderMetrics.dropShipOrders = resp.dropShipOrders,
      this.OrderMetrics.lastRunTime = resp.lastRunTime
      this.OrderMetrics.oldestOnHold = resp.oldestOnHold,
      this.OrderMetrics.threshold = resp.threshold
    });

      this.dataService.getSARSMetrics().subscribe((resp: any) => {
      this.SARMetrics.memCreditsInQueue = resp.memCreditsInQueue,
      this.SARMetrics.proHoldInQueue = resp.proHoldInQueue,
      this.SARMetrics.totalInQueue = resp.totalInQueue,
      this.SARMetrics.oldestInQueue = resp.oldestInQueue   
    });

      this.dataService.getEDIMetrics().subscribe((resp: any) => {
      this.EDIMetrics.openEDIOrders = resp.openEDIOrders,
      this.EDIMetrics.ediAlertThreshold = resp.ediAlertThreshold
      this.EDIMetrics.oldestInQueue = resp.oldestInQueue 
    });

      this.dataService.getIRMetrics().subscribe((resp: any) => {
      this.IRMetrics.irsInQueue = resp.irsInQueue,
      this.IRMetrics.threshold = resp.threshold,
      this.IRMetrics.oldestInQueue = resp.oldestInQueue     
    });

      this.dataService.getShippingErrorMetrics().subscribe((resp: any) => {
      this.ShippingErrorMetrics.openShippingErrors = resp.openShippingErrors,
      this.ShippingErrorMetrics.threshold = resp.threshold,
      this.ShippingErrorMetrics.oldestInQueue = resp.oldestInQueue
    });

      this.dataService.getCommentMetrics().subscribe((resp: any) => {
      this.CommecntsMetric.unresponded = resp.unresponded,
      this.CommecntsMetric.recentCommentDate = resp.recentCommentDate
    });

      this.dataService
        .getOrdersSnapshot()
        .subscribe((data: any) => (this.specialOrders = data));

      this.cols =
        [
        { header: 'Prod', field: 'productCode' },
        { header: 'Cat #', field: 'caT_NO' },
        { header: 'Model', field: 'modelName' },
        { header: 'Order Date', field: 'enterDate' },
        { header: 'Quantity', field: 'quantity' },
        { header: 'Inv', field: 'inventory' },        
        { header: 'Account #', field: 'accountNumber' },  
        { header: 'Status', field: 'status' }
        ];
    this.chartInit();
  }


  filterAccount(event: any) {
    const filtered: Account[] = [];
    const query = event.query;
    for (let i = 0; i < this.accounts.length; i++) {
      const account = this.accounts[i];
      if (account.accountName.toLowerCase().indexOf(query.toLowerCase()) == 0 || account.accountNumber.toString().indexOf(query.toLowerCase()) == 0) {
        filtered.push(account);
      }
    }
    this.filteredAccounts = filtered;
  }

  filterProduct(event: any) {
    const query = event.query.toLowerCase();

    this.dataService.getProducts(query).subscribe((resp: Products[]) => {
      this.products = resp;

      this.filteredProducts = this.products.filter(product =>
        product.productCode.toLowerCase().includes(query) ||
        product.modelName.toLowerCase().includes(query)  
      ).map(product => ({
        ...product,
        modelName: `${product.productCode} - ${product.modelName}`  // 👈 update for display only
      }));
        
    });
  }


  downloadFile()
  {
    this.dataService.downloadCSV().subscribe
      (
        (response) =>
        {
          const columns: CsvColumn[] = [
            {
              key: "accountNumber",
              title: "Account Number"
            },
            {
              key: "accountName",
              title: "Account Name"
            }    
          ];

          downloadCsv(response.toString(), columns, "Map_Violations_" + Date().toString());
        }     
    )
};

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/layout/images/avatar.png'; // fallback avatar
  }

  getAvatarUrl(email: string): string {
    const sanitized = email.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `/content/uploads/${sanitized}/avatar.jpg`;
  }



  onSelectedAccount(event: any) {

   
    this.SelectedAccount = event.value.accountNumber;

   // this.SelectedAccount = event; // assign the full object
  }

  onSelectedProduct(event: any) {
   
    this.SelectedProduct = event.value.productCode;

  //  this.SelectedProduct = event; // assign the full object
  }

  onSelectedPenalty(event: any) {
    this.penalty = event.value;
  }

  MapViolationSubmit(): void {


    if (!this.SelectedAccount || !this.SelectedProduct || !this.penalty) {
      //this.messageService.add({
      //  severity: 'warn',
      //  summary: 'Validation',
      //  detail: 'Please ensure all fields are selected.'
      //});
      return;
    }



    this.selectedAccountsAdvanced = [this.SelectedAccount];
    this.selectedProductsAdvanced = [this.SelectedProduct];

    this.selectedAccountsAdvanced = [];
    this.selectedProductsAdvanced = [];

    const payload = {
      accountNumber: this.SelectedAccount.toString(),
      productCode: this.SelectedProduct.toString(),
      penaltyDays: this.penalty
    };



    this.dataService.submitMapViolation(payload).subscribe({
      next: (res: MapViolation[]) => {

        const accountMatch = this.accounts.find(acc => acc.accountNumber.toString() === res[0].accountNumber);
        const productMatch = this.products.find(prod => prod.productCode === res[0].productCode);


        this.submittedAccountSummary = accountMatch ? [accountMatch] : [];
        this.submittedProductSummary = productMatch ? [productMatch] : [];


        this.mapViolationSubmitted = true;
        this.mapSubmittedAt = new Date();
        this.existingViolations = res;






      },
      error: (err) => {
        //this.messageService.add({
        //  severity: 'error',
        //  summary: 'Error',
        //  detail: err?.error?.message || 'Submission failed'
        //});
      }
    });
  }


  toggleExcerpt(comment: any): void {
    comment.showFullExcerpt = !comment.showFullExcerpt;
  }
 

    chartInit() {
        const textColor =
            getComputedStyle(document.body).getPropertyValue('--text-color') ||
            'rgba(0, 0, 0, 0.87)';
        const surface300 = getComputedStyle(document.body).getPropertyValue(
            '--surface-300'
        );

        this.items = [
            {
                label: 'Options',
                items: [
                    { label: 'Add New', icon: 'pi pi-fw pi-plus' },
                    { label: 'Search', icon: 'pi pi-fw pi-search' },
                ],
            },
        ];

        this.chartData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [
                {
                    label: '% Inquiry',
                    data: [11, 17, 30, 60, 88, 92],
                    backgroundColor: 'rgba(13, 202, 240, .2)',
                    borderColor: '#0dcaf0',
                    pointBackgroundColor: '#0dcaf0',
                    pointBorderColor: '#0dcaf0',
                    pointBorderWidth: 0,
                    pointStyle: 'line',
                    fill: false,
                    tension: 0.4,
                },
                {
                    label: '%Stock',
                    data: [11, 19, 39, 59, 69, 71],
                    backgroundColor: 'rgba(253, 126, 20, .2)',
                    borderColor: '#fd7e14',
                    pointBackgroundColor: '#fd7e14',
                    pointBorderColor: '#fd7e14',
                    pointBorderWidth: 0,
                    pointStyle: 'line',
                    fill: false,
                    tension: 0.4,
                },
                {
                    label: '% Back Order',
                    data: [11, 17, 21, 30, 47, 83],
                    backgroundColor: 'rgba(111, 66, 193, .2)',
                    borderColor: '#6f42c1',
                    pointBackgroundColor: '#6f42c1',
                    pointBorderColor: '#6f42c1',
                    pointBorderWidth: 0,
                    pointStyle: 'line',
                    fill: true,
                    tension: 0.4,
                },
            ],
        };

        this.chartOptions = {
            plugins: {
                legend: {
                    fill: true,
                    labels: {
                        color: textColor,
                    },
                },
            },
            scales: {
                y: {
                    max: 100,
                    min: 0,
                    grid: {
                        color: surface300,
                    },
                    ticks: {
                        color: textColor,
                    },
                },
                x: {
                    grid: {
                        display: true,
                        color: surface300,
                    },
                    ticks: {
                        color: textColor,
                        beginAtZero: true,
                    },
                },
            },
        };
    }

    onEmojiClick(chatInput: any, emoji: string) {
        if (chatInput) {
            chatInput.value += emoji;
            chatInput.focus();
        }
    }

    onGlobalFilter(table: Table, event: Event) {
        table.filterGlobal(
            (event.target as HTMLInputElement).value,
            'contains'
        );
    }
}
