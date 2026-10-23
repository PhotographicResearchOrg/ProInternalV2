/* ---------------------------------------------------------------
    Accounting · 01  Credit Desk (replaces old ProInternal /CreditApproval)

    Database: PRO      Safe to run twice. Adds one notes table, its procedures and two read procedures.
    Reads the Computyme mirror (EDA) and the B2B order tables; changes no Computyme or EDA data.

    The only write to an existing table is the hold override on a B2B order, and that goes through the
    existing dbo.PIV2_Orders_OverrideHold (the Order Toolbench's override): Orders.HoldOverride = 1, logged.
    The member's credit hold itself (ARMST CRED_STAT) stays Computyme's: shown, not changed here.

    The figures follow the old screen (CreditApprovalController.PullCreditStatus / GetVendorDetails):
      Limit               ARMST LIMIT (dollars)
      Balance             ARMST BAL / 100
      Past due            (DAYS30 + DAYS60 + DAYS90) / 100
      Open orders         ARMST ORDERS / 100                 (Computyme's open order total)
      Vendor exposure     VENDORD AMOUNT (direct-vendor POs counted against credit), billed = BILLED
      Available           Limit - (Balance + Open orders + Vendor exposure)
      Shipping soon       IVORD_REP orders shipping in the next 5 days (sum of line C)
      Open invoices       ARHIST lines with no paid date (sum of AMOUNT)
      Allocated           VNORD backorder lines allocated, shipping within 5 days or overdue: ALLOCATE x NET_1 / 100
      EZPay in transit    PRO_EZPAY rows PAID whose invoice isn't marked paid yet
      Invoice available   Limit - (Shipping soon + Open invoices + Allocated) + EZPay in transit
      Investment          STOCK SHARES x current share value (dbo.ShareAmount) + PATR_BAL + PATR_CR
      On hold             ARMST CRED_STAT > 0
    B2B orders in flight: dbo.Orders with OrderStatusId = 1. Held = AutoHold = 1 and HoldOverride isn't 1.

    Cutover (same switch as the Member Desk: appsettings Member:SqlIsMaster, passed in as @SqlIsMaster):
      before   limit and credit hold come from Computyme (ARMST LIMIT, CRED_STAT)        LimitSource = COMPUTYME
      after    limit and credit hold come from SQL (dbo.Roster CreditLimit, CreditHoldSince/Reason,
               edited on the Member Desk)                                                 LimitSource = SQL
      always   balance, aging, invoices, Computyme orders, backorders and vendor POs stay Computyme's
               until receivables (accounting.ar) cuts over; held-order releases and notes are SQL.
    piv2.vMemberCreditSql is built from the Roster columns that exist; run this script again after the
    Member Desk's 01-member-tables.sql if its credit hold columns weren't there the first time.
    The cutover map gets a section 'accounting.credit' (MIXED), insert-only.

    piv2.CreditNote          accounting's notes on a member (who, when, what; nothing is deleted)
    piv2.Credit_MemberList   every member on the B2B site, with the figures above (except the per-line ones)
    piv2.Credit_MemberGet    @AccountNumber: header, open invoices, B2B orders, Computyme orders,
                             backorders, vendor POs, vendor credit approvals, notes
    piv2.CreditNote_Add      add a note
   --------------------------------------------------------------- */

USE PRO;
GO
SET NOCOUNT ON;
GO
IF SCHEMA_ID('piv2') IS NULL EXEC('CREATE SCHEMA piv2');
GO

