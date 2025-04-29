using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ProInternal.Models.Patronage
{
    public class PatronageUpload
    {
        public string CheckDate { get; set; }
        public string Total { get; set; }
        public string? YearQuarter { get; set; }
        public string id { get; set; }
        public string accountID { get; set; }
        public string totalValue { get; set; }
        public string perc { get; set; }
        public string shares { get; set; }
        public string balance { get; set; }
        public string profit { get; set; }
        public string dividend { get; set; }
        public string payment { get; set; }
        public string credit { get; set; }
        public DateTime? dateLoaded { get; set; }
        public string batchID { get; set; }
        public string stockValue { get; set; }
        public string taxWithholding { get; set; }
        public string withdrawal { get; set; }
        public string endingRetention { get; set; }
    }


    public class PatronageHistorical
    {
        public string? id { get; set; }
        public DateTime? issueDate { get; set; }
        public float? totalAmount { get; set; }
        public bool active { get; set; }
    }

    public class DeletePatronageRequest
    {
        public string Id { get; set; }
    }


    public class PatronageActivationRequest
    {
        public string BatchID { get; set; }
        public bool Active { get; set; }
    }


}
//    export interface patronageDetail
//    {
//        id: number;
//  accountID: number;
//  totalValue: number;
//  perc: number;
//  shares: number;
//  balance: number;
//  profit: number;
//  dividend: number;
//  payment: number;
//  credit: number;
//  dateLoaded: Date;
//  batchID: number;
//  stockValue: number;
//  taxWithholding: number;
//  withdrawal: number;
//  endingRetention: number;
//}
