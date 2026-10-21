#nullable disable
using System;
using System.Collections.Generic;
using ProInternal.Models.Marketing;

namespace ProInternal.Models.Products
{
    /* Product Desk · Shopify & assets (read only): piv2.Product_Assets plus Connection's GetProductFiles. */
    public sealed class ProductAssetsView
    {
        public int ProductId { get; set; }
        public string ProductCode { get; set; }

        /* Every ProductData column about Shopify, video, assets, images or media, by name. */
        public List<ProductAssetField> Fields { get; set; } = new();
        public List<ProductImageAsset> Images { get; set; } = new();
        public List<ProductDocumentAsset> Documents { get; set; } = new();
        /* S3 files, from Connection's GetProductFiles. */
        public List<ProductS3File> Files { get; set; } = new();
        /* dbo.productlastchanged rows for the product: what was sent to Shopify, and its answer. */
        public List<ProductShopifyChange> ShopifyFeed { get; set; } = new();
        /* The Marketing screens' Shopify data, filtered to this product. */
        public List<ShopifyGovernanceIssueDto> ShopifyIssues { get; set; } = new();
        public List<ShopifyTaxonomyAuditDto> ShopifyTaxonomy { get; set; } = new();

        /* From appsettings (Assets / Shopify), so the page can build links. */
        public string ImageBaseUrl { get; set; }
        public string FilesBaseUrl { get; set; }
        public string ShopifyAdminProductUrl { get; set; }
        public string FilesError { get; set; }
        public string ShopifyError { get; set; }
    }

    public sealed class ProductAssetField
    {
        public string FieldName { get; set; }
        public string FieldValue { get; set; }
    }

    public sealed class ProductImageAsset
    {
        public string ImageName { get; set; }
        public int? DisplayOrder { get; set; }
        /* Listed in dbo.ProductImage (what the B2B site shows). */
        public bool InProductImage { get; set; }
        public bool Has100 { get; set; }
        public bool Has250 { get; set; }
        public bool HasFull { get; set; }
    }

    public sealed class ProductDocumentAsset
    {
        public string FileName { get; set; }
        public string DisplayName { get; set; }
        public string FileLocation { get; set; }
        public string Url { get; set; }
        public DateTime? UploadDate { get; set; }
        /* Built by the API from FileLocation when Assets:FilesBaseUrl is set. */
        public string Link { get; set; }
    }

    public sealed class ProductS3File
    {
        public string Bucket { get; set; }
        public string Link { get; set; }
        public string DisplayName { get; set; }
    }

    public sealed class ProductShopifyChange
    {
        public long Id { get; set; }
        public string Change { get; set; }
        public string OldValue { get; set; }
        public string NewValue { get; set; }
        public DateTime? DateChanged { get; set; }
        public DateTime? DateProcessed { get; set; }
        public string Result { get; set; }
    }
}
