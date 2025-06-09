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
using ProInternal.Models.Vendor;
using Microsoft.AspNetCore.Identity;
using ProInternal.Helpers;
using Microsoft.Data.SqlClient;
using static System.Runtime.InteropServices.JavaScript.JSType;
using ProInternal.Models.Exclusions;
using System.ComponentModel.Design;
using System.Security;
using Microsoft.AspNetCore.Mvc;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory.Database;
using Microsoft.EntityFrameworkCore;
using System.Numerics;
using Microsoft.AspNetCore.OutputCaching;
using ProInternal.Models.InvoiceRecord;
using ProInternal.Models.Patronage;
using System.Reflection.PortableExecutable;
using ProInternal.Models;


namespace ProInternal.Services
{
    public class ProDataAccess : IProDataAccess
    {
        private string _connectionString { get; set; }
 

        public ProDataAccess(string connectionString)
        {
            _connectionString = connectionString;
   
        }

        public List<UserWithRoles> GetUsersWithRoles()
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var userDict = new Dictionary<int, UserWithRoles>();

                var result = connection.Query<UserWithRoles, string, UserWithRoles>(
                    "PIV2_GetUsersWithRoles",
                    (user, role) =>
                    {
                        if (!userDict.TryGetValue(user.UserId, out var existingUser))
                        {
                            existingUser = user;
                            existingUser.Roles = new List<string>();
                            userDict.Add(existingUser.UserId, existingUser);
                            
                        }

                        if (!string.IsNullOrEmpty(role) && !existingUser.Roles.Contains(role))
                        {
                            existingUser.Roles.Add(role);
                        }

                        return existingUser;
                    },
                    splitOn: "RoleName",
                    commandType: CommandType.StoredProcedure
                );

