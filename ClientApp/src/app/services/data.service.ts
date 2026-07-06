import { Injectable } from "@angular/core";
import { map } from "rxjs/operators";
import { switchMap } from 'rxjs';
import { ApiService } from "./api.service";
import { QuarterlyRebates, QuarterlyRebatesHistorical, qrDetail, PaymentType } from "../models/accounting/quarterly-rebates";
import { OrdersMetrics } from "../models/Dashboard/OrdersMetrics";
import { SARMetrics } from "../models/Dashboard/SARMetrics";
import { EDIMetrics } from "../models/Dashboard/EDIMetrics";
import { IRMetrics } from "../models/Dashboard/IRMetrics";
import { InstantRebate, RebateVendor } from "../models/Dashboard/InstantRebate";
import { ShippingErrorMetrics } from "../models/Dashboard/ShippingErrorMetrics";
import { Account, Brands } from "../models/Dashboard/Account";
import { Products } from "../models/Dashboard/Products";
import { SpecialOrdersSummary } from "../models/Dashboard/SpecialOrdersSummary";
import { RebateIRRowDto, CommitResult, CommitRequest } from "../models/IR/IRLoad";
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
import { ParentCompany, IRBatchExport } from "src/app/models/Dashboard/InstantRebate"
import { panaAccount, panaRep } from 'src/app/models/vendor/panasonicreporting';
import { EzPaySummary, EzPayDetail  } from 'src/app/models/accounting/EzPaySummary';
import { Notification } from 'src/app/models/notifications';
import { ProUser } from 'src/app/models/pro-user';
import { OutstandingAccount, OutstandingInvoice } from 'src/app/models/accounting/Outstanding'; 
import { Vendor } from '../models/accounts/vendor';
import { Member, MemberAddress  } from '../models/accounts/member';
import { SubscriptionRecord } from '../models/accounts/subscription';
import { SendInvoicesRequest } from 'src/app/models/accounting/SendInvoicesRequest';
import { ShippingErrorRecord, ShippingErrorProduct, PackingSlipData, ProcessShippingErrorResponse } from 'src/app/models/WH/ShippingErrorRecord';
import { BatchRunResponse, PoSyncResult } from 'src/app/models/Uvicorn/PassThroughInvoice';
import { Prod, Result, ProductInfoType, ProductInfoLookup, IQPrompt, CategoryNode } from 'src/app/models/Product/EditProduct'; 
import { SellThroughCompliance } from 'src/app/models/vendor/SellThroughCompliance';

@Injectable()
export class DataService {

  constructor(private api: ApiService, private http: HttpClient) { }


  emailSellThroughExport(
    request: any
  ) {
    return this.api.post<any>(
      'API/Vendor/sellthrough/export-email',
      request
    );
  }


  exportSellThrough(request: any) {
    return this.api.post<any>(
      'API/Vendor/sellthrough/export',
      request
    );
  }


  getSellThroughRequestHistory(account: number) {
    return this.api.get<any[]>(
      `API/Vendor/sellthrough/request-history/${account}`
    );
  }


  sendSellThroughRequest(request: any) {
    return this.api.post<any>(
      'API/Vendor/sellthrough/request',
      request
    );
  }


  getSellThroughSubmissionHistory(account: number) {
    return this.api.get<any[]>(
      `API/Vendor/sellthrough/history/${account}`
    );
  }



  getSellThroughCompliance() {
    return this.api.get<SellThroughCompliance[]>(
      'API/Vendor/sellthrough'
    );
  }


  sendSellThroughFile(formData: FormData) {
    return this.api.postMultipartJson<any>(
      'API/Vendor/sellthrough/send',
      formData
    );
  }


  getShopifyTaxonomyAudit() {
    return this.api.get<any[]>(
      'api/Marketing/shopify-taxonomy-audit'
    );
  }

  shopifyTaxonomyReview(
    id: number,
    disposition: string
  ) {
    return this.api.post(
      'api/marketing/shopify-taxonomy-review',
      {
        id,
        disposition
      }
    );
  }


  resolveGovernanceIssue(
    id: number
  ) {

    return this.api.post(
      'api/marketing/shopify-governance-resolve',
      id
    );
  }


  getShopifyGovernance() {
    return this.api.get<any[]>(
      'api/marketing/shopify-governance'
    );
  }


