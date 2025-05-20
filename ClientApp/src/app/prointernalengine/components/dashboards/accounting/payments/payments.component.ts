import { Component, OnInit } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import * as XLSX from 'xlsx';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Table } from 'primeng/table';
import { EzPaySummary, EzPayDetail } from 'src/app/models/accounting/EzPaySummary';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ViewChild } from '@angular/core';


@Component({
  selector: 'app-payments',
  templateUrl: './payments.component.html',
  styleUrls: ['./payments.component.scss'] 
})



export class PaymentsComponent implements OnInit {

  paymentData: EzPaySummary[] = [];
  selectedDate: Date = new Date(); // You can replace this with your @daDate value
  fridayOptions: { label: string, value: Date }[] = [];
  detailData: EzPayDetail[] = [];


  @ViewChild('detailTable') detailTable!: Table;
  @ViewChild('dt') dt!: Table;

  constructor(
    private dataService: DataService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) { }

  ngOnInit(): void {
    this.initFridays();
    this.loadPayments();
  }

  loadPayments(): void {
    this.dataService.getEzPaySummary(this.selectedDate).subscribe({
      next: (data: EzPaySummary[]) => this.paymentData = data,
      error: (err: any) => console.error('Failed to load payments:', err)
    });

    this.dataService.getEzPayDetail(this.selectedDate).subscribe({
      next: (data:  EzPayDetail[])   => this.detailData = data,
      error: (err: any) => console.error('Failed to load detail:', err)
    });

  }

  getDetailTotal(field: keyof EzPayDetail): number {
    return this.detailData.reduce((sum, item) => {
      const val = item[field];
      return typeof val === 'number' ? sum + val : sum;
    }, 0);
  }



  exportDetailToExcel(table: Table): void {
    const exportData = table.filteredValue ?? this.detailData;

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'EZPayDetail');
    XLSX.writeFile(workbook, `EZPay_Detail_${this.selectedDate.toISOString().slice(0, 10)}.xlsx`);
  }
  exportDetailToPDF(table: Table): void {
    const dataSource = table?.filteredValue ?? this.detailData;
    const doc = new jsPDF();

    const title = `EZPay Detail – ${this.selectedDate.toLocaleDateString()}`;
    const headers = [
      [
        'Invoice', 'Date', 'Vendor', 'Vendor Invoice', 'Account',
        'Name', 'Gross', 'Discount', 'Net', 'EZPAY', 'EZPAY Net', 'Receipt'
      ]
    ];

    const rows = dataSource.map(row => [
      row.invoice ?? '',
      row.date ?? '',
      row.vendor ?? '',
      row.vendorInvoice ?? '',
      row.account ?? '',
      row.name ?? '',
      (row.gross ?? 0).toFixed(2),
      (row.discount ?? 0).toFixed(2),
      (row.net ?? 0).toFixed(2),
      (row.ezpay ?? 0).toFixed(2),
      (row.ezpayNet ?? 0).toFixed(2),
      row.receipt ?? ''
    ]);

    // Add totals as last row
    rows.push([
      'TOTALS', '', '', '', '', '',
      this.getDetailTotal('gross').toFixed(2),
      this.getDetailTotal('discount').toFixed(2),
      this.getDetailTotal('net').toFixed(2),
      this.getDetailTotal('ezpay').toFixed(2),
      this.getDetailTotal('ezpayNet').toFixed(2),
      ''
    ]);

    doc.setFontSize(14);
    doc.text(title, 14, 15);

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 20,
      styles: { fontSize: 9 },
      columnStyles: {
        6: { halign: 'right' }, 7: { halign: 'right' },
        8: { halign: 'right' }, 9: { halign: 'right' },
        10: { halign: 'right' }
      },
      headStyles: {
        fillColor: [63, 81, 181],
        textColor: 255,
        fontStyle: 'bold'
      }
    });

    doc.save(`EZPay_Detail_${this.selectedDate.toISOString().slice(0, 10)}.pdf`);
  }




  exportToExcel(table: Table): void {
    const worksheet = XLSX.utils.json_to_sheet(table.filteredValue || this.paymentData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payments');
    XLSX.writeFile(workbook, `EZPayPayments_${this.selectedDate.toISOString().slice(0, 10)}.xlsx`);
  }


  exportToPDF(): void {
    const doc = new jsPDF();
    const title = `EZPay Payments – ${this.selectedDate.toLocaleDateString()}`;

    const headers = [['Account', 'Company', 'EZPAY', 'EZPAY Net', 'Gross', 'Discount', 'Net', 'AutoPay']];

    const data = this.paymentData.map(row => [
      row.account ?? '',
      row.company ?? '',
      (row.ezpay ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      (row.ezpayNet ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      (row.gross ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      (row.discount ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      (row.net ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      row.autoPay ?? ''
    ]);

    const totals = [
      'TOTALS',
      '',
      this.getTotal('ezpay').toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      this.getTotal('ezpayNet').toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      this.getTotal('gross').toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      this.getTotal('discount').toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      this.getTotal('net').toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      ''
    ];

    data.push(totals);


    doc.setFontSize(14);
    doc.text(title, 14, 15);

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 20,
      styles: { fontSize: 9 }
    });

    doc.save(`EZPay_Payments_${this.selectedDate.toISOString().slice(0, 10)}.pdf`);
  }


  getTotal(field: keyof EzPaySummary): number {
    const numericFields: (keyof EzPaySummary)[] = ['ezpay', 'ezpayNet', 'gross', 'discount', 'net'];

    if (!numericFields.includes(field)) return 0;

    return this.paymentData.reduce((sum, item) => {
      const value = item[field];
      return typeof value === 'number' ? sum + value : sum;
    }, 0);
  }


  initFridays(): void {
    const today = new Date();
    const currentFriday = this.getCurrentFriday(today);

    // Build a range: 4 past Fridays, current, and 4 future Fridays
    this.fridayOptions = [];

    for (let i = -4; i <= 4; i++) {
      const friday = new Date(currentFriday);
      friday.setDate(friday.getDate() + (i * 7));

      this.fridayOptions.push({
        label: friday.toLocaleDateString(),
        value: friday
      });

      if (i === 0) {
        this.selectedDate = friday; // default to current Friday
      }
    }
  }

  getCurrentFriday(fromDate: Date): Date {
    const day = fromDate.getDay();
    const diffToFriday = (5 - day + 7) % 7;
    const friday = new Date(fromDate);
    friday.setDate(fromDate.getDate() + diffToFriday);
    return friday;
  }


}
