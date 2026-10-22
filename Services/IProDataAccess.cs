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
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using static ProInternal.Controllers.AuthController;
using MemberDesk = ProInternal.Models.Member;
using CategoryDesk = ProInternal.Models.CategoryDesk;
using AiModels = ProInternal.Models.Ai;

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
        void ShopifyTaxonomyReview(int id, string disposition);
        decimal GetDropShipThreshold();
        void SetDropShipThreshold(
            decimal value,
            string actionBy,
            string actionSource
        );


        CreditRegenRow? GetCreditForRegeneration(int creditId);
        void MarkInvoiceRegen(int creditId, bool success, string? error);

        VendorDto? GetVendorById(int vendorId);
        VendorMatchDto? FindVendorByName(string name);
        VendorMatchDto? FindVendorByAddress(string rawText);

        // Vendor card
        VendorCardDto? GetVendorCard(int vendorId);
        void ToggleVendorActive(int vendorId, AuditActor actor);
        int CreateVendor(CreateVendorDto vendor, AuditActor actor);

        VendorTermsDto? GetVendorTerms(int vendorId);
        void UpsertVendorTerms(VendorTermsDto terms, AuditActor actor);

        int AddVendorBrand(VendorBrandDto brand, AuditActor actor);

        int AddVendorContactGroup(VendorContactGroupDto group, AuditActor actor);
        List<VendorContactGroupDto> GetVendorContacts(int vendorId);
        int AddVendorContact(VendorContactDto contact, AuditActor actor);
        void UpdateVendorContact(VendorContactDto contact, AuditActor actor);
        void DeleteVendorContact(int vendorContactId);

        List<VendorContractDto> GetVendorContracts(int vendorId);
        int AddVendorContract(VendorContractDto contract, AuditActor actor);
        void UpdateVendorContract(VendorContractDto contract, AuditActor actor);

        List<VendorPriceListDto> GetVendorPriceLists(int vendorId);
        int AddVendorPriceList(VendorPriceListDto priceList, AuditActor actor);

        VendorPoliciesDto GetVendorPolicies(int vendorId);
        void UpsertVendorFreightPolicy(VendorFreightPolicyDto policy, AuditActor actor);
        void UpsertVendorShippingPolicy(VendorShippingPolicyDto policy, AuditActor actor);
        void UpsertVendorReturnPolicy(VendorReturnPolicyDto policy, AuditActor actor);

        List<VendorCustomFieldDefinitionDto> GetVendorCustomFieldDefinitions();
        int AddVendorCustomFieldDefinition(VendorCustomFieldDefinitionDto definition, string createdBy);
        int UpdateVendorCustomFieldDefinition(VendorCustomFieldDefinitionDto definition);
        void DeleteVendorCustomFieldDefinition(int definitionId);
        List<VendorCustomFieldDto> GetVendorCustomFields(int vendorId);
        void SaveVendorCustomFieldValue(int vendorId, int definitionId, string? value, AuditActor actor);

        // For vendor changes that don't go through a proc (e.g. file uploads)
        void LogVendorChange(int vendorId, string section, string fieldName, string? oldValue, string? newValue, AuditActor actor);

        List<VendorAuditLogEntryDto> GetEntityAuditLog(string entityType, int entityId, int take = 20);

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
        void RenamePermission(string oldName, string newName, string Description);

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
        List<PatronageUpload> GetRecentPatronageLoad();
        List<PatronageHistorical> GetPatronageHistorical();


        string? GetPrimaryProductDescriptionByProCode(int proCode);

        IEnumerable<ShopifyTaxonomyAuditDto> GetShopifyTaxonomyAudit();

        ProductSearchPage SearchProducts(ProductSearchQuery query);

        #region Member Desk
        // Member Desk models live in ProInternal.Models.Member. The alias keeps them from
        // colliding with existing models that share a name.

        List<MemberDesk.MemberListItem> Member_Search(string term);
        MemberDesk.MemberDetail Member_Get(string accountNumber, bool sqlIsMaster);
        void Member_Save(string accountNumber, MemberDesk.MemberSaveRequest member, bool sqlIsMaster, string user);
        List<MemberDesk.AccessRule> AccessRule_List();
        int AccessRule_Save(MemberDesk.AccessRule rule, string user);
        List<MemberDesk.AccessRuleMember> AccessRule_Members(string code);
        void MemberAuthorization_Grant(string accountNumber, MemberDesk.GrantRequest grant, string user);
        void MemberAuthorization_Revoke(int memberAuthorizationId, string user);
        int MemberDocument_Add(string accountNumber, string documentType, string title, string fileName,
                               string storageKey, string contentType, long sizeBytes, DateTime? expiresOn, string user);
        MemberDesk.MemberDocumentFile MemberDocument_Get(int documentId);
        void MemberDocument_Review(int documentId, MemberDesk.DocumentReviewRequest review, string user);
        void MemberDocument_Delete(int documentId, string user);
        void MapViolation_Add(string accountNumber, MemberDesk.MapViolationRequest violation, string user);
        void MapViolation_End(int violationId, MemberDesk.MapViolationEndRequest end, string user);
        List<MemberDesk.BrandOption> Brand_List();
        void MemberBrand_Allow(string accountNumber, int brandId, string reason, string user);
        void MemberBrand_Block(string accountNumber, int brandId, string reason, string user);
        List<Dictionary<string, object>> Member_Export(bool sqlIsMaster);
        List<Dictionary<string, object>> AccessRule_ExportMembers();
        List<MemberDesk.ProductLookupItem> Product_Lookup(string term);
        #endregion

        #region Category Desk
        // piv2.CategoryDesk_* procedures. Business rules refused by Publish come back as SqlException 50480-50499.
        CategoryDesk.CategoryTree CategoryDesk_Tree(bool sqlIsMaster);
        CategoryDesk.CategoryProductPage CategoryDesk_Products(CategoryDesk.CategoryProductQuery query);
        CategoryDesk.CategoryFilters CategoryDesk_Filters();
        CategoryDesk.PublishResult CategoryDesk_Publish(string changesJson, string comment, int? baseVersion, bool sqlIsMaster, string user);
        List<CategoryDesk.PublishSummary> CategoryDesk_History();
        List<CategoryDesk.PublishItem> CategoryDesk_PublishDetail(int publishId);
        List<CategoryDesk.RevertConflict> CategoryDesk_RevertCheck(int publishId);
        CategoryDesk.PublishResult CategoryDesk_Revert(int publishId, bool skipConflicts, bool sqlIsMaster, string user);
        #endregion

        #region Product AI
        // piv2.Ai_* procedures: usage log, budget and limits, saved market research.
        AiModels.AiUsageCheck Ai_UsageCheck(string feature, string user);
        long Ai_UsageLog(string user, string feature, string provider, string model, int? productId, int items,
                         decimal costUsd, bool costIsEstimate, string status, string question, string detail, long? fileId);
        List<AiModels.AiUsageRow> Ai_UsageReport(DateTime from, DateTime to);
        List<AiModels.ResearchSnapshot> Ai_ResearchList(int productId, string feature = "MARKET_RESEARCH");
        AiModels.AiProductContext Ai_ProductContext(int productId);
        List<AiModels.SalesHistoryRow> Forecast_History(int productId, int months);
        void Forecast_Save(long usageId, int productId, string rowsJson);
        AiModels.ForecastView Forecast_Runs(int productId);
        List<AiModels.ForecastAccuracyRow> Forecast_Accuracy(DateTime from, DateTime to);
        #endregion





        #region Product assets
        // piv2.Product_Assets (Shopify fields, images, documents, Shopify change feed) and Connection's GetProductFiles.
        ProductAssetsView Product_Assets(int productId);
        List<ProductS3File> Product_S3Files(string productCode);
        #endregion

        #region Product sheet
        // piv2.ProductSheet_*: every ProductData column on one page, saved with a change log; each person's layout.
        List<ProductSheetField> ProductSheet_Get(int productId, bool sqlIsMaster);
        int ProductSheet_Save(int productId, string changesJson, string user, bool sqlIsMaster);
        List<ProductSheetChangeLog> ProductSheet_History(int productId);
        string ProductSheet_ViewGet(string user);
        void ProductSheet_ViewSet(string user, string viewJson);
        List<ProductTechSpecRow> Product_TechSpecs(string productCode);
        #endregion


        #region Vendor Desk (cutover map, brand-vendor, vendor record, direct billing, product classes)
        // piv2.Cutover_*, piv2.BrandVendor_*, piv2.Vendor_ComputymeRecord, piv2.VendorBilling_*, piv2.ProductClass_*
        CutoverMap Cutover_List();
        void Cutover_SetOwner(string sectionKey, string owner, string nextStep, string note, string user);
        List<BrandVendorRow> BrandVendor_List(int? vendorId);
        void BrandVendor_Set(int brandId, int? vendorId, string reason, string user);
        List<BrandVendorHistoryRow> BrandVendor_History(int? brandId, int? vendorId);
        VendorRecord Vendor_ComputymeRecord(int vendorId);
        VendorBilling VendorBilling_Get(int vendorId);
        void VendorBilling_Save(int vendorId, VendorBillingSaveRequest request, string user);
        List<ProductClassRow> ProductClass_List();
        int ProductClass_Save(ProductClassSaveRequest request, string user);
        #endregion
    }

}