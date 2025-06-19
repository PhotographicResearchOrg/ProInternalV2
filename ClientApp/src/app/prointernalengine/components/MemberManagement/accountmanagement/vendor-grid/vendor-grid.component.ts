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
  allVendors: Vendor[] = [];
  uploadingVendor: number | null = null;

  visibilityOptions = [
    { label: 'Visible', value: 'Yes', styleClass: 'chip-members' },
    { label: 'Hidden', value: 'No', styleClass: 'chip-clients' }
  ];



  selectedVisibility: string[] = ['Yes', 'No']; // all selected by default
  exporting = false;

  constructor(
    private dataService: DataService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadVendors();
  }

  applyFilter() {
    if (this.selectedVisibility.length === 0) {
      this.vendors = [];
    } else {
      this.vendors = this.allVendors.filter(v => this.selectedVisibility.includes(v.onWeb));
    }
  }

  // Drag over handler to allow drop
  onDragOver(event: DragEvent) {
    event.preventDefault();
  }


  // Helpers to get styleClass and label by value
  getStyleClassByValue(value: string): string {
    const option = this.visibilityOptions.find(o => o.value === value);
    return option ? option.styleClass : '';
  }

  getLabelByValue(value: string): string {
    const option = this.visibilityOptions.find(o => o.value === value);
    return option ? option.label : value;
  }

  onImageDrop(event: DragEvent, vendor: Vendor) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();

      reader.onload = () => {
        vendor.imageUrl = reader.result as string;
        this.uploadingVendor = vendor.id;

        this.dataService.uploadVendorImage(vendor.id, file).subscribe({
          next: (res) => {
            vendor.imageUrl = `${res.imageUrl}?ts=${new Date().getTime()}`;
            this.messageService.add({ severity: 'success', summary: 'Uploaded', detail: 'Image uploaded successfully' });
            this.uploadingVendor = null;
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Image upload failed' });
            this.uploadingVendor = null;
          }
        });
      };

      reader.readAsDataURL(file);
    }
  }

  getVisibilityChipClass(value: string): string {
    return value === 'Yes' ? 'chip-members' : 'chip-clients';
  }

  onGlobalFilter(table: any, event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    table.filterGlobal(input, 'contains');
  }


  exportVendors() {
    this.exporting = true;

    // Implement export logic here (e.g., XLSX export)

    setTimeout(() => {
      this.exporting = false;
    }, 2000);
  }

  loadVendors(): void {
    this.loading = true;
    this.dataService.getVendors().subscribe({
      next: (data) => {
        this.allVendors = data;
        this.vendors = data;
        this.applyFilter();
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
