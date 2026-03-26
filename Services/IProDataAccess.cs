using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ProInternal.Models.Accounting;
using ProInternal.Models.Dashboard;
using ProInternal.Models.Accounts;
using ProInternal.Models.Auth;
using ProInternal.Models.WH;
using ProInternal.Models.Vendor;
using ProInternal.Services;
using System;
using ProInternal.Models.Products;
using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using ProInternal.Models.Exclusions;
using Microsoft.AspNetCore.Mvc;
using ProInternal.Models.InvoiceRecord;
using ProInternal.Models.Patronage;
using ProInternal.Models.InstantRebates;
using ProInternal.Models;
using static ProInternal.Controllers.AuthController;
using Azure.Core;
using ProInternal.Models.Outstanding;
using ProInternal.Models.EditProduct;
using ProInternal.Models.Shared;

namespace ProInternal.Services
{
    public interface IProDataAccess
    {




        VendorDto? GetVendorById(int vendorId);
        VendorMatchDto? FindVendorByName(string name);
        VendorMatchDto? FindVendorByAddress(string rawText);

        MemberMatchDto? FindMemberByName(string name);
        MemberMatchDto? FindMemberByAddress(string rawText);



        void MarkCreditInvoiceFailed(int creditId, string invoiceNumber, string error);
        void UpsertAccountingFile(string fileId, string storedName, string originalName);

        void LinkFileToCredit(int creditId, Guid batchGuid, string fileId);

        IEnumerable<AccountingFile> GetFilesForBatch(Guid batchGuid);

        AccountingFile GetAccountingFile(string fileId);

        IEnumerable<AccountingFile> GetFilesForCredit(int creditId);

        MemberDto? GetMemberByAccount(string account);

        // --- Credits ---
        int InsertAccountingCredit(CreditRequestDto request);



        void MarkCreditSuccess(int creditId, string invoiceNumber);
        void MarkCreditFailed(int creditId, string error);



        IEnumerable<VendorInvoiceLearningDto> GetVendorInvoiceLearning(int vendorId);

        void TouchVendorInvoiceLearning(int id);

        void UpsertVendorInvoiceLearning(VendorInvoiceLearningDto dto);




        IEnumerable<VendorLookupDto> SearchVendors(string term);


        IEnumerable<AccountingCreditDto> GetVendorBillingHistory();
        // --- Accounting (GETs) ---
        IEnumerable<AccountingCreditDto> GetCredits();
        IEnumerable<AccountingCreditDto> GetVendorBilling();

        IEnumerable<MemberLookupDto> SearchMember(string term);
        IEnumerable<VendorLookupDto> SearchVendor(string term, string type);


       



        List<MapViolation> GetAllMapViolations();
        bool MarkProductComplete(int shippingErrorId, int productId, string updatedBy);
        IEnumerable<ProInternal.Models.WH.ShippingErrorRecord> GetShippingErrors();
        ProInternal.Models.WH.ShippingErrorRecord GetShippingErrorDetails(int id);
        void ProcessShippingError(int id, string type, string disposition);
        void ProcessGridShippingErrors(List<ProInternal.Models.WH.ShippingErrorRecord> errors);

        Task<string> ProcessShippingErrors(List<ShippingErrorRequest> errorList);
        List<string> GetPermissionsByRole(string roleName);

        List<string> GetUserExtraPermissions(int userId);
        void SaveUserExtraPermission(int userId, List<string> permissions);

        void ToggleVendorWebStatus(int vendorId);


        IEnumerable<PaymentType> GetPaymentTypes();

        void SavePaymentType(PaymentType payment);

        IEnumerable<Vendor> GetVendors();
        IEnumerable<Member> GetMembers(int memberTypeId);
        IEnumerable<Subscription> GetSubscriptions();

        void RemoveUserExtraPermission(int userId, string permission);
        IEnumerable<MemberAddress> GetMemberShipping(string accountId);

        void CreateRole(string roleName, string roleDescription);
        void RenameRole(string oldName, string newName);
        void DeleteRole(string roleName);

        Task<bool> SendInvoicesToMemberEmail(string accountNumber, string email);

        void UpdateVendorImage(int vendorId, string imageUrl);

        List<PermissionDto> GetAllPermissions();  
        List<UserWithRoles> GetUsersWithRoles();
        List<RoleDto> GetAllRoles();

        void UpdateMemberImage(string accountNumber, string imageUrl);
        void AssignRoleToUser(int userId, string roleName);
        void RemoveRoleFromUser(int userId, string roleName);

        List<UserWithRoles> GetUserRoles(int userId);
        void ReplaceUserRoles(int userId, List<string> roles);


