using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers.Security;
using ProInternal.Models.Accounting.CreditDesk;
using ProInternal.Models.Orders;
using ProInternal.Services;

namespace ProInternal.Controllers
{
    /*
     * Credit Desk (replaces old ProInternal /CreditApproval). SQL: sql/accounting/01-credit-desk.sql
     *   GET  api/creditdesk/members                       every member with limit, balance, past due, exposure, held B2B orders
     *   GET  api/creditdesk/members/{account}             one member: header, open invoices, B2B orders, Computyme orders,
     *                                                     backorders, vendor POs, vendor credit approvals, notes
     *   POST api/creditdesk/orders/{orderId}/override     release a held B2B order (Orders.HoldOverride = 1) with a reason (Credit.Override)
     *   POST api/creditdesk/members/{account}/notes       add a note
     *   GET  api/creditdesk/positive-pay                  Accounting desk: last week's invoices, due this Friday
     * Cutover: before the member cutover (Member:SqlIsMaster = false) limit and credit hold are Computyme's (ARMST);
     * after it they're SQL's (Roster, edited on the Member Desk). Balance, aging and invoices stay Computyme's.
     */
    [ApiController]
    [Route("api/creditdesk")]
    public sealed class CreditDeskController : ControllerBase
    {
        public const string CreditRoute = "/credit";
        public const string CreditOverride = "Credit.Override";
        public const string AccountingRoute = "/dashboard-accounting";

        private readonly IProDataAccess _db;
        private readonly IOrdersDataAccess _orders;

        /* the member cutover switch, the same one the Member Desk uses: limit and credit hold from SQL when true */
        private readonly bool _sqlIsMaster;

        public CreditDeskController(IProDataAccess db, IOrdersDataAccess orders, IConfiguration config)
        {
            _db = db;
            _orders = orders;
            _sqlIsMaster = config.GetValue<bool>("Member:SqlIsMaster");
        }

        private string Actor => Permissions.UserName(User);
        private bool Can(string permission) => Permissions.HasAny(User, new[] { permission });

        [HttpGet("members")]
        [RequirePermission(CreditRoute, CreditOverride)]
        public IActionResult Members()
        {
            var list = _db.Credit_MemberList(_sqlIsMaster);
            list.CanOverride = Can(CreditOverride);
            list.SqlIsMaster = _sqlIsMaster;
            return Ok(list);
        }

        [HttpGet("members/{accountNumber:regex(^\\d{{1,6}}$)}")]
        [RequirePermission(CreditRoute, CreditOverride)]
        public IActionResult Member(string accountNumber)
        {
            var m = _db.Credit_MemberGet(accountNumber, _sqlIsMaster);
            if (m?.Header == null) return NotFound();
            m.CanOverride = Can(CreditOverride);
            m.SqlIsMaster = _sqlIsMaster;
            return Ok(m);
        }

        /* Accounting desk: last week's invoices, due this Friday */
        [HttpGet("positive-pay")]
        [RequirePermission(AccountingRoute, CreditRoute, CreditOverride)]
        public IActionResult PositivePay() => Ok(_db.Accounting_PositivePay());

        [HttpPost("orders/{orderId:int}/override")]
        [RequirePermission(CreditOverride)]
        public IActionResult Override(int orderId, [FromQuery] string accountNumber, [FromBody] CreditOverrideRequest request)
        {
            var reason = request?.Reason?.Trim();
            if (string.IsNullOrEmpty(reason) || reason.Length < 3)
                return BadRequest(new { message = "Say why the order is released." });

            /* the Order Toolbench's override: Orders.HoldOverride = 1, logged with who and why */
            var result = _orders.OverrideOrderHold(new OverrideOrderHoldRequest
            {
                OrderId = orderId.ToString(),
                Reason = reason,
                ActionBy = Actor,
                ActionSource = "Credit Desk"
            });
            if (result == null || !result.Success)
                return BadRequest(new { message = result?.Message ?? "The order wasn't released." });

            if (!string.IsNullOrWhiteSpace(accountNumber))
            {
                try { _db.CreditNote_Add(accountNumber.Trim(), "OVERRIDE", orderId, reason, Actor); }
                catch (SqlException) { /* the release stands; the note is a convenience */ }
            }
            return Ok(result);
        }

        [HttpPost("members/{accountNumber:regex(^\\d{{1,6}}$)}/notes")]
        [RequirePermission(CreditRoute, CreditOverride)]
        public IActionResult AddNote(string accountNumber, [FromBody] CreditNoteRequest request)
        {
            try
            {
                var id = _db.CreditNote_Add(accountNumber, string.IsNullOrWhiteSpace(request?.Kind) ? "NOTE" : request.Kind.Trim().ToUpperInvariant(),
                                            null, request?.Note, Actor);
                return Ok(new { id });
            }
            catch (SqlException ex) when (ex.Number >= 50580 && ex.Number < 50590)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
