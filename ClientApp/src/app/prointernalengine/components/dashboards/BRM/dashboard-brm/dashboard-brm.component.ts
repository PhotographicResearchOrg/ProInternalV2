import { ViewChild, Component, OnInit } from '@angular/core';
import { DeclinedIR } from 'src/app/models/Dashboard/DeclinedIR';
import { IrDeclinesTableComponent } from 'src/app/prointernalengine/components/shared/ir-declines-table/ir-declines-table.component';
import { DataService } from 'src/app/services/data.service';
import { ChangeDetectorRef } from '@angular/core';



@Component({
  selector: 'app-dashboard-brm',
  templateUrl: './dashboard-brm.component.html',
  styleUrls: ['./dashboard-brm.component.scss']
})
export class DashboardBrmComponent implements OnInit {
  @ViewChild('declinesTable') declinesTable!: IrDeclinesTableComponent;

  public declinedIRs: DeclinedIR[] = [];
  public IRDeclinecols: any[] = [];
  public hubspotAccountNumbers: string[] = [];
  public SelectedAccountNumbers: string[] = [];

  public declinedIRsOriginal: any[] = [];
  public statusFilter = 3;
  constructor(private dataService: DataService, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.dataService.GetDeclinedInstantRebates().subscribe((data) => {
      this.declinedIRsOriginal = data;
      this.hubspotAccountNumbers = []; // no filter yet
      this.onAccountFilter([]);        // apply type 3 filter on init
    });


    this.IRDeclinecols = [
      { header: 'Order_ID', field: 'orderID' },
      { header: 'Decline_Date', field: 'processDate' },
      { header: 'IR_Total', field: 'total' },
      { header: 'Reject_Reason', field: 'rejectReason' },
      { header: 'Member', field: 'memberID' },
      { header: 'Model', field: 'model' },
      { header: 'Quantity', field: 'quantity' },
      { header: 'EMail', field: 'eMail' },
      { header: 'Type', field: 'status' }
    ];
  }

  onSearch(event: Event) {
    this.declinesTable.filterGlobal(event);
  }

  //toggleStatusFilter() {
  //  this.statusFilter = this.statusFilter === 3 ? 2 : 3;
  //  this.declinedIRs = this.declinedIRsOriginal
  //    .filter(ir => ir.status === this.statusFilter)
  //    .filter(ir => {
  //      if (!this.hubspotAccountNumbers.length) return true;
  //      return this.hubspotAccountNumbers.includes(ir.memberID?.toString());
  //    });
  //}


  toggleStatusFilter() {
    this.statusFilter = this.statusFilter === 3 ? 2 : 3;

    this.declinedIRs = this.declinedIRsOriginal.filter(ir =>
      ir.status === this.statusFilter &&
      (!this.SelectedAccountNumbers.length || this.SelectedAccountNumbers.includes(ir.memberID?.toString()))
    );
  }




  onAccountFilter(accountNumbers: string[]) {

   this.SelectedAccountNumbers = accountNumbers;

    if (!accountNumbers || accountNumbers.length === 0) {
      this.declinedIRs = [...this.declinedIRsOriginal];
    }
    else {
      this.declinedIRs = this.declinedIRsOriginal.filter(ir => ir.status === 3 && 
        accountNumbers.includes(ir.memberID?.toString())
      );
    }
  }



  getFilterKeys(): string[] {
    return this.declinesTable?.activeFilters
      ? Object.keys(this.declinesTable.activeFilters)
      : [];
  }
  getFilterDisplay(key: string): string {
    const filter = this.declinesTable?.activeFilters?.[key];
    if (!filter) return '';

    if (Array.isArray(filter)) {
      return filter.map(f => f.value).join(', ');
    }
    return (filter as any).value ?? '';
  }
  exportData() {
    this.declinesTable.exportCSV();
  }
}
