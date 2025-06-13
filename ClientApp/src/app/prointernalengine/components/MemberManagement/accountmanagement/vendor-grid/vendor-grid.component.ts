// src/app/accountmanagement/vendor-grid/vendor-grid.component.ts

import { Component, OnInit } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { Vendor } from 'src/app/models/accounts/vendor';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-vendor-grid',
  templateUrl: './vendor-grid.component.html',
  providers: [MessageService]
})
export class VendorGridComponent implements OnInit {

  vendors: Vendor[] = [];
  loading: boolean = true;

  constructor(
    private dataService: DataService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadVendors();
  }

  loadVendors(): void {
    this.loading = true;
    this.dataService.getVendors().subscribe({
      next: (data) => {
        this.vendors = data;
        this.loading = false;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load vendors' });
        this.loading = false;
      }
    });
  }

  toggleWebStatus(vendor: Vendor): void {
    this.dataService.toggleVendorWebStatus(vendor.id).subscribe({
      next: () => {
        vendor.onWeb = vendor.onWeb === 'Yes' ? 'No' : 'Yes';
        this.messageService.add({ severity: 'success', summary: 'Updated', detail: `Web status toggled for ${vendor.name}` });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not toggle status' });
      }
    });
  }
}