  uploadIRFile(file: File, expireDate: Date) {
    const fd = new FormData();
    fd.append('file', file, file.name);                    // MUST be 'file'
    fd.append('expireDate', expireDate.toISOString().slice(0, 10)); // yyyy-MM-dd

    return this.api.postMultipartJson<RebateIRRowDto[]>('api/RebateIr/upload', fd);
  }


  updateProposedModelName(previewId: number, proposed: string) {
    return this.api.patch<void>(`api/RebateIr/preview/${previewId}/proposed`, {
      proposedModelName: proposed
    });
  }


  commitIR(payload: CommitRequest) {
    return this.api.post<CommitResult>('api/RebateIr/commit', payload);
  }


  getAllMapViolations(): Observable<MapViolation[]> {
    return this.api.get<MapViolation[]>('API/Product/mapviolations');
  }

  private readonly productBase = 'API/Product';
  // Product edit
  getProductByCode(code: string): Observable<Result<Prod>> {
    return this.api.get<Result<Prod>>(`${this.productBase}/${encodeURIComponent(code)}`);
  }
  updateProduct(p: Prod): Observable<Result> {
    return this.api.put<Result>(`${this.productBase}/${p.productId}`, p);
  }
  lookupProductInfo(code: string, type: ProductInfoType, parentProductId: number): Observable<Result<ProductInfoLookup>> {
    return this.api.get<Result<ProductInfoLookup>>(
      `${this.productBase}/lookup/${encodeURIComponent(code)}?type=${encodeURIComponent(type)}&parentId=${parentProductId}`
    );
  }
  getIQPrompts(): Observable<IQPrompt[]> {
    return this.api.get<IQPrompt[]>(`${this.productBase}/iqprompts`);
  }
  getSubCategories(parentCatId: number): Observable<CategoryNode[]> {
    return this.api.get<CategoryNode[]>(`API/Common/categories/${parentCatId}`);
  }
  addTag(productId: number, tag: string) {
    return this.api.post<Result>(`${this.productBase}/tags/add`, { productId, tag });
  }
  removeTag(productId: number, tag: string) {
    return this.api.post<Result>(`${this.productBase}/tags/remove`, { productId, tag });
  }
  addToGroup(payload: { productCode: string; groupCode: string; colorName?: string; colorHex?: string; size?: string; }) {
    return this.api.post<Result>(`${this.productBase}/group/add`, payload);
  }
  removeFromGroup(productCode: string) {
    return this.api.post<Result>(`${this.productBase}/group/remove`, { productCode });
  }
  getTechSpecs(code: string) {
    return this.api.get<Result<{ attributes: any[] }>>(`${this.productBase}/techspecs/${encodeURIComponent(code)}`);
  }
  saveTechSpecs(code: string, attributes: any[]) {
    return this.api.post<Result>(`${this.productBase}/techspecs/${encodeURIComponent(code)}`, { attributes });
  }
  //--------------------------------------------------------------------------------------------------------------------------------------
  //--------------------------------------------------------------------------------------------------------------------------------------
  //--------------------------------------------------------------------------------------------------------------------------------------
  //--------------------------------------------------------------------------------------------------------------------------------------



  getShopifySync(): Observable<any> {
    return this.api.get<any>('api/uvicorn/shopify-sync');
  }

  getShopifyNewProducts(): Observable<any> {
    return this.api.get<any>('api/uvicorn/shopify-newproducts');
  }




  getManualSync(emails?: string): Observable<any> {
    if (emails?.trim()) {
      const encoded = encodeURIComponent(emails);
      return this.api.get<any>(`api/uvicorn/manuals?emails=${encoded}`);
    } else {
      return this.api.get<any>('api/uvicorn/manuals');
    }
  }

  saveWHSubscription(model: any) {
    return this.api.post('api/warehouse/subscriptions', model);
  }

  retireShipment(tracking: string) {
    return this.api.post(`api/warehouse/shipments/${tracking}/retire`, {});
  }


  getWHSubscriptions(userId: number) {
    return this.api.get<any[]>(`api/warehouse/subscriptions?userId=${userId}`);
  }


