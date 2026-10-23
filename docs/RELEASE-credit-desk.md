# Credit Desk: release notes

Replaces old ProInternal `/CreditApproval`. Menu: Dashboards › Accounting › Credit Desk (`/credit`); it's also linked from the Accounting desk.

## Run (PRO, safe to run twice)
`sql/accounting/01-credit-desk.sql` adds:
- the `piv2.CreditNote` table and its procedures;
- the `Credit.Override` permission.

It reads the Computyme mirror (EDA) and the B2B order tables, and changes no Computyme or EDA data.

## Security Admin
- Add `/credit` as a menu route for accounting. Member pages open from it (`/credit?account=1747`), so no second route is needed.
- Grant `Credit.Override` to the people who may release held orders.

## What it shows
- **Every member:**
  - limit, balance, past due, open orders, vendor POs and available;
  - B2B orders held for credit, with their value;
  - credit hold, over-limit flags and pending vendor credit approvals.
  - Filter chips: Held orders, Over limit, Past due, Credit hold, Vendor credits and All. Search and Excel export.
- **One member:**
  - the figures plus "How it adds up": open invoices, shipping in 5 days, allocated backorders, EZPay in transit, invoice available, YTD sales and investment;
  - tabs for B2B orders, Open invoices, Computyme orders, Backorders, Vendor POs, Vendor credits and Notes;
  - Excel export of every tab.

The figures use the old screen's formulas (see the header of the SQL).

## What it changes
- **Release a held B2B order.** This sets `Orders.HoldOverride = 1` through the existing `dbo.PIV2_Orders_OverrideHold`, the same as the Order Toolbench's override.
  - A reason is required, and it is logged.
  - The reason is also filed as a note on the member.
- **Notes and "Mark reviewed".** These are stored in `piv2.CreditNote`. Nothing is deleted.

## Not moved
- **The member's Computyme credit hold (ARMST CRED_STAT).** It is shown, not changed.
  - The old screen flipped it by scripting a Computyme terminal session.
  - That waits for the member cutover.
- **Vendor credit approval entry (old NewApproval).** Pending approvals are shown; entry stays on the old site for now.
