import { Component, OnInit } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { DataService } from "src/app/services/data.service";
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { Subscription } from 'rxjs';
import { PatronageUpload, PatronageHistorical, patronageDetail } from "src/app/models/accounting/patronage";
import { HttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { InputSwitchModule } from 'primeng/inputswitch'; // Also needed for p-inputSwitc
import { PaymentTypeComponent } from 'src/app/prointernalengine/components/shared/payment-type/payment-type.component';


@Component({
  templateUrl: './patronage.component.html'
})
export class PatronageComponent implements OnInit {

  menuitems: MenuItem[] = [];
  subscription: Subscription;

  PatronageUploads: PatronageUpload[] = [];

  public patronageUploads: Array<PatronageUpload> = [];
  public PatronageHistorical: Array<PatronageHistorical> = [];
  public PatronageBatchData: patronageDetail[] = [];
  public vendorDownload: string;
  public valSwitch: boolean = false;
  public hasMismatch = false;
  public showDrillDown = false;
  public paymentCardVisible: boolean = false;

  public selectedBatchId: number | null = null;


  public batchSummary = {
    batchID: '',
    dateLoaded: new Date()
  };


  summaryFields: { key: keyof PatronageUpload, label: string, currency: boolean }[] = [
    { key: 'totalValue', label: 'Total Value', currency: true },
    { key: 'balance', label: 'Total Balance', currency: true },
    { key: 'profit', label: 'Total Profit', currency: true },
    { key: 'dividend', label: 'Total Dividend', currency: true },
    { key: 'payment', label: 'Total Payment', currency: true },
    { key: 'credit', label: 'Total Credit', currency: true },
    { key: 'stockValue', label: 'Total Stock Value', currency: true },
    { key: 'taxWithholding', label: 'Total Tax Withholding', currency: true },
    { key: 'endingRetention', label: 'Total Ending Retention', currency: true }
  ];


  constructor(
    http: HttpClient,
    private dataService: DataService,
    public layoutService: LayoutService,
    private messageService: MessageService  // << add this
  ) { }

  ngOnInit() {



    this.dataService.getRecentPatronageLoad().subscribe((data) => (this.PatronageUploads = data));

    this.dataService.getPatronageHistorical().subscribe((data) => (this.PatronageHistorical = data));



  }


  togglePaymentCard(): void {
    this.paymentCardVisible = !this.paymentCardVisible;
  }



  SelectBatch(patronage: PatronageHistorical) {
    if (!patronage?.id) return;

    this.selectedBatchId = patronage.id;

      // Pull details for this batch
      this.dataService.getPatronageBatchDetails( String(patronage.id) ).subscribe((data) => {

      this.PatronageUploads = data;

      if (this.PatronageUploads.length > 0) {
        this.batchSummary.batchID = String(this.PatronageUploads[0].batchID);
        this.batchSummary.dateLoaded = new Date(this.PatronageUploads[0].dateLoaded);
      }
    });
  }




  onReload(event?: any) {
    if (event?.reloadHistorical) {
      this.dataService.getPatronageHistorical().subscribe((data) => {
        this.PatronageHistorical = data;
      });
    }

    if (event?.reloadCurrent) {
      this.dataService.getRecentPatronageLoad().subscribe((data) => {
        this.PatronageUploads = data;

        // Optional: Rebuild batch summary
        if (this.PatronageUploads.length > 0) {
          this.batchSummary.batchID = String(this.PatronageUploads[0].batchID);
          this.batchSummary.dateLoaded = new Date(this.PatronageUploads[0].dateLoaded);
        }

        this.messageService.add({
          severity: 'success',
          summary: 'Upload Complete',
          detail: 'The patronage file was uploaded successfully!',
          life: 3000
        });

      });
    }
  }

  getTotalPatronageAmount(): number {
    return this.PatronageUploads.reduce((sum, m) => sum + m.totalValue, 0);
  }

  getMetricPercentage(metric: PatronageUpload): string {
    const total = this.PatronageUploads.reduce((sum, m) => sum + m.totalValue, 0);
    const percent = total > 0 ? (metric.totalValue / total) * 100 : 0;
    return percent.toFixed(0) + '%';
  }

  toggleDrillDown() {
    this.showDrillDown = !this.showDrillDown;
  }


  // Total Calculation
  getGrossTotal(field: keyof PatronageUpload): number {
    if (!this.PatronageUploads) return 0;
    return this.PatronageUploads.reduce((sum, item) => {
      const value = item[field] ?? 0;
      return sum + Number(value);
    }, 0);
  }


  downloadBatchSummary() {
    const batchTotals: any = {};
    this.summaryFields.forEach(f => {
      batchTotals[f.label] = this.getGrossTotal(f.key);
    });

    const batchData = [{
      'Batch ID': this.batchSummary.batchID,
      'Date Loaded': this.batchSummary.dateLoaded,
      ...batchTotals
    }];


    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(batchData);


    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Batch Summary');

    XLSX.writeFile(wb, `BatchSummary-${this.batchSummary.batchID}.xlsx`);
  }



downloadFullBatchExcel() {
  if (!this.PatronageUploads) return;

  // 1. Prepare batch totals (summary)
  const batchTotals: any = {};
  this.summaryFields.forEach(f => {
    batchTotals[f.label] = this.getGrossTotal(f.key);
  });

  const summaryData = [{
    'Batch ID': this.batchSummary.batchID,
    'Date Loaded': this.batchSummary.dateLoaded,
    ...batchTotals
  }];

  const summarySheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(summaryData);


  const memberDetailsData = this.PatronageUploads.map(item => ({
    'Account ID': item.accountID,
    'Total Value': item.totalValue,
    'Shares': item.shares,
    'Balance': item.balance,
    'Profit': item.profit,
    'Dividend': item.dividend,
    'Payment': item.payment,
    'Credit': item.credit,
    'Stock Value': item.stockValue,
    'Tax Withholding': item.taxWithholding,
    'Ending Retention': item.endingRetention
  }));

  const detailsSheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(memberDetailsData);

  // 3. Create workbook and add both sheets
  const wb: XLSX.WorkBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Batch Summary');
  XLSX.utils.book_append_sheet(wb, detailsSheet, 'Member Details');

  // 4. Save workbook
  XLSX.writeFile(wb, `PatronageBatch-${this.batchSummary.batchID}.xlsx`);
}





  Activate(patronage: any) {

    const payload = {
      batchID: patronage.id,
      active: patronage.active
    };

    this.dataService.activatePatronage(payload).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: payload.active ? 'Batch activated successfully.' : 'Batch deactivated successfully.'
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to update batch status.'
        });
      }
    });
  }




  Delete(item: any) {
    alert(item.id)
    this.dataService.deletePatronageUpload(item.id).subscribe((resp) => {
      window.location.reload();
    });
  }


  Download(item: any) {
    this.dataService.getPatronageBatchDetails(item.id).subscribe((resp) => {
      const data: any[] = resp;
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Batch' + item.id);
      XLSX.writeFile(wb, item.issueDate + '.xlsx');
    });
  }
}