IF OBJECT_ID('piv2.CreditNote', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.CreditNote
    (
        Id            int IDENTITY(1,1) NOT NULL CONSTRAINT PK_CreditNote PRIMARY KEY,
        AccountNumber varchar(20)    NOT NULL,
        Kind          varchar(20)    NOT NULL CONSTRAINT DF_CreditNote_Kind DEFAULT ('NOTE'),  -- NOTE / OVERRIDE / REVIEWED
        OrderId       int            NULL,
        Note          nvarchar(2000) NOT NULL,
        CreatedBy     nvarchar(150)  NULL,
        CreatedAt     datetime2(0)   NOT NULL CONSTRAINT DF_CreditNote_At DEFAULT (SYSUTCDATETIME())
    );
    CREATE INDEX IX_CreditNote_Account ON piv2.CreditNote (AccountNumber, Id DESC);
END
GO

/* ------------------------------------------------ the SQL side of credit (for after the member cutover) */
DECLARE @since sysname = CASE WHEN COL_LENGTH('dbo.Roster', 'CreditHoldSince') IS NOT NULL THEN N'r.CreditHoldSince' ELSE N'CAST(NULL AS datetime)' END,
        @reason sysname = CASE WHEN COL_LENGTH('dbo.Roster', 'CreditHoldReason') IS NOT NULL THEN N'CAST(r.CreditHoldReason AS nvarchar(400))' ELSE N'CAST(NULL AS nvarchar(400))' END,
        @limit sysname = CASE WHEN COL_LENGTH('dbo.Roster', 'CreditLimit') IS NOT NULL THEN N'CAST(r.CreditLimit AS float)' ELSE N'CAST(NULL AS float)' END;
DECLARE @v nvarchar(max) = N'CREATE OR ALTER VIEW piv2.vMemberCreditSql
AS
/* Credit limit and credit hold as SQL holds them (Member Desk). Built by sql/accounting/01-credit-desk.sql. */
SELECT LTRIM(RTRIM(r.AccountNumber)) AS AccountNumber, ' + @limit + N' AS CreditLimit,
       ' + @since + N' AS CreditHoldSince, ' + @reason + N' AS CreditHoldReason
FROM dbo.Roster r
WHERE TRY_CAST(r.AccountNumber AS int) IS NOT NULL;';
EXEC sys.sp_executesql @v;
IF COL_LENGTH('dbo.Roster', 'CreditHoldSince') IS NULL
    PRINT 'dbo.Roster has no CreditHoldSince yet: after the member cutover the hold will read as not held. Run this again after the Member Desk tables are in.';
GO

IF OBJECT_ID('piv2.CutoverSection', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM piv2.CutoverSection WHERE SectionKey = 'accounting.credit')
    INSERT piv2.CutoverSection (SectionKey, Area, Name, Owner, Summary, ComputymeSource, SqlObjects, B2BReads, PivScreen, NextStep, SortOrder, UpdatedBy)
    VALUES ('accounting.credit', N'Accounting', N'Member credit (limit, hold, releases)', 'MIXED',
            N'Limit and credit hold are Computyme''s until the member cutover (Member:SqlIsMaster), then SQL''s on the Member Desk. Balance, aging and invoices stay Computyme''s until receivables cut over. Releasing a held B2B order and the notes are SQL.',
            N'ARMST LIMIT, BAL, DAYS30-90, ORDERS, CRED_STAT; ARHIST; VENDORD; VNORD; IVORD', N'dbo.Roster CreditLimit/CreditHold*, dbo.Orders HoldOverride, piv2.CreditNote',
            N'Checkout credit check (ProcessOrder, Cart_GetCheckoutTotal read ARMST LIMIT)', N'Credit Desk',
            N'Flip with the member cutover; the B2B credit check moves to Roster.CreditLimit in the same release.', 205, N'seed');
GO

/* ------------------------------------------------ every member */
CREATE OR ALTER PROCEDURE piv2.Credit_MemberList
    @SqlIsMaster bit = 0
AS
BEGIN
    SET NOCOUNT ON;

    WITH mem AS (
        SELECT LTRIM(RTRIM(r.AccountNumber)) AS AccountNumber, r.RosterId, r.Company, r.DBA, r.MemberType, r.OnWeb
        FROM dbo.Roster r
        WHERE TRY_CAST(r.AccountNumber AS int) IS NOT NULL AND ISNULL(r.Retired, 0) = 0
    ),
    ar AS (
        SELECT CAST(a.ID AS varchar(20)) COLLATE DATABASE_DEFAULT AS AccountNumber,
               CAST(a.HNAME AS nvarchar(200)) AS ComputymeName,
               src.Limit,
           TRY_CAST(a.LIMIT AS float) AS ComputymeLimit, sq.CreditLimit AS SqlLimit,
           CAST(CASE WHEN @SqlIsMaster = 1 THEN 'SQL' ELSE 'COMPUTYME' END AS varchar(10)) AS LimitSource,
               TRY_CAST(a.BAL AS float) / 100.0 AS Balance,
               TRY_CAST(a.ORDERS AS float) / 100.0 AS OpenOrders,
               (ISNULL(TRY_CAST(a.DAYS30 AS float), 0) + ISNULL(TRY_CAST(a.DAYS60 AS float), 0) + ISNULL(TRY_CAST(a.DAYS90 AS float), 0)) / 100.0 AS PastDue,
               ISNULL(TRY_CAST(a.DAYS90 AS float), 0) / 100.0 AS Days90,
               TRY_CAST(a.Y_SALES AS float) / 100.0 AS YtdSales,
               TRY_CAST(a.HI_CRED AS float) AS HighCredit,
               CAST(CASE WHEN ISNULL(TRY_CAST(a.CRED_STAT AS int), 0) > 0 THEN 1 ELSE 0 END AS bit) AS OnHold
        FROM EDA.ARMST.ARMST a
    ),
    vend AS (
        SELECT CAST(v.ID AS varchar(20)) COLLATE DATABASE_DEFAULT AS AccountNumber,
               SUM(ISNULL(am.AMOUNT, 0)) AS VendorExposure, SUM(ISNULL(b.BILLED, 0)) AS VendorBilled
        FROM EDA.VENDORD.VENDOR_MV v
        LEFT JOIN EDA.VENDORD.AMOUNT_MV am ON am.ID = v.ID AND am.AMOUNT_MV_POS = v.VENDOR_MV_POS
        LEFT JOIN EDA.VENDORD.BILLED_MV b  ON b.ID = v.ID AND b.BILLED_MV_POS = v.VENDOR_MV_POS
        GROUP BY v.ID
    ),
    web AS (
        SELECT LTRIM(RTRIM(r.AccountNumber)) AS AccountNumber,
               COUNT(DISTINCT o.OrderId) AS WebOrders,
               COUNT(DISTINCT CASE WHEN o.AutoHold = 1 AND ISNULL(o.HoldOverride, 0) = 0 THEN o.OrderId END) AS HeldOrders,
               SUM(CASE WHEN o.AutoHold = 1 AND ISNULL(o.HoldOverride, 0) = 0 THEN ISNULL(i.DiscountPrice, 0) * i.Quantity ELSE 0 END) AS HeldValue,
               SUM(ISNULL(i.DiscountPrice, 0) * i.Quantity) AS WebValue
        FROM dbo.Orders o
        JOIN dbo.Users u ON u.UserId = o.UserId
        JOIN dbo.Roster r ON r.RosterId = u.CompanyId
        LEFT JOIN dbo.OrderItem i ON i.OrderId = o.OrderId
        WHERE o.OrderStatusId = 1
        GROUP BY LTRIM(RTRIM(r.AccountNumber))
    ),
    vca AS (
        SELECT LTRIM(RTRIM(c.MemberID)) AS AccountNumber, SUM(c.CreditAmount) AS PendingVendorCredits, COUNT(*) AS PendingVendorCreditCount
        FROM dbo.VendorCreditApproval c
        WHERE c.Processed = 0
        GROUP BY LTRIM(RTRIM(c.MemberID))
    ),
    lastNote AS (
        SELECT n.AccountNumber, MAX(n.CreatedAt) AS LastNoteAt
        FROM piv2.CreditNote n GROUP BY n.AccountNumber
    )
    SELECT m.AccountNumber,
           COALESCE(NULLIF(LTRIM(m.DBA), ''), m.Company, ar.ComputymeName) AS Name,
           m.MemberType, CAST(ISNULL(m.OnWeb, 0) AS bit) AS OnWeb,
           CAST(CASE WHEN ar.AccountNumber IS NULL THEN 0 ELSE 1 END AS bit) AS InComputyme,
           src.Limit, ar.Balance, ar.PastDue, ar.Days90, ar.OpenOrders,
           ISNULL(vd.VendorExposure, 0) AS VendorExposure, ISNULL(vd.VendorBilled, 0) AS VendorBilled,
           src.Limit - (ISNULL(ar.Balance, 0) + ISNULL(ar.OpenOrders, 0) + ISNULL(vd.VendorExposure, 0)) AS Available,
           ar.YtdSales, ar.HighCredit, src.OnHold,
           CAST(CASE WHEN @SqlIsMaster = 1 THEN 'SQL' ELSE 'COMPUTYME' END AS varchar(10)) AS LimitSource,
           ISNULL(w.WebOrders, 0) AS WebOrders, ISNULL(w.WebValue, 0) AS WebValue,
           ISNULL(w.HeldOrders, 0) AS HeldOrders, ISNULL(w.HeldValue, 0) AS HeldValue,
           ISNULL(c.PendingVendorCredits, 0) AS PendingVendorCredits, ISNULL(c.PendingVendorCreditCount, 0) AS PendingVendorCreditCount,
           ln.LastNoteAt
    FROM mem m
    LEFT JOIN ar   ON ar.AccountNumber = m.AccountNumber
    LEFT JOIN vend vd ON vd.AccountNumber = m.AccountNumber
    LEFT JOIN web  w  ON w.AccountNumber = m.AccountNumber
    LEFT JOIN vca  c  ON c.AccountNumber = m.AccountNumber
    LEFT JOIN lastNote ln ON ln.AccountNumber = m.AccountNumber
    LEFT JOIN piv2.vMemberCreditSql sq ON sq.AccountNumber = m.AccountNumber
    CROSS APPLY (SELECT CASE WHEN @SqlIsMaster = 1 THEN sq.CreditLimit ELSE ar.Limit END AS Limit,
                        CAST(CASE WHEN @SqlIsMaster = 1 THEN CASE WHEN sq.CreditHoldSince IS NOT NULL THEN 1 ELSE 0 END
                                  ELSE ISNULL(ar.OnHold, 0) END AS bit) AS OnHold) src
    WHERE m.OnWeb = 1 OR w.WebOrders > 0
    ORDER BY CASE WHEN w.HeldOrders > 0 THEN 0 ELSE 1 END, Name;
END
GO

/* ------------------------------------------------ one member */
CREATE OR ALTER PROCEDURE piv2.Credit_MemberGet
    @AccountNumber varchar(20),
    @SqlIsMaster   bit = 0
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @acct varchar(20) = LTRIM(RTRIM(@AccountNumber)), @now datetime = GETDATE();

    /* figures that need the detail tables */
    DECLARE @shipSoon float, @openInv float, @allocated float, @ezpay float, @share float, @investment float;

    SELECT @shipSoon = SUM(TRY_CAST(l.C AS float))
    FROM EDA.IVORD_REP.IVORD_REP o
    JOIN EDA.IVORD_REP.PQC_MV l ON l.ID = o.ID
    WHERE o.ACCOUNT COLLATE DATABASE_DEFAULT = @acct AND o.SHIP > @now AND DATEDIFF(day, @now, o.SHIP) <= 5;

    SELECT @openInv = SUM(d.AMOUNT)
    FROM EDA.ARHIST.ARHIST h
    JOIN EDA.ARHIST.PDQAE_MV d ON d.ID = h.ID
    WHERE LEFT(h.ID, 4) COLLATE DATABASE_DEFAULT = @acct AND h.DT_PAID IS NULL;

    SELECT @allocated = SUM(ISNULL(TRY_CAST(pq.ALLOCATE AS float), 0) * ISNULL(TRY_CAST(iv.NET_1 AS float), 0) / 100.0)
    FROM EDA.VNORD.VNORD v
    JOIN EDA.VNORD.QP_MV qp ON qp.ID = v.ID
    JOIN EDA.VNORD.PQ_MV pq ON pq.ID = qp.ID AND pq.PQ_MV_POS = qp.QP_MV_POS
    LEFT JOIN EDA.IVMST.IVMST iv ON iv.ID = qp.P
    WHERE v.MEMBER COLLATE DATABASE_DEFAULT = @acct AND pq.ALLOCATE IS NOT NULL
      AND (DATEDIFF(day, @now, v.SHIP) <= 5 OR @now > v.SHIP);

    SELECT @ezpay = SUM(z.EZPAYNET)
    FROM EDA.dbo.PRO_EZPAY z
    LEFT JOIN EDA.ARHIST.ARHIST h ON h.ID = CAST(z.Account AS varchar(50)) + z.Invoice
    WHERE z.BTSA = 'PAID' AND z.Account COLLATE DATABASE_DEFAULT = @acct AND h.DT_PAID IS NULL;

    IF OBJECT_ID('dbo.ShareAmount', 'U') IS NOT NULL
        EXEC sp_executesql N'SELECT TOP (1) @s = ShareAmount FROM dbo.ShareAmount ORDER BY DateChanged DESC;', N'@s float OUTPUT', @s = @share OUTPUT;

    SELECT @investment = ISNULL(TRY_CAST(s.SHARES AS float), 0) * ISNULL(@share, 0) + ISNULL(s.PATR_BAL, 0) + ISNULL(s.PATR_CR, 0)
    FROM EDA.STOCK.STOCK s
    WHERE TRY_CAST(s.ID AS int) = TRY_CAST(@acct AS int);

    /* 1. header */
    SELECT TOP (1)
           @acct AS AccountNumber,
           COALESCE(NULLIF(LTRIM(r.DBA), ''), r.Company, CAST(a.HNAME AS nvarchar(200))) AS Name,
           CAST(a.HNAME AS nvarchar(200)) AS ComputymeName, r.MemberType, CAST(ISNULL(r.OnWeb, 0) AS bit) AS OnWeb, r.Phone, r.Email,
           CAST(CASE WHEN a.ID IS NULL THEN 0 ELSE 1 END AS bit) AS InComputyme,
           TRY_CAST(a.LIMIT AS float) AS Limit,
           TRY_CAST(a.BAL AS float) / 100.0 AS Balance,
           TRY_CAST(a.CURR AS float) / 100.0 AS CurrentDue,
           TRY_CAST(a.DAYS30 AS float) / 100.0 AS Days30,
           TRY_CAST(a.DAYS60 AS float) / 100.0 AS Days60,
           TRY_CAST(a.DAYS90 AS float) / 100.0 AS Days90,
           (ISNULL(TRY_CAST(a.DAYS30 AS float), 0) + ISNULL(TRY_CAST(a.DAYS60 AS float), 0) + ISNULL(TRY_CAST(a.DAYS90 AS float), 0)) / 100.0 AS PastDue,
           TRY_CAST(a.ORDERS AS float) / 100.0 AS OpenOrders,
           ISNULL(vx.VendorExposure, 0) AS VendorExposure, ISNULL(vx.VendorBilled, 0) AS VendorBilled,
           src.Limit - (ISNULL(TRY_CAST(a.BAL AS float), 0) / 100.0 + ISNULL(TRY_CAST(a.ORDERS AS float), 0) / 100.0 + ISNULL(vx.VendorExposure, 0)) AS Available,
           ISNULL(@shipSoon, 0) AS ShippingSoon, ISNULL(@openInv, 0) AS OpenInvoices, ISNULL(@allocated, 0) AS Allocated,
           ISNULL(@ezpay, 0) AS EzPayInTransit,
           src.Limit - (ISNULL(@shipSoon, 0) + ISNULL(@openInv, 0) + ISNULL(@allocated, 0)) + ISNULL(@ezpay, 0) AS InvoiceAvailable,
           TRY_CAST(a.HI_CRED AS float) AS HighCredit, TRY_CAST(a.CY_HI_CRED AS float) AS CurrentYearHigh,
           TRY_CAST(a.Y_SALES AS float) / 100.0 AS YtdSales,
           @investment AS Investment,
           src.OnHold,
           CAST(a.CRED_STAT AS varchar(20)) AS CreditStatus,
           CAST(CASE WHEN ISNULL(TRY_CAST(a.CRED_STAT AS int), 0) > 0 THEN 1 ELSE 0 END AS bit) AS ComputymeOnHold,
           sq.CreditHoldSince AS SqlHoldSince, sq.CreditHoldReason AS SqlHoldReason
    FROM (SELECT @acct AS AccountNumber) k
    LEFT JOIN dbo.Roster r ON LTRIM(RTRIM(r.AccountNumber)) = @acct
    LEFT JOIN EDA.ARMST.ARMST a ON a.ID COLLATE DATABASE_DEFAULT = @acct
    OUTER APPLY (SELECT SUM(ISNULL(am.AMOUNT, 0)) AS VendorExposure, SUM(ISNULL(b.BILLED, 0)) AS VendorBilled
                 FROM EDA.VENDORD.VENDOR_MV v
                 LEFT JOIN EDA.VENDORD.AMOUNT_MV am ON am.ID = v.ID AND am.AMOUNT_MV_POS = v.VENDOR_MV_POS
                 LEFT JOIN EDA.VENDORD.BILLED_MV b  ON b.ID = v.ID AND b.BILLED_MV_POS = v.VENDOR_MV_POS
                 WHERE v.ID COLLATE DATABASE_DEFAULT = @acct) vx
    LEFT JOIN piv2.vMemberCreditSql sq ON sq.AccountNumber = @acct
    CROSS APPLY (SELECT CASE WHEN @SqlIsMaster = 1 THEN sq.CreditLimit ELSE TRY_CAST(a.LIMIT AS float) END AS Limit,
                        CAST(CASE WHEN @SqlIsMaster = 1 THEN CASE WHEN sq.CreditHoldSince IS NOT NULL THEN 1 ELSE 0 END
                                  ELSE CASE WHEN ISNULL(TRY_CAST(a.CRED_STAT AS int), 0) > 0 THEN 1 ELSE 0 END END AS bit) AS OnHold) src;

    /* 2. open invoices (Computyme ARHIST, not paid) */
    SELECT CAST(h.ID AS varchar(20)) AS InvoiceKey, SUBSTRING(h.ID, 5, 20) AS Invoice, h.DT_POSTED AS Posted, h.DATE_C AS InvoiceDate,
           h.TERMS AS Terms, h.P_O_ AS PO, h.VINVNO AS VendorInvoice,
           COALESCE(CAST(ap.SH_NAME AS nvarchar(100)), CASE WHEN NULLIF(LTRIM(h.VEND), '') IS NULL THEN N'PRO' END, h.VEND) AS VendorName,
           SUM(d.AMOUNT) AS Gross,
           TRY_CAST(CASE WHEN CHARINDEX('%', h.TERMS) > 1 THEN LEFT(h.TERMS, CHARINDEX('%', h.TERMS) - 1) END AS float) AS DiscountPct,
           DATEDIFF(day, h.DT_POSTED, @now) AS AgeDays
    FROM EDA.ARHIST.ARHIST h
    JOIN EDA.ARHIST.PDQAE_MV d ON d.ID = h.ID
    OUTER APPLY (SELECT TOP (1) x.SH_NAME FROM EDA.APMST.APMST x WHERE x.ID = d.HPROD) ap
    WHERE LEFT(h.ID, 4) COLLATE DATABASE_DEFAULT = @acct AND h.DT_PAID IS NULL
    GROUP BY h.ID, h.DT_POSTED, h.DATE_C, h.TERMS, h.P_O_, h.VINVNO, h.VEND, ap.SH_NAME
    ORDER BY h.DT_POSTED;

    /* 3. B2B orders in flight (dbo.Orders, status 1) */
    SELECT o.OrderId, o.PONumber AS PO, o.EnterDate AS Entered,
           SUM(ISNULL(i.DiscountPrice, 0) * i.Quantity) AS Total, COUNT(i.OrderId) AS Lines,
           CAST(ISNULL(o.AutoHold, 0) AS bit) AS AutoHold, CAST(ISNULL(o.HoldOverride, 0) AS bit) AS HoldOverride,
           CAST(CASE WHEN o.AutoHold = 1 AND ISNULL(o.HoldOverride, 0) = 0 THEN 1 ELSE 0 END AS bit) AS Held,
           LTRIM(RTRIM(CONCAT(u.FirstName, ' ', u.LastName))) AS OrderedBy
    FROM dbo.Orders o
    JOIN dbo.Users u ON u.UserId = o.UserId
    JOIN dbo.Roster r ON r.RosterId = u.CompanyId
    LEFT JOIN dbo.OrderItem i ON i.OrderId = o.OrderId
    WHERE LTRIM(RTRIM(r.AccountNumber)) = @acct AND o.OrderStatusId = 1
    GROUP BY o.OrderId, o.PONumber, o.EnterDate, o.AutoHold, o.HoldOverride, u.FirstName, u.LastName
    ORDER BY o.EnterDate DESC;

    /* 4. Computyme orders (IVORD) */
    SELECT CAST(o.ID AS varchar(20)) AS OrderKey, o.P_O_ AS PO, o.SHIP AS ShipDate, o.CODE AS Code, o.WEBORDER AS WebOrder,
           SUM(TRY_CAST(l.C AS float)) AS Total, COUNT(l.ID) AS Lines,
           CAST(CASE WHEN o.SHIP > @now AND DATEDIFF(day, @now, o.SHIP) <= 5 THEN 1 ELSE 0 END AS bit) AS ShipsSoon
    FROM EDA.IVORD_REP.IVORD_REP o
    LEFT JOIN EDA.IVORD_REP.PQC_MV l ON l.ID = o.ID
    WHERE o.ACCOUNT COLLATE DATABASE_DEFAULT = @acct
    GROUP BY o.ID, o.P_O_, o.SHIP, o.CODE, o.WEBORDER
    ORDER BY o.SHIP;

    /* 5. backorders (VNORD lines) */
    SELECT CAST(v.ID AS varchar(20)) AS BackorderKey, v.P_O_ AS PO, v.DATE AS Ordered, v.SHIP AS ShipDate,
           CAST(qp.P AS varchar(20)) AS ProductCode, CAST(iv.DESC_C AS nvarchar(200)) AS Description,
           TRY_CAST(qp.Q AS float) AS Quantity, TRY_CAST(pq.ALLOCATE AS float) AS AllocatedQty,
           TRY_CAST(iv.NET_1 AS float) / 100.0 AS UnitNet,
           ISNULL(TRY_CAST(pq.ALLOCATE AS float), 0) * ISNULL(TRY_CAST(iv.NET_1 AS float), 0) / 100.0 AS AllocatedValue,
           CAST(CASE WHEN pq.ALLOCATE IS NOT NULL AND (DATEDIFF(day, @now, v.SHIP) <= 5 OR @now > v.SHIP) THEN 1 ELSE 0 END AS bit) AS CountsNow
    FROM EDA.VNORD.VNORD v
    JOIN EDA.VNORD.QP_MV qp ON qp.ID = v.ID
    LEFT JOIN EDA.VNORD.PQ_MV pq ON pq.ID = qp.ID AND pq.PQ_MV_POS = qp.QP_MV_POS
    LEFT JOIN EDA.IVMST.IVMST iv ON iv.ID = qp.P
    WHERE v.MEMBER COLLATE DATABASE_DEFAULT = @acct
    ORDER BY v.SHIP, v.ID, qp.QP_MV_POS;

    /* 6. direct-vendor POs counted against credit (VENDORD) */
    SELECT CAST(vm.VENDOR AS varchar(20)) AS VendorId, CAST(ap.NAME AS nvarchar(200)) AS VendorName,
           po.P_O AS PO, dt.DATE AS PoDate, am.AMOUNT AS Amount, ISNULL(b.BILLED, 0) AS Billed,
           ISNULL(am.AMOUNT, 0) - ISNULL(b.BILLED, 0) AS Net
    FROM EDA.VENDORD.VENDOR_MV vm
    LEFT JOIN EDA.VENDORD.DATE_MV dt  ON dt.ID = vm.ID AND dt.DATE_MV_POS = vm.VENDOR_MV_POS
    LEFT JOIN EDA.VENDORD.P_O_MV po   ON po.ID = vm.ID AND po.P_O_MV_POS = vm.VENDOR_MV_POS
    LEFT JOIN EDA.VENDORD.AMOUNT_MV am ON am.ID = vm.ID AND am.AMOUNT_MV_POS = vm.VENDOR_MV_POS
    LEFT JOIN EDA.VENDORD.BILLED_MV b  ON b.ID = vm.ID AND b.BILLED_MV_POS = vm.VENDOR_MV_POS
    LEFT JOIN EDA.APMST.APMST ap ON ap.ID = vm.VENDOR
    WHERE vm.ID COLLATE DATABASE_DEFAULT = @acct
    ORDER BY dt.DATE DESC;

    /* 7. vendor credit approvals not processed yet (dbo.VendorCreditApproval) */
    SELECT c.ID AS ApprovalId, c.DateRequested AS Requested, c.VendorID AS VendorId,
           (SELECT TOP (1) CAST(ap.NAME AS nvarchar(200)) FROM EDA.APMST.APMST ap WHERE ap.ID COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(c.VendorID))) AS VendorName,
           c.PO, c.CreditAmount AS Amount, c.AuthorizationCode, c.UserID AS RequestedBy,
           CAST(CASE WHEN c.AuthorizationCode LIKE 'Please call%' OR c.AuthorizationCode = 'Not Authorized' THEN 1 ELSE 0 END AS bit) AS Declined
    FROM dbo.VendorCreditApproval c
    WHERE LTRIM(RTRIM(c.MemberID)) = @acct AND c.Processed = 0
    ORDER BY c.DateRequested DESC;

    /* 8. accounting's notes */
    SELECT TOP (200) n.Id, n.Kind, n.OrderId, n.Note, n.CreatedBy, n.CreatedAt
    FROM piv2.CreditNote n WHERE n.AccountNumber = @acct ORDER BY n.Id DESC;
