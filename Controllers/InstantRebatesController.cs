using Microsoft.AspNetCore.Mvc;
using ProInternal.Services;
using ProInternal.Models.InstantRebates;
using ProInternal.Models.Accounting;


namespace ProInternal.Controllers
{
  
    [Route("api/[controller]")]
    [ApiController]
    public class InstantRebatesController : ControllerBase
    {

        private IProDataAccess _prodataAccess;
        private IDRADataAccess _dradataAccess;
        private INukeDataAccess _nukedataAccess;
        public InstantRebatesController(IProDataAccess proDataAccess, IDRADataAccess DRADataAccess, INukeDataAccess nukedataAccess)
        {
            _prodataAccess = proDataAccess;
            _dradataAccess = DRADataAccess;
            _nukedataAccess = nukedataAccess;
        }

        [HttpGet]
        [Route("GetInstantRebateBatches")]
        public List<IR> GetInstantRebateBatches()
        {
            List<IR> Summary = this._nukedataAccess.GetInstantRebateBatches().ToList();

            return Summary;
        }



        [HttpPut]
        [Route("activateIRBatch/{batchID}")]
        public bool activateIRBatch(int batchID)
        {
            return this._nukedataAccess.activateIRBatch(batchID);

        }

  

        [HttpGet]
        [Route("getIRBatchDetail/{batchID}")]
        public List<IR> getQRBatchDetail(int batchID)
        {
            List<IR> Summary = this._nukedataAccess.getIRBatchDetail(batchID).ToList();
            return Summary;
        }

    }
}
