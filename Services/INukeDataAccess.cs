using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ProInternal.Models.Accounting;
using ProInternal.Models.Dashboard;
using ProInternal.Models.InstantRebates ;
using System;

namespace ProInternal.Services
{
    public interface INukeDataAccess
    {
        IRMetrics GetIRMetrics();
        List<IR> GetInstantRebateBatches();
        bool activateIRBatch(int batchID);
        List<IR> getIRBatchDetail(int batchID);

        List<DeclinedIR> GetDeclinedInstantRebates();
        

    }

}
