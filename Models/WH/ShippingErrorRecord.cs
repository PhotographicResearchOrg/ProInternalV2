using ProInternal.Models.Accounts;

namespace ProInternal.Models.WH
{

    public class ShippingErrorRecord
    {
        public int Id { get; set; }
        public string CompanyName { get; set; }
        public string shipnumber { get; set; }
        
        public string Account { get; set; }
        public string Status { get; set; }
        public string DateSubmitted { get; set; }
        public string ContactName { get; set; }
        public string ContactEmail { get; set; }
        public string ContactPhone { get; set; }
        public string RmaStatus { get; set; }
        public List<ShippingErrorProduct> Products { get; set; }
    }

    public class ShippingErrorProduct
    {
        public string ProductCode { get; set; }
        public string ProductDescription { get; set; }
        public int Quantity { get; set; }
        public string ErrorType { get; set; }
        public decimal Cost { get; set; }
        public string Serial { get; set; }
    }


    public class ProcessRequest
    {
        public string Type { get; set; }
        public string Disposition { get; set; }
    }


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