  getPoSync() {
    // Route is case-insensitive; keep consistent with your others.
    return this.api.get<PoSyncResult>('api/uvicorn/po-sync');
  }

  getInvoiceBatch(): Observable<BatchRunResponse> {
    return this.api.get<BatchRunResponse>('api/Uvicorn/process-batch');
  }

  getInvoiceProcess(invoiceNumber: string) {
    return this.api.get<BatchRunResponse>(
      `api/uvicorn/process?invoice_number=${encodeURIComponent(invoiceNumber)}`
    );
  }

  getShippingErrors(): Observable<ShippingErrorRecord[]>
  {
    return this.api.get<ShippingErrorRecord[]>('API/Warehouse/shippingerrors');
  }


  sendBackToWarehouse(payload: {
    errorId: number;
    productCode: string;
    reason: string;
    username: string;
  }) {
    return this.api.post<any>(
      'API/Warehouse/sendback',
      payload
    );
  }



  getShipments(): Observable<any[]> {
    return this.api.get<any[]>('API/Warehouse/shipments');
  }

  getShipmentEvents(tracking: string): Observable<any[]> {
    return this.api.get<any[]>(`API/Warehouse/shipments/${tracking}/events`);
  }



  getPaymentTypes(): Observable<PaymentType[]> {
    return this.api.get<PaymentType[]>('API/Accounting/getPaymentTypes');
  }

  savePaymentType(payment: PaymentType): Observable<void> {
    return this.api.post<void>('API/Accounting/savePaymentType', payment);
  }
  getShippingErrorDetails(errorId: number): Observable<ShippingErrorRecord> {
    return this.api.get<ShippingErrorRecord>(`API/Warehouse/shippingerrorsdetails/${errorId}`);
  }
  markProductComplete(shippingErrorId: number, productId: number, userName: string): Observable<any> {
    const url = `API/Warehouse/completeProduct`;
    const payload = {
      shippingErrorId: Number(shippingErrorId), 
      productId: Number(productId),        
      userName
    };
    return this.api.post<any>(url, payload);
  }
  // processShippingErrors
  processShippingErrors(errorList: any[]): Observable<void> {
    console.log(errorList);
    return this.api.post<void>(`API/Warehouse/processShippingErrors`, errorList);
  }
  getPackingSlip(shippingErrorId: number): Observable<PackingSlipData> {
    return this.api.get<PackingSlipData>(`API/Warehouse/packingslip/${shippingErrorId}`);
  }
  processShippingError(errorId: number, type: string, disposition?: string): Observable<any> {
    return this.api.post<any>(`api/warehouse/${errorId}/process`, { type, disposition });
  }
  updateShippingErrors(errors: ShippingErrorRecord[]): Observable<any> {
    return this.api.post<any>('API/Warehouse/shippingerrors/process-grid', errors);
  }
  resolveProduct(product: any): Observable<void> {
    return this.api.post<void>(`/api/shipping-errors/resolve`, product);
  }
  ignoreProduct(product: any): Observable<void> {
    return this.api.post<void>(`/api/shipping-errors/ignore`, product);
  }
  // Vendors
  getVendors(): Observable<Vendor[]> {
    return this.api.get<Vendor[]>('API/Listings/vendors');
  }
  toggleVendorWebStatus(vendorId: number): Observable<void> {
    return this.api.post<void>(`API/Listings/vendors/${vendorId}/toggle-web`, {});
  }
  // Members (Members, Affiliates, Clients)
  getMembers(type: 'Members' | 'Affiliates' | 'Clients' = 'Members'): Observable<Member[]> {
    return this.api.get<Member[]>(`API/Listings/members?type=${type}`);
  }
  // Subscriptions
  getSubscriptions(): Observable<SubscriptionRecord[]> {
    return this.api.get<SubscriptionRecord[]>('API/Listings/subscriptions');
  }
  getMemberShipping(accountNumber: string): Observable<MemberAddress[]> {
    return this.api.get<MemberAddress[]>(`API/Listings/members/${accountNumber}/shipping`);
  }
  uploadMemberImage(accountNumber: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('image', file);
    return this.api.postBlob(`API/Listings/members/${accountNumber}/upload-image`, formData);
  }
  uploadVendorImage(vendorId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('image', file);
    return this.api.postBlob(`API/Listings/vendors/${vendorId}/upload-image`, formData);
  }
  //  Load users with their roles for admin UI
  getUsers(): Observable<ProUser[]> {
    return this.api.get<ProUser[]>('API/Auth/users');
  }
  //  Get all available roles (as strings)
  getAllRoles(): Observable<{ roleName: string; roleDescription: string }[]> {
    return this.api.get<{ roleName: string; roleDescription: string }[]>('API/Auth/roles');
  }
  getAllPermissions(): Observable<{ permissionName: string; description: string; routePath: string }[]> {
    return this.api.get<{ permissionName: string; description: string, routePath: string }[]>('API/Auth/permissions');
  }
  createPermission(name: string, description: string, routePath?: string): Observable<void> {
    return this.api.post<void>('API/Auth/permissionscreate', {
      PermissionName: name,
      Description: description,
      RoutePath: routePath
    });
  }


