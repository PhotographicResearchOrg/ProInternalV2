using Dapper;
using Microsoft.Data.SqlClient;
using ProInternal.Helpers;
using ProInternal.Models.Accounting;
using ProInternal.Models.Dashboard;
using ProInternal.Models.EzPaySummary;
using ProInternal.Models.InstantRebates;
using ProInternal.Models.Vendor;
using ProInternal.Models.WH;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Data.SqlClient;
using System.Linq;
using System.Reflection.Metadata;
using System.Threading.Tasks;



namespace ProInternal.Services
{
    public class EDADataAccess : BaseDataAccess, IEDADataAccess
    {
        public EDADataAccess(IConfiguration config, AwsSecretHelper helper)
            : base(config, helper, "EdaConnectionString")
        {
        }



        public async Task<IEnumerable<EzPaySummary>> GetEzPaySummary(DateTime daDate)
        {
            using (IDbConnection connection = GetConnection())
            {
                var parameters = new DynamicParameters();
                parameters.Add("@daDate", daDate);

                try
                {
                    var result = await connection.QueryAsync<EzPaySummary>(
                        "GetEzPaySummary", parameters, commandType: CommandType.StoredProcedure);
                    return result;
                }
                catch
                {
                    return Enumerable.Empty<EzPaySummary>();
                }
            }
        }

        public void SetCreditEmailFlag(string invoiceNumber, bool include)
        {
            using var conn = GetConnection();

                conn.Execute(@"
            MERGE AccountingCreditInvoices AS target
            USING (SELECT @InvoiceNumber AS InvoiceNumber) AS src
            ON target.InvoiceNumber = src.InvoiceNumber

            WHEN MATCHED THEN
                UPDATE SET IncludeInEmail = @Include

            WHEN NOT MATCHED THEN
                INSERT (InvoiceNumber, IncludeInEmail)
                VALUES (@InvoiceNumber, @Include);
        ", new
            {
                InvoiceNumber = invoiceNumber,
                Include = include
            });
        }


        public IEnumerable<ShipmentRecord> GetShipments()
        {
            using var conn = GetConnection();

            return conn.Query<ShipmentRecord>(
                "Warehouse_GetShipments",
                commandType: CommandType.StoredProcedure
            );
        }


        public void RetireShipment(string tracking)
        {
            using var conn = GetConnection();

            conn.Execute(
                "Warehouse_RetireShipment",
                new { TrackingNumber = tracking },
                commandType: CommandType.StoredProcedure
            );
        }



        public IEnumerable<ShipmentEventRecord> GetShipmentEvents(string trackingNumber)
        {
            using var conn = GetConnection();

            return conn.Query<ShipmentEventRecord>(
                "Warehouse_GetShipmentEvents",
                new { TrackingNumber = trackingNumber },
                commandType: CommandType.StoredProcedure
            );
        }



        public void SaveSubscription(ShipmentSubscription sub)
        {
            using var conn = GetConnection();

            conn.Execute(
                "Warehouse_SaveSubscription",
                new
                {
                    sub.UserId,
                    sub.Name,
                    sub.Account,
                    sub.Zone,
                    sub.SLAStatus,
                    sub.MinDays
                },
                commandType: CommandType.StoredProcedure
            );
        }

        public IEnumerable<ShipmentSubscription> GetSubscriptions(int userId)
        {
            using var conn = GetConnection();

            return conn.Query<ShipmentSubscription>(
                "Warehouse_GetSubscriptions",
                new { UserId = userId },
                commandType: CommandType.StoredProcedure
            );
        }



