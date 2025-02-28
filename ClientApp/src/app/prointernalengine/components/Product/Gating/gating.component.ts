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
import { InstantRebate } from "src/app/models/Dashboard/InstantRebate";
import { DeclinedIR } from "src/app/models/Dashboard/DeclinedIR";
import * as XLSX from 'xlsx';
import { Table } from 'primeng/table';


import { TabledemoComponent } from 'src/app/prointernalengine/components/uikit/table/tabledemo.component';
import { TabledemoRoutingModule } from 'src/app/prointernalengine/components/uikit/table//tabledemo-routing.module';
import { ViewChild, ElementRef } from '@angular/core';
import { Customer, Representative } from 'src/app/prointernalengine/api/customer';
import { CustomerService } from 'src/app/prointernalengine/service/customer.service';
import { Product } from 'src/app/prointernalengine/api/product';
import { ProductService } from 'src/app/prointernalengine/service/product.service';
import { MessageService, ConfirmationService } from 'primeng/api';



interface expandedRows {
  [key: string]: boolean;
}

@Component({
  templateUrl: './gating.component.html',
  providers: [MessageService, ConfirmationService]
})

export class GatingComponent implements OnInit {



  public customers1: Customer[] = [];

  selectedCustomers1: Customer[] = [];
  selectedCustomer: Customer = {};
  representatives: Representative[] = [];
  statuses: any[] = [];

  products: Product[] = [];
  rowGroupMetadata: any;
  expandedRows: expandedRows = {};
  activityValues: number[] = [0, 100];

  isExpanded: boolean = false;

  idFrozen: boolean = false;

  loading: boolean = true;


  @ViewChild('filter') filter!: ElementRef;

  constructor(private customerService: CustomerService, private productService: ProductService) { }

  ngOnInit() {

    //alert("IN")

      this.customerService.getCustomersLarge().then(customers => {
      this.customers1 = customers;
      this.loading = false;

      // @ts-ignore
      this.customers1.forEach(customer => customer.date = new Date(customer.date));
    });

    this.productService.getProductsWithOrdersSmall().then(data => this.products = data);

    this.representatives = [
      { name: 'Amy Elsner', image: 'amyelsner.png' },
      { name: 'Anna Fali', image: 'annafali.png' },
      { name: 'Asiya Javayant', image: 'asiyajavayant.png' },
      { name: 'Bernardo Dominic', image: 'bernardodominic.png' },
      { name: 'Elwin Sharvill', image: 'elwinsharvill.png' },
      { name: 'Ioni Bowcher', image: 'ionibowcher.png' },
      { name: 'Ivan Magalhaes', image: 'ivanmagalhaes.png' },
      { name: 'Onyama Limba', image: 'onyamalimba.png' },
      { name: 'Stephen Shaw', image: 'stephenshaw.png' },
      { name: 'XuXue Feng', image: 'xuxuefeng.png' }
    ];

    this.statuses = [
      { label: 'Unqualified', value: 'unqualified' },
      { label: 'Qualified', value: 'qualified' },
      { label: 'New', value: 'new' },
      { label: 'Negotiation', value: 'negotiation' },
      { label: 'Renewal', value: 'renewal' },
      { label: 'Proposal', value: 'proposal' }
    ];
  }

  onSort() {
    this.updateRowGroupMetaData();
  }

  updateRowGroupMetaData() {
    this.rowGroupMetadata = {};

    
  }

  expandAll() {
    if (!this.isExpanded) {
      this.products.forEach(product => product && product.name ? this.expandedRows[product.name] = true : '');

    } else {
      this.expandedRows = {};
    }
    this.isExpanded = !this.isExpanded;
  }

  formatCurrency(value: number) {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

  clear(table: Table) {
    table.clear();
    this.filter.nativeElement.value = '';
  }

  calculateCustomerTotal(name: string) {
    let total = 0;



    return total;
  }


}
