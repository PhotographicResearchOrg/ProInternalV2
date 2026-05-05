
import { DataService } from 'src/app/services/data.service';
import { MessageService } from 'primeng/api';
import { Component, ViewChild } from '@angular/core';
import { Table } from 'primeng/table';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { FilterService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SidebarModule } from 'primeng/sidebar';
import { ConfirmationService } from 'primeng/api';


@Component({
  selector: 'app-shipment-monitor',
  templateUrl: './shipment-monitor.component.html',
  styleUrl: './shipment-monitor.component.scss'
})
export class ShipmentMonitorComponent {
  @ViewChild('dt') table!: Table;

  selectedStatus: string | null = null;
  selectedSla: string | null = null;
  originalShipments: any[] = [];
  loading = false;
  showAlertPanel = false;
  statusOptions: any[] = [];
  subscriptions: any[] = [];
  showHelp = false;

  slaOptions = [
    { label: 'On Time', value: 'OnTime' },
    { label: 'At Risk', value: 'AtRisk' },
    { label: 'Late', value: 'Late' }
  ];

  model: {
    name: string;
    account: string | null;
    zone: number | null;
    slaStatus: string | null;
    minDays: number | null;
  } = {
      name: '',
      account: null,
      zone: null,
      slaStatus: null,
      minDays: null
    };

  zoneOptions = [
    { label: 'Z2', value: 2 },
    { label: 'Z3', value: 3 },
    { label: 'Z4', value: 4 },
    { label: 'Z5', value: 5 },
    { label: 'Z6', value: 6 },
    { label: 'Z7', value: 7 },
    { label: 'Z8', value: 8 }
  ];


  shipments: any[] = [];
  expanded: string | null = null;

  constructor(private dataService: DataService, protected messageService: MessageService, private filterService: FilterService, private confirmationService: ConfirmationService) { }

  ngOnInit() {
    this.load();
    this.loadSubscriptions(); 
  }


  save() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const payload = {
      ...this.model,
      userId: user.id
    };

    console.log('payload:', payload);

    this.dataService.saveWHSubscription(payload)
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Alert Saved'
          });

          this.loadSubscriptions();

          this.model = {
            name: '',
            account: null,
            zone: null,
            slaStatus: null,
            minDays: null
          };
        },
        error: (err) => {
          console.error('❌ save error:', err);

          this.messageService.add({
            severity: 'error',
            summary: 'Failed to save alert'
          });
        }
      });
  }


  retire(row: any) {
    this.dataService.retireShipment(row.trackingNumber)
      .subscribe(() => {
        this.shipments = this.shipments.filter(x => x.trackingNumber !== row.trackingNumber);
        this.originalShipments = this.originalShipments.filter(x => x.trackingNumber !== row.trackingNumber);
      });
  }

  confirmRetire(row: any) {
    this.confirmationService.confirm({
      message: `Retire shipment ${row.trackingNumber}?`,
      header: 'Retire Shipment',
      icon: 'pi pi-exclamation-triangle',

      acceptLabel: 'Retire',
      rejectLabel: 'Cancel',

      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',

      accept: () => {
        this.retire(row);
      }
    });
  }


  loadSubscriptions() {
    const user = JSON.parse(localStorage.getItem('user')!);

    this.dataService.getWHSubscriptions(user.id)
      .subscribe({
        next: (res: any[]) => {
          console.log('subscriptions:', res);
          this.subscriptions = res || [];
        },
        error: (err) => {
          console.error('❌ error loading subscriptions:', err);
        }
      });
  }

  load() {
    this.loading = true;

    this.dataService.getShipments().subscribe({
      next: (res) => {
        this.originalShipments = res;   // 
        this.shipments = [...res];      // 

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


  }


  selectedZone: number | null = null;

  setZone(zone: number | null) {
    this.selectedZone = zone;

    //  START FROM ORIGINAL DATA ALWAYS
    let data = [...this.originalShipments];

    //  APPLY ZONE FILTER
    if (zone === 0) {
      data = data.filter(x => x.zone == null);   // Z?
    } else if (zone !== null) {
      data = data.filter(x => x.zone === zone);
    }

    this.shipments = data;

    //  REAPPLY EXISTING TABLE FILTERS
    setTimeout(() => this.applyFilters());
  }


  isHoliday(row: any): boolean {
    if (!row?.entryDate) return false;

    const d = new Date(row.entryDate);
    const m = d.getMonth() + 1;

    // Nov, Dec, Jan
    return m === 11 || m === 12 || m === 1;
  }


  clearFilters() {
    this.selectedStatus = null;
    this.selectedSla = null;
    this.selectedZone = null;

    this.shipments = [...this.originalShipments];   //  RESET DATA
    this.table.clear();                             // keep this
  }


  getZoneSeverity(zone: number) {
    if (!zone) return 'secondary';
    if (zone <= 4) return 'success';
    if (zone <= 6) return 'warning';
    return 'danger';
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




}
