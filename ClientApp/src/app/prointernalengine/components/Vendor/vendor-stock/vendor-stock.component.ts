import { Component, OnInit, NgZone } from '@angular/core';
import { AppConfig, LayoutService } from 'src/app/layout/service/app.layout.service';
import { Router } from "@angular/router";
import { Folder } from 'src/app/prointernalengine/api/folder';
import { File } from 'src/app/prointernalengine/api/file';
import { FileAppService } from 'src/app/prointernalengine/components/apps/file/service/file.app.service';
import { MenuItem } from 'primeng/api';
import { Subscription, debounceTime } from 'rxjs';
import { DataService } from "src/app/services/data.service";
import { HttpClient } from '@angular/common/http';
import { ProductGating, GatingAssignment } from "src/app/models/Dashboard/ProductGating";
import * as XLSX from 'xlsx';
import { Table } from 'primeng/table';
import { ViewChild, ElementRef } from '@angular/core';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Product } from '../../../api/product';
import { ToastModule } from 'primeng/toast';
import { DragDropModule } from 'primeng/dragdrop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { Account, Brand } from 'src/app/models/Dashboard/Account';
import { VendorStock } from 'src/app/models/vendor/vendorstock';
import {
  trigger,
  transition,
  style,
  animate
} from '@angular/animations';

  @Component({
    templateUrl: './vendor-stock.component.html',
    styleUrl: './vendor-stock.component.scss',
    providers: [MessageService, ConfirmationService],
    animations: [
      trigger('slideInOut', [
        transition(':enter', [
          style({ transform: 'translateX(100%)', opacity: 0 }),
          animate('300ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
        ]),
        transition(':leave', [
          animate('300ms ease-in', style({ transform: 'translateX(100%)', opacity: 0 }))
        ])
      ])
    ]

  })
export class VendorStockComponent implements OnInit {

  public vendorStock: VendorStock[] = [];
  selectedRows: any[] = [];
  loading = true;
  previewVisible = false;
  selectedProduct: any;
  selectedVendorStock: VendorStock[] = [];
  isSummaryVisible = true;

    @ViewChild('filter') filter!: ElementRef;
    constructor(private dataService: DataService, private ngZone: NgZone, private messageService: MessageService) { }


    ngOnInit() {
      this.loading = true;
  

      this.dataService.getVendorStock().subscribe({
        next: (data) => {

          this.vendorStock = data.map(item => ({
            ...item,
            status: item.status || 'Pending'
          }));



          this.loading = false;


        },
        error: (err) => {
          console.error('Error retrieving vendor stock:', err);
          this.loading = false;
        }
      });



    }

    getRowClass(rowData: VendorStock): string {
      return this.selectedVendorStock?.includes(rowData) ? 'p-highlight' : '';
    }


    toggleSummary(): void {
      this.isSummaryVisible = !this.isSummaryVisible;
    }


  isNewlyUploaded(date: string): boolean {
    const today = new Date();
    const uploaded = new Date(date);
    const diff = Math.abs(today.getTime() - uploaded.getTime());
    return diff < 1000 * 60 * 60 * 24 * 2; // within 2 days
  }

  getStatusSeverity(status: string): string {
    switch (status) {
      case 'Approved': return 'info';
      case 'Pending': return 'warning';
      case 'Deployed': return 'success';
      default: return 'secondary';
    }
  }

    getStatusIcon(status: string): string {
      switch (status) {
        case 'Approved':
          return 'pi pi-check-circle text-green-500';
        case 'Pending':
          return 'pi pi-clock text-yellow-500';
        case 'Deployed':
          return 'pi pi-upload text-blue-500';
        default:
          return 'pi pi-question-circle text-gray-500';
      }
    }

    getSelectedDeploymentSummary(): string {
      const approvedCount = this.selectedVendorStock.filter(vs => vs.status === 'Approved').length;
      const pendingCount = this.selectedVendorStock.filter(vs => vs.status === 'Pending').length;
      const deployedCount = this.selectedVendorStock.filter(vs => vs.status === 'Deployed').length;
      return `Approved: ${approvedCount}, Pending: ${pendingCount}, Deployed: ${deployedCount}`;
    }

    approveSelected(): void {
      if (this.selectedVendorStock.length > 0) {
        this.selectedVendorStock.forEach(stock => stock.status = 'Approved');
        this.messageService.add({ severity: 'success', summary: 'Approved', detail: `${this.selectedVendorStock.length} item(s) marked as Approved.` });
     
      } else {
        this.messageService.add({ severity: 'warn', summary: 'No Selection', detail: 'No items selected for approval.' });
      }
    }
    deploySelected(): void {
      if (this.selectedVendorStock.length > 0) {
        this.selectedVendorStock.forEach(stock => stock.status = 'Deployed');
        this.messageService.add({ severity: 'info', summary: 'Deployed', detail: `${this.selectedVendorStock.length} item(s) marked as Deployed.` });

        // Wait a tick to allow summary to visually reflect the update
        setTimeout(() => {
   
        }, 100); // You can adjust this time
      } else {
        this.messageService.add({ severity: 'warn', summary: 'No Selection', detail: 'No items selected for deployment.' });
      }
    }



    getSelectedCount(status: string): number {
      return this.selectedVendorStock.filter(stock => stock.status === status).length;
    }

    getTotalSelectedUnits(): number {
      return this.selectedVendorStock.reduce((total, item) => total + (item.quantity || 0), 0);
    }

  openPreview(stock: any): void {
    this.selectedProduct = stock;
    this.previewVisible = true;
  }

    onGlobalFilter(table: Table, event: Event) {
      table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    }

    clear(table: Table) {
      table.clear();
      this.selectedVendorStock = [];
    }



    Download(item: Table) {
      const filteredData = item.filteredValue || item.value;
      const data: any[] = filteredData;
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Gating_Export');
      XLSX.writeFile(wb, 'Gating_Export.xlsx');
    }


  exportStock(): void {
    const exportData = this.vendorStock.map(stock => ({
      'Catalog Number': stock.catalogNumber,
      'Product Code': stock.productCode,
      'Model Name': stock.modelName,
      'Quantity': stock.quantity,
      'Status': stock.status,
      'Loaded On': stock.loadedOn
    }));

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
    const workbook: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendor Stock');
    XLSX.writeFile(workbook, 'vendor-stock-export.xlsx');
  }
}
