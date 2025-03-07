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
        User login(string username, string password);
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


 


    }


}
