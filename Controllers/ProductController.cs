using Microsoft.AspNetCore.Mvc;
using ProInternal.Services;
using ProInternal.Models.InstantRebates;

using ProInternal.Models.Accounting;
using static System.Runtime.InteropServices.JavaScript.JSType;


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

        //getGatedRetailers

    }
}
