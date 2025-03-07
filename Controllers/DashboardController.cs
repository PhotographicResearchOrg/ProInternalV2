using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using ProInternal.Services;
using ProInternal.Models.Dashboard;
using ProInternal.Models.Accounts;
using Microsoft.AspNetCore.Cors;
using ProInternal.Models.Products;

namespace ProInternal.Controllers
{
  
    [Route("api/[controller]")]
    [ApiController]

    public class DashboardController : ControllerBase
    {

        private IProDataAccess _prodataAccess;
        private IDRADataAccess _dradataAccess;
        private INukeDataAccess _nukedataAccess;
        public DashboardController(IProDataAccess proDataAccess, IDRADataAccess DRADataAccess, INukeDataAccess nukedataAccess)
        {
            _prodataAccess = proDataAccess;
            _dradataAccess = DRADataAccess;
            _nukedataAccess = nukedataAccess;
        }


        [HttpGet]
        [Route("getOrdersSnapshot")]
        public List<SpecialOrdersSummary> DashCommentsMetrics()
        {
            List<SpecialOrdersSummary> Summary = this._prodataAccess.getOrdersSnapshot().ToList();

            return Summary;
        }


        [HttpGet]
        [Route("getAccounts")]
        public List<Account> Accounts()
        {
            List<Account> Accounts = this._prodataAccess.getAccounts().ToList();
            return Accounts;
        }

        [HttpGet]
        [Route("getBrands")]
        public List<Brands> Brands()
        {
            List<Brands> Brands = this._prodataAccess.getBrands().ToList();

           return Brands;
        }



        [HttpGet]
        [Route("getProducts/{searchCriteria}")]
        public List<Products> Products(string searchCriteria)
        {
            List<Products> Products = this._prodataAccess.getProducts(searchCriteria).ToList();

            return Products;
        }


        [HttpGet]
        [Route("GetMemberGateSummary/{memberNumber}")]
        public List<MemberGateSummary> GetMemberGateSummary(string memberNumber)
        {
            List<MemberGateSummary> MemberGateSummary = this._prodataAccess.GetMemberGateSummary(memberNumber).ToList();
            return MemberGateSummary;
        }
        



        [HttpGet]
        [Route("QuickSearchProducts")]
        public List<Products> QuickSearchProducts()
        {
            List<Products> Products = this._prodataAccess.QuickSearchProducts().ToList();
            return Products;
        }



    }
}
