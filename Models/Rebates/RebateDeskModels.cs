using System;
using System.Collections.Generic;

namespace ProInternal.Models.Rebates
{
    /*
     * The canonical fields a vendor rebate sheet is mapped to. A mapping is
     * field name → zero-based column index in the chosen header row.
     */
    public static class RebateFields
    {
        public const string ProCode = "proCode";
        public const string VendorSku = "vendorSku";
        public const string Upc = "upc";
        public const string Description = "description";
        public const string InstantRebate = "instantRebate";
        public const string Reimbursement = "reimbursement";
        public const string MapPrice = "mapPrice";
        public const string ProPad = "proPad";
        public const string StartDate = "startDate";
        public const string EndDate = "endDate";
        public const string StackProduct = "stackProduct";
        public const string RebateType = "rebateType";
        public const string Notes = "notes";

        public static readonly string[] All =
        {
            ProCode, VendorSku, Upc, Description, InstantRebate, Reimbursement, MapPrice, ProPad,
            StartDate, EndDate, StackProduct, RebateType, Notes
        };

        /* What each field means, for people on the desk and for the AI proposal. */
        public static readonly IReadOnlyDictionary<string, string> Meaning = new Dictionary<string, string>
        {
            [ProCode] = "PRO product code (4 or 5 digit number PRO assigns); usually absent in vendor files",
            [VendorSku] = "the vendor's own SKU / item number / part or catalog number for the product",
            [Upc] = "UPC or EAN barcode number",
            [Description] = "product description or model name",
            [InstantRebate] = "instant rebate amount the consumer gets off the price",
            [Reimbursement] = "amount the vendor reimburses the dealer per unit (dealer credit, wholesale rebate, support)",
            [MapPrice] = "MAP / advertised price during the program",
            [ProPad] = "PRO's own extra per unit on top of the vendor's reimbursement (PRO pad); usually absent in vendor files",
            [StartDate] = "program start date",
            [EndDate] = "program end date",
            [StackProduct] = "PRO code of a product this one stacks or bundles with",
            [RebateType] = "rebate type: IR, TITU, Bundle, Coupon, Social, FWP, or its number",
            [Notes] = "notes or comments"
        };
    }

    /* What the desk proposes for one sheet: where the headers are and which column is which field. */
    public sealed class RebateMappingProposal
    {
        public List<string> Sheets { get; set; } = new();
        public string SheetName { get; set; } = "";

        /* 1-based, as Excel shows it. */
        public int HeaderRow { get; set; }
        public List<string> Headers { get; set; } = new();

        /* The first rows under the header, as text, for the person to check the mapping against. */
        public List<List<string>> Sample { get; set; } = new();
        public int DataRows { get; set; }

        public Dictionary<string, int?> Mapping { get; set; } = new();

        /* TEMPLATE (saved for this vendor and layout), AI, or ALIAS (header names only). */
        public string Source { get; set; } = "ALIAS";
        public int? TemplateId { get; set; }
        public string Fingerprint { get; set; } = "";

        /* Why the AI chose as it did, or why it could not be used. */
        public string? Note { get; set; }

        /* The latest end date in the file + the vendor's claim window (60 days unless the vendor terms say otherwise). */
        public DateTime? SuggestedExpireOn { get; set; }

        /* From the vendor terms, pre-filled in the interview. */
        public decimal? VendorSharePct { get; set; }
        public decimal? PadPct { get; set; }
        public int? DefaultRebateType { get; set; }
        public string? CatalogPrefix { get; set; }

        /* Program dates printed above the table, for files with no date columns. */
        public DateTime? FileStartDate { get; set; }
        public DateTime? FileEndDate { get; set; }
    }

    public sealed class RebateProposalRequest
    {
        public string? SheetName { get; set; }
        public int? HeaderRow { get; set; }
    }

    public sealed class RebateMappingRequest
    {
        public string SheetName { get; set; } = "";
        public int HeaderRow { get; set; }
        public Dictionary<string, int?> Mapping { get; set; } = new();

        /* The proposal's source, and whether the person changed any column. */
        public string ProposalSource { get; set; } = "ALIAS";
        public int? TemplateId { get; set; }
        public bool Edited { get; set; }

        public int? DefaultRebateType { get; set; }
        public DateTime? ExpireOn { get; set; }
        public bool StartActive { get; set; } = true;

        /* PRO pad on combo rows (Bundle, Free with purchase), % of the vendor share. */
        public decimal? PadPct { get; set; }

