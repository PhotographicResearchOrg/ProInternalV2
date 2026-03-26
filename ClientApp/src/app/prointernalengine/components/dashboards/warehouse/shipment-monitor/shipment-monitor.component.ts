
import { DataService } from 'src/app/services/data.service';
import { MessageService } from 'primeng/api';
import { Component, ViewChild } from '@angular/core';
import { Table } from 'primeng/table';

import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { FilterService } from 'primeng/api';




@Component({
  selector: 'app-shipment-monitor',
  templateUrl: './shipment-monitor.component.html',
  styleUrl: './shipment-monitor.component.scss'
})
export class ShipmentMonitorComponent {
  @ViewChild('dt') table!: Table;

  selectedStatus: string | null = null;
  selectedSla: string | null = null;
  selectedRegion: string | null = null;
  loading = false;

  statusOptions: any[] = [];

  slaOptions = [
    { label: 'On Time', value: 'OnTime' },
    { label: 'At Risk', value: 'AtRisk' },
    { label: 'Late', value: 'Late' }
  ];

  regionOptions = [
    { label: 'East', value: 'East' },
    { label: 'Central', value: 'Central' },
    { label: 'West', value: 'West' },
    { label: 'Other', value: 'Other' }
  ];

  shipments: any[] = [];
  expanded: string | null = null;

  constructor(private dataService: DataService, protected messageService: MessageService, private filterService: FilterService) { }

  ngOnInit() {
    this.load();

  }





  load() {
    this.loading = true;

    this.dataService.getShipments().subscribe({
      next: (res) => {
        this.shipments = res;

        //  BUILD STATUS FILTER OPTIONS DYNAMICALLY
        const uniqueStatuses = [...new Set(res.map(x => x.currentStatus).filter(Boolean))];

        this.statusOptions = uniqueStatuses.map(s => ({
          label: s,
          value: s
        }));

        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }


  applyFilters() {
    this.table.filterGlobal('', 'contains'); // reset

    if (this.selectedStatus) {
      this.table.filter(this.selectedStatus, 'currentStatus', 'contains');
    }

    if (this.selectedSla) {
      this.table.filter(this.selectedSla, 'slaStatus', 'equals');
    }

    if (this.selectedRegion) {
      this.table.filter(this.selectedRegion, 'destinationState', 'regionFilter');
    }
  }

  clearFilters() {
    this.selectedStatus = null;
    this.selectedSla = null;
    this.selectedRegion = null;
    this.table.clear();
  }


  toggle(row: any) {
    if (this.expanded === row.trackingNumber) {
      this.expanded = null;
      return;
    }

    this.expanded = row.trackingNumber;

    // lazy load events
    if (!row.events) {
      this.dataService.getShipmentEvents(row.trackingNumber)
        .subscribe(events => row.events = events);
    }
  }

  getStatusSeverity(status: string) {
    if (!status) return 'info';
    if (status.includes('Delivered')) return 'success';
    if (status.includes('Out')) return 'warning';
    return 'info';
  }

  getRegion(state: string) {
    const east = ['CT', 'NY', 'NJ', 'PA', 'VA'];
    const central = ['IL', 'WI', 'CO'];
    const west = ['CA', 'WA'];

    if (east.includes(state)) return 'East';
    if (central.includes(state)) return 'Central';
    if (west.includes(state)) return 'West';
    return 'Other';
  }


}
