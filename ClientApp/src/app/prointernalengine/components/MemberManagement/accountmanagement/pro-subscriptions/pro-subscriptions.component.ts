// src/app/accountmanagement/pro-subscriptions/pro-subscriptions.component.ts

import { Component, OnInit } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { SubscriptionRecord } from 'src/app/models/accounts/subscription';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-pro-subscriptions',
  templateUrl: './pro-subscriptions.component.html',
  providers: [MessageService]
})
export class ProSubscriptionsComponent implements OnInit {

  subscriptions: SubscriptionRecord[] = [];
  loading = true;

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
        this.subscriptions = data;
        this.loading = false;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load subscriptions' });
        this.loading = false;
      }
    });
  }

}
