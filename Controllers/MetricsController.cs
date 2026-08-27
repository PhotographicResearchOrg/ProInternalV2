using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using ProInternal.Models.Dashboard;
using ProInternal.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;


namespace ProInternal.Controllers
{

    [Route("api/[controller]")]
    [ApiController]
    public class MetricsController : ControllerBase
    {

        private IProDataAccess _prodataAccess;
        private IDRADataAccess _dradataAccess;
        private INukeDataAccess _nukedataAccess;

        public MetricsController(IProDataAccess proDataAccess, IDRADataAccess DRADataAccess, INukeDataAccess nukedataAccess)
        {
            _prodataAccess = proDataAccess;
            _dradataAccess = DRADataAccess;
            _nukedataAccess = nukedataAccess;
        }


        [HttpGet]
        [Route("getOrderMetrics")]
        public OrdersMetrics DashOrderMetrics()
        {
            OrdersMetrics OrdersSummary = this._prodataAccess.GetOrdersMetrics();
            return OrdersSummary;
        }

        [HttpGet]
        [Route("getSARSMetrics")]
        public SARSMetrics DashSARSMetrics()
        {
            SARSMetrics SARSummary = this._dradataAccess.GetSARSMetrics();
            return SARSummary;
        }



        private string? GetCurrentUser()
        {
            return
                User.FindFirst(ClaimTypes.Email)?.Value ??
                User.FindFirst("email")?.Value ??
                User.FindFirst(ClaimTypes.Name)?.Value ??
                User.FindFirst("preferred_username")?.Value ??
                User.FindFirst("unique_name")?.Value ??
                User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        }


        [HttpGet]
        [Route("getDropShipThreshold")]
        public decimal GetDropShipThreshold()
        {
            return _prodataAccess.GetDropShipThreshold();
        }

        [HttpPost]
        [Route("setDropShipThreshold")]
        public IActionResult SetDropShipThreshold(
          [FromBody] ThresholdRequest req)
        {
            if (req.Value < 0)
                return BadRequest("Threshold cannot be negative.");

            var actionBy = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(actionBy))
                return Unauthorized("Unable to identify the current user.");

            var actionSource = req.ActionSource switch
            {
                "Dashboard Landing" => "Dashboard Landing",
                "Order Toolbench" => "Order Toolbench",
                _ => "Unknown"
            };

            _prodataAccess.SetDropShipThreshold(
                req.Value,
                actionBy,
                actionSource
            );

            return Ok();
        }


        public class ThresholdRequest
        {
            public decimal Value { get; set; }
            public string ActionSource { get; set; } = "";
        }



        [HttpGet]
        [Route("getEDIMetrics")]
        public EDIMetrics DashEDIMetrics()
        {
            EDIMetrics EDISummary = this._prodataAccess.GetEDIMetrics();

            return EDISummary;
        }

        [HttpGet]
        [Route("getIRMetrics")]
        public IRMetrics DashIRMetrics()
        {
            IRMetrics EDISummary = this._nukedataAccess.GetIRMetrics();

            return EDISummary;
        }


        [HttpGet]
        [Route("getShippingErrorMetrics")]
        public ShippingErrorMetrics DashShippingErrorMetrics()
        {
            ShippingErrorMetrics EDISummary = this._prodataAccess.getShippingErrorMetrics();

            return EDISummary;
        }


        
        [HttpGet]
        [Route("getCommentMetrics")]
        public CommecntsMetrics DashCommentsMetrics()
        {
            CommecntsMetrics EDISummary = this._prodataAccess.getCommentsrMetrics();

            return EDISummary;
        }


    }
}