        public async Task<PackingSlipData> GetPackingSlipData(int shippingErrorId)
        {
            using (IDbConnection connection = GetConnection())
            {
                var parameters = new DynamicParameters();
                parameters.Add("@ShippingErrorId", shippingErrorId);

                try
                {
                    var result = new PackingSlipData();

                    // Use Dapper to execute the stored procedure and get the results
                    using (var multi = await connection.QueryMultipleAsync(
                        "ShippingError_GetPackingSlipSummary", parameters, commandType: CommandType.StoredProcedure))
                    {
                        // Fetch the header part of the packing slip
                        result.Header = await multi.ReadSingleOrDefaultAsync<PackingSlipHeader>();

                        // Fetch the product details for the packing slip
                        result.Products = (await multi.ReadAsync<PackingSlipProduct>()).ToList();
                    }

                    return result;
                }
                catch (Exception ex)
                {
                    // Optionally log the exception here
                    return null;
                }
            }
        }



        public async Task<IEnumerable<EzPayDetail>> GetEzPayDetail(DateTime daDate)
        {
            using (IDbConnection connection = GetConnection())
            {
                var parameters = new DynamicParameters();
                parameters.Add("@daDate", daDate);

                try
                {
                    var result = await connection.QueryAsync<EzPayDetail>(
                        "GetEzPayDetail", parameters, commandType: CommandType.StoredProcedure);
                    return result;
                }
                catch
                {
                    return Enumerable.Empty<EzPayDetail>();
                }
            }
        }







        public List<PanaAccount> GetAllPanaAccounts()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<PanaAccount>("GetAllPanaAccounts").ToList();
                return output;
            }
        }

        public List<PanaRep> GetAllPanaReps()
        {
            using (IDbConnection connection = GetConnection())
            {
                var output = connection.Query<PanaRep>("GetAllPanaReps").ToList();
                return output;
            }
        }



        public async Task<PanaRep> SavePanaRep(PanaRep rep)
        {
            using (IDbConnection connection = GetConnection())
            {
                var parameters = new DynamicParameters();
                parameters.Add("@RepName", rep.RepName);
                parameters.Add("@Email", rep.Email);
                parameters.Add("@Id", rep.Id, dbType: DbType.Int32, direction: ParameterDirection.InputOutput);

                try
                {
                    var result = await connection.QueryAsync<PanaRep>(
                        "SavePanaRep",
                        parameters,
                        commandType: CommandType.StoredProcedure
                    );

                    rep.Id = parameters.Get<int>("@Id");
                    return rep;
                }
                catch (Exception ex)
                {
                    // Optionally log
                    return new PanaRep();
                }
            }
        }

        public async Task<bool> DeletePanaRep(int id)
        {
            using (IDbConnection connection = GetConnection())
            {
                var parameters = new DynamicParameters();
                parameters.Add("@Id", id);

                try
                {
                    await connection.ExecuteAsync("DeletePanaRep", parameters, commandType: CommandType.StoredProcedure);
                    return true;
                }
                catch
                {
                    return false;
                }
            }
        }

        public async Task<bool> DeletePanaAccount(string meca)
        {
            using (IDbConnection connection = GetConnection())
            {
                var parameters = new DynamicParameters();
                parameters.Add("@Id", meca);

                try
                {
                    await connection.ExecuteAsync("DeletePanaAccount", parameters, commandType: CommandType.StoredProcedure);
                    return true;
                }
                catch
                {
                    return false;
                }
            }
        }



        public async Task<PanaAccount> SavePanaAccount(PanaAccount account)
        {
            using (IDbConnection connection = GetConnection())
            {
                var parameters = new DynamicParameters();
                parameters.Add("@Meca", account.Meca);
                parameters.Add("@AccountNumber", account.AccountNumber);
                parameters.Add("@AccountName", account.AccountName);
                parameters.Add("@RepId", account.RepId);
                parameters.Add("@Id", account.ID, DbType.Int32, ParameterDirection.InputOutput);

                try
                {
                    var result = await connection.QueryAsync<PanaAccount>(
                        "SavePanaAccount",
                        parameters,
                        commandType: CommandType.StoredProcedure
                    );

                    account.ID = parameters.Get<int>("@Id");
                    return account;

                }
                catch (Exception ex)
                {
                    return new PanaAccount();
                }
            }
        }




    }
}