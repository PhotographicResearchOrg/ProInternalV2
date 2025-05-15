import { group } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DragDropModule } from 'primeng/dragdrop';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { Account } from 'src/app/models/Dashboard/Account';
import { CompanyGroupExclusion, ProductExclusionGroup } from 'src/app/models/exclusions/group-exclusions';
import { DataService } from 'src/app/services/data.service';
import { TabViewModule } from 'primeng/tabview';
import * as XLSX from 'xlsx';
import { TableModule } from 'primeng/table';

@Component({
  selector: 'app-exclusion-group-company',
  standalone: true,
  imports: [CommonModule, DropdownModule, FormsModule, DragDropModule, ButtonModule, ToastModule, TabViewModule, TableModule],
	providers: [MessageService],
	templateUrl: './exclusion-group-company.component.html',
  styleUrl: './exclusion-group-company.component.scss'
})
export class ExclusionGroupCompanyComponent {

  @Input() groups: ProductExclusionGroup[] = [];

	public allGroups: Array<ProductExclusionGroup> = [];
	public selectedGroups: Array<ProductExclusionGroup> = [];
	public unselectedGroups: Array<ProductExclusionGroup> = [];
	public companies: Array<Account> = [];
	public selectedCompanyId: number | undefined;
	private activeGroup: ProductExclusionGroup | undefined;

  public groupSaveSummary: ProductExclusionGroup[] = [];
  public saveCompanyName: string = '';
  public saveTimestamp: Date | null = null;
  public selectedGroupIdForCompanyView: number | null = null;

  groupCompanies: { companyId: number; companyName: string }[] = [];

  selectedGroupNameForCompanyView: string;


	constructor(private dataService: DataService, private messageService: MessageService) { }
	ngOnInit() {
		this.getBrands();
		this.getCompanies();
	}
	getBrands() {
		this.dataService.getExclusionGroups().subscribe((data: Array<ProductExclusionGroup>) => {
			this.allGroups = data.sort((a, b) =>  a.groupName.localeCompare(b.groupName));
		});
	}
	getCompanies() {
		this.dataService.getAccounts().subscribe((data: Array<Account>) => {
			this.companies = data.sort((a, b) => a.accountName.localeCompare(b.accountName));
		});
	}

	onCompanyChange(e:any) {
		this.selectedCompanyId = this.companies.find((company: Account) => company.companyID === e.value)?.companyID;
    console.log(e)
    if (this.selectedCompanyId) {
  
			this.dataService.getCompanyGroupExclusions(this.selectedCompanyId).subscribe((data: Array<CompanyGroupExclusion>) => {
				this.selectedGroups = this.allGroups.filter(group => data.map(g => g.productExclusionGroupID).indexOf(group.productExclusionGroupID) !== -1);
				this.unselectedGroups = this.allGroups.filter(group => this.selectedGroups.map(s => s.productExclusionGroupID).indexOf(group.productExclusionGroupID) === -1);
			})
		}
	}

  onGlobalFilter(event: Event, table: any) {
    const input = event.target as HTMLInputElement;
    table.filterGlobal(input.value, 'contains');
  }


	dragStart(group: ProductExclusionGroup) {
		this.activeGroup = group;
	}
	drop(isIncluded: boolean) {
		if (this.activeGroup) {
			if (isIncluded) {
				this.selectedGroups.push(this.activeGroup);
				this.unselectedGroups = this.unselectedGroups.filter(group => group !== this.activeGroup);
			} else {
				this.unselectedGroups.push(this.activeGroup);
				this.selectedGroups = this.selectedGroups.filter(group => group !== this.activeGroup);
			}
			this.activeGroup = undefined;
		}
	}

  save() {
    const selectedCompany = this.companies.find(c => c.companyID === this.selectedCompanyId);

    this.dataService.addExclustionGroupToCompany(
      this.selectedCompanyId!,
      this.selectedGroups.map(g => g.productExclusionGroupID)
    ).subscribe(() => {
      this.groupSaveSummary = [...this.selectedGroups];
      this.saveCompanyName = selectedCompany?.accountName || 'Unknown Company';
      this.saveTimestamp = new Date();
    });
  }


  loadCompaniesForGroup(): void {
    if (!this.selectedGroupIdForCompanyView) {
      this.groupCompanies = [];
      return;
    }

    this.dataService.getCompaniesForGroup(this.selectedGroupIdForCompanyView).subscribe({
      next: (data) => this.groupCompanies = data,
      error: () => this.groupCompanies = []
    });
  }


  onGroupSelect(event: any) {
    const selected = this.groups.find(g => g.productExclusionGroupID === event.value);
    this.selectedGroupNameForCompanyView = selected?.groupName || 'Group';
  }

  exportGroupCompaniesToExcel(): void {
    const exportData = this.groupCompanies.map(c => ({
      'Company Name': c.companyName,
      'Company ID': c.companyId
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();

    const safeSheetName = this.selectedGroupNameForCompanyView?.replace(/[\\/?*[\]:]/g, '') || 'Group';
    const fileName = `Companies_Assigned_to_${safeSheetName.replace(/\s+/g, '_')}.xlsx`;

    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
    XLSX.writeFile(workbook, fileName);
  }

}
