using Microsoft.AspNetCore.Mvc;
using ProInternal.Services;
using ProInternal.Models.Accounting;
using static System.Runtime.InteropServices.JavaScript.JSType;
using ProInternal.Models.Shared;
using ProInternal.Models.EditProduct;
using ProInternal.Models.Dashboard;
using ProInternal.Models.Exclusions;
using ProInternal.Models.Products;
using System.ComponentModel.Design;
using ProInternal.Models;
using Microsoft.Data.SqlClient;
using System.Data;
using Dapper;


namespace ProInternal.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
 
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

        [HttpGet]
        [Route("exclusion/groups")]
        public List<ProductExclusionGroup> getExclusionGroups() {
            return this._prodataAccess.Exclusions_GetExclusionGroups();
        }


        [HttpGet]
        [Route("mapviolations")]
        public List<MapViolation> GetAllMapViolations()
        {
            return this._prodataAccess.GetAllMapViolations();
       
        }




        [HttpGet("getCountryExcludedBrands")]
        public IActionResult GetCountryExcludedBrands([FromQuery] string country)
        {
            try
            {
                var restrictedBrands = _prodataAccess.GetExcludedBrandsByCountry(country);
                return Ok(restrictedBrands);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Failed to retrieve excluded brands.");
            }
        }


        [HttpGet("getUniqueCountries")]
        public IActionResult GetUniqueCountries()
        {
            try
            {
                var countries = _prodataAccess.GetUniqueCountries();

                return Ok(countries);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Failed to retrieve countries.");
            }
        }

        [HttpPost("apply-country-exclusion")]
        public IActionResult ApplyCountryBrandExclusion([FromBody] CountryBrandRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Country) )
                {
                    return BadRequest(new ApiResponse { Success = false });
                }
                 _prodataAccess.ApplyCountryBrandExclusion(request);
                return Ok(new ApiResponse { Success = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse { Success = false });
            }
        }

        [HttpGet]
        [Route("exclusion/group/{groupID}")]
        public List<ProductExclusionGroupProduct> getExclusionGroupProducts(int groupID) {
            return this._prodataAccess.Exclusions_GetExclusionGroupProducts(groupID);
        }
        [HttpGet]
        [Route("exclusion/groups/{companyID}")]
        public List<CompanyGroupExclusion> getCompanyExclusionGroups(int companyID) {
            return this._prodataAccess.Exclusions_GetCompanyGroupExclusions(companyID);
        }

        [HttpGet]
        [Route("exclusion/brands/{companyID}")]
        public List<CompanyBrandExclusion> GetCompanyBrandExclusions(int companyID) {
            return this._prodataAccess.Exclusions_GetCompanyBrandExclusions(companyID);
        }

        [HttpPost]
        [Route("exclusion/group")]
        public int CreateExclusionGroup([FromBody] string groupName) {
            return this._prodataAccess.Exclusion_CreateGroup(groupName);
        }

        [HttpPost]
        [Route("exclusion/group/{productExclusionGroupID}")]
        public void AddProductsToExclusionGroup(int productExclusionGroupID, List<string> productCodes) {
            this._prodataAccess.Exclusion_AddProductsToGroup(productExclusionGroupID, productCodes);
        }

        [HttpPost]
        [Route("exclusion/group/add/{companyID}")]
        public void AddCompanyExclusionGroups(int companyID, [FromBody] List<int> productExclusionGroupIds) {
            this._prodataAccess.Exclusion_ExcludeCompanyGroups(companyID, productExclusionGroupIds);
        }

        [HttpPost]
        [Route("exclusion/brand/add/{companyID}")]
        public void AddCompanyBrandExclusion(int companyID, [FromBody] List<int> brandIds) {
            this._prodataAccess.Exclusions_ExcludeCompanyBrands(companyID, brandIds);
        }


        [HttpGet("unassigned")]
        public async Task<ActionResult<List<Products>>> GetUnassignedProducts()
        {
            var products =  this._prodataAccess.GetUnassignedProductsAsync();

            return Ok(products);

        }


        [HttpGet("exclusiongroups/{groupId}/companies")]
        public async Task<ActionResult<List<CompanyDto>>> GetCompaniesForGroup(int groupId)
        {
            var companies = this._prodataAccess.GetCompaniesAssignedToGroupAsync(groupId);
            return Ok(companies);
        }



        [HttpPost("assignbrands")]
        public IActionResult AssignBrandsToMember([FromBody] GatingAssignment assignment)
        {
            try
            {
                _prodataAccess.AssignBrandsToMember(assignment);

                var response = new ApiResponse
                {
                    Success = true,
                    Message = $"Brands successfully modifed to account {assignment.AccountNumber}."
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                var response = new ApiResponse
                {
                    Success = false,
                    Message = $"An error occurred while modifying brands: {ex.Message}"
                };

                return StatusCode(500, response);
            }
        }


        [HttpPost("submitMapViolation")]
        public IActionResult SubmitMapViolation([FromBody] MapViolation violation)
        {
            try
            {
                if (violation == null || string.IsNullOrWhiteSpace(violation.AccountNumber) || string.IsNullOrWhiteSpace(violation.ProductCode))
                {
                    return BadRequest("Invalid request. Account number and product code are required.");
                }

                var result = _prodataAccess.GetExistingViolations(violation);

                if (result == null || result.Count == 0)
                {
                    return NotFound("No existing MAP violations found after submission.");
                }

                return Ok(result);
            }
            catch (SqlException sqlEx)
            {
                // Log sqlEx as needed
                return StatusCode(500, "A database error occurred while processing the request.");
            }
            catch (Exception ex)
            {
                // Log ex as needed
                return StatusCode(500, "An unexpected error occurred.");
            }
        }

        
        
//        // GET API/Product/{code}
//        [HttpGet("{code}")]
//        public ActionResult<Result<ProdDto>> GetByCode(string code)
//        {
//            var prod = _prodataAccess.GetProductEnvelopeByCode(code);
//            if (prod == null)
//                return Ok(Result.Fail<ProdDto>($"The Product Code {code} is invalid."));

//            if (prod.IsDiscontinued)
//                return Ok(Result.Warn(prod, "This product has been discontinued."));

//            return Ok(Result.Ok(prod));
//        }

//        // PUT API/Product/{id}
//        [HttpPut("{id:int}")]
//        public ActionResult<Result> Update(int id, [FromBody] ProdDto dto)
//        {
//            if (id != dto.ProductId) return BadRequest("Mismatched ProductId.");
//            var res = _prodataAccess.UpdateProductEnvelope(dto);
//            return Ok(res);
//        }

//        // GET API/Product/lookup/{code}?type=accessory|related&parentId=#
//        [HttpGet("lookup/{code}")]
//        public ActionResult<Result<ProductInfoLookupDto>> Lookup(string code, [FromQuery] string type, [FromQuery] int parentId)
//        {
//            var info = _prodataAccess.LookupProductInfo(code, type, parentId);
//            return info == null
//                ? Ok(Result.Fail<ProductInfoLookupDto>("Invalid product code."))
//                : Ok(Result.Ok(info));
//        }

//        // GET API/Product/iqprompts
//        [HttpGet("iqprompts")]
//        public ActionResult<List<IQPromptDto>> GetIQPrompts()
//            => Ok(_prodataAccess.GetIQPrompts());

//        // POST API/Product/tags/add
//        public record TagCmd(int ProductId, string Tag);
//        [HttpPost("tags/add")]
//        public ActionResult<Result> AddTag([FromBody] TagCmd cmd)
//            => Ok(_prodataAccess.AddTag(cmd.ProductId, cmd.Tag));

//        // POST API/Product/tags/remove
//        [HttpPost("tags/remove")]
//        public ActionResult<Result> RemoveTag([FromBody] TagCmd cmd)
//            => Ok(_prodataAccess.RemoveTag(cmd.ProductId, cmd.Tag));

//        // POST API/Product/group/add
//        public record GroupAddCmd(string ProductCode, string GroupCode, string? ColorName, string? ColorHex, string? Size);
//        [HttpPost("group/add")]
//        public ActionResult<Result> AddToGroup([FromBody] GroupAddCmd cmd)
//            => Ok(_prodataAccess.AddToGroup(cmd.ProductCode, cmd.GroupCode, cmd.ColorName, cmd.ColorHex, cmd.Size));

//        // POST API/Product/group/remove
//        public record GroupRemoveCmd(string ProductCode);
//        [HttpPost("group/remove")]
//        public ActionResult<Result> RemoveFromGroup([FromBody] GroupRemoveCmd cmd)
//            => Ok(_prodataAccess.RemoveFromGroup(cmd.ProductCode));

//        // GET API/Product/techspecs/{code}
//        [HttpGet("techspecs/{code}")]
//        public ActionResult<Result<object>> GetTechSpecs(string code)
//            => Ok(Result.Ok<object>(new { attributes = _prodataAccess.GetTechSpecs(code) }));

//        // POST API/Product/techspecs/{code}
//        public record TechSpecsSaveCmd(List<ProductAttributeDto> Attributes);
//        [HttpPost("techspecs/{code}")]
//        public ActionResult<Result> SaveTechSpecs(string code, [FromBody] TechSpecsSaveCmd cmd)
//            => Ok(_prodataAccess.SaveTechSpecs(code, cmd.Attributes ?? new()));
    
}
}
