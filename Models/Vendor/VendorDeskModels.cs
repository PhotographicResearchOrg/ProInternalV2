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

    /* ---------------------------------------------------------- Computyme terms (piv2.VendorBilling_Get) */

    public sealed class VendorBillingComputyme
    {
        public string CashDiscountStored { get; set; }
        public decimal? CashDiscountPct { get; set; }
        public string SurchargeStored { get; set; }
        public string SurchargeCodeStored { get; set; }
        public bool AddsSurchargeToMemberBill { get; set; }
        public string DueDaysText { get; set; }
        public string TermsType { get; set; }
        public int? NetDays { get; set; }
        public int? DayOfMonth { get; set; }
        public string TermsDescription { get; set; }
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

    public sealed class VendorBilling
    {
        public int VendorId { get; set; }
        public VendorBillingComputyme Computyme { get; set; }
        public List<VendorBillingProgram> Programs { get; set; } = new();
    }

    /* ---------------------------------------------------------- Fulfillment (piv2.Vendor_Fulfillment) */

    public sealed class VendorFulfillmentSummary
    {
        public int Products { get; set; }
        public int LiveProducts { get; set; }
        public int InWarehouse { get; set; }
        public int ShipsDirect { get; set; }
        public int OutOfStock { get; set; }
        public int DropShipEligible { get; set; }
        public int FromOtherBrands { get; set; }
    }

    public sealed class VendorFulfillmentBrand
    {
        public int? BrandId { get; set; }
        public string BrandName { get; set; }
        public bool BrandOnThisVendor { get; set; }
        public int Products { get; set; }
        public int LiveProducts { get; set; }
        public int InWarehouse { get; set; }
        public int ShipsDirect { get; set; }
        public int OutOfStock { get; set; }
    }

    public sealed class VendorFulfillment
    {
        public int VendorId { get; set; }
        public VendorFulfillmentSummary Summary { get; set; }
        public List<VendorFulfillmentBrand> Brands { get; set; } = new();
    }

    /* ---------------------------------------------------------- Product supply (piv2.Product_SupplyInfo) */

    public sealed class ProductSupplyVendor
    {
        public int ProductId { get; set; }
        public string ProductCode { get; set; }
        public int? BrandId { get; set; }
        public string BrandName { get; set; }
        public int? BrandVendorId { get; set; }
        public string BrandVendorName { get; set; }
        /* Computyme's actual vendor (IVMST A.VENDOR): who the product is bought from */
        public int? VendorId { get; set; }
        public string VendorName { get; set; }
        public bool VendorsDiffer { get; set; }
        public int? ClassNo { get; set; }
        public string ClassName { get; set; }
        /* IVMST field 15: 1 / 2 / 3, blank = not suspended */
        public string SuspendStatus { get; set; }
        public string SuspendMeaning { get; set; }
        public bool IsDiscontinued { get; set; }
        public bool InComputyme { get; set; }
    }

    public sealed class ProductWarehouseStock
    {
        public string WarehouseCode { get; set; }
        public string Name { get; set; }
        public string WarehouseType { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string Country { get; set; }
        public string StockSource { get; set; }
        public int? OnHand { get; set; }
        public bool ShipsDirectMarker { get; set; }
        public int? MemberOrdersWaiting { get; set; }
        public int? OnOrder { get; set; }
        public DateTime? StockDue { get; set; }
        public string BinPrimary { get; set; }
        public string BinSecondary { get; set; }
        public bool HasStockFeed { get; set; }
    }

    public sealed class ProductSupply
    {
        public ProductSupplyVendor Vendor { get; set; }
        public List<ProductWarehouseStock> Warehouses { get; set; } = new();
    }

    /* ---------------------------------------------------------- Contacts and logins (dbo.VendorUsers, piv2.VendorLogin_*) */

    public sealed class VendorLogin
    {
        public int UserId { get; set; }
        public int VendorId { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Username { get; set; }
        public string Email { get; set; }
        public string Phone { get; set; }
        public string PhoneAlt { get; set; }
        public string Fax { get; set; }
        public bool IsActive { get; set; }
        public int ContactType { get; set; }
        public string ContactTypeName { get; set; }
        public bool HasPassword { get; set; }
        public DateTime? LastLogin { get; set; }
        public DateTime? EnterDate { get; set; }
        public DateTime? UpdateDate { get; set; }
    }

    public sealed class VendorLoginLogEntry
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Action { get; set; }
        public string NewJson { get; set; }
        public string ChangedBy { get; set; }
        public DateTime ChangedAt { get; set; }
    }

    public sealed class VendorContactType
    {
        public int ContactType { get; set; }
        public string ContactDescription { get; set; }
    }

    public sealed class VendorAddressRow
    {
        public int AddressId { get; set; }
        public string Address1 { get; set; }
        public string Address2 { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string Zip { get; set; }
        public string Country { get; set; }
        public int AddressTypeId { get; set; }
        public bool IsPrimary { get; set; }
        public DateTime? EnterDate { get; set; }
        public DateTime? UpdateDate { get; set; }
    }

    public sealed class VendorLogins
    {
        public int VendorId { get; set; }
        public List<VendorLogin> Contacts { get; set; } = new();
        public List<VendorLoginLogEntry> Log { get; set; } = new();
        public List<VendorContactType> Types { get; set; } = new();
        public List<VendorAddressRow> Addresses { get; set; } = new();
        public bool CanEdit { get; set; }
    }

    public sealed class VendorLoginSaveRequest
    {
        public int? UserId { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Email { get; set; }
        public string Phone { get; set; }
        public string PhoneAlt { get; set; }
        public string Fax { get; set; }
        public int ContactType { get; set; }
        public bool IsActive { get; set; } = true;
        public string Username { get; set; }
        /* null or empty = keep the current password */
        public string Password { get; set; }
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