        Task<IEnumerable<OutstandingAccount>> GetAccountsWithOutstanding();

        Task<IEnumerable<OutstandingInvoice>> GetInvoicesByAccount(string accountNumber);


        void EnableUser(int userId);
        void DisableUser(int userId);
        void DeleteUser(int userId);

        void AssignPermissionToRole(string roleName, List<string> permissionName);
        void RemovePermissionFromRole(string roleName, List<string> permissionName);
        List<string> GetUserPermissions(int userId);


        void CreatePermission(string permissionName, string description, string? routePath);
        void RenamePermission(string oldName, string newName , string Description);

        void DeletePermission(string permissionName);




        void MarkNotificationAsRead(int notificationId, int userId);
        void DeleteNotification(int notificationId, int userId);

        List<Notification> GetNotificationsForUser(int userId);
        List<CompanyDto> GetCompaniesAssignedToGroupAsync(int groupId);
        List<Products> GetUnassignedProductsAsync();
        List<QuarterlyRebate> GetQuarterRebateSummary();
        OrdersMetrics GetOrdersMetrics();
        EDIMetrics GetEDIMetrics();
        ShippingErrorMetrics getShippingErrorMetrics();
        CommecntsMetrics getCommentsrMetrics();
        List<SpecialOrdersSummary> getOrdersSnapshot();
        LoginResponse login(string username, string password);
        
        List<ProInternal.Models.Accounts.ShippingErrorRecord> getAccounts();

        List<Products> getProducts(string searchCriteria);

        List<MemberGateSummary> GetMemberGateSummary(string searchCriteria);
        
        List<Brands> getBrands();

        QuarterlyRebates saveData(QuarterlyRebates saveData);

        List<QuarterlyDataSummary> getCurrentQuarterlyData();

        List<QuarterlyDataHistorical> getHistoricalQRData();

        List<PatronageUpload> getPatronageBatchDetails(string batchID);


        bool deletePatronageLoad(string id);
        bool deleteQRUpload(int batchID);
        bool activate(int batchID);
        bool activatePatronageBatch(string batchID, bool active);
        List<qrDetail> getQRBatchDetail(int batchID);
        List<qrDetail> getQRBatchVendorDetail(string batchID);
        List<GatedProducts> getGatedRetailers();
        List<Products> QuickSearchProducts();
        int Exclusion_CreateGroup(string groupName);
		void Exclusion_AddProductsToGroup(int productExclusionGroupID, List<string> productCodes);
        void Exclusion_ExcludeCompanyGroups(int companyID, List<int> productExclusionGroupID);
        void Exclusions_ExcludeCompanyBrands(int companyID, List<int> brandID);
        List<CompanyBrandExclusion> Exclusions_GetCompanyBrandExclusions(int companyID);
        List<ProductExclusionGroup> Exclusions_GetExclusionGroups();
        List<ProductExclusionGroupProduct> Exclusions_GetExclusionGroupProducts(int productExclusionGroupID);
        List<CompanyGroupExclusion> Exclusions_GetCompanyGroupExclusions(int companyID);
        void AssignBrandsToMember([FromBody] GatingAssignment assignment);
        List<MapViolation> GetExistingViolations(MapViolation violation);
        List<string> GetUniqueCountries();
        List<Brands> GetExcludedBrandsByCountry(string country);
        void ApplyCountryBrandExclusion(CountryBrandRequest data);
        VendorUserResponse saveVendorUser(VendorUser user);        
        List<VendorStock> GetVendorStock();
        List<VendorSearch> getAllVendors();
        List<InvoiceRecord> GetInvoices();
        void savePatronageData(List<PatronageUpload> data);
        List<PatronageUpload>GetRecentPatronageLoad();
        List<PatronageHistorical> GetPatronageHistorical();


        string? GetPrimaryProductDescriptionByProCode(int proCode);


        //// Product edit
        //ProdDto? GetProductEnvelopeByCode(string productCode);
        //Result UpdateProductEnvelope(ProdDto dto);

        //ProductInfoLookupDto? LookupProductInfo(string code, string type, int parentId);
        //List<IQPromptDto> GetIQPrompts();

        //Result AddTag(int productId, string tag);
        //Result RemoveTag(int productId, string tag);

        //Result AddToGroup(string productCode, string groupCode, string? colorName, string? colorHex, string? size);
        //Result RemoveFromGroup(string productCode);

        //List<ProductAttributeDto> GetTechSpecs(string code);
        //Result SaveTechSpecs(string code, IEnumerable<ProductAttributeDto> attrs);

        //// Common
        //List<CategoryNodeDto> GetSubCategories(int parentCatId);


    }

}