  updatePermission(oldName: string, newName: string, description: string): Observable<void> {
    return this.api.post<void>('API/Auth/permissionsrename', {
      oldName,
      newName,
      description
    });
  }

  deletePermission(permissionName: string): Observable<void> {
    return this.api.post<void>('API/Auth/permissionsdelete', { permissionName });
  }



  // Assign selected roles to a user
  // This is used
  assignRoles(userId: number, roles: string[]): Observable<void> {
    return this.api.post<void>('API/Auth/assign-role', { userId, roles });
  }
  // GET user roles by userId
  getUserRoles(userId: number): Observable<string[]> {
    return this.api.get<string[]>(`API/Auth/user-roles/${userId}`);
  }
  // GET user permissions by userId
  getUserPermissions(userId: number): Observable<string[]> {
    return this.api.get<string[]>(`API/Auth/user-permissions/${userId}`);
  }




  // POST assign a single role to a user
  assignRole(userId: number, roleName: string): Observable<void> {
    return this.api.post<void>('API/Auth/assign-role', { userId, roleName });
  }

  // POST remove a single role from a user
  removeRole(userId: number, roleName: string): Observable<void> {
    return this.api.post<void>('API/Auth/remove-role', { userId, roleName });
  }


  getExtraPermissions(userId: number): Observable<string[]> {
    return this.api.get<string[]>(`/api/user/${userId}/extra-permissions`);
  }


  //addExtraPermission(userId: number, permission: string): Observable<void> {
  //  return this.api.postWithAuth<void>(`/api/user/${userId}/extra-permissions`, permission);
  //}

  removeExtraPermission(userId: number, permission: string): Observable<void> {
    return this.api.delete<void>(`/api/user/${userId}/extra-permissions/${permission}`);
  }

  assignExtraPermissions(userId: number, permissions: string[]): Observable<void> {
    return this.api.postWithAuth<void>(`API/Auth/extra-permissions`, {
      userId,
      permissions
    });
  }


  enableUser(userId: number): Observable<void> {
    return this.api.post<void>(`API/Auth/user/${userId}/enable`, {});
  }

  disableUser(userId: number): Observable<void> {
    return this.api.post<void>(`API/Auth/user/${userId}/disable`, {});
  }


  deleteUser(userId: number): Observable<void> {
    return this.api.post<void>(`API/Auth/user/${userId}/delete`, {});
  }



  getPermissionsByRole(roleName: string): Observable<string[]> {
    return this.api.get<string[]>(`API/Auth/role-permissions/${roleName}`);
  }

  assignPermissionsToRole(role: string, permissions: (string | { permissionName: string })[]): Observable<void> {
    const cleanPermissions = permissions.map(p => typeof p === 'string' ? p : p.permissionName);
    return this.api.post<void>('API/Auth/assign-permission', { role, permission: cleanPermissions });
  }

  removePermissionsFromRole(role: string, permission: string[]): Observable<void> {
    return this.api.post<void>('API/Auth/remove-permission', { role, permission });
  }



  // Create a new role
  createRole(roleName: string, roleDescription: string): Observable<void> {
    return this.api.post<void>('API/Auth/create-role', {
      roleName,
      roleDescription
    });
  }
  // Rename a role
  renameRole(oldName: string, newName: string): Observable<void> {
    return this.api.post<void>('API/Auth/rename-role', { oldName, newName });
  }
  // Delete a role
  deleteRole(roleName: string): Observable<void> {
    return this.api.post<void>('API/Auth/delete-role', roleName);
  }



