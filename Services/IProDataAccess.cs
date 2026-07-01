using Azure.Core;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using ProInternal.Models;
using ProInternal.Models.Accounting;
using ProInternal.Models.Accounts;
using ProInternal.Models.Auth;
using ProInternal.Models.Dashboard;
using ProInternal.Models.EditProduct;
using ProInternal.Models.Exclusions;
using ProInternal.Models.InstantRebates;
using ProInternal.Models.InvoiceRecord;
using ProInternal.Models.Outstanding;
using ProInternal.Models.Patronage;
using ProInternal.Models.Products;
using ProInternal.Models.Shared;
using ProInternal.Models.Marketing;
using ProInternal.Models.Vendor;
using ProInternal.Models.WH;
using ProInternal.Services;
using System;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using static ProInternal.Controllers.AuthController;

namespace ProInternal.Services
{
    public interface IProDataAccess
    {



        List<SellThroughExportDto>
GetSellThroughExportData(
    List<string> weeks,
    List<int> accounts
);


        void InsertSellThroughRequestAudit(
    int vendorId,
    int account,
    DateTime weekEnding,
    string contactEmail,
    string requestedBy
);



        List<SellThroughSubmissionAuditDto> GetSellThroughSubmissionHistory(int account);

        void InsertSellThroughSubmissionAudit(
    int vendorId,
    int account,
    DateTime weekEnding,
    string fileName,
    string sentToBRMEmail,
    string sentBy,
    string comments
);

        bool ProductReceived(int shippingErrorId, string productCode);

        List<SellThroughRequestAuditDto>
        GetSellThroughRequestHistory(int account);

        IEnumerable<SellThroughComplianceDto> GetSellThroughCompliance();

        void ResolveGovernanceIssue(int id);

        IEnumerable<ShopifyGovernanceIssueDto> GetShopifyGovernanceIssues();
        void ShopifyTaxonomyReview( int id, string disposition);
        decimal GetDropShipThreshold();
        void SetDropShipThreshold(decimal value);

        VendorDto? GetVendorById(int vendorId);
        VendorMatchDto? FindVendorByName(string name);
        VendorMatchDto? FindVendorByAddress(string rawText);

        MemberMatchDto? FindMemberByName(string name);
        MemberMatchDto? FindMemberByAddress(string rawText);


        Task SendBackToWarehouse(int errorI, string productCode, string reason, string username);
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

        QuarterlyRebates saveData(QuarterlyRebates data, DateTime issueDate);


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
        public void savePatronageData(List<PatronageUpload> data, DateTime issueDate);
        List<PatronageUpload>GetRecentPatronageLoad();
        List<PatronageHistorical> GetPatronageHistorical();


        string? GetPrimaryProductDescriptionByProCode(int proCode);

        IEnumerable<ShopifyTaxonomyAuditDto> GetShopifyTaxonomyAudit();

    }

}
