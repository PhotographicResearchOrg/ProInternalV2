#nullable disable
using System;
using System.Collections.Generic;

namespace ProInternal.Models.Vendor
{
    /* ---------------------------------------------------------- Cutover map (piv2.Cutover_*) */

    public sealed class CutoverSection
    {
        public string SectionKey { get; set; }
        public string Area { get; set; }
        public string Name { get; set; }
        /* COMPUTYME (master, PIV2 read only) · SQL (master in SQL) · MIXED · EXTENSION (PIV2 only) */
        public string Owner { get; set; }
        public string Summary { get; set; }
        public string ComputymeSource { get; set; }
        public string SqlObjects { get; set; }
        public string B2BReads { get; set; }
        public string PivScreen { get; set; }
        public string NextStep { get; set; }
        public int SortOrder { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string UpdatedBy { get; set; }
    }

    public sealed class CutoverLogEntry
    {
        public int Id { get; set; }
        public string SectionKey { get; set; }
        public string Name { get; set; }
        public string OldOwner { get; set; }
        public string NewOwner { get; set; }
        public string Note { get; set; }
        public string ChangedBy { get; set; }
        public DateTime ChangedAt { get; set; }
    }

    public sealed class CutoverMap
    {
        public List<CutoverSection> Sections { get; set; } = new();
        public List<CutoverLogEntry> Log { get; set; } = new();
        public bool CanEdit { get; set; }
    }

    public sealed class CutoverOwnerRequest
    {
        public string Owner { get; set; }
        public string NextStep { get; set; }
        public string Note { get; set; }
    }

    /* ---------------------------------------------------------- Brand ↔ vendor (piv2.BrandVendor_*) */

    public sealed class BrandVendorRow
    {
        public int BrandId { get; set; }
        public string BrandName { get; set; }
        public int? VendorId { get; set; }
        public string VendorName { get; set; }
        /* OK · NO_VENDOR · UNKNOWN_VENDOR · NOT_AP_VENDOR */
        public string LinkStatus { get; set; }
        public int Products { get; set; }
        public int LiveProducts { get; set; }
        /* products whose Computyme actual vendor (IVMST A.VENDOR) isn't the brand's vendor */
        public int BoughtElsewhere { get; set; }
        public string ActualVendors { get; set; }
        public DateTime? LastMovedAt { get; set; }
        public string LastMovedBy { get; set; }
    }

    public sealed class BrandVendorHistoryRow
    {
        public int Id { get; set; }
        public int BrandId { get; set; }
        public string BrandName { get; set; }
        public int? OldVendorId { get; set; }
        public int? NewVendorId { get; set; }
        public string Reason { get; set; }
        public string ChangedBy { get; set; }
        public DateTime ChangedAt { get; set; }
    }

    public sealed class BrandVendorList
    {
        public List<BrandVendorRow> Brands { get; set; } = new();
        public bool CanEdit { get; set; }
    }

    public sealed class BrandVendorMoveRequest
    {
        public int? VendorId { get; set; }
        public string Reason { get; set; }
    }

    /* ---------------------------------------------------------- Vendor record (piv2.Vendor_ComputymeRecord) */

    public sealed class VendorRecordField
    {
        public string ColumnName { get; set; }
        public string Label { get; set; }
        public string GroupName { get; set; }
        public int SortOrder { get; set; }
        public string Value { get; set; }
        public string DisplayValue { get; set; }
        public string Note { get; set; }
        public bool Hidden { get; set; }
    }

    public sealed class VendorRecordTerms
    {
        public string DueDaysText { get; set; }
        public string CashDiscountText { get; set; }
        public decimal? CashDiscountPct { get; set; }
        /* NONE · NET · DAY_NEXT_MONTH · DAY_THIS_MONTH · UNPARSED */
        public string TermsType { get; set; }
        public int? NetDays { get; set; }
        public int? DayOfMonth { get; set; }
        public string Description { get; set; }
    }

    public sealed class VendorRecordUsage
    {
        public int ProductsAsVendor { get; set; }
        public int LiveProductsAsVendor { get; set; }
        public int Brands { get; set; }
        public int DirectBillingPrograms { get; set; }
        public int PurchaseOrders { get; set; }
        public int OpenPurchaseOrders { get; set; }
        public bool InComputyme { get; set; }
    }

    public sealed class VendorRecord
    {
        public int VendorId { get; set; }
        public List<VendorRecordField> Fields { get; set; } = new();
        public VendorRecordTerms Terms { get; set; }
        public VendorRecordUsage Usage { get; set; }
    }

