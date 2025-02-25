namespace ProInternal.Models.Dashboard
{
    public class SpecialOrdersSummary
    {
        public int ProductCode  { get; set; }
        public string CAT_NO   { get; set; }
        public string ModelName   { get; set; }
        public string image   { get; set; }
        public float price { get; set; }
        public DateTime EnterDate { get; set; }
        public int Quantity { get; set; }
        public int Inventory { get; set; }
        public string CatName { get; set; }
        public string Status { get; set; }
        public string AccountNumber { get; set; }
    }

}
