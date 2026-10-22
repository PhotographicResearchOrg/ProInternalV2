#nullable disable
using System;
using System.Collections.Generic;

namespace ProInternal.Models.Vendor
{
    /* Warehouse setup (piv2.Warehouse_*, sql/vendor-desk/04). */

    public sealed class WarehouseRow
    {
        public string WarehouseCode { get; set; }
        public string Name { get; set; }
        /* OWN · 3PL · VENDOR */
        public string WarehouseType { get; set; }
        public string Address1 { get; set; }
        public string Address2 { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string PostalCode { get; set; }
        public string Country { get; set; }
        public string Phone { get; set; }
        public string Email { get; set; }
        /* COMPUTYME · PIV2 · FEED */
        public string StockSource { get; set; }
        public bool IsActive { get; set; }
        public int SortOrder { get; set; }
        public string PrimaryContact { get; set; }
        public string PrimaryEmail { get; set; }
        public string PrimaryPhone { get; set; }
        public int Contacts { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string UpdatedBy { get; set; }
    }

    public sealed class WarehouseDetail
    {
        public string WarehouseCode { get; set; }
        public string Name { get; set; }
        public string WarehouseType { get; set; }
        public string Address1 { get; set; }
        public string Address2 { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string PostalCode { get; set; }
        public string Country { get; set; }
        public string Phone { get; set; }
        public string Email { get; set; }
        public string Website { get; set; }
        public string TimeZone { get; set; }
        public string Hours { get; set; }
        public string OrderCutoff { get; set; }
        public string ReceivingNotes { get; set; }
        public string ShippingNotes { get; set; }
        public string AccountNumber { get; set; }
        public string StockSource { get; set; }
        public string Notes { get; set; }
        public bool IsActive { get; set; }
        public int SortOrder { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string UpdatedBy { get; set; }
    }

    public sealed class WarehouseContact
    {
        public int ContactId { get; set; }
        public string WarehouseCode { get; set; }
        public string Name { get; set; }
        public string Role { get; set; }
        public string Email { get; set; }
        public string Phone { get; set; }
        public bool IsPrimary { get; set; }
        public string Notes { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string UpdatedBy { get; set; }
    }

    public sealed class WarehouseLogEntry
    {
        public int Id { get; set; }
        public string What { get; set; }
        public string OldJson { get; set; }
        public string NewJson { get; set; }
        public string ChangedBy { get; set; }
        public DateTime ChangedAt { get; set; }
    }

    public sealed class WarehouseView
    {
        public WarehouseDetail Warehouse { get; set; }
        public List<WarehouseContact> Contacts { get; set; } = new();
        public List<WarehouseLogEntry> Log { get; set; } = new();
        public bool CanEdit { get; set; }
    }

    public sealed class WarehouseList
    {
        public List<WarehouseRow> Warehouses { get; set; } = new();
        public bool CanEdit { get; set; }
    }
}