        /* When the file has no reimbursement column: vendor share = this % of the instant rebate. */
        public decimal? VendorSharePct { get; set; }

        /* Dates for rows that have none in the file. */
        public DateTime? DefaultStartDate { get; set; }
        public DateTime? DefaultEndDate { get; set; }
    }

    /* One mapped row, as sent to piv2.Rebate_SetMapping. */
    public sealed class RebateMappedRow
    {
        public int SourceRow { get; set; }
        public Dictionary<string, string?> Raw { get; set; } = new();
        public string? ProCode { get; set; }
        public string? VendorSku { get; set; }
        public string? Upc { get; set; }
        public string? Description { get; set; }
        public decimal? InstantRebate { get; set; }
        public decimal? Reimbursement { get; set; }
        public decimal? MapPrice { get; set; }
        public decimal? ProPad { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string? StackProduct { get; set; }
        public int? RebateType { get; set; }
        public string? Notes { get; set; }
    }

    public sealed class RebateReasonRequest
    {
        public string? Reason { get; set; }
    }

    public sealed class RebateActiveRequest
    {
        public bool Active { get; set; }
        public string? Reason { get; set; }
    }

    public sealed class RebateLoadRequest
    {
        /* Empty loads every ready row. */
        public List<long>? RowIds { get; set; }
    }

    public sealed class RebateRowUpdate
    {
        public string? ProCode { get; set; }
        public string? VendorSku { get; set; }
        public string? Upc { get; set; }
        public string? StackProduct { get; set; }
        public string? Description { get; set; }
        public decimal? InstantRebate { get; set; }
        public decimal? Reimbursement { get; set; }
        public decimal? MapPrice { get; set; }

        /* This line's PRO pad; empty = the upload's default for combo lines. */
        public decimal? ProPad { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int? RebateType { get; set; }
        public string? Notes { get; set; }
    }

    public sealed class RebatePickModelRequest
    {
        public int? ModelId { get; set; }
    }

    public sealed class RebateDatesRequest
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public DateTime? ExpireOn { get; set; }
        public string? Reason { get; set; }
    }

    public sealed class RebateAmountsRequest
    {
        public decimal InstantRebate { get; set; }

        /* Claimed back from the vendor per unit. */
        public decimal VendorShare { get; set; }

        /* PRO's own money per unit (combo products). Member amount = VendorShare + ProPad. */
        public decimal ProPad { get; set; }
        public decimal MapPrice { get; set; }
        public string? Reason { get; set; }
    }

    public sealed class RebateAddProgramsRequest
    {
        public int ModelId { get; set; }
        public int IRType { get; set; }
        public decimal InstantRebate { get; set; }
        public decimal Reimbursement { get; set; }
        public decimal ProPad { get; set; }
        public decimal MapPrice { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public DateTime ExpireOn { get; set; }
        public int RepeatWeeks { get; set; }
        public bool StartActive { get; set; }
        public string? Reason { get; set; }
    }

    public sealed class RebateProductRequest
    {
        public string Rail { get; set; } = "IR";
        public int VendorId { get; set; }
        public string Description { get; set; } = "";

        /* Comma list, e.g. "3780, 3781". */
        public string ProCodes { get; set; } = "";
        public bool SerialNumbersRequired { get; set; }
        public string? Reason { get; set; }

        /* From purgatory: after saving, this row is set to the new product. */
        public long? ForRowId { get; set; }
    }

    public sealed class RebateStacksRequest
    {
        public List<int> StackModelIds { get; set; } = new();
        public string? Reason { get; set; }
    }

    public sealed class RebateVendorTermsRequest
    {
        public string? CatalogPrefix { get; set; }
        public string? BrandIds { get; set; }
        public decimal? VendorSharePct { get; set; }
        public decimal? ComboPadPct { get; set; }
        public int? ExpireDays { get; set; }
        public int? DefaultRebateType { get; set; }
        public string? Notes { get; set; }
    }

    public sealed class RebateCreateProductsRequest
    {
        public List<long>? RowIds { get; set; }
    }

    public sealed class PriceProtectionProgramRequest
    {
        public int ModelId { get; set; }
        public DateTime ProgramDate { get; set; }
        public decimal NewInvoiceCost { get; set; }
        public decimal Amount { get; set; }
        public decimal NewMap { get; set; }
        public bool StartActive { get; set; }
        public string? Reason { get; set; }
    }
}