                return userDict.Values.ToList();
            }
        }



        public void EnableUser(int userId)
        {
            using var conn = new SqlConnection(_connectionString);
            var parameters = new { UserId = userId };
            conn.Execute("PIV2_EnableUser", parameters, commandType: CommandType.StoredProcedure);
        }


        public void DisableUser(int userId)
        {
            using var conn = new SqlConnection(_connectionString);
            conn.Execute("PIV2_DisableUser", new { userId }, commandType: CommandType.StoredProcedure);
        }

        public void DeleteUser(int userId)
        {
            using var conn = new SqlConnection(_connectionString);
            conn.Execute("PIV2_DeleteUser", new { userId }, commandType: CommandType.StoredProcedure);
        }


        public void AssignRoleToUser(int userId, string roleName)
        {
            using var conn = new SqlConnection(_connectionString);
            conn.Execute("PIV2_AssignRoleToUser", new { userId, roleName }, commandType: CommandType.StoredProcedure);
        }

        public void RemoveRoleFromUser(int userId, string roleName)
        {
            using var conn = new SqlConnection(_connectionString);
            conn.Execute("PIV2_RemoveRoleFromUser", new { userId, roleName }, commandType: CommandType.StoredProcedure);
        }


        public List<UserWithRoles> GetUserRoles(int userId)
        {
            using var conn = new SqlConnection(_connectionString);
            return conn.Query<UserWithRoles>("PIV2_GetUserRoles", new { userId }, commandType: CommandType.StoredProcedure).ToList();
        }


        public List<RoleDto> GetAllRoles()
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return connection.Query<RoleDto>(
                    "PIV2_GetAllRoles",
                    commandType: CommandType.StoredProcedure
                ).ToList();
            }
        }




        public List<string> GetPermissionsByRole(string roleName)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                return connection.Query<string>(
                    "PIV2_GetPermissionsByRole",
                    new { RoleName = roleName },
                    commandType: CommandType.StoredProcedure
                ).ToList();
            }
        }

        public void CreatePermission(string permissionName, string description)
        {
            using var conn = new SqlConnection(_connectionString);
            conn.Execute("dbo.CreatePermission", new { permissionName, description }, commandType: CommandType.StoredProcedure);
        }



        public void RenamePermission(string oldName, string newName, string description)
        {
            using var conn = new SqlConnection(_connectionString);

            conn.Execute("dbo.RenamePermission", new { oldName, newName, description }, commandType: CommandType.StoredProcedure);
        }




        public void DeletePermission(string permissionName)
        {
            using var conn = new SqlConnection(_connectionString);
            conn.Execute("dbo.DeletePermission", new { permissionName }, commandType: CommandType.StoredProcedure);
        }




        public List<string> GetUserExtraPermissions(int userId)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return connection.Query<string>("[PIV2_GetUserExtraPermissions]", new { UserId = userId }, commandType: CommandType.StoredProcedure).ToList();
            }
        }

        //public void SaveUserExtraPermission(int userId, string permission)
        //{
        //    using (var connection = new SqlConnection(_connectionString))
        //    {

        //        connection.Execute("PIV2SetUserExtraPermissions", new { UserId = userId, Permission = permission }, commandType: CommandType.StoredProcedure);
        //    }
        //}

        public void SaveUserExtraPermission(int userId, List<string> permissions)
        {
            using var conn = new SqlConnection(_connectionString);

            var table = new DataTable();
            table.Columns.Add("PermissionName", typeof(string));
            foreach (var p in permissions)
                table.Rows.Add(p);

            var parameters = new DynamicParameters();
            parameters.Add("@UserId", userId);
            parameters.Add("@Permissions", table.AsTableValuedParameter("dbo.ExtraPermissionsList"));

            conn.Execute("dbo.PIV2SetUserExtraPermissions", parameters, commandType: CommandType.StoredProcedure);
        }




        public void RemoveUserExtraPermission(int userId, string permission)
        {
            using (var connection = new SqlConnection(_connectionString))
            {

                connection.Execute("RemoveUserExtraPermission", new { UserId = userId, Permission = permission }, commandType: CommandType.StoredProcedure);
            }
        }




        public void AssignPermissionToRole(string roleName, List<string> permissionNames)
        {
            using var conn = new SqlConnection(_connectionString);
            foreach (var permission in permissionNames)
            {
                conn.Execute("PIV2_AssignPermissionToRole",
                    new { roleName, permissionName = permission },
                    commandType: CommandType.StoredProcedure);
            }
        }

        public void RemovePermissionFromRole(string roleName, List<string> permissionNames)
        {
            using var conn = new SqlConnection(_connectionString);
            foreach (var permission in permissionNames)
            {
                conn.Execute("PIV2_RemovePermissionFromRole",
                    new { roleName, permissionName = permission },
                    commandType: CommandType.StoredProcedure);
            }
        }



        public List<string> GetUserPermissions(int userId)
        {
            using var conn = new SqlConnection(_connectionString);
            return conn.Query<string>("PIV2_GetUserPermissions", new { userId }, commandType: CommandType.StoredProcedure).ToList();
        }


        public void CreateRole(string roleName, string roleDescription)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                connection.Execute(
                    "PIV2_CreateRole",
                    new { RoleName = roleName, RoleDescription = roleDescription },
                    commandType: CommandType.StoredProcedure);
            }
        }

        public void RenameRole(string oldName, string newName)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                connection.Execute(
                    "PIV2_RenameRole",
                    new { OldName = oldName, NewName = newName },
                    commandType: CommandType.StoredProcedure);
            }
        }

        public void DeleteRole(string roleName)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                connection.Execute(
                    "PIV2_DeleteRole",
                    new { RoleName = roleName },
                    commandType: CommandType.StoredProcedure);
            }
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

     
        public List<InvoiceRecord> GetInvoices()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<InvoiceRecord>("GetEzpayInvoices").ToList();

                return output;
            }
        }



        public List<VendorStock> GetVendorStock()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<VendorStock>("GetAllVendorStock").ToList();
               
                return output;
            }
        }


        public VendorUserResponse saveVendorUser(VendorUser user)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var parameters = new DynamicParameters();
                parameters.Add("@CompanyID", user.CompanyId);
                parameters.Add("@Email", user.Email);
                parameters.Add("@FirstName", user.FirstName);
                parameters.Add("@LastName", user.LastName);
                parameters.Add("@Username", user.Username);
                parameters.Add("@Password", user.Password);


                try
                {
                    var output = connection.Query<VendorUserResponse>(
                        "InsertVendorUser",
                        parameters,
                        commandType: CommandType.StoredProcedure
                    ).FirstOrDefault();

                    return output ?? new VendorUserResponse(); // Return default if null
                }
                catch (Exception e)
                {
    
                    return new VendorUserResponse(); // Return empty response object on error
                }
            }
        }

        public List<VendorSearch> getAllVendors()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<VendorSearch>("getAllVendors").ToList();
                
                return output;
            }
        }


        #region Authentication
        public LoginResponse login(string username, string password)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var response = new LoginResponse();

                try
                {
                    var output = connection.QueryMultiple("PIV2_GetUserLoginData", new { username, password });

                    // 1. First result set: User
                    var user = output.Read<User>().FirstOrDefault();
                    if (user == null)
                        return response; // Return empty response (invalid login)
                 

                    // 2. Second result set: Roles (List<string>)
                    var roles = output.Read<string>().ToList();


                    // 3. Third result set: Permissions (List<string>)
                    var permissions = output.Read<string>().ToList();


                    var extraPermissions = output.Read<string>().ToList();

                    // Build final response
                    response.User = user;
                    response.Roles = roles;
                    response.Permissions = permissions;
                    response.ExtraPermissions = extraPermissions;
                }



                catch (Exception ex)
                {
                    // Optional: log error
                    Console.WriteLine($"Login error: {ex.Message}");
                }

                return response;
            }
        }


        public List<PermissionDto> GetAllPermissions()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                return connection.Query<PermissionDto>("PIV2_GetAllPermissions").ToList();
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
        
        public List<Notification> GetNotificationsForUser(int userId)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var parameters = new { UserId = userId };
                var notifications = connection.Query<Notification>(
                    "GetNotificationsForUser",
                    parameters,
                    commandType: CommandType.StoredProcedure
                ).ToList();

                return notifications;
            }
        }


        public void MarkNotificationAsRead(int notificationId, int userId)
        {
            using var connection = new SqlConnection(_connectionString);
            connection.Execute("MarkNotificationAsRead", new { Id = notificationId, UserId = userId }, commandType: CommandType.StoredProcedure);
        }

        public void DeleteNotification(int notificationId, int userId)
        {
            using var connection = new SqlConnection(_connectionString);
            connection.Execute("ArchiveUserNotification", new { Id = notificationId, UserId = userId }, commandType: CommandType.StoredProcedure);
        }




        public List<GatedProducts> getGatedRetailers()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<GatedProducts>("getGatedRetailers").ToList();
                return output;
            }
        }



        public List<MapViolation> GetExistingViolations(MapViolation violation)
        {
            using (IDbConnection db = new SqlConnection(_connectionString))
            {
                var parameters = new DynamicParameters();
                parameters.Add("@AccountNumber", violation.AccountNumber);
                parameters.Add("@ProductCode", violation.ProductCode);
                parameters.Add("@DayPenalty", violation.PenaltyDays);

                var results = db.Query<MapViolation>(
                    "InsertAndGetMapViolations",
                    parameters,
                    commandType: CommandType.StoredProcedure
                ).ToList();

                return results;
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


        
        public List<PatronageUpload> GetRecentPatronageLoad()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<PatronageUpload>("GetRecentPatronage").ToList();

                return output;
            }
        }


        public List<PatronageHistorical> GetPatronageHistorical()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<PatronageHistorical>("GetPatronageHistorical").ToList();

                return output;
            }
        }


        public bool activatePatronageBatch(string batchID, bool active)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                try
                {
                    var parameters = new { BatchID = batchID, Active = active };

                    var result = connection.Execute(
                        "UpdatePatronageBatchActive",   
                        parameters,
                        commandType: CommandType.StoredProcedure
                    );

                    return result > 0;
                }
                catch (Exception)
                {
                    return false;
                }
            }
        }


        public List<PatronageUpload> getPatronageBatchDetails(string batchID)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<PatronageUpload>("getPatronageBatchDetails @batchID", new { batchID = batchID }).ToList();
                return output;
            }
        }





        public bool deletePatronageLoad(string id)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                bool status = true;
                try
                {
                    connection.Execute("deletePatronageBatch @batchID", new { batchID = id });
                }
                catch { status = false; }
                finally { }
                return status;
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

        private object ToDbDecimal(object value)
        {
            if (value == null)
                return DBNull.Value;

            var str = value.ToString().Trim();

            if (string.IsNullOrEmpty(str))
                return DBNull.Value;

            if (decimal.TryParse(str.Replace("(", "-").Replace(")", ""), out var result))
                return result;

            return DBNull.Value;
        }

        public void savePatronageData(List<PatronageUpload> data )
        {

            var batchId = "PATR-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmm");


            var table = new DataTable();
            table.Columns.Add("AccountID", typeof(int));
            table.Columns.Add("TotalValue", typeof(decimal));
            table.Columns.Add("Perc", typeof(decimal));
            table.Columns.Add("Shares", typeof(decimal));
            table.Columns.Add("Balance", typeof(decimal));
            table.Columns.Add("Profit", typeof(decimal));
            table.Columns.Add("Dividend", typeof(decimal));
            table.Columns.Add("Payment", typeof(decimal));
            table.Columns.Add("Credit", typeof(decimal));
            table.Columns.Add("DateLoaded", typeof(DateTime));
            table.Columns.Add("BatchID", typeof(string));
            table.Columns.Add("StockValue", typeof(decimal));
            table.Columns.Add("TaxWithholding", typeof(decimal));
            table.Columns.Add("Withdrawal", typeof(decimal));
            table.Columns.Add("EndingRetention", typeof(decimal));

            foreach (var item in data)
            {

                var parsedDate = DateTime.Parse(item.dateLoaded.ToString());
                var cleanDateLoaded = parsedDate.AddSeconds(-parsedDate.Second).AddMilliseconds(-parsedDate.Millisecond);


                table.Rows.Add(
                    item.accountID,
                    ToDbDecimal(item.totalValue),
                    ToDbDecimal(item.perc),
                    ToDbDecimal(item.shares),
                    ToDbDecimal(item.balance),
                    ToDbDecimal(item.profit),
                    ToDbDecimal(item.dividend),
                    ToDbDecimal(item.payment),
                    ToDbDecimal(item.credit),
                    cleanDateLoaded,
                    batchId,
                    ToDbDecimal(item.stockValue),
                    ToDbDecimal(item.taxWithholding),
                    ToDbDecimal(item.withdrawal),
                    ToDbDecimal(item.endingRetention)
                );
            }



            var p = new DynamicParameters();
            p.Add("@PatronageUploads", table.AsTableValuedParameter("PatronageUploadTableType"));

            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                try
                {
                    var output = connection.Query<string>("InsertPatronageUploads", p, commandType: CommandType.StoredProcedure).FirstOrDefault();
                }
                catch (Exception e) { }
                finally { }
             
            }
        }





        public QuarterlyRebates saveData(QuarterlyRebates data)
        {

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
                dt.Columns.Add("Holder" + i.ToString());
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
                catch (Exception e) { }
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

        public void ApplyCountryBrandExclusion(CountryBrandRequest data)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {

                var table = new DataTable();
                table.Columns.Add("BrandId", typeof(int));

                foreach (var id in data.BrandIds)
                {
                    table.Rows.Add(id);
                }

                var parameters = new DynamicParameters();
                parameters.Add("@Country", data.Country);
                parameters.Add("@BrandIds", table.AsTableValuedParameter("BrandIdTableType"));

                connection.Execute("ApplyBrandExclusionByCountry", parameters, commandType: CommandType.StoredProcedure);
            }
        }


        public List<Brands> GetExcludedBrandsByCountry(string country)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {         
                var output = connection.Query<Brands>("GetExcludedBrandsByCountry", new { country = country }).ToList();
                
                return output;
            }
        }


        public List<string> GetUniqueCountries()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<string>("GetUniqueCountries").ToList();

                return output;
            }

        }
            


        public void AssignBrandsToMember([FromBody] GatingAssignment assignment)
        {

            // Build the DataTable matching the user-defined table type
            DataTable brandTable = new DataTable();
            brandTable.Columns.Add(new DataColumn("BrandID", typeof(string)));

            foreach (var brandId in assignment.BrandIds)
            {
                DataRow row = brandTable.NewRow();
                row["BrandID"] = brandId;
                brandTable.Rows.Add(row);
            }

            var parameters = new DynamicParameters();
            parameters.Add("@AccountNumber", assignment.AccountNumber);
            parameters.Add("@Brands", brandTable.AsTableValuedParameter("BrandIdListType"));

            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                connection.Execute("InsertMemberBrandGating", parameters, commandType: CommandType.StoredProcedure);
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

        public List<CompanyDto> GetCompaniesAssignedToGroupAsync(int groupId)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<CompanyDto>(
                    "Exclusions_GetCompanyExclusions",
                    new { GroupID = groupId },  // Match this to what the stored procedure expects
                    commandType: CommandType.StoredProcedure
                ).ToList();

                return output;
            }
        }



        public List<Products> GetUnassignedProductsAsync()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<Products>("GetUnassignedProducts").ToList();
              
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