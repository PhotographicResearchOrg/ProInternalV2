using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace ProInternal.Models.SendInvoicesRequest
{
    public class SendInvoicesRequest
    {
        public string AccountNumber { get; set; }
        public string Email { get; set; }
    }
   
}