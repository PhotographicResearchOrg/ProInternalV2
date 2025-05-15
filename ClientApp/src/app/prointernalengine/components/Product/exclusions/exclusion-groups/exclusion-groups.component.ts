import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DragDropModule } from 'primeng/dragdrop';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { ProductExclusionGroup, ProductExclusionGroupProduct } from 'src/app/models/exclusions/group-exclusions';
import { ProProduct } from 'src/app/prointernalengine/api/product';
import { DataService } from 'src/app/services/data.service';
import * as XLSX from 'xlsx';
import { ExclusionGroupCompanyComponent } from 'src/app/prointernalengine/components/Product/exclusions/exclusion-group-company/exclusion-group-company.component';
import { PanasonicreportingComponent } from 'src/app/prointernalengine/components/Reporting/panasonicreporting/panasonicreporting.component';

@Component({
  selector: 'app-exclusion-groups',
  standalone: true,
  imports: [PanasonicreportingComponent ,CommonModule, FormsModule, ReactiveFormsModule, InputTextModule, ButtonModule, DropdownModule, DragDropModule, ToastModule, ExclusionGroupCompanyComponent],
  providers: [MessageService],
  templateUrl: './exclusion-groups.component.html',
  styleUrl: './exclusion-groups.component.scss'
})



export class ExclusionGroupsComponent {

	public groups: Array<ProductExclusionGroup> = [];
	public selectedGroupId: number | undefined;
	public includedProducts: Array<ProductExclusionGroupProduct> = [];
	public newGroupName: string;
	public products: Array<ProProduct> = [];
	public searchTerm: string = '';
  public searchResults: Array<ProProduct> = [];

  public newlyCreatedGroupName: string | null = null;



  public groupSaveAcknowledged = false;
  public lastSavedGroupName = '';
  public lastSavedProducts: ProductExclusionGroupProduct[] = [];
  public lastSavedAt: Date = new Date();

  public saveSummaryVisible = false;
  public savedProductSummary: ProProduct[] = [];
  public selectedGroupName = '';
  public saveTimestamp: Date = new Date();


  public unassignedProducts: ProProduct[] = [];



	private activeProduct: ProductExclusionGroupProduct | undefined;
	public searchBox = new FormControl('');

  submittedSummary: {
    groupName: string;
    products: { productCode: string; modelName: string }[];
  } | null = null;

	constructor(private dataService: DataService, private messageService: MessageService) { }

  ngOnInit()
  {
		this.dataService.getExclusionGroups().subscribe((data: Array<ProductExclusionGroup>) => {
			this.groups = data.sort((a, b) => a.groupName.localeCompare(b.groupName));
		});

    this.searchBox.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(searchTerm => (searchTerm || '').trim().length > 2),
      switchMap(searchTerm => this.dataService.getProducts(searchTerm || ''))
    ).subscribe((data: Array<ProProduct>) => {
      const includedProductCodes = new Set(this.includedProducts.map(p => p.productCode));
      this.searchResults = data
        .filter(p => !includedProductCodes.has(p.productCode)) // Exclude already added
        .sort((a, b) => a.productCode.localeCompare(b.productCode));
    });

    this.dataService.getUnassignedProducts().subscribe(data => {
      this.unassignedProducts = data;
    });



	}

  addNew() {
    if (this.newGroupName?.trim()) {
      this.dataService.createExclusionGroup(this.newGroupName).subscribe((groupId) => {
        this.groups.push(new ProductExclusionGroup({
          productExclusionGroupID: groupId,
          groupName: this.newGroupName
        }));
        this.groups.sort((a, b) => a.groupName.localeCompare(b.groupName));
        this.newlyCreatedGroupName = this.newGroupName;
        this.newGroupName = '';
      });
    }
  }

	onGroupChange(e: any) {
		this.selectedGroupId = this.groups.find(group => group.productExclusionGroupID === e.value)?.productExclusionGroupID;
		this.dataService.getExclusionGroupProducts(this.selectedGroupId || 0).subscribe((data: any) => {
			this.includedProducts = data.sort((a: any, b: any) => a.productCode.localeCompare(b.productCode));
		});
	}

	removeProduct(productCode: string) {
		if (this.selectedGroupId) {
			this.includedProducts = this.includedProducts.filter(product => product.productCode !== productCode);
		}
	}

  dragStart(product: ProProduct) {
    this.activeProduct = new ProductExclusionGroupProduct({
      productCode: product.productCode,
      modelName: product.modelName
    });
  }

	drop() {
		if (this.activeProduct && this.selectedGroupId) {
			this.includedProducts.push(new ProductExclusionGroupProduct({ productCode: this.activeProduct.productCode, productExclusionGroupID: this.selectedGroupId, modelName: this.activeProduct.modelName }));
			this.activeProduct = undefined;
		}
	}

  handleProductDrop(toIncluded: boolean) {
    if (!this.activeProduct || !this.selectedGroupId) return;

    const exists = toIncluded
      ? this.includedProducts.some(p => p.productCode === this.activeProduct!.productCode)
      : this.products.some(p => p.productCode === this.activeProduct!.productCode);

    if (exists) return;

    const targetArray = toIncluded ? this.includedProducts : this.products;
    targetArray.push(new ProductExclusionGroupProduct({
      productCode: this.activeProduct.productCode,
      modelName: this.activeProduct.modelName,
      productExclusionGroupID: this.selectedGroupId
    }));

    this.activeProduct = undefined;
  }


  exportToExcel(): void {
    const worksheetData = this.includedProducts.map(product => ({
      'Product Code': product.productCode,
      'Model Name': product.modelName
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ProductsInGroup');

    XLSX.writeFile(workbook, `ExclusionGroup_${this.selectedGroupId}_Products.xlsx`);
  }

  save() {
    const group = this.groups.find(g => g.productExclusionGroupID === this.selectedGroupId);

    this.dataService.addProductToExclusionGroup(
      this.selectedGroupId || 0,
      this.includedProducts.map(p => p.productCode)
    ).subscribe(() => {
      this.savedProductSummary = [...this.includedProducts];
      this.selectedGroupName = group?.groupName || 'Unknown';
      this.saveTimestamp = new Date();
      this.saveSummaryVisible = true;

      // Optionally hide after 5s
      // setTimeout(() => this.saveSummaryVisible = false, 5000);
    });
  }
   

}
