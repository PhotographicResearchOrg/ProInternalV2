using Microsoft.AspNetCore.Mvc;
using ProInternal.Services;
using ProInternal.Models.Accounting;
using static System.Runtime.InteropServices.JavaScript.JSType;
using ProInternal.Models.Dashboard;
using ProInternal.Models.Exclusions;
using ProInternal.Models.Products;
using System.ComponentModel.Design;
using ProInternal.Models;


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



    }
}
