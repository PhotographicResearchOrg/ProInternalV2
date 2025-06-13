// src/app/accountmanagement/affiliate-grid/affiliate-grid.component.ts

import { Component, OnInit } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { Member } from 'src/app/models/accounts/member'; // Reusing Member model
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-affiliate-grid',
  templateUrl: './affiliate-grid.component.html',
  providers: [MessageService]
})
export class AffiliateGridComponent implements OnInit {

  affiliates: Member[] = [];
  loading = true;

  constructor(
    private dataService: DataService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadAffiliates();
  }

  loadAffiliates(): void {
    this.loading = true;
    this.dataService.getMembers('Affiliates').subscribe({
      next: (data) => {
        this.affiliates = data;
        this.loading = false;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load affiliates' });
        this.loading = false;
      }
    });
  }

}