END
GO

/* ------------------------------------------------ notes */
CREATE OR ALTER PROCEDURE piv2.CreditNote_Add
    @AccountNumber varchar(20),
    @Kind          varchar(20) = 'NOTE',
    @OrderId       int = NULL,
    @Note          nvarchar(2000),
    @User          nvarchar(150)
AS
BEGIN
    SET NOCOUNT ON;
    IF NULLIF(LTRIM(RTRIM(@Note)), N'') IS NULL THROW 50580, 'Write a note.', 1;
    IF @Kind NOT IN ('NOTE', 'OVERRIDE', 'REVIEWED') THROW 50581, 'Unknown note type.', 1;
    INSERT piv2.CreditNote (AccountNumber, Kind, OrderId, Note, CreatedBy)
    VALUES (LTRIM(RTRIM(@AccountNumber)), @Kind, @OrderId, LTRIM(RTRIM(@Note)), @User);
    SELECT CAST(SCOPE_IDENTITY() AS int) AS Id;
END
GO

/* ------------------------------------------------ permission: overriding a held order from the Credit Desk */
IF OBJECT_ID('dbo.CreatePermission', 'P') IS NOT NULL
BEGIN
    DECLARE @tbl nvarchar(300) =
        (SELECT TOP (1) QUOTENAME(s.name) + N'.' + QUOTENAME(t.name)
           FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
          WHERE EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = t.object_id AND c.name = N'PermissionName')
            AND EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = t.object_id AND c.name = N'RoutePath')
          ORDER BY CASE WHEN t.name LIKE N'%Permission%' THEN 0 ELSE 1 END, t.name);
    DECLARE @have int = 0;
    IF @tbl IS NOT NULL
    BEGIN
        DECLARE @q nvarchar(max) = N'SELECT @n = COUNT(*) FROM ' + @tbl + N' WHERE PermissionName = N''Credit.Override''';
        EXEC sp_executesql @q, N'@n int OUTPUT', @n = @have OUTPUT;
    END
    IF @have = 0
        EXEC dbo.CreatePermission @permissionName = N'Credit.Override',
             @description = N'Credit Desk · release a B2B order held for credit (Orders.HoldOverride = 1)', @routePath = N'/credit';
END
GO

PRINT 'Credit Desk 01 ready.';
GO
