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
        public VendorController(IProDataAccess proDataAccess, IDRADataAccess DRADataAccess, INukeDataAccess nukedataAccess)
        {
            _prodataAccess = proDataAccess;
            _dradataAccess = DRADataAccess;
            _nukedataAccess = nukedataAccess;
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
