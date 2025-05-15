using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using ProInternal.Models.Accounting;
using ProInternal.Models.Dashboard;
using ProInternal.Models.InstantRebates;
using ProInternal.Models.Vendor;
using Microsoft.Data.SqlClient;
using System.Reflection.Metadata;




namespace ProInternal.Services
{
    public class EDADataAccess : IEDADataAccess
    {

        private string _connectionString { get; set; }

        public EDADataAccess(string connectionString)
        {
            _connectionString = connectionString;
        }


        public List<PanaAccount> GetAllPanaAccounts()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<PanaAccount>("GetAllPanaAccounts").ToList();
                return output;
            }
        }

        public List<PanaRep> GetAllPanaReps()
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
            {
                var output = connection.Query<PanaRep>("GetAllPanaReps").ToList();
                return output;
            }
        }



        public async Task<PanaRep> SavePanaRep(PanaRep rep)
        {
            using (IDbConnection connection = new SqlConnection(_connectionString))
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
            using (IDbConnection connection = new SqlConnection(_connectionString))
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
            using (IDbConnection connection = new SqlConnection(_connectionString))
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
            using (IDbConnection connection = new SqlConnection(_connectionString))
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