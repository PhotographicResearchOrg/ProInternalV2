using Microsoft.AspNetCore.Mvc;
using ProInternal.Services;
using ProInternal.Models.Accounting;
using static System.Runtime.InteropServices.JavaScript.JSType;
using ProInternal.Models.Dashboard;


namespace ProInternal.Controllers
{
  
    [Route("api/[controller]")]
    [ApiController]
    public class ProductController : ControllerBase
    {
        private IProDataAccess _prodataAccess;
        private IDRADataAccess _dradataAccess;
        private INukeDataAccess _nukedataAccess;
        public ProductController(IProDataAccess proDataAccess, IDRADataAccess DRADataAccess, INukeDataAccess nukedataAccess)
        {
            _prodataAccess = proDataAccess;
            _dradataAccess = DRADataAccess;
            _nukedataAccess = nukedataAccess;
        }


        [HttpGet]
        [Route("getGatedRetailers")]
        public List<GatedProducts> getGatedRetailers()
        {
            List<GatedProducts> Summary = this._prodataAccess.getGatedRetailers().ToList();

            return Summary;
        }



    }
}
