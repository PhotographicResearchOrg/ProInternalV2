#nullable disable
using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using ProInternal.Helpers.Security;
using ProInternal.Models.Vendor;
using ProInternal.Services;

namespace ProInternal.Controllers
{
    /*
     * Vendor Desk foundation: cutover map, brand ↔ vendor, the Computyme vendor record, direct billing, product classes.
     *
     *   GET  api/vendordesk/cutover                       every section, who is master, and the change log
     *   PUT  api/vendordesk/cutover/{sectionKey}          change the owner (Cutover.Admin)
     *   GET  api/vendordesk/brands[?vendorId=]            brands with their vendor and callouts
     *   PUT  api/vendordesk/brands/{brandId}/vendor       move a brand (Brands.Edit) — writes dbo.Brand.VendorID (B2B vendor filter)
     *   GET  api/vendordesk/brands/history[?brandId=&vendorId=]
     *   GET  api/vendordesk/vendors/{vendorId}/record     every APMST field, parsed terms, where the vendor is used (read only)
     *   GET  api/vendordesk/vendors/{vendorId}/billing    direct billing: Computyme values + the PIV2 split
     *   PUT  api/vendordesk/vendors/{vendorId}/billing    save the split (Vendors.Edit)
     *   GET  api/vendordesk/classes                       product classes
     *   PUT  api/vendordesk/classes                       add or edit a class (ProductClasses.Edit)
     *
     * Rules live in the piv2 procedures (sql/vendor-desk/01); their refusals (50520-50539) come back as 400.
     */
    [Authorize]
    [ApiController]
    [Route("api/vendordesk")]
    public sealed class VendorDeskController : ControllerBase
    {
        public const string CutoverRoute = "/cutover";
        public const string BrandsRoute = "/brandvendors";
        public const string VendorCardRoute = "/vendor-card";
        public const string VendorAccountsRoute = "/accountmanagement";
        public const string CutoverAdmin = "Cutover.Admin";
        public const string BrandsEdit = "Brands.Edit";
        public const string VendorsEdit = "Vendors.Edit";
        public const string ClassesEdit = "ProductClasses.Edit";

        private readonly IProDataAccess _db;

        public VendorDeskController(IProDataAccess db)
        {
            _db = db;
        }

        private string Actor => Permissions.UserName(User);
        private bool Can(string permission) => Permissions.HasAny(User, new[] { permission });

        private IActionResult Run(Func<object> action)
        {
            try { return Ok(action()); }
            catch (SqlException ex) when (ex.Number >= 50520 && ex.Number < 50540)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // ------------------------------------------------------------ cutover map

        [HttpGet("cutover")]
        [RequirePermission(CutoverRoute, CutoverAdmin)]
        public IActionResult Cutover()
        {
            var map = _db.Cutover_List();
            map.CanEdit = Can(CutoverAdmin);
            return Ok(map);
        }

        [HttpPut("cutover/{sectionKey}")]
        [RequirePermission(CutoverAdmin)]
        public IActionResult SetOwner(string sectionKey, [FromBody] CutoverOwnerRequest request)
        {
            if (request == null) return BadRequest(new { message = "Nothing to save." });
            return Run(() =>
            {
                _db.Cutover_SetOwner(sectionKey, request.Owner?.Trim().ToUpperInvariant(), request.NextStep, request.Note, Actor);
                return _db.Cutover_List();
            });
        }

        // ------------------------------------------------------------ brands

        [HttpGet("brands")]
        [RequirePermission(BrandsRoute, VendorCardRoute, VendorAccountsRoute, BrandsEdit, VendorsEdit)]
        public IActionResult Brands([FromQuery] int? vendorId = null)
        {
            return Ok(new BrandVendorList { Brands = _db.BrandVendor_List(vendorId), CanEdit = Can(BrandsEdit) });
        }

        [HttpPut("brands/{brandId:int}/vendor")]
        [RequirePermission(BrandsEdit)]
        public IActionResult MoveBrand(int brandId, [FromBody] BrandVendorMoveRequest request)
        {
            if (request == null) return BadRequest(new { message = "Nothing to save." });
            return Run(() =>
            {
                _db.BrandVendor_Set(brandId, request.VendorId, request.Reason, Actor);
                return new { brandId, vendorId = request.VendorId };
            });
        }

        [HttpGet("brands/history")]
        [RequirePermission(BrandsRoute, VendorCardRoute, VendorAccountsRoute, BrandsEdit, VendorsEdit)]
        public IActionResult BrandHistory([FromQuery] int? brandId = null, [FromQuery] int? vendorId = null)
        {
            return Ok(_db.BrandVendor_History(brandId, vendorId));
        }

        // ------------------------------------------------------------ vendor record and direct billing

        [HttpGet("vendors/{vendorId:int}/record")]
        [RequirePermission(VendorCardRoute, VendorAccountsRoute, BrandsRoute, VendorsEdit)]
        public IActionResult Record(int vendorId)
        {
            return Ok(_db.Vendor_ComputymeRecord(vendorId));
        }

        [HttpGet("vendors/{vendorId:int}/billing")]
        [RequirePermission(VendorCardRoute, VendorAccountsRoute, VendorsEdit)]
        public IActionResult Billing(int vendorId)
        {
            var billing = _db.VendorBilling_Get(vendorId);
            billing.CanEdit = Can(VendorsEdit);
            return Ok(billing);
        }

        [HttpPut("vendors/{vendorId:int}/billing")]
        [RequirePermission(VendorsEdit)]
        public IActionResult SaveBilling(int vendorId, [FromBody] VendorBillingSaveRequest request)
        {
            if (request == null) return BadRequest(new { message = "Nothing to save." });
            return Run(() =>
            {
                _db.VendorBilling_Save(vendorId, request, Actor);
                var billing = _db.VendorBilling_Get(vendorId);
                billing.CanEdit = true;
                return billing;
            });
        }

        // ------------------------------------------------------------ product classes

        [HttpGet("classes")]
        [RequirePermission(BrandsRoute, VendorCardRoute, ClassesEdit)]
        public IActionResult Classes()
        {
            return Ok(new ProductClassList { Classes = _db.ProductClass_List(), CanEdit = Can(ClassesEdit) });
        }

        [HttpPut("classes")]
        [RequirePermission(ClassesEdit)]
        public IActionResult SaveClass([FromBody] ProductClassSaveRequest request)
        {
            if (request == null) return BadRequest(new { message = "Nothing to save." });
            return Run(() => new { classNo = _db.ProductClass_Save(request, Actor) });
        }
    }
}
