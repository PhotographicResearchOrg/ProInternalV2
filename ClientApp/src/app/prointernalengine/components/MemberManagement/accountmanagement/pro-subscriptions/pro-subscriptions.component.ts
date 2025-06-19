import { Component, OnInit } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { SubscriptionRecord } from 'src/app/models/accounts/subscription';
import { MessageService } from 'primeng/api';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-pro-subscriptions',
  templateUrl: './pro-subscriptions.component.html',
  providers: [MessageService]
})
export class ProSubscriptionsComponent implements OnInit {

  subscriptions: SubscriptionRecord[] = [];
  allSubscriptions: SubscriptionRecord[] = [];
  loading = true;
  exporting = false;

  // Filter chips
  subscriptionTypeOptions = [
    // Populate from your backend or define statically here
    { label: 'Type A', value: 'Type A' },
    { label: 'Type B', value: 'Type B' },
    { label: 'Type C', value: 'Type C' }
  ];


  selectedSubscriptionTypes: string[] = [];

  constructor(
    private dataService: DataService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadSubscriptions();
  }

  loadSubscriptions(): void {
    this.loading = true;
    this.dataService.getSubscriptions().subscribe({
      next: (data) => {
        this.allSubscriptions = data;
        this.subscriptions = data;

        // Extract unique subscription names for chips
        const uniqueTypes = Array.from(new Set(data.map(s => s.subscriptionName))).sort();

        this.subscriptionTypeOptions = uniqueTypes.map(type => ({
          label: type,
          value: type
        }));

        // Select all chips by default
        this.selectedSubscriptionTypes = this.subscriptionTypeOptions.map(option => option.value);

        // Apply filter to show all data initially
        this.applyFilter();

        this.loading = false;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load subscriptions' });
        this.loading = false;
      }
    });
  }



  applyFilter() {
    if (this.selectedSubscriptionTypes.length === 0) {
      this.subscriptions = this.allSubscriptions;
    } else {
      this.subscriptions = this.allSubscriptions.filter(sub =>
        this.selectedSubscriptionTypes.includes(sub.subscriptionName)
      );
    }
  }


  getChipClass(type: string): string {
    switch (type) {
      case 'Type A': return 'chip-members';    // choose colors or create new classes
      case 'Type B': return 'chip-clients';
      case 'Type C': return 'chip-affiliates';
      default: return 'custom-chip';
    }
  }

  getSubscriptionChipClass(subscriptionName: string): string {
    switch (subscriptionName.toLowerCase()) {
      case 'buyer\'s guide': return 'chip-members';     // Blue
      case 'profitlines': return 'chip-clients';       // Green
      case 'premium': return 'chip-affiliates';        // Orange
      default: return 'custom-chip';                    // Default styling
    }
  }



  onGlobalFilter(table: any, event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    table.filterGlobal(input, 'contains');
  }

  exportToExcel(data: any[], filename = 'subscriptions_export.xlsx'): void {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportSubscriptionsOnly(): void {
    this.exportToExcel(this.subscriptions, 'subscriptions_only.xlsx');
  }

}
