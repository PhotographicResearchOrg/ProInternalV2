import { Component, OnInit, Inject } from '@angular/core';
import { Folder } from 'src/app/prointernalengine/api/folder';
import { File } from 'src/app/prointernalengine/api/file';
import { Metric } from 'src/app/prointernalengine/api/metric';
import { FileAppService } from 'src/app/prointernalengine/components/apps/file/service/file.app.service';
import { MenuItem } from 'primeng/api';
import { AppConfig,LayoutService } from 'src/app/layout/service/app.layout.service';
import { Subscription, debounceTime } from 'rxjs';
import { DataService } from "src/app/services/data.service";
import { Router } from "@angular/router";
import { QuarterlyRebates, QuarterlyRebatesHistorical, qrDetail } from "src/app/models/accounting/quarterly-rebates";
import { HttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { ConfirmationService } from 'primeng/api'; // already assumed



@Component({
  templateUrl: './qtr-rebates.component.html'
})

export class QtrRebatesComponent implements OnInit {

  menuitems: MenuItem[] = [];
  subscription: Subscription;
  QuarterlyRebates: QuarterlyRebates[] = [];

  public quarterlyrebates: Array<QuarterlyRebates> = [];
  public QRHistorical: Array<QuarterlyRebatesHistorical> = [];
  public QRBatchData: qrDetail[] = [];
  public vendorDownload: string;
  public valSwitch: boolean = false;
  constructor(http: HttpClient, 
    private dataService: DataService,
    private fileService: FileAppService,
    public layoutService: LayoutService,
    private confirmationService: ConfirmationService
  )
  { }


  


  ngOnInit() {

    this.dataService.getRecentLoad().subscribe((data) => (this.QuarterlyRebates = data));
    this.dataService.getQRHistorical().subscribe((data) => (this.QRHistorical = data));
   
    this.menuitems = [
      { label: 'Download', icon: 'pi pi-file-excel', command: (event) => this.DownloadVendor(event) },
      { label: 'Search', icon: 'pi pi-search' },
    ];
  }
  setValue(event: any) {
    this.vendorDownload = event
  }

  onReload(payload?: { reloadHistorical: boolean; reloadCurrent: boolean }) {
    const reloadHistorical = payload?.reloadHistorical ?? true;
    const reloadCurrent = payload?.reloadCurrent ?? true;

    if (reloadCurrent) {
      this.dataService.getRecentLoad().subscribe((data) => this.QuarterlyRebates = data);
    }

    if (reloadHistorical) {
      this.dataService.getQRHistorical().subscribe((data) => this.QRHistorical = data);
    }
  }




  getTotalRebateAmount(): number {
    return this.QuarterlyRebates.reduce((sum, m) => sum + m.totalAmount, 0);
  }
  getMetricPercentage(metric: any): string {
    const validMetrics = this.QuarterlyRebates.filter(m => m.programName?.toLowerCase() !== 'gross');
    const total = validMetrics.reduce((sum, m) => sum + m.totalAmount, 0);
    const percent = total > 0 ? (metric.totalAmount / total) * 100 : 0;
    return percent.toFixed(0) + '%';
  }

  Activate(item: any) {
   
  //this.dataService.activate(item).subscribe((resp) => { });

    this.dataService.activate(item).subscribe(() => {
      this.refreshQuarterlyData();  // re-fetch updated data
    });

  }

  refreshQuarterlyData() {
    this.dataService.getRecentLoad().subscribe((data) => this.QuarterlyRebates = data);
    this.dataService.getQRHistorical().subscribe((data) => this.QRHistorical = data);
  }

  DownloadVendor(event: any)
  {
    //batch id comma program id
    this.dataService.pullQRBatchVendorDetail(this.vendorDownload).subscribe((resp) => {
      const data: any[] = resp;
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data' );
      XLSX.writeFile(wb,  'Data.xlsx');
      //  alert(this.vendorDownload)
    });
  }

  Delete(item: QuarterlyRebatesHistorical) {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete batch ID ${item.id}?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.dataService.deleteQRUpload(item.id).subscribe(() => {
          this.refreshQuarterlyData();
        });
      }
    });
  }

  Download(item: any) {
      this.dataService.pullQRBatchDetail(item.id).subscribe((resp) => {
      const data: any[] = resp;
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Batch' + item.id);
      XLSX.writeFile(wb, item.issueDate + '.xlsx');

    });
  }
  }

  
  

