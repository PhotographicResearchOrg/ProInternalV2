using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using ProInternal.Services;
using ProInternal.Models.Accounting;
using ProInternal.Models.Auth;
using Newtonsoft.Json;
using static System.Runtime.InteropServices.JavaScript.JSType;
using Microsoft.VisualBasic;
using System.Dynamic;
using System.Text.Json;
using Newtonsoft.Json.Linq;
using System.Data;
using ProInternal.Models.Dashboard;
using ProInternal.Models.InvoiceRecord;
using ProInternal.Models.Patronage;
using ProInternal.Models.EzPaySummary;
using ProInternal.Models.WH;
using ProInternal.Models.Outstanding;
using ProInternal.Models.SendInvoicesRequest;


namespace ProInternal.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    //[Route("[controller]")]
    public class WarehouseController : ControllerBase
    {
        private IProDataAccess _proDataAccess;
        private IDRADataAccess _dradataAccess;
        private IEDADataAccess _edadataAccess;

        public WarehouseController(IProDataAccess proDataAccess, IDRADataAccess DRADataAccess, IEDADataAccess edadataAccess) 
        {
            _proDataAccess = proDataAccess;
            _dradataAccess = DRADataAccess;
            _edadataAccess = edadataAccess;

        }


        [HttpGet("shippingerrors")]
        public ActionResult<IEnumerable<ShippingErrorRecord>> GetShippingErrors()
        {
            var records = _proDataAccess.GetShippingErrors();
            return Ok(records);
        }

        [HttpGet("shipments")]
        public IActionResult GetShipments()
        {
            var data = _edadataAccess.GetShipments();
            return Ok(data);
        }

        [HttpGet("shipments/{tracking}/events")]
        public IActionResult GetShipmentEvents(string tracking)
        {
            var data = _edadataAccess.GetShipmentEvents(tracking);
            return Ok(data);
        }


        [HttpPost("completeProduct")]
        public IActionResult CompleteProduct([FromBody] CompleteProductRequest request)
        {
            if (request == null || request.ProductId <= 0 || request.ShippingErrorId <= 0 || string.IsNullOrWhiteSpace(request.UserName))
            {
                return BadRequest("Invalid request.");
            }

            var result = _proDataAccess.MarkProductComplete(request.ShippingErrorId, request.ProductId, request.UserName);
            return Ok(new { success = result });
        }




        [HttpPost("processShippingErrors")]
        public async Task<ActionResult> ProcessShippingErrors([FromBody] List<ShippingErrorRequest> errorList)
        {
            try
            {
                var result = await _proDataAccess.ProcessShippingErrors(errorList);
                return Ok(new { success = true, message = result });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error processing shipping errors", details = ex.Message });
            }
        }



     







        [HttpGet("shippingerrorsdetails/{id}")]
        public ActionResult<ShippingErrorRecord> GetShippingErrorDetails(int id)
        {
            var record = _proDataAccess.GetShippingErrorDetails(id);
            if (record == null) return NotFound();
            return Ok(record);
        }


        [HttpGet("packingslip/{id}")]
        public async Task<ActionResult<PackingSlipData>> GetPackingSlip(int id)
        {
            try
            {
                var packingSlipData = await _edadataAccess.GetPackingSlipData(id);
                if (packingSlipData == null)
                {
                    return NotFound();
                }

                return Ok(packingSlipData);
            }
            catch (Exception ex)
            {
                // Log the error
                //    _logger.LogError(ex, "Error occurred while fetching packing slip for shipping error ID: {id}", id);
                return StatusCode(500, "Internal server error");
            }
        }




        [HttpPost("{id}/process")]
        public IActionResult ProcessShippingError(int id, [FromBody] ProcessRequest request)
        {
            _proDataAccess.ProcessShippingError(id, request.Type, request.Disposition);
            return Ok();
        }

        [HttpPost("process-grid")]
        public IActionResult ProcessGridShippingErrors([FromBody] List<ShippingErrorRecord> errors)
        {
            _proDataAccess.ProcessGridShippingErrors(errors);
            return Ok();
        }

    }
}
