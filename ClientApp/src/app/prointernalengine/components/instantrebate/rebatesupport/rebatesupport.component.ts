import { Component, OnInit, Inject, ViewChild } from '@angular/core';
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
import { MessageService } from 'primeng/api';
import { IrDeclinesTableComponent } from 'src/app/prointernalengine/components/shared/ir-declines-table/ir-declines-table.component';

@Component({
  templateUrl: './rebatesupport.component.html',
})


export class RebatesupportComponent implements OnInit {

  @ViewChild(IrDeclinesTableComponent) declinesTable!: IrDeclinesTableComponent;

  public InstantRebateBatches: Array<InstantRebate> = [];
  public declinedIRs: Array<DeclinedIR> = [];

 
  public cols: any[] = [];
  public IRDeclinecols: any[] = [];


  constructor(
    http: HttpClient,
    private dataService: DataService,
    private fileService: FileAppService,
    public layoutService: LayoutService,
    private messageService: MessageService) { }


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


  getActiveStatus(batch: any): boolean {
    return !batch.expired;
  }


  exportData() {
    this.declinesTable.exportCSV();
  }

  onSearch(event: Event) {
    this.declinesTable.filterGlobal(event);
  }


  onReload() {
    window.location.reload();
  }

  Activate(batch: InstantRebate) {
    const newExpiredValue = !batch.expired;

    this.dataService.activateIRBatch(batch.batchID).subscribe({
      next: () => {
        batch.expired = newExpiredValue; // Update local status
        this.messageService.add({
          severity: 'success',
          summary: 'Status Updated',
          detail: `Batch ${batch.batchID} marked as ${newExpiredValue ? 'Expired' : 'Active'}`
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Update Failed',
          detail: `Could not update batch ${batch.batchID}`
        });
      }
    });
  }


    onGlobalFilter(table: Table, event: Event) {
        table.filterGlobal(
            (event.target as HTMLInputElement).value,
            'contains'
        );
  
    }

}
