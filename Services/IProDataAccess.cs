using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ProInternal.Models.Accounting;
using ProInternal.Models.Dashboard;
using ProInternal.Models.Accounts;
using ProInternal.Models.Auth;
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

namespace ProInternal.Services
{
    public interface IProDataAccess
    {

        List<string> GetPermissionsByRole(string roleName);

        List<string> GetUserExtraPermissions(int userId);
        void SaveUserExtraPermission(int userId, List<string> permissions);

        void ToggleVendorWebStatus(int vendorId);

        IEnumerable<Vendor> GetVendors();
        IEnumerable<Member> GetMembers(int memberTypeId);
        IEnumerable<Subscription> GetSubscriptions();

        void RemoveUserExtraPermission(int userId, string permission);
        IEnumerable<MemberAddress> GetMemberShipping(string accountId);

        void CreateRole(string roleName, string roleDescription);
        void RenameRole(string oldName, string newName);
        void DeleteRole(string roleName);



        List<PermissionDto> GetAllPermissions();  
        List<UserWithRoles> GetUsersWithRoles();
        List<RoleDto> GetAllRoles();

        void AssignRoleToUser(int userId, string roleName);
        void RemoveRoleFromUser(int userId, string roleName);

        List<UserWithRoles> GetUserRoles(int userId);
        void ReplaceUserRoles(int userId, List<string> roles);


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
        
        List<Account> getAccounts();
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












    }


}
