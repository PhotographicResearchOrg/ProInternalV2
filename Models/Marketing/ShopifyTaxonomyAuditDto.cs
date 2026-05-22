namespace ProInternal.Models.Marketing
{
    public class ShopifyTaxonomyAuditDto
    {
        public int Id { get; set; }

        public long ProductCode { get; set; }

        public string ModelName { get; set; }

        public string BrandName { get; set; }

        public string ProductType { get; set; }

        public string SearchText { get; set; }

        public string ShopifyCategoryId { get; set; }

        public string ShopifyCategoryFullName { get; set; }

        public bool WasApplied { get; set; }

        public int ImageCount { get; set; }

        public string Status { get; set; }

        public DateTime CreatedDate { get; set; }
    }

    public class ShopifyTaxonomyReviewRequest
    {
        public int Id { get; set; }

        public string Disposition { get; set; }
    }

    public class ShopifyGovernanceIssueDto
    {
        public int Id { get; set; }

        public long ProductCode { get; set; }

        public long ShopifyProductId { get; set; }

        public string IssueType { get; set; }

        public string IssueSeverity { get; set; }

        public string Details { get; set; }

        public DateTime CreatedDate { get; set; }
    }

}
