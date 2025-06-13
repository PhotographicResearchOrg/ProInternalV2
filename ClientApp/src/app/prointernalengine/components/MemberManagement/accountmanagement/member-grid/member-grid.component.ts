// src/app/accountmanagement/member-grid/member-grid.component.ts

import { Component, OnInit } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { Member, MemberAddress } from 'src/app/models/accounts/member';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-member-grid',
  templateUrl: './member-grid.component.html',
  providers: [MessageService]
})
export class MemberGridComponent implements OnInit {

  members: Member[] = [];
  loading = true;
  rowExpansionCache: { [accountNumber: string]: MemberAddress[] } = {};
  expandedRows: { [accountNumber: string]: boolean } = {};  // THIS is what you bind to [expandedRowKeys]

  constructor(
    private dataService: DataService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadMembers();
  }

  loadMembers(): void {
    this.loading = true;
    this.dataService.getMembers().subscribe({
      next: (data) => {
        this.members = data;
        this.loading = false;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load members' });
        this.loading = false;
      }
    });
  }


  onRowExpand(member: Member): void {
    const account = member.accountNumber;

    if (!this.rowExpansionCache[account]) {
      this.dataService.getMemberShipping(account).subscribe(addresses => {
        this.rowExpansionCache[account] = addresses;
        this.expandedRows[account] = true;
      });
    } else {
      this.expandedRows[account] = true;
    }
  }

}
