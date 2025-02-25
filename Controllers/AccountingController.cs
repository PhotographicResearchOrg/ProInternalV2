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


namespace ProInternal.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    //[Route("[controller]")]
    public class AccountingController : ControllerBase
    {
        private IProDataAccess _proDataAccess;
        public AccountingController(IProDataAccess proDataAccess) 
        {
            _proDataAccess = proDataAccess;
        }


        [HttpPost, DisableRequestSizeLimit]
        [Route("LoadQuarterFile")]
       // public async Task<IEnumerable<SellThroughUploadError>> UploadSellThrough([FromForm] string date)
        public async Task<ActionResult> Result(IFormFile file)
        {

            //get data from file
            QuarterlyRebates Loadeddata =  await LoadQuarterlyData(file);

            if (Loadeddata == null) 
            { 
            
            }
            else
            {
                //Call SP.
                this._proDataAccess.saveData(Loadeddata);

            }

            return null;

        }

        //DataTable tbl
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
                try { Programs.Add(Vendor[HeaderCounter] + " - " + Term[HeaderCounter]); 
                }
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
