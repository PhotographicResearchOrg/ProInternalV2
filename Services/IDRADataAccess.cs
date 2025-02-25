using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ProInternal.Models.Accounting;
using ProInternal.Models.Dashboard;
using ProInternal.Services;
using System;

namespace ProInternal.Services
{
    public interface IDRADataAccess
    {
        SARSMetrics GetSARSMetrics();
    }
}
