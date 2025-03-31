import { Injectable } from "@angular/core";
import { map } from "rxjs/operators";
import { ApiService } from "./api.service";
import { QuarterlyRebates, QuarterlyRebatesHistorical, qrDetail } from "../models/accounting/quarterly-rebates";
import { OrdersMetrics } from "../models/Dashboard/OrdersMetrics";
import { SARMetrics } from "../models/Dashboard/SARMetrics";
import { EDIMetrics } from "../models/Dashboard/EDIMetrics";
import { IRMetrics } from "../models/Dashboard/IRMetrics";
import { InstantRebate } from "../models/Dashboard/InstantRebate";
import { ShippingErrorMetrics } from "../models/Dashboard/ShippingErrorMetrics";
import { Account, Brands } from "../models/Dashboard/Account";
import { Products } from "../models/Dashboard/Products";
import { SpecialOrdersSummary } from "../models/Dashboard/SpecialOrdersSummary";
import { DeclinedIR } from "../models/Dashboard/DeclinedIR";
import { CommentsMetrics } from "../models/Dashboard/CommentsMetrics";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { options } from "@fullcalendar/core/preact";
import { Observable } from "rxjs";
import { Product } from "../prointernalengine/api/product";
import { ProductGating } from "../models/Dashboard/ProductGating";
import { MemberGateSummary } from "../models/Dashboard/MemberGateSummary";
import { CompanyBrandExclusion } from "../models/exclusions/brand-exclusions";
import { CompanyGroupExclusion, ProductExclusionGroup, ProductExclusionGroupProduct } from "../models/exclusions/group-exclusions";
import { LoginResponse } from '../models/LoginResponse'; // <- make sure path is correct



@Injectable()
export class DataService {

  constructor(private api: ApiService) { }

  getQuarterySummary()
  {
    return this.api.get<Array<QuarterlyRebates>>('API/Accounting/CurrentQuarterLiability');
  }

  getGatedRetailers() {
    return this.api.get<Array<ProductGating>>('API/Product/getGatedRetailers');
  }

  getEmbedConfig() {
    return this.api.get<{ token: string; embedUrl: string; reportId: string }>('API/PowerBI/token');
  }

  uploadQuarterlyFile(file: File) {
    const formData: any = new FormData();
    formData.append(`file`, file, file.name);
    return this.api.postBlob(`API/Accounting/LoadQuarterFile`, formData)
  }


  GetInstantRebateBatches() {
    return this.api.get<Array<InstantRebate>>('API/InstantRebates/GetInstantRebateBatches');
  }

  activateIRBatch(batchId: number) {
      return this.api.put(`API/InstantRebates/activateIRBatch/${batchId}`, {});
    }


  pullIRBatchDetail(batchId: number) {
    return this.api.get<Array<InstantRebate>>(`API/InstantRebates/getIRBatchDetail/${batchId}`);
  }


  GetDeclinedInstantRebates() {
    return this.api.get<Array<DeclinedIR>>('API/InstantRebates/GetDeclinedInstantRebates');
  }


  getRecentLoad() {
    return this.api.get <Array<QuarterlyRebates>>(`API/Accounting/getCurrentQuarterlyData`);
  }

  getQRHistorical() {
    return this.api.get<Array<QuarterlyRebatesHistorical>>(`API/Accounting/getHistoricalQRData`);
  }


  deleteQRUpload(batchId: number) {

    return this.api.put(`API/Accounting/deleteQRUpload/${batchId}`, {});
  }

  activate(batchId: number) {
  
    return this.api.put(`API/Accounting/activate/${batchId}`, {});
  }

  pullQRBatchDetail(batchId: number) {
    console.log(batchId);
    return this.api.get<Array<qrDetail>>(`API/Accounting/getQRBatchDetail/${batchId}`);
  }

  pullQRBatchVendorDetail(batchId: string) {
    console.log(batchId);
    return this.api.get<Array<qrDetail>>(`API/Accounting/getQRBatchVendorDetail/${batchId}`);
  }


  /************* Mertics for Dash *************/
  getOrderMetrics()
  {
    return this.api.get<OrdersMetrics>(`API/Metrics/getOrderMetrics`);
  }

  getSARSMetrics()
  { return this.api.get<SARMetrics>(`API/Metrics/getSARSMetrics`); }

  getEDIMetrics()
  { return this.api.get<EDIMetrics>(`API/Metrics/getEDIMetrics`); }

  getIRMetrics()
  { return this.api.get<IRMetrics>(`API/Metrics/getIRMetrics`); }

  getShippingErrorMetrics()
  { return this.api.get<ShippingErrorMetrics>(`API/Metrics/getShippingErrorMetrics`); }

  getCommentMetrics()
  { return this.api.get<ShippingErrorMetrics>(`API/Metrics/getCommentMetrics`); }

  /************* End Mertics for Dash *************/

  /************* Dash or Landing Page *************/
  getOrdersSnapshot()
  { return this.api.get<Array<SpecialOrdersSummary>>(`API/Dashboard/getOrdersSnapshot`); }

  /*************END  Dash or Landign Page *************/

  getAccounts() { return this.api.get<Array<Account>>(`API/Dashboard/getAccounts`); }


  getBrands() { return this.api.get<Array<Brands>>(`API/Dashboard/getBrands`); }


  getProducts(searchCriteria: string)    { return this.api.get<Array<Products>>(`API/Dashboard/getProducts/${searchCriteria}`); }


  GetMemberGateSummary(memberNumber: string) {
    return this.api.get<Array<MemberGateSummary>>(`API/Dashboard/GetMemberGateSummary/${memberNumber}`);
  }



  login(username: string, password: string): Observable<LoginResponse>
  {
    return this.api.post(`API/Auth/Login`, { username, password });
    //return this.api.post(`API/Product/exclusion/brand/add/${companyID}`, brandIDs);
  }



 
  QuickSearchProducts() { return this.api.get<Array<Products>>(`API/Dashboard/QuickSearchProducts`); }


  downloadCSV(): Observable<any> { return this.api.getJSON('API/Dashboard/getAccounts')}

  //region Exclusions
	getBrandExclusions(companyID: number) { 
		return this.api.get<Array<CompanyBrandExclusion>>(`API/Product/exclusion/brands/${companyID}`); 
	}

	getExclusionGroups() {
		return this.api.get<Array<ProductExclusionGroup>>(`API/Product/exclusion/groups`);
	}
	getExclusionGroupProducts(groupID: number) {
		return this.api.get<Array<ProductExclusionGroupProduct>>(`API/Product/exclusion/group/${groupID}`);
	}
	getCompanyGroupExclusions(companyID: number) {
		return this.api.get<Array<CompanyGroupExclusion>>(`API/Product/exclusion/groups/${companyID}`);
	}

	createExclusionGroup(groupName: string) {
		return this.api.post<ProductExclusionGroup>(`API/Product/exclusion/group`, groupName);
	}
	addProductToExclusionGroup(groupID: number, productCode: Array<string>) {
		return this.api.post(`API/Product/exclusion/group/${groupID}`, productCode);	
	}
	addExclustionGroupToCompany(companyID: number, groupIDs: Array<number>) {
		return this.api.post(`API/Product/exclusion/group/add/${companyID}`, groupIDs);
	}
	addBrandExclusionToCompany(companyID: number, brandIDs: Array<number>) {
		return this.api.post(`API/Product/exclusion/brand/add/${companyID}`, brandIDs );
	}

  //end region Exclusions

}


