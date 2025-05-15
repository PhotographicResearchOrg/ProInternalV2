namespace ProInternal.Models.Exclusions {
	public class ProductExclusionGroup {
		public int ProductExclusionGroupID { get; set; }
		public string? GroupName { get; set; }
	}

	public class ProductExclusionGroupProduct {
		public int ProductExclusionGroupProductID { get; set; }
		public int ProductExclusionGroupID { get; set; }
		public string? ProductCode { get; set; }
		public string? ModelName { get; set; }

	}

	public class CompanyGroupExclusion {
		public int CompanyGroupExclusionID { get; set; }
		public int CompanyID { get; set; }
		public int ProductExclusionGroupID { get; set; }
	}

	public class CompanyBrandExclusion {
		public int CompanyID { get; set; }
		public int BrandID { get; set; }
		public string? BrandName { get; set; }
	}


    public class CountryBrandRequest
    {
        public string Country { get; set; }
        public List<int> BrandIds { get; set; }
    }


    public class CompanyDto
    {
        public int CompanyId { get; set; }
        public string CompanyName { get; set; }
    }

}
