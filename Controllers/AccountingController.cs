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
using ProInternal.Models.Accounts;
using ProInternal.Models.Outstanding;
using ProInternal.Models.SendInvoicesRequest;


namespace ProInternal.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    //[Route("[controller]")]
    public class AccountingController : ControllerBase
    {
        private IProDataAccess _proDataAccess;
        private IDRADataAccess _dradataAccess;
        private IEDADataAccess _edadataAccess;

        public AccountingController(IProDataAccess proDataAccess, IDRADataAccess DRADataAccess, IEDADataAccess edadataAccess) 
        {
            _proDataAccess = proDataAccess;
            _dradataAccess = DRADataAccess;
            _edadataAccess = edadataAccess;

        }


        [HttpGet("accounts")]
        public async Task<ActionResult<IEnumerable<OutstandingAccount>>> GetAccounts()
        {
            var accounts = await _proDataAccess.GetAccountsWithOutstanding();
            return Ok(accounts);
        }

        [HttpGet("accounts/{accountNumber}/invoices")]
        public async Task<ActionResult<IEnumerable<OutstandingInvoice>>> GetInvoices(string accountNumber)
        {
            var invoices = await _proDataAccess.GetInvoicesByAccount(accountNumber);
            return Ok(invoices);
        }


        [HttpPost("send-invoices")]
        public async Task<IActionResult> SendInvoices([FromBody] SendInvoicesRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.AccountNumber))
                return BadRequest("Account number is required.");

            if (string.IsNullOrWhiteSpace(request.Email))
                return BadRequest("Email address is required.");

            bool success = await _proDataAccess.SendInvoicesToMemberEmail(request.AccountNumber, request.Email);

            if (success)
                return Ok();
            else
                return StatusCode(500, "Failed to send invoices.");
        }



        [HttpGet]
        [Route("ezpay-summary")]
        public async Task<ActionResult> GetEzPaySummary([FromQuery] DateTime date)
        {
            IEnumerable<EzPaySummary> summaryList = await _edadataAccess.GetEzPaySummary(date);

            return Ok(summaryList);
        }


        [HttpGet("ezpay-detail")]
        public async Task<IActionResult> GetEzPayDetail([FromQuery] DateTime date)
        {
            IEnumerable<EzPayDetail> detailList = await _edadataAccess.GetEzPayDetail(date);
            return Ok(detailList);
        }




        [HttpPost, DisableRequestSizeLimit]
        [Route("LoadQuarterFile")]
        public async Task<ActionResult> Result(IFormFile file)
        {
            QuarterlyRebates Loadeddata = await LoadQuarterlyData(file);

            if (Loadeddata != null)
            {
                this._proDataAccess.saveData(Loadeddata);
            }

            return Ok(new { success = true }); // ✅ ensures Angular receives a response
        }




        [HttpGet]
        [Route("forecast")]
        public IActionResult GetInvoices()
        {
            List<InvoiceRecord> result = this._proDataAccess.GetInvoices(); // Filter & map to DTO
            return Ok(result);
        }










        [HttpGet]
        [Route("GetPatronageHistorical")]
        public IActionResult GetPatronageHistorical()
        {
            List<PatronageHistorical> result = this._proDataAccess.GetPatronageHistorical();

            return Ok(result);
        }

        [HttpPut]
        [Route("ActivatePatronageBatch")]
        public bool ActivatePatronageBatch([FromBody] PatronageActivationRequest request)
        {
            return this._proDataAccess.activatePatronageBatch(request.BatchID, request.Active);
        }


        [HttpGet]
        [Route("getPatronageBatchDetails/{batchID}")]
        public ActionResult<List<PatronageUpload>> getPatronageBatchDetails(string batchID)
        {
            var details = this._proDataAccess.getPatronageBatchDetails(batchID);

            if (details == null || !details.Any())
            {
                return NotFound();
            }

            return Ok(details);
        }






        [HttpGet]
        [Route("GetRecentPatronageLoad")]
        public IActionResult GetRecentPatronageLoad()
        {
            List<PatronageUpload> result = this._proDataAccess.GetRecentPatronageLoad(); 
           
            return Ok(result);
        }



        [HttpPost, DisableRequestSizeLimit]
        [Route("LoadPatronageFile")]
        // public async Task<IEnumerable<SellThroughUploadError>> UploadSellThrough([FromForm] string date)
        public async Task<ActionResult> PatronageResult(IFormFile file)
        {





            List<PatronageUpload> Loadeddata = await LoadPatronageFile(file);
            if (Loadeddata == null)
            {
            
            }
            else
            {
       
                   this._proDataAccess.savePatronageData(Loadeddata);

            }

            return Ok(new { success = true, message = "Patronage file uploaded successfully." });

        }



        private async Task<List<PatronageUpload>> LoadPatronageFile(IFormFile file)
        {
            string requestBody = await new StreamReader(file.OpenReadStream()).ReadToEndAsync();
            var root = JsonConvert.DeserializeObject<dynamic>(requestBody.ToString());
            var patronageUploads = new List<PatronageUpload>();

            List<string> Term = new List<string>();

            DataTable dt = new DataTable();
            dt.Columns.Add("MemberNumber");
            dt.Columns.Add("Member");

            ////Get terms names
            foreach (var field in root[0])
                if (!string.IsNullOrEmpty(field.ToString()))
                {

                    //Do validation here. 
                    Term.Add(field.ToString());
                }



            // Assuming first row is header, start from row 1
            for (int i = 2; i < root.Count; i++)
            {
                var row = root[i];
                try
                {
                    PatronageUpload entry = new PatronageUpload
                    {
                        accountID = row.Count > 0 ? row[0]: 0,
                        totalValue = row.Count > 1 ? row[2] : 0,
                        perc = row.Count > 2 ? row[4] : 0,
                        shares = row.Count > 3 ? row[5] : 0,
                        balance = row.Count > 4 ? row[6] : 0,
                        profit = row.Count > 5 ? row[7] : 0,
                        dividend = row.Count > 6 ? row[8] : 0,
                        payment = row.Count > 7 ? row[10] : 0,
                        credit = row.Count > 8 ? row[11] : 0,
                        dateLoaded = DateTime.Now,
                        batchID = "", // You can set BatchID later
                        stockValue = row.Count > 9 ? row[3] : 0,
                        taxWithholding = row.Count > 10 ? row[9] : 0,
                        withdrawal =  "",
                        endingRetention = row.Count > 12 ? row[12] : 0,
                    };

                    patronageUploads.Add(entry);
                }
                catch (Exception ex)
                {
                    // Log or handle parsing error
                }
            }
            return patronageUploads;
        }


        private async Task<QuarterlyRebates> LoadQuarterlyData(IFormFile file)
        {  
            string requestBody = await new StreamReader(file.OpenReadStream()).ReadToEndAsync();
            var root = JsonConvert.DeserializeObject<dynamic>(requestBody.ToString());
            int count = root.Count;

            List<string> Term = new List<string>();
            List<string> Vendor = new List<string>();
            List<string> Programs = new List<string>();

            DataTable dt = new DataTable();
            dt.Columns.Add("MemberNumber");
            dt.Columns.Add("Member");

            //1st line are periods. 
            //Get terms names
                    foreach (var field in root[0])
                    if (!string.IsNullOrEmpty(field.ToString()))
                    {
                        Term.Add(field.ToString());

                    }

            //2nd line are programs. 
            //Get Vendors 
            foreach (var field in root[1])
                {
                    //Clean the list. 
                    if (!field.ToString().ToUpper().Contains("MEM"))
                        Vendor.Add(field.ToString());
                    //Drop when we hit end. 
                    if (field.ToString().ToUpper().Contains("MEMBER TOTAL"))
                    {
                        break;
                    }
                }


            int HeaderCounter = 0;
            //Need to build Program Name 
            foreach (var getVendor in Vendor)
            {
                try 
                { Programs.Add(Vendor[HeaderCounter] + " - " + Term[HeaderCounter]); }
                catch (Exception e) { }
                finally { HeaderCounter++; }
            }

            //Build Data Col fields.
            foreach (var program in Programs)
            {
                dt.Columns.Add(program);
            }

            //2 for member and member number
            int columnsFound = Programs.Count() + 2;
            int startCounter;

            //Rules. 
            //NO MERGED CELLS.
            //Thre must be a term in each col.
            //MAX of 10 cols. 
            int counter = 1;          
            foreach (var data in root )
            {              
                    try
                    {
                    if (counter > 2)
                    {
                        startCounter = 0;
                        DataRow _data = dt.NewRow();

                        foreach (var field in data)
                        {
                            if (startCounter < columnsFound)
                            {                                
                                _data[startCounter] = field.ToString();                               
                            }                         
                            startCounter++;
                        }
                        dt.Rows.Add(_data);
                    }
                    }            
                    catch { }
                    finally { counter++;  }             
            }

            QuarterlyRebates newData = new QuarterlyRebates();
            newData.FileData = dt;
            newData.ProgramList = Programs;
            //I now have my dtaa table 
            //save data 
            return newData;
        }


        [HttpGet]
        [Route("getCurrentQuarterlyData")]
        public List<QuarterlyDataSummary> getCurrentQuarterlyData()
        {
            List<QuarterlyDataSummary> QuarterlyDataSummary = this._proDataAccess.getCurrentQuarterlyData();
            return QuarterlyDataSummary;
        }

        [HttpGet]
        [Route("getHistoricalQRData")]
        public List<QuarterlyDataHistorical> getHistoricalQRData()
        {
            List<QuarterlyDataHistorical> QuarterlyDataSummary = this._proDataAccess.getHistoricalQRData();
            return QuarterlyDataSummary;
        }




        [HttpPut("DeletePatronageLoad")]
        public bool DeletePatronageLoad([FromBody] DeletePatronageRequest request)
        {
            return this._proDataAccess.deletePatronageLoad(request.Id);

        }





    [HttpPut]
        [Route("deleteQRUpload/{batchID}")]
        public bool deleteQRUpload(int batchID)
        {
            return this._proDataAccess.deleteQRUpload(batchID);
             
        }

        [HttpPut]
        [Route("activate/{batchID}")]
        public bool activate(int batchID)
        {
            return this._proDataAccess.activate(batchID);

        }


        [HttpGet]
        [Route("getQRBatchDetail/{batchID}")]
        public List<qrDetail> getQRBatchDetail(int batchID)
        {
            List<qrDetail> QuarterlyDataSummary = this._proDataAccess.getQRBatchDetail(batchID);
            return QuarterlyDataSummary;
        }



        

        [HttpGet]
        [Route("getQRBatchVendorDetail/{batchID}")]
        public List<qrDetail> getQRBatchVendorDetail(string batchID)
        {
            List<qrDetail> QuarterlyDataSummary = this._proDataAccess.getQRBatchVendorDetail(batchID);
            return QuarterlyDataSummary;
        }


        [HttpGet]
        [Route("CurrentQuarterLiability")]
        public List<QuarterlyRebate> GetQuarterRebateSummary()
        {
            List<QuarterlyRebate> QuarterRebateSummar = this._proDataAccess.GetQuarterRebateSummary();
            return QuarterRebateSummar;
        }
    }
}
