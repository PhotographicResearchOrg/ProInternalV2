import { Component, OnInit, Inject } from '@angular/core';
import { AppConfig, LayoutService } from 'src/app/layout/service/app.layout.service';
import { Router } from "@angular/router";
import { Folder } from 'src/app/prointernalengine/api/folder';
import { File } from 'src/app/prointernalengine/api/file';
import { FileAppService } from 'src/app/prointernalengine/components/apps/file/service/file.app.service';
import { MenuItem } from 'primeng/api';
import { Subscription, debounceTime } from 'rxjs';
import { DataService } from "src/app/services/data.service";
import { HttpClient } from '@angular/common/http';
import { ProductGating } from "src/app/models/Dashboard/ProductGating";
import * as XLSX from 'xlsx';
import { Table } from 'primeng/table';
import { ViewChild, ElementRef } from '@angular/core';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Account, Brands } from "src/app/models/Dashboard/Account";
import { Product } from '../../../api/product';
import { Products } from "src/app/models/Dashboard/Products";

interface expandedRows {
  [key: string]: boolean;
}

@Component({
  templateUrl: './gating.component.html',
  providers: [MessageService, ConfirmationService]
})

export class GatingComponent implements OnInit {

  public gatedProducts: ProductGating[] = [];
  rowGroupMetadata: any;
  loadingMainGrid: boolean = true;
  loadingMembers: boolean = true;
  loadingBrands: boolean = true;
  loadingProducts: boolean = true;


  sourceItems: any[] = [];
  targetItems: any[] = [];




  members: any[] = [];
  selectedMembers: any[] = [];
  memberFilter: string = '';



  accounts: Account[] = [];
  brandModel: Brands[] = [];


  brands: any[] = [];
  selectedBrands: any[] = [];
  brandFilter: string = '';


  products: any[] =[];
  selectedProducts: any[] = [];
  productFilter: string = '';

  productList: Products[] = [];



  @ViewChild('filter') filter!: ElementRef;

  constructor(private dataService: DataService,) { }

  ngOnInit() {
      this.dataService.getGatedRetailers().subscribe((data) => {
        this.loadingMainGrid = false;
        this.gatedProducts = data;
    


      for (let Account of this.gatedProducts)
      {
      if (Account.accountNumber < 5000) { Account.retailerType = 'Member' }
      if (Account.accountNumber >= 5000 && Account.accountNumber <= 7000) { Account.retailerType = 'Client' }
      if (Account.accountNumber > 7000) { Account.retailerType = 'Affiliate' }
      }


        this.dataService.getAccounts().subscribe((data) => {
          this.accounts = data;
          for (let Accounts of this.accounts) {
            this.members.push({ name: Accounts.accountName, accountNumber: Accounts.accountNumber.toString() });
          }
        
          setTimeout(() => {
            this.loadingMembers = false;
          }, 0); // Ensures it's executed after all iterations
        });

        });




        this.dataService.getBrands().subscribe((data) => {       
          this.brandModel = data;

          for (let Brands of this.brandModel) {          
            this.brands.push({ name: Brands.brandName, brandNumber: Brands.brandID.toString() });
          }

          setTimeout(() => {
            this.loadingBrands = false;
          }, 0); // Ensures it's executed after all iterations
        });

   

    
        this.dataService.QuickSearchProducts().subscribe((data) => {
          this.productList = data;

         for (let prod of this.productList) {
            this.products.push({ name: prod.productCode.toString() + " -  " + prod.modelName, ID: prod.productCode }) 
         //  // this.brands.push({ name: Brands.brandName, brandNumber: Brands.brandID.toString() });
          }

          // Ensure `loadingProducts` is set to false AFTER the loop is done
          setTimeout(() => {
            this.loadingProducts = false;
          }, 0); // Ensures it's executed after all iterations
      
        });

  }

  filteredMembers = [...this.members];
  filteredBrands = [...this.brands];
  filteredProducts =  [...this.products];

  // Filter function for members
  filterMembers() {
    this.filteredMembers = this.members.filter(member =>
      member.name.toLowerCase().includes(this.memberFilter.toLowerCase()) ||
      member.accountNumber.toLowerCase().includes(this.memberFilter.toLowerCase())
    );
  }



  // Filter function for products
  filterProducts() {
    this.filteredProducts = this.products.filter(product =>
      product.name.toLowerCase().includes(this.productFilter.toLowerCase())
    );
  }



  // Filter function for brands
  filterBrands() {
    this.filteredBrands = this.brands.filter(brand =>
      brand.name.toLowerCase().includes(this.brandFilter.toLowerCase())
    );
  }


  onBrandSelected() {

    setTimeout(() => {

      this.filteredBrands = [];
    }, 300); // Small delay to ensure UI update



  }

  onProductSelected() {

    setTimeout(() => {
      this.filteredProducts = [];
    }, 300); // Small delay to ensure UI update

    
  }

  onMemberSelected() {
    if (this.selectedMembers.length > 0) {
      // Get the first selected member
      const selectedMember = this.selectedMembers[0];



      //Need to get specific barnds. 
      const  memberBrands: any[] = [];
      memberBrands.push({ name: 'Brands.brandName', brandNumber: 'Brands.brandID.toString()' });



      // Populate the product list based on the selected member
      //this.filteredProducts = selectedMember.products?.map(productName => ({ name: productName })) || [];


      // Populate the brand list based on the selected member
      this.selectedBrands = memberBrands;

      // Clear selected members after assigning brands
      setTimeout(() => {
        this.filteredMembers = [];
      }, 300); // Small delay to ensure UI update

    }
  }



  Process() { }

  Download(item: Table) {
      const filteredData = item.filteredValue || item.value;
      const data: any[] = filteredData;
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Gating_Export');
      XLSX.writeFile(wb, 'Gating_Export.xlsx');
  }

  onSort() {
    this.updateRowGroupMetaData();
  }
  updateRowGroupMetaData() {
    this.rowGroupMetadata = {};
  }
  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }
  clear(table: Table) {
    table.clear();
    this.filter.nativeElement.value = '';
  }

}
