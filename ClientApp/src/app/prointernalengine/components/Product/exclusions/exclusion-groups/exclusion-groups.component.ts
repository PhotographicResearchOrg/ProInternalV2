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

@Component({
  selector: 'app-exclusion-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InputTextModule, ButtonModule, DropdownModule, DragDropModule, ToastModule],
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

	private activeProduct: ProductExclusionGroupProduct | undefined;
	public searchBox = new FormControl('');

	constructor(private dataService: DataService, private messageService: MessageService) { }

	ngOnInit() {
		this.dataService.getExclusionGroups().subscribe((data: Array<ProductExclusionGroup>) => {
			this.groups = data.sort((a, b) => a.groupName.localeCompare(b.groupName));
		});

		this.searchBox.valueChanges.pipe(
			debounceTime(300),
			distinctUntilChanged(),
			filter(searchTerm => (searchTerm || '').trim().length > 2),
			switchMap(searchTerm => this.dataService.getProducts(searchTerm || ''))
		).subscribe((data: Array<ProProduct>) => {
			this.products = data.sort((a, b) => a.productCode.localeCompare(b.productCode));
		});
	}

	addNew() {
		if (this.newGroupName) {
			this.dataService.createExclusionGroup(this.newGroupName).subscribe((groupId) => {
				this.groups.push(new ProductExclusionGroup({ productExclusionGroupID: groupId, groupName: this.newGroupName }));
				this.groups.sort((a, b) => a.groupName.localeCompare(b.groupName));
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
		this.activeProduct = new ProductExclusionGroupProduct({ productCode: product.productCode, modelName: product.modelName });
	}
	drop() {
		if (this.activeProduct && this.selectedGroupId) {
			this.includedProducts.push(new ProductExclusionGroupProduct({ productCode: this.activeProduct.productCode, productExclusionGroupID: this.selectedGroupId, modelName: this.activeProduct.modelName }));
			this.activeProduct = undefined;
		}
	}

	save() {
		this.dataService.addProductToExclusionGroup(this.selectedGroupId || 0, this.includedProducts.map(p => p.productCode)).subscribe(() => {
			this.includedProducts = [];
			this.dataService.getExclusionGroupProducts(this.selectedGroupId || 0).subscribe((data: any) => {
				this.includedProducts = data.sort((a: any, b: any) => a.productCode.localeCompare(b.productCode));
			});
		});
	}
}
