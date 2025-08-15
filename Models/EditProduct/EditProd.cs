namespace ProInternal.Models.EditProduct
{

        // Models/ProductDtos.cs
        public class ResultDto<T>
        {
            public bool Success { get; set; }
            public string Message { get; set; } = "";
            public string ResultType { get; set; } = "SUCCESS";
            public T Data { get; set; }
        }

        public class ProdDto
        {
            public int ProductId { get; set; }
            public string ProductCode { get; set; } = "";
            public string ModelName { get; set; } = "";
            public string ModelVersion { get; set; }
            public string P65 { get; set; }

            public bool IsActive { get; set; }
            public bool IsPublic { get; set; }
            public bool IsForSale { get; set; }
            public bool ShippingHold { get; set; }
            public bool IsDiscontinued { get; set; }
            public bool RequireSerialForSar { get; set; }
            public bool SpecialOrder { get; set; }
            public bool NewProdOverride { get; set; }

            public string ReplacementCode { get; set; }
            public int? TopCatId { get; set; }
            public int? CategoryId { get; set; }

            public int? BrandId { get; set; }
            public decimal? BrandRebate { get; set; }

            public int? Multiple { get; set; }
            public int? Carton { get; set; }

            public string Features { get; set; }
            public string Specs { get; set; }
            public string Faq { get; set; }
            public string OutOfStockMessage { get; set; }
            public DateTime? StockDueDate { get; set; }

            public List<AccessoryDto> Accessories { get; set; } = new();
            public List<RelatedDto> RelatedProducts { get; set; } = new();
            public List<string> Tags { get; set; } = new();

            public string VariationColorName { get; set; }
            public string VariationColorHex { get; set; }
            public string VariationSize { get; set; }

            public bool IsGroupDefault { get; set; }
            public List<GroupMemberDto> Group { get; set; } = new();

            public List<ProductAttributeDto> ProductAttributes { get; set; } = new();

            // Optional preload for UI convenience
            public List<BrandOptionDto> Brands { get; set; } = new();
            public List<IQPromptDto> IQPrompts { get; set; } = new();
        }

        public class AccessoryDto { public int AccessoryProductId { get; set; } public string ProductCode { get; set; } public string ModelName { get; set; } }
        public class RelatedDto { public int RelatedProductId { get; set; } public string ProductCode { get; set; } public string ModelName { get; set; } }
        public class GroupMemberDto { public string ProductCode { get; set; } public string GroupCode { get; set; } }
        public class ProductAttributeDto { public string AttributeName { get; set; } public string AttributeValue { get; set; } }
        public class BrandOptionDto { public int BrandId { get; set; } public string BrandName { get; set; } public bool DisplayBrandRebate { get; set; } }
        public class IQPromptDto { public int IQPromptId { get; set; } public string Name { get; set; } public bool IsStartPrompt { get; set; } }
        public class ProductInfoLookupDto { public int ProductId { get; set; } public string ModelName { get; set; } }

        public class CategoryNodeDto
        {
            public int CatId { get; set; }
            public string CatName { get; set; }
            public int? ParentId { get; set; }
            public bool Selected { get; set; }
        }

    }





