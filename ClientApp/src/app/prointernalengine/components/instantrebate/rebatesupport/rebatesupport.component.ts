import { Component, OnInit, Inject } from '@angular/core';
import { AppConfig, LayoutService } from 'src/app/layout/service/app.layout.service';
import { Router } from "@angular/router";
import { Folder } from 'src/app/prointernalengine/api/folder';
import { File } from 'src/app/prointernalengine/api/file';
import { FileAppService } from 'src/app/prointernalengine/components/apps/file/service/file.app.service';
import { MenuItem } from 'primeng/api';
import { Subscription, debounceTime } from 'rxjs';
import { DataService } from "src/app/services/data.service";
import { HttpClient } from '@angular/common/http';
import { InstantRebate } from "src/app/models/Dashboard/InstantRebate";
import { DeclinedIR } from "src/app/models/Dashboard/DeclinedIR";
import * as XLSX from 'xlsx';
import { Table } from 'primeng/table';


@Component({
  templateUrl: './rebatesupport.component.html',
})
export class RebatesupportComponent implements OnInit {


  public InstantRebateBatches: Array<InstantRebate> = [];
  public declinedIRs: Array<DeclinedIR> = [];

  

  public cols: any[] = [];
  public IRDeclinecols: any[] = [];


  constructor(
    http: HttpClient,
    private dataService: DataService,
    private fileService: FileAppService,
    public layoutService: LayoutService) { }


  ngOnInit()
  {

    this.dataService.GetInstantRebateBatches().subscribe((data) => (this.InstantRebateBatches = data));
    this.dataService.GetDeclinedInstantRebates().subscribe((data) => (this.declinedIRs = data));

    this.IRDeclinecols =
      [
      { header: 'Order_ID', field: 'orderID' },
      { header: 'Decline_Date', field: 'processDate' },
      { header: 'IR_Total', field: 'total' },
      { header: 'Reject_Reason', field: 'rejectReason' },
      { header: 'Member', field: 'memberID' },
      { header: 'Model', field: 'model' },
      { header: 'Quantity', field: 'quantity' },
      { header: 'EMail', field: 'eMail' },
      ];


      this.cols =
          [
          { header: 'Batch_ID', field: 'batchID' },
          { header: 'Vendor_Name', field: 'vendorName' },
          { header: 'Units', field: 'units' },
          { header: 'Program_Start', field: 'programStart' },
          { header: 'Program_End', field: 'programEnd' },
          { header: 'IR_Type', field: 'irtypeName' },    
          ];


  }

  Download(item: any) {

    this.dataService.pullIRBatchDetail(item.batchID).subscribe((resp) => {
      const data: any[] = resp;
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Batch' + item.batchID);
      XLSX.writeFile(wb, item.programStart + '_' + item.programEnd + '.xlsx');
    });
  }


   Delete(item: any)
   {
     this.dataService.deleteQRUpload(item.id).subscribe((resp) => {
        window.location.reload();
      });
  }


  onReload() {
    window.location.reload();
  }


    Activate(item: any) {
      this.dataService.activateIRBatch(item).subscribe((resp) => { });
      this.onReload();
    }


    onGlobalFilter(table: Table, event: Event) {
        table.filterGlobal(
            (event.target as HTMLInputElement).value,
            'contains'
        );
  
    }

}
