using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using ProInternal.Services;
using ProInternal.Models.Dashboard;
using Microsoft.AspNetCore.Cors;


namespace ProInternal.Controllers
{

    [Route("api/[controller]")]
    [ApiController]
    public class ListingsController : ControllerBase
    {

        private IProDataAccess _prodataAccess;
        private IDRADataAccess _dradataAccess;
        private INukeDataAccess _nukedataAccess;

        public ListingsController(IProDataAccess proDataAccess, IDRADataAccess DRADataAccess, INukeDataAccess nukedataAccess)
        {
            _prodataAccess = proDataAccess;
            _dradataAccess = DRADataAccess;
            _nukedataAccess = nukedataAccess;
        }

        [HttpGet("members")]
        public IActionResult GetMembers([FromQuery] string type = "Members")
        {
            int typeId = type switch
            {
                "Affiliates" => 2,
                "Clients" => 3,
                _ => 1 // Members
            };

            var members = _prodataAccess.GetMembers(typeId);
            return Ok(members);
        }

        [HttpGet("subscriptions")]
        public IActionResult GetSubscriptions()
        {
            var subs = _prodataAccess.GetSubscriptions();
            return Ok(subs);
        }


        [HttpGet("members/{accountId}/shipping")]
        public IActionResult GetMemberShipping(string accountId)
        {
            var addresses = _prodataAccess.GetMemberShipping(accountId);
            return Ok(addresses);
        }



        [HttpPost("vendors/{id}/toggle-web")]
        public IActionResult ToggleVendorWebStatus(int id)
        {
            _prodataAccess.ToggleVendorWebStatus(id);
            return Ok();
        }


        [HttpGet("vendors")]
        public IActionResult GetVendors()
        {
            var vendors = _prodataAccess.GetVendors();
            return Ok(vendors);
        }


    }
}
