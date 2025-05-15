using Microsoft.AspNetCore.Mvc;
using ProInternal.Services;
using ProInternal.Models.Accounting;
using static System.Runtime.InteropServices.JavaScript.JSType;
using ProInternal.Models.Dashboard;
using ProInternal.Models.Exclusions;
using ProInternal.Models.Products;
using System.ComponentModel.Design;
using ProInternal.Models.Vendor;
using Microsoft.Data.SqlClient;
using System.Data;
using Dapper;
using Microsoft.EntityFrameworkCore;
using System.Numerics;
using Azure.Core;


namespace ProInternal.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
 
    public class VendorController : ControllerBase
    {
        private IProDataAccess _prodataAccess;
        private IDRADataAccess _dradataAccess;
        private INukeDataAccess _nukedataAccess;
        private IEDADataAccess _edadataAccess;

        public VendorController(IProDataAccess proDataAccess, IDRADataAccess DRADataAccess, INukeDataAccess nukedataAccess, IEDADataAccess edadataAccess)
        {
            _prodataAccess = proDataAccess;
            _dradataAccess = DRADataAccess;
            _nukedataAccess = nukedataAccess;
            _edadataAccess = edadataAccess;
        }



      
        [HttpGet("panareps")]
        public IActionResult GetAllReps()
        {
            var reps = this._edadataAccess.GetAllPanaReps();
            return Ok(reps);
     
        }


        [HttpGet("panaaccounts")]
        public IActionResult GetAllAccounts()
        {
            var accounts = this._edadataAccess.GetAllPanaAccounts();
            return Ok(accounts);
        }



        [HttpPost("savepanarep")]
        public async Task<ActionResult<PanaRep>> SaveRep([FromBody] PanaRep rep)
        {
            var saved = await this._edadataAccess.SavePanaRep(rep);
            return Ok(saved);
        }

        [HttpPost("savepanaaccount")]
        public async Task<ActionResult<PanaAccount>> SaveAccount([FromBody] PanaAccount account)
        {
            var saved = await this._edadataAccess.SavePanaAccount(account);
            return Ok(saved);
        }




        [HttpDelete("deletepanarep/{id}")]
        public async Task<IActionResult> DeleteRep(int id)
        {
            var success = await _edadataAccess.DeletePanaRep(id);
            return success ? Ok() : StatusCode(500, "Failed to delete rep.");
        }


        [HttpDelete("deletepanaaccount/{meca}")]
        public async Task<IActionResult> DeleteAccount(string meca)
        {
            var success = await _edadataAccess.DeletePanaAccount(meca);
            return success ? Ok() : StatusCode(500, "Failed to delete account.");
        }




        [HttpGet("vendorstock")]
        public List<VendorStock> GetVendorStock()
        {
            List<VendorStock> reuslt = this._prodataAccess.GetVendorStock().ToList();
            return reuslt;
        }


        [HttpGet("getAllVendors")]
        public IActionResult getAllVendors()
        {
            List<VendorSearch> results = this._prodataAccess.getAllVendors(); // Your service logic here
            return Ok(results); // Should return List<{ id, name }>
        }


        [HttpPost("saveVendorUser")]
        public async Task<IActionResult> saveVendorUser([FromBody] VendorUser vendorUser)
        {
            if (vendorUser == null)
            {
                return BadRequest("Invalid data.");
            }

            // Ensure that the 'company' is not null and has a valid ID
            if (vendorUser.CompanyId > 0 )
            {
                var data =  this._prodataAccess.saveVendorUser(vendorUser);
                // Return the result with the UserId
                return Ok(new { Status = data.Status, UserId = data.UserId });
          
            }
            else
            {
                return BadRequest("Invalid company data.");
            }
        }


    }
}
