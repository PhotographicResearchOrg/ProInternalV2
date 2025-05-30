import { Injectable } from "@angular/core";
import { map } from "rxjs/operators";
import { ApiService } from "./api.service";
import { QuarterlyRebates, QuarterlyRebatesHistorical, qrDetail } from "../models/accounting/quarterly-rebates";
import { OrdersMetrics } from "../models/Dashboard/OrdersMetrics";
import { SARMetrics } from "../models/Dashboard/SARMetrics";
import { EDIMetrics } from "../models/Dashboard/EDIMetrics";
import { IRMetrics } from "../models/Dashboard/IRMetrics";
import { InstantRebate, RebateVendor } from "../models/Dashboard/InstantRebate";
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
import { ProductGating, GatingAssignment } from "../models/Dashboard/ProductGating";
import { MemberGateSummary } from "../models/Dashboard/MemberGateSummary";
import { CompanyBrandExclusion } from "../models/exclusions/brand-exclusions";
import { CompanyGroupExclusion, ProductExclusionGroup, ProductExclusionGroupProduct } from "../models/exclusions/group-exclusions";
import { LoginResponse } from '../models/LoginResponse'; // <- make sure path is correct
import { comments } from 'src/app/models/Dashboard/comments'
import { ApiResponse } from "src/app/models/ApiResponse";
import { MapViolationResponse } from 'src/app/models/Dashboard/MapViolationResponse';
import { MapViolation } from 'src/app/models/Dashboard/MapViolation';
import { CountryBrandRequest } from 'src/app/models/Dashboard/CountryBrandRequest';
import { VendorStock } from 'src/app/models/vendor/vendorstock';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { VendorUser } from 'src/app/models/vendor/vendoruser';
import { InvoiceRecord } from 'src/app/models/accounting/InvoiceRecord';
import { PatronageUpload, PatronageHistorical, patronageDetail } from "src/app/models/accounting/patronage";
import { ParentCompany } from "src/app/models/Dashboard/InstantRebate"
import { panaAccount, panaRep } from 'src/app/models/vendor/panasonicreporting';
import { EzPaySummary, EzPayDetail  } from 'src/app/models/accounting/EzPaySummary';

@Injectable()
export class DataService {

  constructor(private api: ApiService) { }






  getEzPaySummary(date: Date): Observable<EzPaySummary[]> {
    const formattedDate = date.toISOString().slice(0, 10); // 'YYYY-MM-DD'
    return this.api.get<EzPaySummary[]>(`API/Accounting/ezpay-summary?date=${formattedDate}`);
  }

  getEzPayDetail(date: Date): Observable<EzPayDetail[]> {
    const formattedDate = date.toISOString().slice(0, 10);
    return this.api.get<EzPayDetail[]>(`API/Accounting/ezpay-detail?date=${formattedDate}`);
  }


  getAllReps(): Observable<panaRep[]> {
    return this.api.get<panaRep[]>('API/Vendor/panareps');
  }


  getAllAccounts(): Observable<panaAccount[]> {
    return this.api.get<panaAccount[]>('API/Vendor/panaaccounts');
  }


  saveRep(rep: panaRep): Observable<panaRep> {

    return this.api.post<panaRep>('API/Vendor/savepanarep', rep);
  }
  saveAccount(account: panaAccount): Observable<panaAccount> {
    return this.api.post<panaAccount>('API/Vendor/savepanaaccount', account);
  }


  // Delete a rep by ID
  deleteRep(repId: number): Observable<void> {
    return this.api.delete<void>(`API/Vendor/deletepanarep/${repId}`);
  }

  // Delete an account by MECA number
  deleteAccount(meca: string): Observable<void> {

    return this.api.delete<void>(`API/Vendor/deletepanaaccount/${meca}`);
  }


  deleteIRFile(orderId: number, filename: string): Observable<void> {
    const encodedFile = encodeURIComponent(filename); // handle special characters
    return this.api.delete<void>(`API/InstantRebates/DeleteIRFile/${orderId}/${encodedFile}`);
  }

  uploadRebateFile(formData: FormData): Observable<void> {
    return this.api.postBlob('API/InstantRebates/UploadIRFile', formData);
  }


  getAllParentCompanies(): Observable<ParentCompany[]> {
    return this.api.get<ParentCompany[]>(`API/InstantRebates/getAllParentCompanies`);
  }

  addParentCompany(company: ParentCompany): Observable<any> {
    return this.api.post(`API/InstantRebates/addParentCompany`, company);
  }

  updateParentCompany(company: ParentCompany): Observable<any> {


    return this.api.put(`API/InstantRebates/updateParentCompany/${company.id}`, company);
  }

  deleteParentCompany(id: number): Observable<any> {
    return this.api.delete(`API/InstantRebates/deleteParentCompany/${id}`);
  }


  uploadParentImage(fileData: FormData): Observable<string> {
    return this.api.postFormData<string>('API/InstantRebates/uploadParentImage', fileData);
  }



  getAllRebateVendors(): Observable<RebateVendor[]> {
    return this.api.get<RebateVendor[]>('API/InstantRebates/getAllRebateVendors');
  }




  addRebateVendor(vendor: RebateVendor): Observable<RebateVendor> {
    return this.api.post<RebateVendor>('API/InstantRebates/addRebateVendor', vendor);
  }

