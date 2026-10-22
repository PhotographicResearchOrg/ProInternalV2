#nullable disable
using System;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using ProInternal.Helpers.Security;
using ProInternal.Models.Vendor;
using ProInternal.Services;

namespace ProInternal.Controllers
{
    /*
     * Warehouses: where stock is held (PRO's own PA warehouse, 3PLs later), with address, hours and contacts.
     *   GET    api/warehouses                       every warehouse
     *   GET    api/warehouses/{code}                one warehouse, its contacts, its change log
     *   PUT    api/warehouses                       add or change a warehouse (Warehouses.Edit)
     *   PUT    api/warehouses/{code}/contacts       add or change a contact (Warehouses.Edit)
     *   DELETE api/warehouses/contacts/{id}         remove a contact (Warehouses.Edit)
     * Rules are in the piv2.Warehouse_* procedures (sql/vendor-desk/04); refusals (50550-50559) come back as 400.
     */
    [Authorize]
    [ApiController]
    [Route("api/warehouses")]
    public sealed class WarehousesController : ControllerBase
    {
        public const string ScreenRoute = "/warehouses";
        public const string EditPermission = "Warehouses.Edit";
        private const string ProductEditRoute = "/productedit";

        private readonly IProDataAccess _db;
        public WarehousesController(IProDataAccess db) { _db = db; }

        private string Actor => Permissions.UserName(User);
        private bool CanEdit => Permissions.HasAny(User, new[] { EditPermission });

        private IActionResult Run(Func<object> action)
        {
            try { return Ok(action()); }
            catch (SqlException ex) when (ex.Number >= 50550 && ex.Number < 50560) { return BadRequest(new { message = ex.Message }); }
        }

        public sealed class ContactBody
        {
            public int? ContactId { get; set; }
            public string Name { get; set; }
            public string Role { get; set; }
            public string Email { get; set; }
            public string Phone { get; set; }
            public bool IsPrimary { get; set; }
            public string Notes { get; set; }
        }

        [HttpGet]
        [RequirePermission(ScreenRoute, EditPermission, ProductEditRoute)]
        public IActionResult List() => Ok(new WarehouseList { Warehouses = _db.Warehouse_List(), CanEdit = CanEdit });

        [HttpGet("{code}")]
        [RequirePermission(ScreenRoute, EditPermission)]
        public IActionResult Get(string code)
        {
            var view = _db.Warehouse_Get(code);
            if (view.Warehouse == null) return NotFound(new { message = "That warehouse doesn't exist." });
            view.CanEdit = CanEdit;
            return Ok(view);
        }

        [HttpPut]
        [RequirePermission(EditPermission)]
        public IActionResult Save([FromBody] JsonElement body)
        {
            if (body.ValueKind != JsonValueKind.Object) return BadRequest(new { message = "Nothing to save." });
            return Run(() => new { warehouseCode = _db.Warehouse_Save(body.GetRawText(), Actor) });
        }

        [HttpPut("{code}/contacts")]
        [RequirePermission(EditPermission)]
        public IActionResult SaveContact(string code, [FromBody] ContactBody c)
        {
            if (c == null) return BadRequest(new { message = "Nothing to save." });
            return Run(() => new { contactId = _db.WarehouseContact_Save(c.ContactId, code, c.Name, c.Role, c.Email, c.Phone, c.IsPrimary, c.Notes, Actor) });
        }

        [HttpDelete("contacts/{contactId:int}")]
        [RequirePermission(EditPermission)]
        public IActionResult DeleteContact(int contactId)
        {
            return Run(() => { _db.WarehouseContact_Delete(contactId, Actor); return new { deleted = true }; });
        }
    }
}
