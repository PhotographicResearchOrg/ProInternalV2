using ProInternal.Models.Accounts;

namespace ProInternal.Models.WH
{


    public class ShipmentRecord
    {
        public string TrackingNumber { get; set; }
        public DateTime? EntryDate { get; set; }
        public DateTime? DeliveredDate { get; set; }
        public string CurrentStatus { get; set; }
        public int ExpectedDays { get; set; }
        public int ActualDays { get; set; }
        public string SLAStatus { get; set; }
        public string DestinationState { get; set; }

        public string Account { get; set; }
        public int? Zone { get; set; }

        public int? Air { get; set; }

        public string Accountname { get; set; }

        
    }




    public class ShipmentSubscription
    {
        public int Id { get; set; }
        public int UserId { get; set; }

        public string Name { get; set; }

        public string? Account { get; set; }
        public int? Zone { get; set; }
        public string? SLAStatus { get; set; }
        public int? MinDays { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; }
    }



    public class ShipmentEventRecord
    {
        public string TrackingNumber { get; set; }
        public string Status { get; set; }
        public string StatusCode { get; set; }
        public DateTime EventDateTime { get; set; }
        public string City { get; set; }
        public string State { get; set; }
    }




    public class ShippingErrorRecord
    {
        public int Id { get; set; }
        public string CompanyName { get; set; }
        public string shipnumber { get; set; }
        
        public string Account { get; set; }
        public string Status { get; set; }
        public string DateSubmitted { get; set; }
        public DateTime? ShipDate { get; set; }
        
        public string ContactName { get; set; }
        public string ContactEmail { get; set; }
        public string ContactPhone { get; set; }
        public string RmaStatus { get; set; }

        public string ReturnMessage { get; set; }
        public string ReturnedBy { get; set; }
        public DateTime? ReturnedDate { get; set; }


        public List<ShippingErrorProduct> Products { get; set; }
    }


    public class SendBackRequest
    {
        public int ErrorId { get; set; }
        public string ProductCode { get; set; }
        public string Reason { get; set; }
        public string Username { get; set; }
    }


    public class ShippingErrorProduct
    {

        public Boolean? isBRMProduct { get; set; }
        public string ProductCode { get; set; }
        public string ProductDescription { get; set; }
        public int Quantity { get; set; }
        public string errorType { get; set; }
        public decimal Cost { get; set; }
        public string Serial { get; set; }
        public string Disposition { get; set; }
        public int? BRMFollowUp { get; set; }
        public string CustomMessage { get; set; }


        public string ReturnMessage { get; set; }
        public string ReturnedBy { get; set; }
        public DateTime? ReturnedDate { get; set; }


        public DateTime? RAIssuedDate { get; set; }
        public DateTime? RAReceivedDate { get; set; }


    }


    public class ProcessRequest
    {
        public string Type { get; set; }
        public string Disposition { get; set; }
    }


}

public class CompleteProductRequest
{
    public int ShippingErrorId { get; set; }
    public int ProductId { get; set; }
    
    public string UserName { get; set; } // Optional audit
}


// Data/IShippingErrorRepository.cs
public interface IShippingErrorRepository
{
    IEnumerable<ShippingErrorRecord> GetShippingErrors();
    ShippingErrorRecord GetShippingErrorDetails(int id);
    void ProcessShippingError(int id, string type, string disposition);
    void ProcessGridShippingErrors(List<ShippingErrorRecord> errors);
}

public class PackingSlipData
{
    public PackingSlipHeader Header { get; set; }
    public List<PackingSlipProduct> Products { get; set; }
}

public class PackingSlipHeader
{
    public string OrderDate { get; set; }
    public string ProOrderNumber { get; set; }
    public string PO { get; set; }
    public string CheckedBy { get; set; }
    public string ShippingNumber { get; set; }
    public string ProMember { get; set; }
}

public class PackingSlipProduct
{
    public string ProductCode { get; set; }
    public int QuantityOrdered { get; set; }
    public int QuantityShipped { get; set; }
    public string Description { get; set; }
}


public class ProductReceivedRequest
{
    public int ShippingErrorId { get; set; }
    public string ProductCode { get; set; }
}


public class ShippingErrorRequest
{
    public string productCode { get; set; }
    public int ID { get; set; }
    public int ErrorID { get; set; }
    public int Disposition { get; set; }
    public string CustomMessage { get; set; }
}

public class ShippingErrorProduct
{
    public int Id { get; set; }
    public int Disposition { get; set; }
    public string SoftMessage { get; set; } // For BRM Soft Touch message
    public string ProductCode { get; set; }
    // Other fields as necessary
}