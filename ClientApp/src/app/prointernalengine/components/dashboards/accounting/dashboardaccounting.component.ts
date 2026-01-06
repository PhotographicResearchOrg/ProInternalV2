import { Component, OnInit, inject } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { Subscription, debounceTime } from 'rxjs';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageModule } from 'primeng/message';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { DataService } from 'src/app/services/data.service';
import { BatchRunResponse } from 'src/app/models/Uvicorn/PassThroughInvoice';




interface MonthlyPayment {
    name?: string;
    amount?: number;
    paid?: boolean;
    date?: string;
}

@Component({
    templateUrl: './dashboardaccounting.component.html',
})



export class DashboardAccountingComponent implements OnInit {

    invoiceNumber = '';
    dropdownItem: SelectItem[] = [];
    selectedDropdownItem: any;
    payments: MonthlyPayment[] = [];
    visitorChart: any;
    visitorChartOptions: any;
    subscription!: Subscription;
    isRunning = false;
    lastRunAt: Date | null = null;
    lastResult: BatchRunResponse | null = null;
    lastOk = false;
    successSummary = '';
    errorSummary = '';
    showRaw = false;


    isRunningSingle = false;
    lastSingleRunAt: Date | null = null;
    singleResult: any = null;
    singleOk = false;
    singleSummary = '';
    showSingleRaw = false;

  constructor(public layoutService: LayoutService,  public confirm: ConfirmationService, public toast: MessageService, public dataService: DataService) {
        this.subscription = this.layoutService.configUpdate$
            .pipe(debounceTime(25))
            .subscribe((config) => {
                this.initChart();
            });
  }


    ngOnInit() {
        this.dropdownItem.push({ label: 'Select One', value: null });
        this.dropdownItem.push({
            label: 'Xbox Series X',
            value: { id: 1, name: 'Xbox One', code: 'XO' },
        });
        this.dropdownItem.push({
            label: 'PlayStation 5',
            value: { id: 2, name: 'PS4', code: 'PS4' },
        });
        this.dropdownItem.push({
            label: 'Nintendo Switch',
            value: { id: 3, name: 'Wii U', code: 'WU' },
        });

        this.payments = [
            {
                name: 'Mark Klass',
                amount: 9003,
                paid: true,
                date: '06/04/2023',
            },
            {
                name: 'Mark L',
                amount: 4885.5,
                paid: true,
                date: '07/04/2023',
            },
            { name: 'Mike M', amount: 4578.2, paid: false, date: '12/04/2023' },
            {
                name: 'Nate L.',
                amount: 8825.9,
                paid: true,
                date: '07/04/2023',
            },
            {
                name: 'Shawn V',
                amount: 4880.9,
                paid: false,
                date: '12/04/2023',
            },
            {
                name: 'Lan C',
                amount: 39992.9,
                paid: false,
                date: '01/04/2024',
            },
        ];

        this.initChart();
    }

    initChart() {
        const textColor = getComputedStyle(document.body).getPropertyValue(
            '--text-color'
        );
        const primaryColor = getComputedStyle(document.body).getPropertyValue(
            '--primary-color'
        );
        const surfaceLight = getComputedStyle(document.body).getPropertyValue(
            '--surface-100'
        );

        this.visitorChart = {
            labels: [
                'Jan',
                'Feb',
                'Mar',
                'Apr',
                'May',
                'Jun',
                'July',
                'Aug',
                'Sept',
                'Oct',
                'Nov',
                'Dec',
            ],
            datasets: [
                {
                    data: [
                        600, 671, 660, 665, 700, 610, 810, 790, 710, 860, 810,
                        780,
                    ],
                    backgroundColor: primaryColor,
                    fill: true,
                    barPercentage: 0.75,
                    stepped: true,
                },
            ],
        };

        this.visitorChartOptions = {
            plugins: {
                legend: {
                    display: false,
                },
            },
            responsive: true,
            hover: {
                mode: 'index',
            },
            scales: {
                y: {
                    min: 500,
                    max: 900,
                    ticks: {
                        color: textColor,
                    },
                    grid: {
                        color: surfaceLight,
                    },
                },
                x: {
                    ticks: {
                        color: textColor,
                    },
                    grid: {
                        display: false,
                    },
                },
            },
        };
  }


  confirmRun(event: Event) {
    this.confirm.confirm({
      target: event.target as HTMLElement,
      message: 'Run invoice batch now?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Run',
      rejectLabel: 'Cancel',
      accept: () => this.run()
    });
  }

  run() {
    this.isRunning = true;
    this.successSummary = '';
    this.errorSummary = '';
    this.showRaw = false;

    this.dataService.getInvoiceBatch().subscribe({
      next: (res) => {
        this.isRunning = false;
        this.lastRunAt = new Date();
        this.lastResult = res;
        this.lastOk = true;

        const processed = res.processed ?? res.totalProcessed ?? res.count ?? null;
        const errors = res.errors ?? res.errorCount ?? 0;
        const msg = res.message ?? 'Batch completed';

        this.successSummary = processed !== null
          ? `${msg}. Processed: ${processed}${errors ? `, Errors: ${errors}` : ''}`
          : msg;

        this.toast.add({ severity: 'success', summary: 'Batch complete', detail: this.successSummary, life: 6000 });
      },
      error: (err) => {
        this.isRunning = false;
        this.lastRunAt = new Date();
        this.lastResult = (err && 'error' in err) ? (err as any).error : err;
        this.lastOk = false;

        this.errorSummary = (err as any)?.message || 'Batch failed';
        this.toast.add({ severity: 'error', summary: 'Batch failed', detail: this.errorSummary, life: 8000 });
      },
    });
  }



  runSingle() {
    if (!this.invoiceNumber?.trim()) {
      this.toast.add({ severity: 'warn', summary: 'Invoice required', detail: 'Enter an invoice number.' });
      return;
    }

    this.isRunningSingle = true;
    this.singleSummary = '';
    this.showSingleRaw = false;

    this.dataService.getInvoiceProcess(this.invoiceNumber.trim()).subscribe({
      next: (res) => {
        this.isRunningSingle = false;
        this.lastSingleRunAt = new Date();
        this.singleResult = res;
        this.singleOk = true;

        const msg = res?.message ?? 'Invoice processed';
        const processed = res?.processed ?? res?.count ?? null;
        const errors = res?.errors ?? res?.errorCount ?? 0;

        this.singleSummary = processed !== null
          ? `${msg}. Processed: ${processed}${errors ? `, Errors: ${errors}` : ''}`
          : msg;

        this.toast.add({ severity: 'success', summary: 'Done', detail: this.singleSummary, life: 6000 });
      },
      error: (err) => {
        this.isRunningSingle = false;
        this.lastSingleRunAt = new Date();
        this.singleResult = (err && 'error' in err) ? (err as any).error : err;
        this.singleOk = false;
        const detail = (err as any)?.message || 'Request failed';
        this.singleSummary = detail;
        this.toast.add({ severity: 'error', summary: 'Error', detail, life: 8000 });
      }
    });
  }
}



