using Microsoft.AspNetCore.Mvc;
using ProInternal.Services;
using ProInternal.Models.InstantRebates;

using ProInternal.Models.Accounting;
using static System.Runtime.InteropServices.JavaScript.JSType;


namespace ProInternal.Controllers
{
  
    [Route("api/[controller]")]
    [ApiController]
    public class InstantRebatesController : ControllerBase
    {
        private IWebHostEnvironment _env;
        private IProDataAccess _prodataAccess;
        private IDRADataAccess _dradataAccess;
        private INukeDataAccess _nukedataAccess;

        public InstantRebatesController(IProDataAccess proDataAccess, IDRADataAccess DRADataAccess, INukeDataAccess nukedataAccess, IWebHostEnvironment env)
        {
            _prodataAccess = proDataAccess;
            _dradataAccess = DRADataAccess;
            _nukedataAccess = nukedataAccess;
            _env = env;
        }

        [HttpGet]
        [Route("GetInstantRebateBatches")]
        public List<IR> GetInstantRebateBatches()
        {
            List<IR> Summary = this._nukedataAccess.GetInstantRebateBatches().ToList();

            return Summary;
        }


      
            [HttpGet]
            [Route("GetDeclinedInstantRebates")]
            public List<DeclinedIR> GetDeclinedInstantRebates()
            {
                List<DeclinedIR> Summary = this._nukedataAccess.GetDeclinedInstantRebates().ToList();

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




        [HttpPost("addRebateVendor")]
        public IActionResult AddRebateVendor([FromBody] RebateVendor vendor)
        {
            var createdVendor = _nukedataAccess.AddRebateVendor(vendor);
            return Ok(createdVendor);
        }


        [HttpPut("updateRebateVendor/{id}")]
        public IActionResult UpdateRebateVendor(int id, [FromBody] RebateVendor vendor)
        {
            _nukedataAccess.UpdateRebateVendor(id, vendor);
            return Ok();
        }


        [HttpDelete("deleteRebateVendor/{id}")]
        public IActionResult DeleteRebateVendor(int id)
        {
            _nukedataAccess.DeleteRebateVendor(id);
            return Ok();
        }









        [HttpGet]
        [Route("getAllParentCompanies")]
        public List<ParentIRCompany> GetAllParentCompanies()
        {
            return _nukedataAccess.GetAllParentIRCompanies();
        }


        [HttpPost("addParentCompany")]
        public IActionResult AddParentCompany([FromBody] ParentIRCompany company)
        {
            if (string.IsNullOrWhiteSpace(company.CompanyName))
                return BadRequest("Company name is required.");

            var newId = _nukedataAccess.AddParentIRCompany(company.CompanyName, company.ImageUrl);

            var created = new ParentIRCompany
            {
                ID = newId,
                CompanyName = company.CompanyName,
                ImageUrl = company.ImageUrl
            };

            return Ok(created);
        }



        [HttpGet("getAllRebateVendors")]
        public IActionResult GetAllRebateVendors()
        {
            var vendors = _nukedataAccess.GetAllRebateVendors();
            return Ok(vendors);
        }


        [HttpPut("updateParentCompany/{id}")]
        public IActionResult UpdateParentCompany(int id, [FromBody] ParentIRCompany company)
        {
            _nukedataAccess.UpdateParentIRCompany(company.ID, company.CompanyName, company.ImageUrl);
            return Ok();
        }


        [HttpDelete]
        [Route("deleteParentCompany/{id}")]
        public IActionResult DeleteParentCompany(int id)
        {
            _nukedataAccess.DeleteParentIRCompany(id);
            return Ok();
        }


        [HttpPost("uploadParentImage")]
        [Consumes("multipart/form-data")]
        public IActionResult UploadParentImage([FromForm] IFormFile file, [FromForm] string location)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");


            

            var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads", location);
            Directory.CreateDirectory(uploadsFolder);

            var uniqueFileName = Guid.NewGuid().ToString() + Path.GetExtension(file.FileName);
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                file.CopyTo(stream);
            }

            var imageUrl = $"/uploads/{location}/{uniqueFileName}";
            return Ok(imageUrl);
        }






    }
}
