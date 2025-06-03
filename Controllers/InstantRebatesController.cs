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


        [HttpGet("GetDeclinedRebateOrder")]
        public IActionResult GetDeclinedRebateOrder([FromQuery] int orderId)
        {
            var summary = _nukedataAccess.GetDeclinedInstantRebates()
                                         .Where(x => x.OrderID == orderId)
                                         .ToList();

            if (!summary.Any())
                return NotFound();

            return Ok(summary);
        }



        [HttpPost]
        [Route("UploadIRFile")]
        public async Task<IActionResult> UploadIRFile([FromForm] IFormFile file, [FromForm] int orderId)
        {


            if (file == null || file.Length == 0)
                return BadRequest("Invalid file");

            var safeFileName = Path.GetFileName(file.FileName);
            var uploadDir = Path.Combine(@"\\YourServer\ProofShare"); // use UNC or local
            //var fullPath = Path.Combine(uploadDir, $"{orderId}_{safeFileName}");
            var uncPath = $@"\\10.0.0.13\Temp\uploads\Master\{orderId}_{safeFileName}";
            try
            {
                using (var stream = new FileStream(uncPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

            
                // Save to DB
                _nukedataAccess.InsertAdditionalFile(orderId, safeFileName);
                _nukedataAccess.MarkAsHasAdditionalFiles(orderId); // sets MasterFileLoc = 'Additional Files' if not already



                return Ok();

            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Upload error: {ex.Message}");
            }
        }



        [HttpPost("resubmit")]
        public IActionResult ResubmitRebateOrder([FromBody] int orderId)
        {
            if (orderId <= 0)
                return BadRequest("Invalid order ID");

            try
            {
                _nukedataAccess.ResubmitOrderToQueue(orderId);
                return Ok(new { success = true, message = "Order resubmitted successfully." });
            }
            catch (Exception ex)
            {
           
                return StatusCode(500, "An error occurred while resubmitting the order.");
            }
        }


        [HttpPost("ConfirmDecline")]
        public IActionResult ConfirmDecline([FromBody] int orderId)
        {

            _nukedataAccess.ConfirmDecline(orderId);
            return Ok();
        }
    



    [HttpDelete]
        [Route("DeleteIRFile/{orderId}/{filename}")]
        public IActionResult DeleteIRFile(int orderId, string filename)
        {
            if (orderId <= 0 || string.IsNullOrWhiteSpace(filename))
                return BadRequest("Invalid input.");


            var safeFilename = Path.GetFileName(filename); // Prevent path traversal
            var proofDirectory = Path.Combine("C:\\Path\\To\\Proof"); // adjust as needed
            //var fullPath = Path.Combine(proofDirectory, $"{orderId}_{safeFilename}");
            var uncPath = $@"\\10.0.0.13\Temp\uploads\Master\{orderId}_{safeFilename}";
            try
            {
                // 1. Delete physical file if it exists
                if (System.IO.File.Exists(uncPath))
                {
                    System.IO.File.Delete(uncPath);
                }
                // 2. Delete from database
                this._nukedataAccess.DeleteRebateProofFile(orderId, safeFilename);
                return Ok();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error deleting file: {ex.Message}");
            }
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
