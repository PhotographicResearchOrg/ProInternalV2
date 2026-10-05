import { Component, OnInit } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { Vendor } from 'src/app/models/accounts/vendor';
import { MessageService } from 'primeng/api';
import { Router } from '@angular/router';

type Visibility = 'all' | 'Yes' | 'No';

@Component({
  selector: 'app-vendor-grid',
  templateUrl: './vendor-grid.component.html',
  styleUrls: ['./vendor-grid.component.scss'],
  providers: [MessageService]
})
export class VendorGridComponent implements OnInit {

  vendors: Vendor[] = [];
  loading: boolean = true;
  allVendors: Vendor[] = [];
  uploadingVendor: number | null = null;
  togglingId: number | null = null;
  dragOverId: number | null = null;

  visibilityOptions: { label: string, value: Visibility }[] = [
    { label: 'All', value: 'all' },
    { label: 'Live', value: 'Yes' },
    { label: 'Hidden', value: 'No' }
  ];

  visibility: Visibility = 'all';
  exporting = false;

  // Same palette as the vendor card's brandColors
  brandColors = [
    { fg: '#0e7c73', bg: '#dff1ef' },
    { fg: '#5b4bb5', bg: '#e9e6f7' },
    { fg: '#a15c07', bg: '#fbeecb' },
    { fg: '#1d4ed8', bg: '#dce8fd' }
  ];

  constructor(
    private dataService: DataService,
    private messageService: MessageService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadVendors();
  }

  get liveCount(): number {
    return this.allVendors.filter(v => v.onWeb === 'Yes').length;
  }

  get missingLogoCount(): number {
    return this.allVendors.filter(v => !v.imageUrl).length;
  }

  countFor(value: Visibility): number {
    return value === 'all' ? this.allVendors.length : this.allVendors.filter(v => v.onWeb === value).length;
  }

  brand(id: number) { return this.brandColors[Math.abs(id || 0) % this.brandColors.length]; }

  initials(n: string): string {
    return (n || '').split(/\s+/).filter(w => /^[A-Za-z0-9]/.test(w)).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  }

  openVendor(vendor: Vendor) {
    this.router.navigate(['/vendor-card'], { queryParams: { vendorId: vendor.id } });
  }

  setVisibility(value: Visibility) {
    this.visibility = value;
    this.applyFilter();
  }

  applyFilter() {
    this.vendors = this.visibility === 'all'
      ? this.allVendors
      : this.allVendors.filter(v => v.onWeb === this.visibility);
  }

  // Drag over handler to allow drop
  onDragOver(event: DragEvent, vendor: Vendor) {
    event.preventDefault();
    this.dragOverId = vendor.id;
  }

  onImageDrop(event: DragEvent, vendor: Vendor) {
    event.preventDefault();
    this.dragOverId = null;
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
    this.togglingId = vendor.id;
    this.dataService.toggleVendorWebStatus(vendor.id).subscribe({
      next: () => {
        vendor.onWeb = vendor.onWeb === 'Yes' ? 'No' : 'Yes';
        this.togglingId = null;
        this.applyFilter();
        this.messageService.add({ severity: 'success', summary: 'Updated', detail: `${vendor.name} is now ${vendor.onWeb === 'Yes' ? 'live on' : 'hidden from'} the web` });
      },
      error: () => {
        this.togglingId = null;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not toggle status' });
      }
    });
  }
}
