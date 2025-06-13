// src/app/accountmanagement/client-grid/client-grid.component.ts

import { Component, OnInit } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { Member } from 'src/app/models/accounts/member'; // Reusing same model
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-client-grid',
  templateUrl: './client-grid.component.html',
  providers: [MessageService]
})
export class ClientGridComponent implements OnInit {

  clients: Member[] = [];
  loading = true;

  constructor(
    private dataService: DataService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadClients();
  }

  loadClients(): void {
    this.loading = true;
    this.dataService.getMembers('Clients').subscribe({
      next: (data) => {
        this.clients = data;
        this.loading = false;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load clients' });
        this.loading = false;
      }
    });
  }

}
