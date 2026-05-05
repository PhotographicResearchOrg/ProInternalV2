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



        [HttpGet]
        [Route("getDropShipThreshold")]
        public decimal GetDropShipThreshold()
        {
            return _prodataAccess.GetDropShipThreshold();
        }

        [HttpPost]
        [Route("setDropShipThreshold")]
        public void SetDropShipThreshold([FromBody] ThresholdRequest req)
        {
            _prodataAccess.SetDropShipThreshold(req.Value);
        }

        public class ThresholdRequest
        {
            public decimal Value { get; set; }
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
