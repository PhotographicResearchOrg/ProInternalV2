// src/app/accountmanagement/member-grid/member-grid.component.ts

import { Component, OnInit } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { Member, MemberAddress } from 'src/app/models/accounts/member';
import { MessageService } from 'primeng/api';
import * as XLSX from 'xlsx';
import { forkJoin } from 'rxjs';




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
  globalFilter: string = '';
  uploadingAccount: string | null = null;  // track which member is uploading
  exporting: boolean = false;

  allMembers: Member[] = [];  // holds all loaded data
 
  selectedTypes: string[] = ['Members', 'Clients', 'Affiliates']; // default selected types

  typeOptions = [
    { label: 'Members', value: 'Members' },
    { label: 'Clients', value: 'Clients' },
    { label: 'Affiliates', value: 'Affiliates' }
  ];

  constructor(
    private dataService: DataService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadAllTypes();
  }


  loadAllTypes(): void {
    this.loading = true;

    forkJoin({
      members: this.dataService.getMembers(),              // default is Members
      clients: this.dataService.getMembers('Clients'),
      affiliates: this.dataService.getMembers('Affiliates'),
    }).subscribe({
      next: ({ members, clients, affiliates }) => {
        const typedMembers = members.map(m => ({ ...m, type: 'Members' }));
        const typedClients = clients.map(c => ({ ...c, type: 'Clients' }));
        const typedAffiliates = affiliates.map(a => ({ ...a, type: 'Affiliates' }));

        this.allMembers = [...typedMembers, ...typedClients, ...typedAffiliates];
        this.applyFilter();

        this.loading = false;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load data' });
        this.loading = false;
      }
    });
  }


  //loadMembers(): void {
  //  this.loading = true;
  //  this.dataService.getMembers().subscribe({
  //    next: (data) => {
  //      this.members = data;
  //      this.loading = false;
  //    },
  //    error: () => {
  //      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load members' });
  //      this.loading = false;
  //    }
  //  });
  //}





  // Called on chip changes
  applyFilter(): void {
    if (!this.selectedTypes || this.selectedTypes.length === 0) {
      this.members = [...this.allMembers];  // show all if no filter selected
    } else {
      this.members = this.allMembers.filter(m => m.type !== undefined && this.selectedTypes.includes(m.type));

    }
  }

  getChipClass(type: string): string {
    switch (type) {
      case 'Members': return 'p-multiselect-token members';
      case 'Clients': return 'p-multiselect-token clients';
      case 'Affiliates': return 'p-multiselect-token affiliates';
      default: return '';
    }
  }




  onGlobalFilter(table: any, event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    table.filterGlobal(input, 'contains');
  }

  toggleRow(member: Member): void {
    const account = member.accountNumber;

    alert(account)

    if (this.expandedRows[account])
    {
      const { [account]: _, ...rest } = this.expandedRows;
      this.expandedRows = rest;
    } else
    {
      if (!this.rowExpansionCache[account]) {
        alert(account)
        this.dataService.getMemberShipping(account).subscribe(addresses => {
          this.rowExpansionCache[account] = addresses;
          this.expandedRows = {
            ...this.expandedRows,
            [account]: true
          };
        });
      } else {
        this.expandedRows = {
          ...this.expandedRows,
          [account]: true
        };
      }
    }
  }



  exportToExcel(data: any[], filenamePrefix: string = 'member_export'): void {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const fileName = `${filenamePrefix}_${timestamp}.xlsx`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }



  exportMembersOnly(): void {
    this.exportToExcel(this.members, 'members_only');
  }

  loadAllAddressesForExport(): Promise<void> {
    const loadPromises: Promise<void>[] = this.members.map(member => {
      const account = member.accountNumber;

      // If not already cached, fetch and store
      if (!this.rowExpansionCache[account]) {
        return this.dataService.getMemberShipping(account).toPromise().then(addresses => {
          this.rowExpansionCache[account] = addresses ?? []; // Ensure it's always an array
        });
      }

      // Already cached
      return Promise.resolve();
    });

    return Promise.all(loadPromises).then(() => { });
  }



  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();  // <-- add this line
  }




  onImageDrop(event: DragEvent, member: Member) {
    event.preventDefault();
    event.stopPropagation();  // <-- add this line

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];

      this.uploadingAccount = member.accountNumber;

      this.dataService.uploadMemberImage(member.accountNumber, file).subscribe({
        next: (res) => {
          member.imageUrl = `${res.imageUrl}?ts=${new Date().getTime()}`;
          this.messageService.add({ severity: 'success', summary: 'Uploaded', detail: 'Image uploaded successfully' });
          this.uploadingAccount = null;
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Upload failed' });
          this.uploadingAccount = null;
        }
      });
    }
  }




  onRowExpand(member: Member): void {
    const account = member.accountNumber;

    if (!this.rowExpansionCache[account]) {
      this.dataService.getMemberShipping(account).subscribe(addresses => {
        this.rowExpansionCache[account] = addresses;
        this.expandedRows = {
          ...this.expandedRows,
          [account]: true
        };
      });
    } else {
      this.expandedRows = {
        ...this.expandedRows,
        [account]: true
      };
    }
  }

  onRowCollapse(member: Member): void {
    const account = member.accountNumber;
    const { [account]: _, ...rest } = this.expandedRows;
    this.expandedRows = rest;
  }


  exportAllWithAddresses(): void {
    this.exporting = true;

    this.loadAllAddressesForExport().then(() => {
      const exportRows: any[] = [];

      for (const member of this.members) {
        const accountKey = member.accountNumber.toString();
        const addresses = this.rowExpansionCache[accountKey] ?? [];

        if (!addresses.length) {
          exportRows.push({
            AccountNumber: member.accountNumber,
            DBA: member.dba,
            Email: member.email,
            AddressType: '',
            Street: '',
            City: '',
            State: '',
            Zip: '',
            Country: ''
          });
        } else {
          addresses.forEach(addr => {
            exportRows.push({
              AccountNumber: member.accountNumber,
              DBA: member.dba,
              Email: member.email,
              AddressType: addr.addressType,
              Street: addr.street,
              City: addr.city,
              State: addr.state,
              Zip: addr.zip,
              Country: addr.country
            });
          });
        }
      }



      this.exportToExcel(exportRows, 'members_with_addresses');
    }).finally(() => {
      this.exporting = false;
    });
  }





}
