using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using ProInternal.Services;
using ProInternal.Models.Dashboard;
using Microsoft.AspNetCore.Cors;
using Microsoft.Data.SqlClient;


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



        [HttpPost("vendors/{vendorId}/upload-image")]
        public async Task<IActionResult> UploadVendorImage(int vendorId, [FromForm] IFormFile image)
        {
            if (image == null || image.Length == 0)
                return BadRequest("Image is required");

            var fileName = $"{vendorId}.jpg";
            var folderPath = Path.Combine("wwwroot", "vendor-images");
            var filePath = Path.Combine(folderPath, fileName);

            Directory.CreateDirectory(folderPath);

            using var stream = new FileStream(filePath, FileMode.Create);
            await image.CopyToAsync(stream);

            var imageUrl = $"/vendor-images/{fileName}";

            _prodataAccess.UpdateVendorImage(vendorId, imageUrl); // Your DAL update method

            return Ok(new { imageUrl });
        }





        [HttpPost("members/{accountNumber}/upload-image")]
        public async Task<IActionResult> UploadMemberImage(string accountNumber, [FromForm] IFormFile image)
        {
            if (image == null || image.Length == 0)
                return BadRequest("Image is required");

            var fileName = $"{accountNumber}.jpg";
            var folderPath = Path.Combine("wwwroot", "member-images");
            var filePath = Path.Combine(folderPath, fileName);

            Directory.CreateDirectory(folderPath);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await image.CopyToAsync(stream);
            }

            var imageUrl = $"/member-images/{fileName}";


            _prodataAccess.UpdateMemberImage(accountNumber, imageUrl);

            return Ok(new { imageUrl });
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
