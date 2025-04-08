import { DragDropModule } from 'primeng/dragdrop';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { Account, Brand } from 'src/app/models/Dashboard/Account';
import { DataService } from 'src/app/services/data.service';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-brand-exclusions',
  standalone: true,
  imports: [CommonModule, DropdownModule, FormsModule, DragDropModule, ButtonModule, ToastModule],
  providers: [MessageService],
  templateUrl: './brand-exclusions.component.html',
  styleUrl: './brand-exclusions.component.scss'
})
export class BrandExclusionsComponent {

	public allBrands: Array<Brand> = [];
	public selectedBrands: Array<Brand> = [];
	public unselectedBrands: Array<Brand> = [];
	public companies: Array<Account> = [];
	public selectedCompanyId: number | undefined;
	private activeBrand: Brand | undefined;
  showSummary: boolean = false;
  summaryTimestamp: Date = new Date();
  selectedCompany: any = null;

	constructor(private dataService: DataService, private messageService: MessageService) { }
	ngOnInit() {
		this.getBrands();
		this.getCompanies();
	}
	getBrands() {
		this.dataService.getBrands().subscribe((data: Array<Brand>) => {
			this.allBrands = data.sort((a, b) =>  a.brandName.localeCompare(b.brandName));
		});
	}
	getCompanies() {
		this.dataService.getAccounts().subscribe((data: Array<Account>) => {
			this.companies = data.sort((a, b) => a.accountName.localeCompare(b.accountName));
		});
	}

	onCompanyChange(e:any) {
		this.selectedCompanyId = this.companies.find((company: Account) => company.companyID === e.value)?.companyID;
		if(this.selectedCompanyId) {
			this.dataService.getBrandExclusions(this.selectedCompanyId).subscribe((data: Array<Brand>) => {
				this.selectedBrands = data;
				this.unselectedBrands = this.allBrands.filter(brand => this.selectedBrands.map(s => s.brandID).indexOf(brand.brandID) === -1);
			})
		}
	}

	dragStart(brand: Brand) {
		this.activeBrand = brand;
	}
	drop(isIncluded: boolean) {
		if (this.activeBrand) {
			if (isIncluded) {
				this.selectedBrands.push(this.activeBrand);
				this.unselectedBrands = this.unselectedBrands.filter(brand => brand !== this.activeBrand);
			} else {
				this.unselectedBrands.push(this.activeBrand);
				this.selectedBrands = this.selectedBrands.filter(brand => brand !== this.activeBrand);
			}
			this.activeBrand = undefined;
		}
	}

	save() {
		this.dataService.addBrandExclusionToCompany(this.selectedCompanyId!, this.selectedBrands.map(b => b.brandID)).subscribe(() => {
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Brand exclusions saved successfully!' });

      this.showSummary = true;
      this.summaryTimestamp = new Date();
      this.selectedCompany = this.companies.find(c => c.companyID === this.selectedCompanyId);

		});
	}
}
