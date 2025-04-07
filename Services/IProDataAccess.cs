using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ProInternal.Models.Accounting;
using ProInternal.Models.Dashboard;
using ProInternal.Models.Accounts;
using ProInternal.Models.Auth;
using ProInternal.Services;
using System;
using ProInternal.Models.Products;
using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using ProInternal.Models.Exclusions;
using Microsoft.AspNetCore.Mvc;

namespace ProInternal.Services
{
    public interface IProDataAccess
    {
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

        bool deleteQRUpload(int batchID);
        bool activate(int batchID);
      
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



    }


}
