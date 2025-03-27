using ProInternal.Models.Accounting;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using ProInternal.Models.Dashboard;
using ProInternal.Models.Auth;
using ProInternal.Models.Accounts;
using ProInternal.Models.Products;
using Microsoft.AspNetCore.Identity;
using ProInternal.Helpers;
using Microsoft.Data.SqlClient;
using static System.Runtime.InteropServices.JavaScript.JSType;
using ProInternal.Models.Exclusions;
using System.ComponentModel.Design;
using System.Security;


namespace ProInternal.Services
{
    public class ProDataAccess : IProDataAccess
    {
        private string _connectionString { get; set; }
        public ProDataAccess(string connectionString)
        {
            _connectionString = connectionString;
        }

        #region QuarterlyRebates

        public List<QuarterlyRebate> GetQuarterRebateSummary()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<QuarterlyRebate>("StolenGoods_Get_Flat").ToList();
                return output;
            }
        }

        #endregion

        public List<QuarterlyDataSummary> getCurrentQuarterlyData()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<QuarterlyDataSummary>("QuarterlyGetRecentFileUpload").ToList();
                return output;
            }
        }


        #region Authentication
        public LoginResponse login(string username, string password)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.QueryMultiple("Auth_Login_Internal @username, @password", new { username = username, password = password });

                User user = null;

                List<Permission> permissionset = new List<Permission>();

                try {                     
                    user = output.Read<User>().FirstOrDefault();
                    permissionset = output.Read<Permission>().ToList();
                  }

                catch { }

                var Response = new LoginResponse
                {
                    User = user,
                    Permissions = permissionset
                };

                return (Response);



            }
        }

        public List<QuarterlyDataHistorical> getHistoricalQRData()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<QuarterlyDataHistorical>("GetQRHistorical").ToList();
                return output;
            }
        }


        public List<GatedProducts> getGatedRetailers()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<GatedProducts>("getGatedRetailers").ToList();
                return output;
            }
        }




        public List<qrDetail> getQRBatchDetail(int batchID)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<qrDetail>("PullQRBatch @batchID", new { batchID = batchID }).ToList();
                return output;
            }
        }

        public List<qrDetail> getQRBatchVendorDetail(string StringBatchID)
        {

            string[] values = StringBatchID.Split(',');

            int IntbatchID = Convert.ToInt32(values[0]);
            int IntprogramID = Convert.ToInt32(values[1]);


            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<qrDetail>("PullQRVendorBatch @batchID, @programID", new { batchID = IntbatchID, programID = IntprogramID }).ToList();
                return output;
            }
        }
        


        public bool deleteQRUpload(int batchID)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                bool status = true;
                try
                {
                    connection.Execute("deleteBatch @batchID", new { batchID = batchID });                    
                }
                catch { status = false; }
                finally { }
                return status;
            }
        }


        public bool activate(int batchID)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                bool status = true;
                try
                {
                    connection.Execute("activateBatch @batchID", new { batchID = batchID });
                }
                catch { status = false; }
                finally { }
                return status;
            }
        }

       


        public QuarterlyRebates saveData(QuarterlyRebates data )
        {
            //ListtoDataTableConverter converter = new ListtoDataTableConverter();
            //DataTable Headers = converter.ToDataTable(data.ProgramList);


            DataTable Headers = new DataTable();

            Headers.Columns.Add(new DataColumn("ProgramName", typeof(string)));        
            foreach (var program in data.ProgramList)
            {
                DataRow row = Headers.NewRow();
                row["ProgramName"] = program.ToString();
                Headers.Rows.Add(row);
            }


            DataTable dt = new DataTable();
            dt = data.FileData;
            //Get quanitity of cols 
            int columns = dt.Columns.Count;
            int remainingCols = 0;
            remainingCols = 10 - columns;

            for (int i = 1; i <= remainingCols; i++)
            {
                dt.Columns.Add("Holder" + i.ToString() );            
            }


            //ProgramName
            //QuarterlyFileData

            var p = new DynamicParameters();
            p.Add("@QuarterlyFileData", data.FileData.AsTableValuedParameter("QuarterlyFileData"));
            p.Add("@Programs", Headers.AsTableValuedParameter("Programs"));

            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                try
                {
                    var output = connection.Query<string>("QuarterlyLoadFile", p, commandType: CommandType.StoredProcedure).FirstOrDefault();
                }
                catch(Exception e) { }
                finally { }
                QuarterlyRebates c = new QuarterlyRebates();
                return c;               
            }     
        }



        #region Metrics 

        public OrdersMetrics GetOrdersMetrics()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<OrdersMetrics>("InternalOrdersMetrics").FirstOrDefault(); 

                return output;
            }
        }

        public EDIMetrics GetEDIMetrics()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<EDIMetrics>("InternalEDISMetrics").FirstOrDefault();

                return output;
            }
        }


        public ShippingErrorMetrics getShippingErrorMetrics()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<ShippingErrorMetrics>("InternalShippingErrorMetrics").FirstOrDefault();

                return output;
            }
        }


        public CommecntsMetrics getCommentsrMetrics()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<CommecntsMetrics>("InternalCommentsMetrics").FirstOrDefault();
                return output;
            }
        }


        #endregion



        //InternalMapViolation
        //ProductMapViolation


        public List<Account> getAccounts()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<Account>("GetAccounts").ToList();

                return output;
            }
        }

        public List<Products> getProducts(string searchCriteria)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<Products>("InternalGetProducts", new {searchCriteria =  searchCriteria }).ToList();

                return output;
            }
        }

        public List<MemberGateSummary> GetMemberGateSummary(string searchCriteria)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<MemberGateSummary>("GetMemberGateSummarys", new { searchCriteria = searchCriteria }).ToList();

                return output;
            }
        }
     

        public List<Products> QuickSearchProducts()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<Products>("GetProducts").ToList();
                return output;
            }
        }


        public List<Brands> getBrands()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<Brands>("GetBrands").ToList();
                return output;
            }
        }


        public List<SpecialOrdersSummary> getOrdersSnapshot()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<SpecialOrdersSummary>("InternalOrdersSnapshot").ToList();

                return output;
            }
        }


        //public User login(string username, string password)
        //{
        //    using (IDbConnection connection = new SqlConnection(_connectionString))
        //    {
        //        var output = connection.QueryMultiple("Auth_Login @username, @password", new { username = username, password = password });
        //        User user = null;
        //        try { user = output.Read<User>().FirstOrDefault(); }
        //        catch { }  
        //        return user;
        //    }
        //}

		#region Exclusions
        public int Exclusion_CreateGroup(string groupName) {
			using (IDbConnection connection = new SqlConnection(_connectionString)) {
				var output = connection.Query<int>("Exclusions_CreateGroup @groupName", new { groupName = groupName}).FirstOrDefault();
				return output;
			}
		}

        public void Exclusion_AddProductsToGroup(int productExclusionGroupID, List<string> productCodes) {

			DataTable productCodeTable = new DataTable();

			productCodeTable.Columns.Add(new DataColumn("ProductCode", typeof(string)));
			foreach (var code in productCodes) {
				DataRow row = productCodeTable.NewRow();
				row["ProductCode"] = code;
				productCodeTable.Rows.Add(row);
			}

			var p = new DynamicParameters();
			p.Add("@ProductExclusionGroupID", productExclusionGroupID);
			p.Add("@ProductCodes", productCodeTable.AsTableValuedParameter("ProductCodeList"));

			using (IDbConnection connection = new SqlConnection(_connectionString)) {
				connection.Execute("Exclusions_AddProductsToGroup", p, commandType: CommandType.StoredProcedure);
			}
		}

        public void Exclusion_ExcludeCompanyGroups(int companyID, List<int> productExclusionGroupIDs) {
            DataTable groupIds = new DataTable();
            groupIds.Columns.Add(new DataColumn("Id", typeof(int)));
            foreach (int id in productExclusionGroupIDs) {
                DataRow row = groupIds.NewRow();
                row["Id"] = id;
                groupIds.Rows.Add(row);
            }
            var p = new DynamicParameters();
            p.Add("@CompanyId", companyID);
            p.Add("@ProductExclusionGroupIDs", groupIds.AsTableValuedParameter("IdList"));
			using (IDbConnection connection = new SqlConnection(_connectionString)) {
				connection.Execute("Exclusions_ExcludeCompanyGroups", p, commandType: CommandType.StoredProcedure);
			}
		}

       public void Exclusions_ExcludeCompanyBrands(int companyID, List<int> brandIDs) {
			DataTable brandIds = new DataTable();
			brandIds.Columns.Add(new DataColumn("BrandId", typeof(int)));
			foreach (int id in brandIDs) {
				DataRow row = brandIds.NewRow();
				row["BrandId"] = id;
				brandIds.Rows.Add(row);
			}
			var p = new DynamicParameters();
			p.Add("@CompanyId", companyID);
			p.Add("@BrandIds", brandIds.AsTableValuedParameter("BrandIdList"));
			using (IDbConnection connection = new SqlConnection(_connectionString)) {
				connection.Execute("Exclusions_ExcludeCompanyBrands", p, commandType: CommandType.StoredProcedure);
			}
		}

        public List<CompanyBrandExclusion> Exclusions_GetCompanyBrandExclusions(int companyID) {
			using (IDbConnection connection = new SqlConnection(_connectionString)) {
				var output = connection.Query<CompanyBrandExclusion>("Exclusions_GetCompanyBrandExclusions @CompanyID", new { CompanyID = companyID}).ToList();
				return output;
			}
		}

        public List<ProductExclusionGroup> Exclusions_GetExclusionGroups() {
			using (IDbConnection connection = new SqlConnection(_connectionString)) {
				var output = connection.Query<ProductExclusionGroup>("Exclusions_GetExclusionGroups").ToList();
				return output;
			}
        }

        public List<ProductExclusionGroupProduct> Exclusions_GetExclusionGroupProducts(int productExclusionGroupID) { 
 			using (IDbConnection connection = new SqlConnection(_connectionString)) {
				var output = connection.Query<ProductExclusionGroupProduct>("Exclusions_GetExclusionGroupProducts @ProductExclusionGroupID", new { ProductExclusionGroupID = productExclusionGroupID }).ToList();
				return output;
			}
       }

        public List<CompanyGroupExclusion> Exclusions_GetCompanyGroupExclusions(int companyID) {
			using (IDbConnection connection = new SqlConnection(_connectionString)) {
				var output = connection.Query<CompanyGroupExclusion>("Exclusions_GetCompanyGroupExclusions @CompanyID", new { CompanyID = companyID }).ToList();
				return output;
			}

        }
		#endregion

	}
}
#endregion