  getAccountsWithOutstanding(): Observable<OutstandingAccount[]> {
    return this.api.get<OutstandingAccount[]>(`API/Accounting/accounts`);
  }

  getInvoicesByAccount(accountNumber: string): Observable<OutstandingInvoice[]> {
    return this.api.get<OutstandingInvoice[]>(`API/Accounting/accounts/${accountNumber}/invoices`);
  }







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


  sendAllInvoicesToMemberEmail(data: SendInvoicesRequest): Observable<any> {
    const body = {
      AccountNumber: data.AccountNumber.toString(),  // ensure string
      Email: data.Email.toString()
    };
    return this.api.post('API/Accounting/send-invoices', body);

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
  
    return this.api.get<Array<VendorStock>>(`API/Vendor/vendorstock`).pipe(
      tap((data) => {

      }),
      catchError((error) => {

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

  uploadQuarterlyFile(file: File, issueDate: Date) {

    const formData: any = new FormData();
    formData.append('file', file, file.name);
    formData.append('issueDate', issueDate?.toISOString());

    return this.api.postBlob(`API/Accounting/LoadQuarterFile`, formData);
  }


  getUnassignedProducts() { return this.api.get<Array<Products>>(`API/Product/unassigned`); }


  getCompaniesForGroup(groupId: number): Observable<{ companyId: number; companyName: string }[]> {
    return this.api.get<{ companyId: number; companyName: string }[]>(`API/Product/exclusiongroups/${groupId}/companies`);
  }



  uploadPatronageFile(file: File, issueDate: Date) {

    const formData: any = new FormData();
    formData.append('file', file, file.name);
    formData.append('issueDate', issueDate?.toISOString());

    return this.api.postBlob(`API/Accounting/LoadPatronageFile`, formData);
  }



  
  GetInstantRebateBatches() {
    return this.api.get<Array<InstantRebate>>('API/InstantRebates/GetInstantRebateBatches');
  }

  activateIRBatch(batchId: number) {
      return this.api.put(`API/InstantRebates/activateIRBatch/${batchId}`, {});
    }


  pullIRBatchDetail(batchId: number) {
    return this.api.get<IRBatchExport>(`API/InstantRebates/getIRBatchDetail/${batchId}`);
  }


  GetDeclinedInstantRebates() {
    return this.api.get<Array<DeclinedIR>>('API/InstantRebates/GetDeclinedInstantRebates');
  }

  getDeclinedRebateOrder(orderId: number): Observable<DeclinedIR> {
    return this.api.get<DeclinedIR>(`API/InstantRebates/GetDeclinedRebateOrder?orderId=${orderId}`);
  }

  resubmitRebateOrder(orderId: number) {
    return this.api.post('API/InstantRebates/resubmit', orderId);
  }

  confirmDecline(orderId: number): Observable<void> {
    //return this.api.postWithAuth<void>('API/InstantRebates/ConfirmDecline', { orderId });
    return this.api.postWithAuth<void>('API/InstantRebates/ConfirmDecline', orderId);
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

    return this.api.get<Array<qrDetail>>(`API/Accounting/getQRBatchDetail/${batchId}`);
  }

  pullQRBatchVendorDetail(batchId: string) {

    return this.api.get<Array<qrDetail>>(`API/Accounting/getQRBatchVendorDetail/${batchId}`);
  }


  /************* Mertics for Dash *************/


  getDropShipThreshold() {
    return this.api.get<number>('API/Metrics/getDropShipThreshold');
  }

  setDropShipThreshold(value: number) {
    return this.api.post('API/Metrics/setDropShipThreshold', { value });
  }


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

  login(username: string, password: string): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('API/Auth/Login', { username, password });
  }

  getNotifications(): Observable<Notification[]> {
    return this.api.getWithAuth<Notification[]>('API/Notifications/notifications');
  }

  markNotificationAsRead(id: number): Observable<void> {
    return this.api.postWithAuth<void>(`API/Notifications/mark-read/${id}`, {});
  }


  deleteNotification(id: number): Observable<void> {
    return this.api.deleteWithAuth<void>(`API/Notifications/delete/${id}`);
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