  updateRebateVendor(vendor: RebateVendor): Observable<any> {
    return this.api.put(`API/InstantRebates/updateRebateVendor/${vendor.id}`, vendor);
  }

  deleteRebateVendor(id: number): Observable<any> {
    return this.api.delete(`API/InstantRebates/deleteRebateVendor/${id}`);
  }





  getRecentPatronageLoad(): Observable<PatronageUpload[]> {
    return this.api.get<PatronageUpload[]>('API/Accounting/GetRecentPatronageLoad');
  }

  getPatronageHistorical(): Observable<PatronageHistorical[]> {
    return this.api.get<PatronageHistorical[]>('API/Accounting/GetPatronageHistorical');
  }



  activatePatronage(payload: { batchID: string, active: boolean }): Observable<any> {
    console.log(payload)
    return this.api.put('API/Accounting/ActivatePatronageBatch', payload);
  }


  getPatronageBatchDetails(id: string): Observable<patronageDetail[]> {
    return this.api.get<patronageDetail[]>(`API/Accounting/getPatronageBatchDetails/${id}`);
  }


  deletePatronageUpload(id: string): Observable<any> {
    return this.api.put('API/Accounting/DeletePatronageLoad', { id });
  }


  // data.service.ts
  submitMapViolation(violation: MapViolation): Observable<MapViolation[]> {
    return this.api.post<MapViolation[]>(`API/Product/submitMapViolation`, violation);
  }
  getCountryExcludedBrands(country: string): Observable<Brands[]> {
    return this.api.get<Brands[]>(`API/Product/getCountryExcludedBrands?country=${encodeURIComponent(country)}`);
  }
  getUniqueCountries(): Observable<string[]> {
    return this.api.get<string[]>(`API/Product/getUniqueCountries`);
  }
  getComments(): Observable<comments[]> {
    return this.api.get<comments[]>('API/comments/monitor');
  }
  assignBrandsToMember(payload: GatingAssignment) {
    return this.api.post<ApiResponse>('API/Product/assignbrands', payload);
  }
  applyCountryBrandExclusion(payload: CountryBrandRequest): Observable<any> {
    return this.api.post<any>('API/Product/apply-country-exclusion', payload);
  }

  getForecastInvoices(): Observable<InvoiceRecord[]> {
    return this.api.get<InvoiceRecord[]>('api/Accounting/forecast');
  }

  getVendorStock() {
    console.log('Initiating getVendorStock call');
    return this.api.get<Array<VendorStock>>(`API/Vendor/vendorstock`).pipe(
      tap((data) => {
        console.log('Data received from API:', data);
      }),
      catchError((error) => {
        console.error('Error occurred while fetching vendor stock:', error);
        return throwError(() => error);
      })
    );
  }

  getGatedRetailers() {
    return this.api.get<Array<ProductGating>>('API/Product/getGatedRetailers');
  }

  getQuarterySummary()
  {
    return this.api.get<Array<QuarterlyRebates>>('API/Accounting/CurrentQuarterLiability');
  }


  getEmbedConfig() {
    return this.api.get<{ token: string; embedUrl: string; reportId: string }>('API/PowerBI/token');
  }

  uploadQuarterlyFile(file: File) {
    const formData: any = new FormData();
    formData.append(`file`, file, file.name);
    return this.api.postBlob(`API/Accounting/LoadQuarterFile`, formData)
  }


  getUnassignedProducts() { return this.api.get<Array<Products>>(`API/Product/unassigned`); }


  getCompaniesForGroup(groupId: number): Observable<{ companyId: number; companyName: string }[]> {
    return this.api.get<{ companyId: number; companyName: string }[]>(`API/Product/exclusiongroups/${groupId}/companies`);
  }



  uploadPatronageFile(file: File) {

    const formData: any = new FormData();
    formData.append(`file`, file, file.name);
    return this.api.postBlob(`API/Accounting/LoadPatronageFile`, formData)
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

  getDeclinedRebateOrder(orderId: number): Observable<DeclinedIR> {
    return this.api.get<DeclinedIR>(`API/InstantRebates/GetDeclinedRebateOrder?orderId=${orderId}`);
  }

  resubmitRebateOrder(orderId: number) {
    return this.api.post(`API/InstantRebates/resubmit`, { orderId });
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

  getAllVendors() {
    return this.api.get<Array<{ id: number; name: string }>>("API/Vendor/getAllVendors");
  }

  saveVendor(vendorUser: VendorUser): Observable<any> {
    return this.api.post('API/Vendor/saveVendorUser', vendorUser);
  }

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



  getHubspotCompanies(): Observable<{ results: any[] }> {
    return this.api.get<{ results: any[] }>('api/hubspot/companies');
  }

  getHubspotOwners(): Observable<{ results: any[] }> {
    return this.api.get<{ results: any[] }>('api/hubspot/owners');
  }

  updateHubspotCompanyOwner(companyId: string, ownerId: string): Observable<any> {
    return this.api.patch<any>(`api/hubspot/companies/${companyId}`, {
      properties: { hubspot_owner_id: ownerId }
    });
  }

  deleteHubspotCompany(companyId: string): Observable<any> {
    return this.api.delete(`API/hubspot/companies/${companyId}`);
  }



}


