import { Component, OnInit } from '@angular/core';
import { QuarterlyRebates, QuarterlyRebatesHistorical, qrDetail, PaymentType } from "src/app/models/accounting/quarterly-rebates";
import { DataService } from 'src/app/services/data.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Member } from 'src/app/models/accounts/member';
import * as XLSX from 'xlsx';
import { ViewChild } from '@angular/core';
import { Table } from 'primeng/table';

@Component({
  selector: 'app-payment-type',
  templateUrl: './payment-type.component.html'
})
export class PaymentTypeComponent implements OnInit {

  allMembers: Member[] = [];
  paymentTypes: PaymentType[] = [];
  filteredList: MemberPaymentDisplay[] = [];


  @ViewChild('dt') tableRef!: Table;

  paymentTypeOptions = [
    { label: 'Check', value: 'Check' },
    { label: 'ACH', value: 'ACH' }
  ];

  constructor(
    private dataService: DataService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.dataService.getMembers('Members').subscribe(members => {
      this.allMembers = members;

      this.dataService.getPaymentTypes().subscribe(types => {
        this.paymentTypes = types;

        this.filteredList = this.allMembers.map(member => {
          const match = this.paymentTypes.find(p => p.accountNumber === member.accountNumber);
          return {
            accountNumber: member.accountNumber,
            dba: member.dba,
            legalName: member.legalName,
            paymentType: match?.paymentTypeName || '',
            paymentTypeName: match?.paymentTypeName || ''
          };
        });
      });
    });
  }

  onGlobalFilter(event: Event) {
    const input = event.target as HTMLInputElement;
    this.tableRef.filterGlobal(input.value, 'contains');
  }

  onPaymentTypeChange(row: MemberPaymentDisplay) {
    const updated: PaymentType = {
      accountNumber: row.accountNumber,
      dba: row.dba,
      paymentTypeName: row.paymentTypeName
    };

    this.dataService.savePaymentType(updated).subscribe(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'Saved',
        detail: `Payment Type updated for ${row.accountNumber}`
      });
    });
  }

  exportToExcel(): void {
    const exportData = this.filteredList.map(item => ({
      AccountNumber: item.accountNumber,
      DBA: item.dba,
      LegalName: item.legalName,
      PaymentType: item.paymentType || 'Not Selected'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PaymentTypes');
    XLSX.writeFile(workbook, 'PaymentTypes.xlsx');
  }
}

interface MemberPaymentDisplay {
  accountNumber: string;
  dba: string;
  legalName: string;
  paymentType: string;
  paymentTypeName: string;
}