    /* ---------------------------------------------------------- Direct billing (piv2.VendorBilling_*) */

    public sealed class VendorBillingComputyme
    {
        public string CashDiscountStored { get; set; }
        public string SurchargeStored { get; set; }
        public string SurchargeCodeStored { get; set; }
        public bool AddsSurchargeToMemberBill { get; set; }
        public string DueDaysText { get; set; }
    }

    public sealed class VendorBillingProgram
    {
        public int? ProgramNo { get; set; }
        public string Name { get; set; }
        public string SurchargeStored { get; set; }
        public string SpecialDeductionStored { get; set; }
        public string SpecialPctStored { get; set; }
        public string AdminDaysStored { get; set; }
        public string FtrStored { get; set; }
        public string SurchargeTypeStored { get; set; }
        public string YtdSalesStored { get; set; }
        public string PriorYearStored { get; set; }
        public string SurchargesStored { get; set; }
    }

    public sealed class VendorBillingSplit
    {
        public int VendorId { get; set; }
        public decimal? CashDiscountPct { get; set; }
        public decimal? ProSharePct { get; set; }
        public decimal? SpecialDeductionPct { get; set; }
        public decimal? PassToMemberPct { get; set; }
        public decimal? PassToMemberEffectivePct { get; set; }
        public bool PassToMemberIsCalculated { get; set; }
        public bool? AddSurchargeToMemberBill { get; set; }
        public DateTime? EffectiveFrom { get; set; }
        public string Notes { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string UpdatedBy { get; set; }
    }

    public sealed class VendorBillingLogEntry
    {
        public int Id { get; set; }
        public string OldJson { get; set; }
        public string NewJson { get; set; }
        public string ChangedBy { get; set; }
        public DateTime ChangedAt { get; set; }
    }

    public sealed class VendorBilling
    {
        public int VendorId { get; set; }
        public VendorBillingComputyme Computyme { get; set; }
        public List<VendorBillingProgram> Programs { get; set; } = new();
        public VendorBillingSplit Split { get; set; }
        public List<VendorBillingLogEntry> Log { get; set; } = new();
        public bool CanEdit { get; set; }
    }

    public sealed class VendorBillingSaveRequest
    {
        public decimal? CashDiscountPct { get; set; }
        public decimal? ProSharePct { get; set; }
        public decimal? SpecialDeductionPct { get; set; }
        public decimal? PassToMemberPct { get; set; }
        public bool? AddSurchargeToMemberBill { get; set; }
        public DateTime? EffectiveFrom { get; set; }
        public string Notes { get; set; }
    }

    /* ---------------------------------------------------------- Product classes (piv2.ProductClass_*) */

    public sealed class ProductClassRow
    {
        public int ClassNo { get; set; }
        public string Name { get; set; }
        public string ComputymeName { get; set; }
        public string ShortCode { get; set; }
        /* COMPUTYME (rules applied by Computyme, locked) · PIV2 (editable) */
        public string Source { get; set; }
        public string Description { get; set; }
        public decimal? TermsPct { get; set; }
        public decimal? PromptPayPct { get; set; }
        public decimal? NetNetFactor { get; set; }
        public decimal? NetNet6Factor { get; set; }
        public decimal? RalNetFactor { get; set; }
        public bool? HasDating { get; set; }
        public bool? FastShipping { get; set; }
        public bool? IsOrderBucket { get; set; }
        public string RuleRefs { get; set; }
        public bool IsActive { get; set; }
        public int Products { get; set; }
        public int LiveProducts { get; set; }
        public int Vendors { get; set; }
        /* a Computyme vendor group in use that PIV2 hasn't described yet */
        public bool NotDescribed { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string UpdatedBy { get; set; }
    }

    public sealed class ProductClassList
    {
        public List<ProductClassRow> Classes { get; set; } = new();
        public bool CanEdit { get; set; }
    }

    public sealed class ProductClassSaveRequest
    {
        public int? ClassNo { get; set; }
        public string Name { get; set; }
        public string ShortCode { get; set; }
        public string Description { get; set; }
        public decimal? TermsPct { get; set; }
        public decimal? PromptPayPct { get; set; }
        public decimal? NetNetFactor { get; set; }
        public decimal? NetNet6Factor { get; set; }
        public decimal? RalNetFactor { get; set; }
        public bool? HasDating { get; set; }
        public bool? FastShipping { get; set; }
        public bool? IsActive { get; set; }
        public string RuleRefs { get; set; }
    }
}
