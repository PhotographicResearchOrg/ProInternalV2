import { group } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DragDropModule } from 'primeng/dragdrop';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { Account } from 'src/app/models/Dashboard/Account';
import { CompanyGroupExclusion, ProductExclusionGroup } from 'src/app/models/exclusions/group-exclusions';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-exclusion-group-company',
  standalone: true,
  imports: [CommonModule, DropdownModule, FormsModule, DragDropModule, ButtonModule, ToastModule],
	providers: [MessageService],
	templateUrl: './exclusion-group-company.component.html',
  styleUrl: './exclusion-group-company.component.scss'
})
export class ExclusionGroupCompanyComponent {

	public allGroups: Array<ProductExclusionGroup> = [];
	public selectedGroups: Array<ProductExclusionGroup> = [];
	public unselectedGroups: Array<ProductExclusionGroup> = [];
	public companies: Array<Account> = [];
	public selectedCompanyId: number | undefined;
	private activeGroup: ProductExclusionGroup | undefined;

  public groupSaveSummary: ProductExclusionGroup[] = [];
  public saveCompanyName: string = '';
  public saveTimestamp: Date | null = null;



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

}
