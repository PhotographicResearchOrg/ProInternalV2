namespace ProInternal.Models.Products
{
    public class Products
    {
        public int AccountNumber { get; set; }
        public string SpecOrder { get; set; }
        public int IsDropShipEligible { get; set; }
        public int Id { get; set; }
        public string ProductCode { get; set; }
        public int BrandId { get; set; }
        public string ModelName { get; set; }
        public string ModelVersion { get; set; }
        public string AdditionalText { get; set; }
        public int CatId { get; set; }
        public int SubCatId { get; set; }
        public string UPC { get; set; }
        public double   Retail { get; set; }
        public double DS_CHG { get; set; }
        public double LAST_VALUE { get; set; }
        public double CartonPricingRetail { get; set; }
        public double AuthorizedPrice { get; set; }
        public int IsActive { get; set; }
        public int IsPublic { get; set; }
        public int IsForSale { get; set; }
        public bool  IsDiscontinued { get; set; }
        public string ReplacementCode { get; set; }
        public string Features { get; set; }
        public string Specs { get; set; }
        public string InstructionBook { get; set; }
        public string FAQDoc { get; set; }
        public string P65 { get; set; }
        public DateTime EnterDate { get; set; }
        public DateTime LastUpdated { get; set; }
        public int UpdatedBy { get; set; }
        public string hold { get; set; }
        public int Inventory { get; set; }
        public int Multiple { get; set; }
        public string OutOfStockMessage { get; set; }
        public DateTime StockDueDate { get; set; }
        public int SpecialPriceQuantity { get; set; }
        public int Carton { get; set; }
        public int TopCatId { get; set; }
        public double MAP { get; set; }
        public double CUST_RETAIL { get; set; }
        public string REBATE { get; set; }
        public bool RequireSerialForSar { get; set; }
        public double BrandRebate { get; set; }
        public string FAQ { get; set; }
        public string CAT_NO { get; set; }
        public int FastShippingAvailable { get; set; }
        public int ShippingHold { get; set; }
        public string SupplementalShippingSku { get; set; }
        public int SupplementalShippingProductId { get; set; }
        public double SupplementalShippingCost { get; set; }
        public int IsGroup { get; set; }
        public int IsClient { get; set; }
        public string label { get; set; }

    }


    public class Brands
    {
        public int BrandID { get; set; }
        public string BrandName { get; set; }

    }

}
