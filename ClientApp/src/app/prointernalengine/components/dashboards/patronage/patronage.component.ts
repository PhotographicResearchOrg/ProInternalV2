import { Component, OnInit } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { DataService } from "src/app/services/data.service";
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { Subscription } from 'rxjs';
import { PatronageUpload, PatronageHistorical, patronageDetail } from "src/app/models/accounting/patronage";
import { HttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';

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

  constructor(
    http: HttpClient,
    private dataService: DataService,
    public layoutService: LayoutService
  ) { }

  ngOnInit() {
    this.dataService.getRecentPatronageLoad().subscribe((data) => (this.PatronageUploads = data));
    this.dataService.getPatronageHistorical().subscribe((data) => (this.PatronageHistorical = data));

    this.menuitems = [
      { label: 'Download', icon: 'pi pi-file-excel', command: (event) => this.DownloadVendor(event) },
      { label: 'Search', icon: 'pi pi-search' },
    ];
  }

  setValue(event: any) {
    this.vendorDownload = event;
  }

  onReload() {
    window.location.reload();
  }

  getTotalPatronageAmount(): number {
    return this.PatronageUploads.reduce((sum, m) => sum + m.totalValue, 0);
  }

  getMetricPercentage(metric: PatronageUpload): string {
    const total = this.PatronageUploads.reduce((sum, m) => sum + m.totalValue, 0);
    const percent = total > 0 ? (metric.totalValue / total) * 100 : 0;
    return percent.toFixed(0) + '%';
  }


  Activate(item: any) {
    this.dataService.activatePatronage(item).subscribe((resp) => { });
  }

  DownloadVendor(event: any) {
    this.dataService.pullPatronageBatchVendorDetail(this.vendorDownload).subscribe((resp) => {
      const data: any[] = resp;
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(wb, 'PatronageData.xlsx');
    });
  }

  Delete(item: any) {
    this.dataService.deletePatronageUpload(item.id).subscribe((resp) => {
      window.location.reload();
    });
  }

  Download(item: any) {
    this.dataService.pullPatronageBatchDetail(item.id).subscribe((resp) => {
      const data: any[] = resp;
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Batch' + item.id);
      XLSX.writeFile(wb, item.issueDate + '.xlsx');
    });
  }
}
