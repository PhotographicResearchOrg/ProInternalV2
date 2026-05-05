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
using ProInternal.Models.WH;
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
using System.Reflection;
using ProInternal.Models.Outstanding;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using ProInternal.Models.InstantRebates;


namespace ProInternal.Services
{
    public class ProDataAccess : BaseDataAccess, IProDataAccess
    {
        public ProDataAccess(IConfiguration config, AwsSecretHelper helper)
            : base(config, helper, "ProConnectionString")
        {
        }


        public VendorDto? GetVendorById(int vendorId)
        {
            using var conn = GetConnection();

            return conn.QueryFirstOrDefault<VendorDto>(@"
        SELECT
            VendorId,
            Name,
            BillingTerms,
            Address
        FROM Vendor
        WHERE VendorId = @vendorId
    ", new { vendorId });
        }



        public decimal GetDropShipThreshold()
        {
            using (var conn = GetConnection())
            {
                return conn.QueryFirstOrDefault<decimal>(
                    "SELECT DropShipThreshold FROM OrderProcessingConfig WHERE Id = 1"
                );
            }
        }
        public void SetDropShipThreshold(decimal value)
        {
            using (var conn = GetConnection())
            {
                conn.Execute(
                    @"UPDATE OrderProcessingConfig
              SET DropShipThreshold = @Value
              WHERE Id = 1",
                    new { Value = value }
                );
            }
        }




        // --------------------------------------------------
        // UPSERT FILE (DEDUP SAFE)
        // --------------------------------------------------
        public void UpsertAccountingFile(string fileId, string storedName, string originalName)
        {
            using var conn = GetConnection();
            //using var db = Connection;

            conn.Execute(
                "AccountingFiles_Upsert",
                new
                {
                    FileId = fileId,
                    StoredName = storedName,
                    OriginalName = originalName
                },
                commandType: CommandType.StoredProcedure
            );
        }

        // --------------------------------------------------
        // LINK FILE TO CREDIT + BATCH
        // --------------------------------------------------
        public void LinkFileToCredit(int creditId,  Guid batchGuid, string fileId)
        {
            //using var db = Connection;
            using var conn = GetConnection();

            conn.Execute(
                "AccountingCreditFiles_Insert",
                new
                {
                    CreditID = creditId,
                    BatchGuid = batchGuid,
                    FileId = fileId
                },
                commandType: CommandType.StoredProcedure
            );
        }


        public IEnumerable<AccountingFile> GetFilesForCredit(int creditId)
        {
            using var conn = GetConnection();

            return conn.Query<AccountingFile>(
                "AccountingFiles_GetByCredit",
                new { CreditId = creditId },
                commandType: CommandType.StoredProcedure
            );
        }

        public void MarkCreditInvoiceFailed(
    int creditId,
    string invoiceNumber,
    string error
)
        {
            using var conn = GetConnection();

            conn.Execute(
                "dbo.AccountingCredit_MarkInvoiceFailed",
                new
                {
                    CreditId = creditId,
                    InvoiceNumber = invoiceNumber,
                    Error = error
                },
                commandType: CommandType.StoredProcedure
            );
        }


        public MemberDto? GetMemberByAccount(string account)
        {
            using var conn = GetConnection();

            return conn.QuerySingleOrDefault<MemberDto>(
                "dbo.Member_GetBillToByAccount",
                new { Account = account },
                commandType: CommandType.StoredProcedure
            );
        }



        // --------------------------------------------------
        // GET FILES FOR BATCH (INVOICE BUILD)
        // --------------------------------------------------
        public IEnumerable<AccountingFile> GetFilesForBatch(Guid batchGuid)
        {
            //using var db = Connection;
            using var conn = GetConnection();

            return conn.Query<AccountingFile>(
                "AccountingFiles_GetByBatch",
                new { BatchGuid = batchGuid },
                commandType: CommandType.StoredProcedure
            );
        }

        // --------------------------------------------------
        // GET SINGLE FILE (PREVIEW)
        // --------------------------------------------------
        public AccountingFile GetAccountingFile(string fileId)
        {
            // using var db = Connection;
            using var conn = GetConnection();

            return conn.QueryFirstOrDefault<AccountingFile>(
                "AccountingFiles_GetById",
                new { FileId = fileId },
                commandType: CommandType.StoredProcedure
            );
        }




        public int InsertVendorBilling(VendorBillingRequestDto dto, Guid batchGuid, int batchId)
        {
            using var conn = GetConnection();

            return conn.QuerySingle<int>(
                "PIV2Accounting_InsertCredit",
                new
                {
                    BatchID = batchId,                 // legacy – can be 0 if unused
                    BatchGuid = batchGuid,             // REQUIRED
                    Module = "2",                      // 🔥 KEY DIFFERENCE
                    ProID = int.Parse(dto.ProID),
                    Account = "1320",                  // or whatever posting acct
                    Amount = dto.Amount,
                    OrderDate = dto.OrderDate,
                    Description = dto.Description ?? "Vendor Billing",
                    FileName = string.Join(",", dto.FileNames),
                    ApplyEZPay = dto.EZPay ? "Y" : "N",
                    PO = dto.PO,
                    UserEntered = "UI",
                    VendorID = int.Parse(dto.VendorID),
                    Terms = dto.Terms,
                    FutureBilling = dto.FutureBilling,
                    VendorInv = dto.VendorInv,
                    VendInvDate = dto.VendInvDate,
                    VendorDueDate = dto.VendorDueDate,
                    Discount = dto.Discount,
                    PostingAccount = "1320"
                },
                commandType: CommandType.StoredProcedure
            );
        }



  

        public int InsertAccountingCredit(CreditRequestDto dto)
        {
            using var conn = GetConnection();

            return conn.ExecuteScalar<int>(
                "PIV2Accounting_InsertCredit",
                new
                {
                    BatchID = 0,

                    BatchGuid = dto.BatchGuid,
                    // SP expects CHAR(1)
                    Module = dto.Module.ToString(),

                    // SP expects INT
                    ProID = int.Parse(dto.ProID),

                    // SP expects CHAR(4)
                    Account = dto.ProID.Substring(0, 4),

                    PostingAccount = dto.PostingAccount ?? "1320",

                    Amount = dto.Amount,
                    OrderDate = dto.OrderDate,
                    Description = dto.Description,

                    // 🔥 FLATTEN FILE LIST → SINGLE VALUE
                    FileName = string.Join(",", dto.FileNames),
                    
                    // SP expects CHAR(1)
                    ApplyEZPay = dto.EZPay ? "1" : "2",

                    PO = dto.PO ?? "",
                    VendorPO = dto.VendorInvoice ?? "",
                    UserEntered = "SYSTEM",

                    // Optional SP params
                    VendorID = dto.VendorID,
                    Terms = (string?)null,
                    FutureBilling = (string?)null,
                    VendorInv = dto.VendorInvoice,
                    VendInvDate = dto.VendInvDate,
                    VendorDueDate = dto.VendorDueDate,


                    Discount = (decimal?)null
                },
                commandType: CommandType.StoredProcedure
            );
        }




        public IEnumerable<VendorLookupDto> SearchVendors(string term)
        {
            using var conn = GetConnection();

            return conn.Query<VendorLookupDto>(
                "Vendor_Search",
                new { term },
                commandType: CommandType.StoredProcedure
            );
        }


        public IEnumerable<AccountingCreditDto> GetCredits()
        {
            using var conn = GetConnection();

            using var multi = conn.QueryMultiple(
                  "PIV2AAccounting_GetCredits",
                  new { Module = "1" },
                  commandType: CommandType.StoredProcedure
              );

            var credits = multi.Read<AccountingCreditDto>().ToList();
            var files = multi.Read<(int CreditID, string FileId, string OriginalName)>();

            var lookup = credits.ToDictionary(c => c.ID);

            foreach (var f in files)
            {
                if (lookup.TryGetValue(f.CreditID, out var credit))
                {
                    credit.Files.Add(new AccountingCreditFileDto
                    {
                        FileId = f.FileId,
                        OriginalName = f.OriginalName
                    });
                }
            }

            return credits;
        }


        public IEnumerable<AccountingCreditDto> GetVendorBillingHistory()
        {
            using var conn = GetConnection();

            using var multi = conn.QueryMultiple(
                "PIV2AAccounting_GetCredits",
                new { Module = "2" },
                commandType: CommandType.StoredProcedure
            );

            var credits = multi.Read<AccountingCreditDto>().ToList();
            var files = multi.Read<(int CreditID, string FileId, string OriginalName)>();

            var lookup = credits.ToDictionary(c => c.ID);

            foreach (var f in files)
            {
                if (lookup.TryGetValue(f.CreditID, out var credit))
                {
                    credit.Files.Add(new AccountingCreditFileDto
                    {
                        FileId = f.FileId,
                        OriginalName = f.OriginalName
                    });
                }
            }

            return credits;
        }



        public IEnumerable<AccountingCreditDto> GetVendorBilling()
        {
            using var conn = GetConnection();
            return conn.Query<AccountingCreditDto>(
                "PIV2Accounting_GetVendorBilling",
                commandType: CommandType.StoredProcedure
            );
        }



        public IEnumerable<MemberLookupDto> SearchMember(string term)
        {
            using var conn = GetConnection();

            return conn.Query<MemberLookupDto>(
                "Accounting_SearchMember",
                new { Term = term },
                commandType: CommandType.StoredProcedure
            );
        }


        public IEnumerable<VendorLookupDto> SearchVendor(string term, string type)
        {
            using var conn = GetConnection();

            return conn.Query<VendorLookupDto>(
                "Accounting_SearchVendor",
                new { Term = term, Type = type },
                commandType: CommandType.StoredProcedure
            );
        }

        public void MarkCreditSuccess(int creditId, string invoiceNumber)
        {
            using var conn = GetConnection();

            conn.Execute(
                "PIV2_Accounting_MarkCreditSuccess",
                new { CreditId = creditId, InvoiceNumber = invoiceNumber },
                commandType: CommandType.StoredProcedure
            );
        }

        public void MarkCreditFailed(int creditId, string error)
        {
            using var conn = GetConnection();

            conn.Execute(
                "PIV2_Accounting_MarkCreditFailed",
                new { CreditId = creditId, Error = error },
                commandType: CommandType.StoredProcedure
            );
        }

        public IEnumerable<VendorInvoiceLearningDto>
    GetVendorInvoiceLearning(int vendorId)
        {
            using var conn = GetConnection();

            return conn.Query<VendorInvoiceLearningDto>(
                "VendorInvoiceLearning_GetByVendor",
                new { VendorId = vendorId },
                commandType: CommandType.StoredProcedure
            );
        }

        public VendorMatchDto? FindVendorByName(string name)
        {
            using var conn = GetConnection();

            return conn.QueryFirstOrDefault<VendorMatchDto>(
                "Vendor_FindByName",
                new { Name = name },
                commandType: CommandType.StoredProcedure
            );
        }

        public VendorMatchDto? FindVendorByAddress(string rawText)
        {
            using var conn = GetConnection();

            return conn.QueryFirstOrDefault<VendorMatchDto>(
                "Vendor_FindByAddress",
                new { RawText = rawText },
                commandType: CommandType.StoredProcedure
            );
        }


        public MemberMatchDto? FindMemberByName(string name)
        {
            using var conn = GetConnection();

            return conn.QueryFirstOrDefault<MemberMatchDto>(
                "Member_FindByName",
                new { Name = name },
                commandType: CommandType.StoredProcedure
            );
        }

        public MemberMatchDto? FindMemberByAddress(string rawText)
        {
            using var conn = GetConnection();

            return conn.QueryFirstOrDefault<MemberMatchDto>(
                "Member_FindByAddress",
                new { RawText = rawText },
                commandType: CommandType.StoredProcedure
            );
        }



        public async Task SendBackToWarehouse(int errorId, string productCode, string reason, string username)
        {
            using var conn = GetConnection();

            var parameters = new DynamicParameters();
            parameters.Add("@ErrorID", errorId);
            parameters.Add("@ProductCode", productCode);
            parameters.Add("@Reason", reason);
            parameters.Add("@Username", username);

            await conn.ExecuteAsync(
                "ShippingError_SendBackToWarehouse",
                parameters,
                commandType: CommandType.StoredProcedure
            );
        }




        public void TouchVendorInvoiceLearning(int id)
        {
            using var conn = GetConnection();

            conn.Execute(
                "VendorInvoiceLearning_Touch",
                new { Id = id },
                commandType: CommandType.StoredProcedure
            );
        }

        public void UpsertVendorInvoiceLearning(VendorInvoiceLearningDto dto)
        {
            using var db = GetConnection();
            db.Execute(
                "VendorInvoiceLearning_Upsert",
                new
                {
                    dto.VendorId,
                    dto.FieldName,
                    dto.Strategy,
                    dto.Pattern,
                    dto.ResolvedValue   // 🔥 THIS WAS MISSING
                },
                commandType: CommandType.StoredProcedure
            );
        }





        public async Task<string> ProcessShippingErrors(List<ShippingErrorRequest> errorList)
        {
            using (var connection = GetConnection())
            {
             //   connection.Open();

                try
                {
                    // Start a transaction to ensure atomicity of the process
                    using (var transaction = connection.BeginTransaction())
                    {
                        foreach (var error in errorList)
                        {
                            // Define the parameters for the stored procedure
                            var parameters = new DynamicParameters();
                            parameters.Add("@ErrorID", error.ErrorID);
                            parameters.Add("@Disposition", error.Disposition);
                            parameters.Add("@CustomMessage", error.CustomMessage);
                            parameters.Add("@ID", error.ID);
                            parameters.Add("@ProductCode", error.productCode);

                            // Call the stored procedure to process each shipping error
                            await connection.ExecuteAsync("Process_ShippingError", parameters, commandType: CommandType.StoredProcedure, transaction: transaction);
                        }

                        // Commit the transaction after all errors are processed
                        transaction.Commit();
                    }

                    return "Shipping errors processed successfully.";
                }
                catch (Exception ex)
                {
                    // Rollback the transaction if an error occurs
                
                    throw new Exception("Error processing shipping errors", ex);
                }
            }
        }


        public void SavePaymentType(PaymentType payment)
        {
            using var connection = GetConnection();
            using var command = new SqlCommand("Accounting_SavePaymentType", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@AccountNumber", payment.AccountNumber);
            command.Parameters.AddWithValue("@PaymentType", string.IsNullOrEmpty(payment.PaymentTypeName) ? DBNull.Value : (object)payment.PaymentTypeName);

            connection.Open();
            command.ExecuteNonQuery();

        }



        public IEnumerable<PaymentType> GetPaymentTypes()
        {
            using var connection = GetConnection();
            return connection.Query<PaymentType>(
                "Accounting_GetPaymentTypes",
                commandType: CommandType.StoredProcedure
            );
        }



        public string? GetPrimaryProductDescriptionByProCode(int proCode)
        {
            using var conn = GetConnection();
            return conn.QueryFirstOrDefault<string>(
                "PIV2GetPrimaryProductDescriptionByProCode",
                new { ProCode = proCode },
                commandType: CommandType.StoredProcedure
            );
        }


        public IEnumerable<ProInternal.Models.WH.ShippingErrorRecord> GetShippingErrors()
        {
            using var connection = GetConnection();
            var errorDictionary = new Dictionary<int, ProInternal.Models.WH.ShippingErrorRecord>();

            var result = connection.Query<
                ProInternal.Models.WH.ShippingErrorRecord,
                ProInternal.Models.WH.ShippingErrorProduct,
                ProInternal.Models.WH.ShippingErrorRecord>(
                "GetShippingErrors",
                (error, product) =>
                {
                    if (!errorDictionary.TryGetValue(error.Id, out var errorEntry))
                    {
                        errorEntry = error;
                        errorEntry.Products = new List<ProInternal.Models.WH.ShippingErrorProduct>();
                        errorDictionary.Add(error.Id, errorEntry);
                    }

                    if (product != null && !string.IsNullOrEmpty(product.ProductCode))
                    {
                        errorEntry.Products.Add(product);
                    }

                    return errorEntry;
                },
                splitOn: "ProductCode",
                commandType: CommandType.StoredProcedure
            );

            return errorDictionary.Values;
        }






        public IEnumerable<MemberAddress> GetMemberShipping(string accountId)
        {
            using var connection = GetConnection();
            connection.Open();
            return connection.Query<MemberAddress>(
                "GetMemberShipping",
                new { AccountID = accountId },
                commandType: CommandType.StoredProcedure
            ).ToList();
        }

        public ProInternal.Models.WH.ShippingErrorRecord GetShippingErrorDetails(int id)
        {
            using var connection = GetConnection();
            connection.Open();

            using var multi = connection.QueryMultiple(
                "GetShippingErrorDetails",
                new { ErrorId = id },
                commandType: CommandType.StoredProcedure
            );

            var record = multi.Read<ProInternal.Models.WH.ShippingErrorRecord>().FirstOrDefault();
            if (record != null)
            {
                record.Products = multi.Read<ProInternal.Models.WH.ShippingErrorProduct>().ToList();
            }

            return record;
        }

        public void ProcessShippingError(int id, string type, string disposition)
        {
            using var connection = GetConnection();
            using var command = new SqlCommand("ProcessShippingError", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@ErrorId", id);
            command.Parameters.AddWithValue("@Type", type);
            command.Parameters.AddWithValue("@Disposition", string.IsNullOrEmpty(disposition) ? DBNull.Value : (object)disposition);

            connection.Open();
            command.ExecuteNonQuery();
        }

        public void ProcessGridShippingErrors(List<ProInternal.Models.WH.ShippingErrorRecord> errors)
        {
            foreach (var error in errors)
            {
                using var connection = GetConnection();
                using var command = new SqlCommand("ProcessGridShippingError", connection)
                {
                    CommandType = CommandType.StoredProcedure
                };

                command.Parameters.AddWithValue("@ErrorId", error.Id);
                // Assuming you want to pass disposition or other values
                command.Parameters.AddWithValue("@Disposition", DBNull.Value);

                connection.Open();
                command.ExecuteNonQuery();
            }
        }


        public void ToggleVendorWebStatus(int vendorId)
        {
            using var connection = GetConnection();
            using var command = new SqlCommand("ToggleVendorWebStatus", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@VendorId", vendorId);

            connection.Open();
            command.ExecuteNonQuery();
        }



        public IEnumerable<Subscription> GetSubscriptions()
        {
            using var connection = GetConnection();
            connection.Open();

            var subscriptions = connection.Query<Subscription>(
            "PIV2GetSubscriptions",     
            commandType: CommandType.StoredProcedure
        ).ToList();

        return subscriptions;
        }



        public void UpdateMemberImage(string accountNumber, string imageUrl)
        {
            using var connection = GetConnection();
            using var command = new SqlCommand("PIV2UpdateMemberImage", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@AccountNumber", accountNumber);
            command.Parameters.AddWithValue("@ImageUrl", imageUrl);

            connection.Open();
            command.ExecuteNonQuery();
        }



        public IEnumerable<Member> GetMembers(int memberTypeId)
        {
            using var connection = GetConnection();
            connection.Open();

            var members = connection.Query<Member>(
                "PIV2GetMembers",
                new { MemberType = memberTypeId },
                commandType: CommandType.StoredProcedure
            ).ToList();

            return members;
        }





        public IEnumerable<Vendor> GetVendors()
        {
            using var connection = GetConnection();
            connection.Open();

            var vendors = connection.Query<Vendor>(
                "PIV2GetVendors",
                commandType: CommandType.StoredProcedure
            ).ToList();

            // Map 'OnWeb' from int to "Yes"/"No" after retrieval
            foreach (var vendor in vendors)
            {
                // Assuming Vendor.OnWeb is a string property, convert it here
                vendor.OnWeb = (vendor.OnWeb == "1" || vendor.OnWeb == "True") ? "Yes" : "No";
            }

            return vendors;
        }


        public async Task<IEnumerable<OutstandingAccount>> GetAccountsWithOutstanding()
        {
            using var connection = GetConnection();
            // Stored procedure returns all accounts with gross outstanding
            var accounts = await connection.QueryAsync<OutstandingAccount>(
                "PIV2_GetAccountsWithOutstanding",
                commandType: CommandType.StoredProcedure);
            return accounts;
        }

        public async Task<IEnumerable<OutstandingInvoice>> GetInvoicesByAccount(string accountNumber)
        {
            using var connection = GetConnection();

            var parameters = new DynamicParameters();
            parameters.Add("@AccountNumber", accountNumber);

            var invoices = await connection.QueryAsync<OutstandingInvoice>(
                "PIV2_GetInvoicesByAccount",
                parameters,
                commandType: CommandType.StoredProcedure);

            return invoices;
        }


        public async Task<bool> SendInvoicesToMemberEmail(string accountNumber, string email)
        {
            using var connection = GetConnection();
            var parameters = new DynamicParameters();
            parameters.Add("@AccountNumber", accountNumber);
            parameters.Add("@Email", email);
            parameters.Add("@ReturnVal", dbType: DbType.Int32, direction: ParameterDirection.ReturnValue);

            await connection.ExecuteAsync(
                "PIV2SendInvoicesToMemberEmail",
                parameters,
                commandType: CommandType.StoredProcedure);

            var result = parameters.Get<int>("@ReturnVal");
            return result == 1;
        }


        


        public void UpdateVendorImage(int vendorId, string imageUrl)
        {
            using var connection = GetConnection();
            using var command = new SqlCommand("dbo.PIV2UpdateVendorImage", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@VendorId", vendorId);
            command.Parameters.AddWithValue("@ImageUrl", imageUrl ?? (object)DBNull.Value);

            connection.Open();
            command.ExecuteNonQuery();
        }



        public List<UserWithRoles> GetUsersWithRoles()
        {
            using (var connection = GetConnection())
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
            using var conn = GetConnection();
            var parameters = new { UserId = userId };
            conn.Execute("PIV2_EnableUser", parameters, commandType: CommandType.StoredProcedure);
        }


        public void DisableUser(int userId)
        {
            using var conn = GetConnection();
            conn.Execute("PIV2_DisableUser", new { userId }, commandType: CommandType.StoredProcedure);
        }

        public void DeleteUser(int userId)
        {
            using var conn = GetConnection();
            conn.Execute("PIV2_DeleteUser", new { userId }, commandType: CommandType.StoredProcedure);
        }


        public void AssignRoleToUser(int userId, string roleName)
        {
            using var conn = GetConnection();
            conn.Execute("PIV2_AssignRoleToUser", new { userId, roleName }, commandType: CommandType.StoredProcedure);
        }

        public void RemoveRoleFromUser(int userId, string roleName)
        {
            using var conn = GetConnection();
            conn.Execute("PIV2_RemoveRoleFromUser", new { userId, roleName }, commandType: CommandType.StoredProcedure);
        }


        public List<UserWithRoles> GetUserRoles(int userId)
        {
            using var conn = GetConnection();
            return conn.Query<UserWithRoles>("PIV2_GetUserRoles", new { userId }, commandType: CommandType.StoredProcedure).ToList();
        }


        public List<RoleDto> GetAllRoles()
        {
            using (var connection = GetConnection())
            {
                return connection.Query<RoleDto>(
                    "PIV2_GetAllRoles",
                    commandType: CommandType.StoredProcedure
                ).ToList();
            }
        }




        public List<string> GetPermissionsByRole(string roleName)
        {
            using (IDbConnection connection = GetConnection())
            {
                return connection.Query<string>(
                    "PIV2_GetPermissionsByRole",
                    new { RoleName = roleName },
                    commandType: CommandType.StoredProcedure
                ).ToList();
            }
        }

        public void CreatePermission(string permissionName, string description, string? routePath)
        {
            using var conn = GetConnection();
            conn.Execute("dbo.CreatePermission", new { permissionName, description, routePath }, commandType: CommandType.StoredProcedure);
        }



        public void RenamePermission(string oldName, string newName, string description)
        {
            using var conn = GetConnection();

            conn.Execute("dbo.RenamePermission", new { oldName, newName, description }, commandType: CommandType.StoredProcedure);
        }




        public void DeletePermission(string permissionName)
        {
            using var conn = GetConnection();
            conn.Execute("dbo.DeletePermission", new { permissionName }, commandType: CommandType.StoredProcedure);
        }




        public List<string> GetUserExtraPermissions(int userId)
        {
            using (var connection = GetConnection())
            {
                return connection.Query<string>("[PIV2_GetUserExtraPermissions]", new { UserId = userId }, commandType: CommandType.StoredProcedure).ToList();
            }
        }

        
        public void SaveUserExtraPermission(int userId, List<string> permissions)
        {
            using var conn = GetConnection();

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
            using (var connection = GetConnection())
            {

                connection.Execute("RemoveUserExtraPermission", new { UserId = userId, Permission = permission }, commandType: CommandType.StoredProcedure);
            }
        }



        public void ReplaceUserRoles(int userId, List<string> roles)
        {
            using (var connection = GetConnection())
            {
                var table = new DataTable();
                table.Columns.Add("RoleName", typeof(string));

                foreach (var role in roles)
                {
                    table.Rows.Add(role);
                }

                var parameters = new DynamicParameters();
                parameters.Add("@UserId", userId);
                parameters.Add("@Roles", table.AsTableValuedParameter("RoleNameTable"));

                connection.Execute("PIV2_ReplaceUserRoles", parameters, commandType: CommandType.StoredProcedure);
            }
        }






        public void AssignPermissionToRole(string roleName, List<string> permissionNames)
        {
            using var conn = GetConnection();
            foreach (var permission in permissionNames)
            {
                conn.Execute("PIV2_AssignPermissionToRole",
                    new { roleName, permissionName = permission },
                    commandType: CommandType.StoredProcedure);
            }
        }

        public void RemovePermissionFromRole(string roleName, List<string> permissionNames)
        {
            using var conn = GetConnection();
            foreach (var permission in permissionNames)
            {
                conn.Execute("PIV2_RemovePermissionFromRole",
                    new { roleName, permissionName = permission },
                    commandType: CommandType.StoredProcedure);
            }
        }



        public List<string> GetUserPermissions(int userId)
        {
            using var conn = GetConnection();
            return conn.Query<string>("PIV2_GetUserPermissions", new { userId }, commandType: CommandType.StoredProcedure).ToList();
        }


        public void CreateRole(string roleName, string roleDescription)
        {
            using (IDbConnection connection = GetConnection())
            {
                connection.Execute(
                    "PIV2_CreateRole",
                    new { RoleName = roleName, RoleDescription = roleDescription },
                    commandType: CommandType.StoredProcedure);
            }
        }

        public void RenameRole(string oldName, string newName)
        {
            using (IDbConnection connection = GetConnection())
            {
                connection.Execute(
                    "PIV2_RenameRole",
                    new { OldName = oldName, NewName = newName },
                    commandType: CommandType.StoredProcedure);
            }
        }

        public void DeleteRole(string roleName)
        {
            using (IDbConnection connection = GetConnection())
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
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<QuarterlyRebate>("StolenGoods_Get_Flat").ToList();
                return output;
            }
        }

        #endregion

        public List<QuarterlyDataSummary> getCurrentQuarterlyData()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<QuarterlyDataSummary>("QuarterlyGetRecentFileUpload").ToList();
                return output;
            }
        }

     
        public List<InvoiceRecord> GetInvoices()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<InvoiceRecord>("GetEzpayInvoices").ToList();

                return output;
            }
        }



        public List<VendorStock> GetVendorStock()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<VendorStock>("GetAllVendorStock").ToList();
               
                return output;
            }
        }


