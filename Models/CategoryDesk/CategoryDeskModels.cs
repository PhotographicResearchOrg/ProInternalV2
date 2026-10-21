#nullable disable   // optional fields: without this, [ApiController] treats every non-nullable string as required
using System;
using System.Collections.Generic;
using System.Text.Json;

namespace ProInternal.Models.CategoryDesk
{
    /* ------------------------------------------------------------ tree */

    public class CategoryNode
    {
        public int CatId { get; set; }
        public int? ParentCatId { get; set; }
        public string Name { get; set; }
        public bool Visible { get; set; }
        public bool EffectiveVisible { get; set; }
        public string Notes { get; set; }
        public int? Egrp { get; set; }
        public int Depth { get; set; }
        public int? TopId { get; set; }
        public string PathNames { get; set; }
        public int OwnCount { get; set; }
        public int OwnActiveCount { get; set; }
        public int TotalCount { get; set; }
        public int ActiveCount { get; set; }
        public int DiscontinuedCount { get; set; }
    }

    public class CategorySummary
    {
        public int Uncategorized { get; set; }
        public int Suspect { get; set; }
        public int VisibleEmpty { get; set; }
        public int Orphans { get; set; }
        public int Version { get; set; }
    }

    public class EgrpOption
    {
        public int Egrp { get; set; }
        public string Name { get; set; }
    }

    public class OrphanCategory
    {
        public int CatId { get; set; }
        public string Name { get; set; }
        public int? ParentCatId { get; set; }
    }

    public class CategoryTree
    {
        public List<CategoryNode> Nodes { get; set; } = new();
        public CategorySummary Summary { get; set; } = new();
        public List<EgrpOption> EgrpsNotOnTree { get; set; } = new();
        public List<OrphanCategory> Orphans { get; set; } = new();

        /* Product:SqlIsMaster. False: the top level (EGRP) is Computyme's and locked. */
        public bool SqlIsMaster { get; set; }
        public bool CanEdit { get; set; }
    }

    /* ------------------------------------------------------------ products */

    public class CategoryProductQuery
    {
        public string Term { get; set; }
        public int? BrandId { get; set; }
        public int? VendorId { get; set; }
        public string Status { get; set; }           // ACTIVE | DISCONTINUED
        public bool? ForSale { get; set; }
        public bool? IsPublic { get; set; }
        public int? NodeId { get; set; }
        public bool IncludeChildren { get; set; } = true;
        public string Queue { get; set; }            // UNCATEGORIZED | SUSPECT
        public int? Egrp { get; set; }
        public int? NewDays { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 100;     // 0 = every match (export, select all)
    }

    public class CategoryProductRow
    {
        public int ProductId { get; set; }
        public string ProductCode { get; set; }
        public string ModelName { get; set; }
        public int? BrandId { get; set; }
        public string BrandName { get; set; }
        public int? VendorId { get; set; }
        public string VendorName { get; set; }
        public int? Egrp { get; set; }
        public bool IsDiscontinued { get; set; }
        public bool IsForSale { get; set; }
        public bool IsPublic { get; set; }
        public string ReplacementCode { get; set; }
        public DateTime? EnterDate { get; set; }
        public int NodeId { get; set; }
        public string NodePath { get; set; }
        public int? EgrpTopId { get; set; }
        public string Problem { get; set; }
        public int? SuggestedNodeId { get; set; }
        public string SuggestedPath { get; set; }
        public string SuggestReason { get; set; }
        public int? SuggestConfidence { get; set; }
        public string SuggestSignal { get; set; }
        public int TotalCount { get; set; }
    }

    public class CategoryProductPage
    {
        public List<CategoryProductRow> Rows { get; set; } = new();
        public int Total { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }

    public class FilterOption
    {
        public int Id { get; set; }
        public string Name { get; set; }
    }

    public class CategoryFilters
    {
        public List<FilterOption> Brands { get; set; } = new();
        public List<FilterOption> Vendors { get; set; } = new();
    }

    /* ------------------------------------------------------------ publish */

    public class PublishRequest
    {
        /* { "categories": [...], "products": [...] } as described in piv2.CategoryDesk_Publish */
        public JsonElement Changes { get; set; }
        public string Comment { get; set; }
        public int? BaseVersion { get; set; }
    }

    public class PublishResult
    {
        public int PublishId { get; set; }
        public int CategoryChanges { get; set; }
        public int ProductChanges { get; set; }
        public int ProductsRepathed { get; set; }
        public List<NewCategoryId> NewIds { get; set; } = new();
    }

    public class NewCategoryId
    {
        public int TempId { get; set; }
        public int CatId { get; set; }
    }

    /* ------------------------------------------------------------ history and revert */

    public class PublishSummary
    {
        public int PublishId { get; set; }
        public DateTime PublishedAt { get; set; }
        public string PublishedBy { get; set; }
        public string Comment { get; set; }
        public int? RevertOfPublishId { get; set; }
        public int? RevertedByPublishId { get; set; }
        public int CategoryChanges { get; set; }
        public int ProductChanges { get; set; }
        public int FromAi { get; set; }
        public int FromSuggestion { get; set; }
    }

    public class PublishItem
    {
        public long ChangeId { get; set; }
        public int PublishId { get; set; }
        public DateTime PublishedAt { get; set; }
        public string PublishedBy { get; set; }
        public string Comment { get; set; }
        public string ItemType { get; set; }
        public int ItemId { get; set; }
        public string ItemLabel { get; set; }
        public string Action { get; set; }
        public string Fields { get; set; }
        public string Source { get; set; }
        public string BeforeJson { get; set; }
        public string AfterJson { get; set; }
        public string BeforePath { get; set; }
        public string AfterPath { get; set; }
    }

    public class RevertConflict
    {
        public string ItemType { get; set; }
        public int ItemId { get; set; }
        public string ItemLabel { get; set; }
        public int LaterPublishId { get; set; }
        public string LaterBy { get; set; }
        public DateTime LaterAt { get; set; }
    }

    public class RevertRequest
    {
        /* true: leave items a later publish changed as they are. false: put them back anyway. */
        public bool SkipConflicts { get; set; } = true;
    }
}
