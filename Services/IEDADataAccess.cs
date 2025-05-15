using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ProInternal.Models.Accounting;
using ProInternal.Models.Dashboard;
using ProInternal.Models.InstantRebates ;
using System;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory.Database;
using ProInternal.Models.Vendor;


namespace ProInternal.Services
{
    public interface IEDADataAccess
    {


        List<PanaRep> GetAllPanaReps();

        List<PanaAccount> GetAllPanaAccounts();


        Task<PanaRep> SavePanaRep(PanaRep rep);
        Task<PanaAccount> SavePanaAccount(PanaAccount account);


        Task<bool> DeletePanaRep(int id);
        Task<bool> DeletePanaAccount(string meca);

    }

}
