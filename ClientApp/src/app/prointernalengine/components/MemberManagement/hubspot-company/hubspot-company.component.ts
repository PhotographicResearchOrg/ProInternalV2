import { Component, OnInit, ViewChild, Output,EventEmitter } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { ConfirmationService } from 'primeng/api';

@Component({
  selector: 'app-hubspot-company',
  templateUrl: './hubspot-company.component.html',
  styleUrls: ['./hubspot-company.component.scss'],
  providers: [MessageService]
})

export class HubspotCompanyComponent implements OnInit {
  @ViewChild('table') table!: Table;
  @Output() accountNumbersChanged = new EventEmitter<string[]>();
  @Output() filterByAccountNumbers = new EventEmitter<string[]>();

  companies: any[] = [];
  owners: any[] = [];
  ownersLookup: { [key: string]: string } = {};
  loading = true;
  filterText: string = '';
  selectedOwnerId: string | null = '36109109'; // ← replace with your default ownerId
  globalFilterValue: string = '';

  constructor(
    private dataService: DataService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) { }

  ngOnInit(): void {
    this.loadData();
  }





  loadData(): void {


    this.dataService.getHubspotOwners().subscribe(ownerData => {

      this.owners = (ownerData.results || []).map(owner => {
        const name = `${owner.firstName || ''} ${owner.lastName || ''}`.trim();
        const label = name || owner.email || 'Unknown';
        this.ownersLookup[owner.id] = label;

        return {
          id: owner.id,
          name: label
        };
      });



      this.dataService.getHubspotCompanies().subscribe(companyData => {
        this.companies = companyData.results.map((c: any) => {
          const ownerId = c.properties.hubspot_owner_id;
          const ownerName = this.ownersLookup[ownerId] || 'Unassigned';
          const accountNumber = c.properties.account_number || '';

          return {
            id: c.id,
            name: c.properties.name,
            accountNumber: accountNumber,
            ownerId: ownerId,
            ownerName: ownerName  // <-- required for global filter + sort
          };
        });




        // Apply default filter once data is loaded
        if (this.selectedOwnerId) {
          this.onOwnerFilter(this.selectedOwnerId);
        }
        this.loading = false;
      });
    });
  }



  onOwnerFilter(ownerId: string) {
    if (this.table) {
      this.table.filter(ownerId, 'ownerId', 'equals');
    }

    const matchingAccounts = this.companies
      .filter(c => c.ownerId === ownerId)
      .map(c => c.accountNumber)
      .filter(a => a); // exclude nulls

    this.filterByAccountNumbers.emit(matchingAccounts);
  }

  confirmDeleteCompany(companyId: string): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to delete this company?',
      accept: () => {
        this.deleteCompany(companyId);
      }
    });
  }

  confirmUpdateOwner(companyId: string, newOwnerId: string) {
    this.confirmationService.confirm({
      message: 'Are you sure you want to change the owner?',
      accept: () => {
        this.updateOwner(companyId, newOwnerId);
      }
    });
  }

  updateOwner(companyId: string, newOwnerId: string): void {
    this.dataService.updateHubspotCompanyOwner(companyId, newOwnerId).subscribe(() => {
      this.messageService.add({ severity: 'success', summary: 'Owner Updated' });
    });
  }



  filterTableGlobal(event: Event, table: Table) {
    const input = event.target as HTMLInputElement;
    table.filterGlobal(input.value, 'contains');
  }

  deleteCompany(companyId: string): void {
    this.dataService.deleteHubspotCompany(companyId).subscribe(() => {
      this.companies = this.companies.filter(c => c.id !== companyId);
      this.messageService.add({ severity: 'success', summary: 'Company Deleted' });
    });
  }
}




