#nullable disable
using System;
using System.Collections.Generic;

namespace ProInternal.Models.Products
{
    /* Product Desk · product sheet: every ProductData column (and Computyme's from dbo.Product) for one product. */
    public sealed class ProductSheetField
    {
        public string Source { get; set; }        // ProductData | Computyme
        public string ColumnName { get; set; }
        public string DataType { get; set; }
        public short MaxLength { get; set; }
        public byte Prec { get; set; }
        public byte Scale { get; set; }
        public bool IsNullable { get; set; }
        public string Value { get; set; }
        public string Label { get; set; }
        public string GroupName { get; set; }
        public int SortOrder { get; set; }
        /* SYSTEM | CATEGORY | SHOPIFY | COMPUTYME | CONTRACT, or null when editable */
        public string Lock { get; set; }
        public string Note { get; set; }
    }

    /* One row of the B2B site's tech specs (TechSpecs_GetAttributesAndValuesForProduct). */
    public sealed class ProductTechSpecRow
    {
        public int SectionId { get; set; }
        public string SectionName { get; set; }
        public int SectionDisplayOrder { get; set; }
        public int AttributeId { get; set; }
        public string AttributeName { get; set; }
        public int AttributeDisplayOrder { get; set; }
        public int IsNumeric { get; set; }
        public decimal? ValueNumeric { get; set; }
        public string Unit { get; set; }
        public string ValueText { get; set; }
        /* What the B2B page shows: the text, or the number with its unit. */
        public string Value => !string.IsNullOrWhiteSpace(ValueText) ? ValueText
                             : ValueNumeric is decimal n ? $"{n:0.####}{(string.IsNullOrWhiteSpace(Unit) ? "" : " " + Unit)}" : null;
    }

    public sealed class ProductSheetChangeLog
    {
        public long LogId { get; set; }
        public string ColumnName { get; set; }
        public string Label { get; set; }
        public string OldValue { get; set; }
        public string NewValue { get; set; }
        public string ChangedBy { get; set; }
        public DateTime ChangedAt { get; set; }
    }

    public sealed class ProductSheetView
    {
        public List<ProductSheetField> Fields { get; set; } = new();
        public List<ProductTechSpecRow> TechSpecs { get; set; } = new();
        public List<ProductSheetChangeLog> History { get; set; } = new();
        public string TechSpecsError { get; set; }
        public bool SqlIsMaster { get; set; }
        public bool CanEdit { get; set; }
    }

    public sealed class ProductSheetChange
    {
        public string Column { get; set; }
        public string Value { get; set; }
    }

    public sealed class ProductSheetSaveRequest
    {
        public List<ProductSheetChange> Changes { get; set; } = new();
    }

    public sealed class ProductSheetLayout
    {
        /* The person's layout as JSON: hidden groups and fields, group order, pinned fields. */
        public string ViewJson { get; set; }
    }
}
