using Microsoft.AspNetCore.Mvc;
using ProInternal.Services;
using ProInternal.Models.Accounting;
using static System.Runtime.InteropServices.JavaScript.JSType;
using ProInternal.Models.Dashboard;
using ProInternal.Models.Exclusions;


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
        [Route("exclusion/groups/{accountNumber}")]
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
        [Route("exclusions/group/{productExclusionGroupID}/{companyID")]
        public void AddCompanyExclusionGroup(int productExclusionGroupID, int companyID) {
            this._prodataAccess.Exclusion_ExcludeCompanyGroup(companyID, productExclusionGroupID);
        }

        [HttpPost]
        [Route("exclusion/brand/{brandID}/{companyID}")]
        public void AddCompanyBrandExclusion(int brandID, int companyID) {
            this._prodataAccess.Exclusions_ExcludeCompanyBrand(companyID, brandID);
        }


	}
}