        public VendorUserResponse saveVendorUser(VendorUser user)
        {
            using (IDbConnection connection = GetConnection())
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
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<VendorSearch>("getAllVendors").ToList();
                
                return output;
            }
        }


        #region Authentication
        public LoginResponse login(string username, string password)
        {
            using (IDbConnection connection = GetConnection())
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


                    // 3. Third result set: Permissions (List<permission>)
                    var permissions = output.Read<Permission>().ToList();


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
                    //Console.WriteLine($"Login error: {ex.Message}");
                }

                return response;
            }
        }

       


        public bool MarkProductComplete(int shippingErrorId, int productId, string updatedBy)
        {
            using (IDbConnection connection = GetConnection())
            {
                var result = connection.Execute("ShippingError_MarkProductComplete",
                    new { ShippingErrorId = shippingErrorId, ProductId = productId, UpdatedBy = updatedBy },
                    commandType: CommandType.StoredProcedure);
                return result > 0;
            }
        }




        public List<PermissionDto> GetAllPermissions()
        {
            using (IDbConnection connection = GetConnection())
            {
                return connection.Query<PermissionDto>("PIV2_GetAllPermissions").ToList();
            }
        }


        public List<QuarterlyDataHistorical> getHistoricalQRData()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<QuarterlyDataHistorical>("GetQRHistorical").ToList();
                return output;
            }
        }
        
        public List<Notification> GetNotificationsForUser(int userId)
        {
            using (IDbConnection connection = GetConnection())
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
            using var connection = GetConnection();
            connection.Execute("MarkNotificationAsRead", new { Id = notificationId, UserId = userId }, commandType: CommandType.StoredProcedure);
        }

        public void DeleteNotification(int notificationId, int userId)
        {
            using var connection = GetConnection();
            connection.Execute("ArchiveUserNotification", new { Id = notificationId, UserId = userId }, commandType: CommandType.StoredProcedure);
        }




        public List<GatedProducts> getGatedRetailers()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<GatedProducts>("getGatedRetailers").ToList();
                return output;
            }
        }



        public List<MapViolation> GetExistingViolations(MapViolation violation)
        {
            using (IDbConnection db = GetConnection())
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
            using (IDbConnection connection = GetConnection())
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


            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<qrDetail>("PullQRVendorBatch @batchID, @programID", new { batchID = IntbatchID, programID = IntprogramID }).ToList();
                return output;
            }
        }


        
        public List<PatronageUpload> GetRecentPatronageLoad()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<PatronageUpload>("GetRecentPatronage").ToList();

                return output;
            }
        }


        public List<PatronageHistorical> GetPatronageHistorical()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<PatronageHistorical>("GetPatronageHistorical").ToList();

                return output;
            }
        }


        public bool activatePatronageBatch(string batchID, bool active)
        {
            using (IDbConnection connection = GetConnection())
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
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<PatronageUpload>("getPatronageBatchDetails @batchID", new { batchID = batchID }).ToList();
                return output;
            }
        }





        public bool deletePatronageLoad(string id)
        {
            using (IDbConnection connection = GetConnection())
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
            using (IDbConnection connection = GetConnection())
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
            using (IDbConnection connection = GetConnection())
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

        public void savePatronageData(List<PatronageUpload> data, DateTime issueDate)
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
            table.Columns.Add("IssueDate", typeof(DateTime));

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
                    ToDbDecimal(item.endingRetention),
                    issueDate
                );
            }



            var p = new DynamicParameters();
            p.Add("@PatronageUploads", table.AsTableValuedParameter("PatronageUploadTableType"));

            using (IDbConnection connection = GetConnection())
            {
                try
                {
                    var output = connection.Query<string>("InsertPatronageUploads", p, commandType: CommandType.StoredProcedure).FirstOrDefault();
                }
                catch (Exception e) { }
                finally { }
             
            }
        }





        public QuarterlyRebates saveData(QuarterlyRebates data, DateTime issueDate)
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
            p.Add("@IssueDate", issueDate);

            using (IDbConnection connection = GetConnection())
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
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<OrdersMetrics>("InternalOrdersMetrics").FirstOrDefault();

                if (output != null)
                {
                    output.dropShipThreshold = GetDropShipThreshold();
                }


                return output;
            }
        }

        public EDIMetrics GetEDIMetrics()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<EDIMetrics>("InternalEDISMetrics").FirstOrDefault();

                return output;
            }
        }


        public ShippingErrorMetrics getShippingErrorMetrics()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<ShippingErrorMetrics>("InternalShippingErrorMetrics").FirstOrDefault();

                return output;
            }
        }


        public CommecntsMetrics getCommentsrMetrics()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<CommecntsMetrics>("InternalCommentsMetrics").FirstOrDefault();
                return output;
            }
        }


        #endregion

        public List<MapViolation> GetAllMapViolations()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<MapViolation>("PIV2MapViolations_GetAll", commandType: CommandType.StoredProcedure).ToList();
                return output;
            }
        }



        public List<ProInternal.Models.Accounts.ShippingErrorRecord> getAccounts()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<ProInternal.Models.Accounts.ShippingErrorRecord>("GetAccounts").ToList();

                return output;
            }
        }

        public void ApplyCountryBrandExclusion(CountryBrandRequest data)
        {
            using (IDbConnection connection = GetConnection())
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
            using (IDbConnection connection = GetConnection())
            {         
                var output = connection.Query<Brands>("GetExcludedBrandsByCountry", new { country = country }).ToList();
                
                return output;
            }
        }


        public List<string> GetUniqueCountries()
        {
            using (IDbConnection connection = GetConnection())
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

            using (IDbConnection connection = GetConnection())
            {
                connection.Execute("InsertMemberBrandGating", parameters, commandType: CommandType.StoredProcedure);
            }
        }



        public List<Products> getProducts(string searchCriteria)
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<Products>("InternalGetProducts", new {searchCriteria =  searchCriteria }).ToList();

                return output;
            }
        }

        public List<MemberGateSummary> GetMemberGateSummary(string searchCriteria)
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<MemberGateSummary>("GetMemberGateSummarys", new { searchCriteria = searchCriteria }).ToList();

                return output;
            }
        }
     

        public List<Products> QuickSearchProducts()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<Products>("GetProducts").ToList();
                return output;
            }
        }


        public List<Brands> getBrands()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<Brands>("GetBrands").ToList();
                return output;
            }
        }


        public List<SpecialOrdersSummary> getOrdersSnapshot()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<SpecialOrdersSummary>("InternalOrdersSnapshot").ToList();

                return output;
            }
        }




		#region Exclusions
        public int Exclusion_CreateGroup(string groupName) {
			using (IDbConnection connection = GetConnection()) {
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

			using (IDbConnection connection = GetConnection()) {
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
			using (IDbConnection connection = GetConnection()) {
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
			using (IDbConnection connection = GetConnection()) {
				connection.Execute("Exclusions_ExcludeCompanyBrands", p, commandType: CommandType.StoredProcedure);
			}
		}

        public List<CompanyBrandExclusion> Exclusions_GetCompanyBrandExclusions(int companyID) {
			using (IDbConnection connection = GetConnection()) {
				var output = connection.Query<CompanyBrandExclusion>("Exclusions_GetCompanyBrandExclusions @CompanyID", new { CompanyID = companyID}).ToList();
				return output;
			}
		}

        public List<CompanyDto> GetCompaniesAssignedToGroupAsync(int groupId)
        {
            using (IDbConnection connection = GetConnection())
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
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<Products>("GetUnassignedProducts").ToList();
              
                return output;
            }
        }



        public List<ProductExclusionGroup> Exclusions_GetExclusionGroups() {
			using (IDbConnection connection = GetConnection()) {
				var output = connection.Query<ProductExclusionGroup>("Exclusions_GetExclusionGroups").ToList();
				return output;
			}
        }

        public List<ProductExclusionGroupProduct> Exclusions_GetExclusionGroupProducts(int productExclusionGroupID) { 
 			using (IDbConnection connection = GetConnection()) {
				var output = connection.Query<ProductExclusionGroupProduct>("Exclusions_GetExclusionGroupProducts @ProductExclusionGroupID", new { ProductExclusionGroupID = productExclusionGroupID }).ToList();
				return output;
			}
       }

        public List<CompanyGroupExclusion> Exclusions_GetCompanyGroupExclusions(int companyID) {
			using (IDbConnection connection = GetConnection()) {
				var output = connection.Query<CompanyGroupExclusion>("Exclusions_GetCompanyGroupExclusions @CompanyID", new { CompanyID = companyID }).ToList();
				return output;
			}

        }
		#endregion

	}
}
#endregion