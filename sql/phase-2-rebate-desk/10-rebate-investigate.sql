/* ---------------------------------------------------------------
    Phase 2 · 10  Rebate Desk: Investigate, the nightly sales summary,
                  and AR credits found by member account

    Database: PRO_NUKE      Safe to run twice.      Run after 07.
    Reads [EDA].dbo.ARHistorical (AR history: one line per invoice line).

    New tables (piv2 only; nothing existing changes):
      piv2.MemberSalesMonth   units and $ per member, PRO code and month
      piv2.MemberName         each member's account name (latest seen)
      piv2.RebateArCredit     rebate credits in AR (HPROD 1320), with the
                              claim number read from VINVNO
      piv2.SalesRefreshLog    one row per nightly run
    These are copies rebuilt nightly by piv2.Rebate_RefreshSales (the
    SQL Agent job in 11). Until the first run they are empty: the desk
    then falls back to the live AR lookup for credits, and Investigate
    shows no sales.

    AR credits: a claim's credit is the HPROD 1320 line on the member's
    account (ARHistorical.Account) whose VINVNO ends in the claim number.
    Matching on Account replaces the old "first 4 characters of the AR id",
    which missed members with 5-digit numbers.
   --------------------------------------------------------------- */

USE PRO_NUKE;
GO
SET XACT_ABORT ON;
GO

IF OBJECT_ID('piv2.MemberSalesMonth') IS NULL
CREATE TABLE piv2.MemberSalesMonth
(
    MemberId   int            NOT NULL,
    ProCode    int            NOT NULL,
    MonthStart date           NOT NULL,
    Units      decimal(19,2)  NOT NULL,     -- net of returns
    Amount     decimal(19,2)  NOT NULL,
    Lines      int            NOT NULL,
    CONSTRAINT PK_MemberSalesMonth PRIMARY KEY (MemberId, ProCode, MonthStart)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MemberSalesMonth_Code' AND object_id = OBJECT_ID('piv2.MemberSalesMonth'))
    CREATE INDEX IX_MemberSalesMonth_Code ON piv2.MemberSalesMonth (ProCode, MonthStart) INCLUDE (Units, Amount);
GO

IF OBJECT_ID('piv2.MemberName') IS NULL
CREATE TABLE piv2.MemberName
(
    MemberId int           NOT NULL CONSTRAINT PK_MemberName PRIMARY KEY,
    Name     nvarchar(200) NULL
);
GO

IF OBJECT_ID('piv2.RebateArCredit') IS NULL
CREATE TABLE piv2.RebateArCredit
(
    ArCreditId    int IDENTITY   NOT NULL CONSTRAINT PK_RebateArCredit PRIMARY KEY,
    MemberId      int            NOT NULL,
    OrderId       int            NULL,      -- the claim number at the end of VINVNO
    ArId          varchar(50)    NOT NULL,
    InvoiceNumber varchar(50)    NULL,
    Vinvno        varchar(50)    NULL,
    Amount        decimal(19,2)  NULL,
    PostedAt      datetime       NULL,
    Terms         varchar(50)    NULL,
    PoNumber      varchar(50)    NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RebateArCredit_Claim' AND object_id = OBJECT_ID('piv2.RebateArCredit'))
    CREATE INDEX IX_RebateArCredit_Claim ON piv2.RebateArCredit (OrderId, MemberId);
GO

IF OBJECT_ID('piv2.SalesRefreshLog') IS NULL
CREATE TABLE piv2.SalesRefreshLog
(
    RunId      int IDENTITY   NOT NULL CONSTRAINT PK_SalesRefreshLog PRIMARY KEY,
    StartedAt  datetime2(0)   NOT NULL CONSTRAINT DF_SalesRefreshLog_Start DEFAULT SYSUTCDATETIME(),
    FinishedAt datetime2(0)   NULL,
    SalesRows  int            NULL,
    Credits    int            NULL,
    Error      nvarchar(2000) NULL
);
GO

/* ---------------------------------------------------------------
   Nightly: rebuild the copies from ARHistorical. Each table is
   replaced in one transaction, so the desk never sees it half-built.
   --------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE piv2.Rebate_RefreshSales
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @run int;
    INSERT piv2.SalesRefreshLog DEFAULT VALUES;
    SET @run = SCOPE_IDENTITY();

    BEGIN TRY
        /* Sales: every line except the rebate credits, summed by member, PRO code and month. */
        CREATE TABLE #s (MemberId int NOT NULL, ProCode int NOT NULL, MonthStart date NOT NULL,
                         Units decimal(19,2) NOT NULL, Amount decimal(19,2) NOT NULL, Lines int NOT NULL,
                         PRIMARY KEY (MemberId, ProCode, MonthStart));
        INSERT #s
        SELECT x.MemberId, x.ProCode, x.MonthStart, SUM(x.Units), SUM(x.Amount), COUNT(*)
          FROM (SELECT TRY_CAST(a.Account AS int) AS MemberId, TRY_CAST(a.HPROD AS int) AS ProCode,
                       DATEFROMPARTS(YEAR(a.DT_POSTED), MONTH(a.DT_POSTED), 1) AS MonthStart,
                       CAST(COALESCE(TRY_CAST(a.QUAN AS decimal(19,2)), 0) AS decimal(19,2)) AS Units,
                       CAST(COALESCE(TRY_CAST(a.AMOUNT AS decimal(19,2)), 0) AS decimal(19,2)) AS Amount
                  FROM [EDA].dbo.ARHistorical a
                 WHERE a.DT_POSTED IS NOT NULL) x
         WHERE x.MemberId IS NOT NULL AND x.ProCode IS NOT NULL AND x.ProCode <> 1320
         GROUP BY x.MemberId, x.ProCode, x.MonthStart;

        CREATE TABLE #n (MemberId int NOT NULL PRIMARY KEY, Name nvarchar(200) NULL);
        INSERT #n
        SELECT MemberId, Name
          FROM (SELECT TRY_CAST(a.Account AS int) AS MemberId, LEFT(LTRIM(RTRIM(a.AccountName)), 200) AS Name,
                       ROW_NUMBER() OVER (PARTITION BY TRY_CAST(a.Account AS int) ORDER BY a.DT_POSTED DESC) AS rn
                  FROM [EDA].dbo.ARHistorical a
                 WHERE TRY_CAST(a.Account AS int) IS NOT NULL AND NULLIF(LTRIM(RTRIM(a.AccountName)), '') IS NOT NULL) x
         WHERE rn = 1;

        /* Rebate credits: HPROD 1320; the claim number is the run of digits at the end of VINVNO. */
        CREATE TABLE #c (MemberId int NOT NULL, OrderId int NULL, ArId varchar(50) NOT NULL, InvoiceNumber varchar(50) NULL,
                         Vinvno varchar(50) NULL, Amount decimal(19,2) NULL, PostedAt datetime NULL, Terms varchar(50) NULL, PoNumber varchar(50) NULL);
        INSERT #c
        SELECT TRY_CAST(a.Account AS int),
               TRY_CAST(RIGHT(v.Vinvno, PATINDEX('%[^0-9]%', REVERSE(v.Vinvno) + 'x') - 1) AS int),
               LEFT(CAST(a.id AS varchar(50)), 50),
               LEFT(SUBSTRING(CAST(a.id AS varchar(50)), LEN(CAST(TRY_CAST(a.Account AS int) AS varchar(20))) + 1, 50), 50),
               v.Vinvno, TRY_CAST(a.AMOUNT AS decimal(19,2)), a.DT_POSTED, LEFT(RTRIM(CAST(a.TERMS AS varchar(50))), 50), LEFT(RTRIM(CAST(a.P_O_ AS varchar(50))), 50)
          FROM [EDA].dbo.ARHistorical a
         CROSS APPLY (SELECT LEFT(RTRIM(CAST(a.VINVNO AS varchar(50))), 50) AS Vinvno) v
         WHERE TRY_CAST(a.HPROD AS int) = 1320 AND TRY_CAST(a.Account AS int) IS NOT NULL;

        BEGIN TRAN;
            DELETE piv2.MemberSalesMonth;
            INSERT piv2.MemberSalesMonth (MemberId, ProCode, MonthStart, Units, Amount, Lines) SELECT * FROM #s;
            DELETE piv2.MemberName;
            INSERT piv2.MemberName (MemberId, Name) SELECT * FROM #n;
            DELETE piv2.RebateArCredit;
            INSERT piv2.RebateArCredit (MemberId, OrderId, ArId, InvoiceNumber, Vinvno, Amount, PostedAt, Terms, PoNumber) SELECT * FROM #c;
        COMMIT;

        UPDATE piv2.SalesRefreshLog
           SET FinishedAt = SYSUTCDATETIME(), SalesRows = (SELECT COUNT(*) FROM #s), Credits = (SELECT COUNT(*) FROM #c)
         WHERE RunId = @run;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        UPDATE piv2.SalesRefreshLog SET FinishedAt = SYSUTCDATETIME(), Error = LEFT(ERROR_MESSAGE(), 2000) WHERE RunId = @run;
        THROW;
    END CATCH
END
GO

/* piv2.Rebate_ArCredit (a claim's credit, by member account) is defined in 07, with these two tables. */

/* =================================================================
   Investigate
   ================================================================= */

/* The lookup box: a claim #, a member (number or name), a rebate product (description or PRO code) or a vendor. */
CREATE OR ALTER PROCEDURE piv2.Investigate_Find
    @Q nvarchar(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET @Q = NULLIF(LTRIM(RTRIM(@Q)), N'');
    IF @Q IS NULL RETURN;
    DECLARE @n int = TRY_CAST(@Q AS int);

    SELECT TOP (40) x.*
      FROM
      (
        SELECT 'CLAIM' AS Kind, CAST(r.ORDERID AS nvarchar(20)) AS [Key], MAX(r.MemberID) AS MemberId, CAST(NULL AS int) AS ModelId, CAST(NULL AS int) AS VendorId,
               CONCAT(N'Claim ', r.ORDERID, N' · member ', MAX(r.MemberID), N' · ', CONVERT(nvarchar(10), MIN(r.Date), 101)) AS Label, 1 AS Ord
          FROM dbo.RebateRedeem r WHERE @n IS NOT NULL AND r.ORDERID = @n AND COALESCE(r.Saved, 0) = 0 GROUP BY r.ORDERID
        UNION ALL
        SELECT 'MEMBER', CAST(m.MemberId AS nvarchar(20)), m.MemberId, NULL, NULL, CONCAT(N'Member ', m.MemberId, N' · ', m.Name), 2
          FROM piv2.MemberName m
         WHERE (@n IS NOT NULL AND m.MemberId = @n) OR (@n IS NULL AND m.Name LIKE N'%' + @Q + N'%')
        UNION ALL
        SELECT p.* FROM
        (
            SELECT TOP (15) 'PRODUCT' AS Kind, CAST(m.ModelID AS nvarchar(20)) AS [Key], CAST(NULL AS int) AS MemberId, m.ModelID AS ModelId, m.VendorID AS VendorId,
                   CONCAT(CAST(m.ModelNumber AS nvarchar(300)), N' · PRO ', CAST(m.ModelName AS nvarchar(100)), N' · #', m.ModelID) AS Label, 3 AS Ord
              FROM dbo.RebateCameraModels m
             WHERE m.IsPriceProtection = 0
               AND (m.ModelNumber LIKE N'%' + @Q + N'%' OR m.ModelName LIKE N'%' + @Q + N'%'
                    OR (@n IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.RebateCameraModelsDetails d WHERE d.ParentModelID = m.ModelID AND d.ProCode = @n)))
             ORDER BY COALESCE(m.Active, 0) DESC, m.ModelID DESC
        ) p
        UNION ALL
        SELECT 'VENDOR', CAST(v.VendorID AS nvarchar(20)), NULL, NULL, v.VendorID, CONCAT(N'Vendor ', v.VendorName), 4
          FROM dbo.RebateVendors v
         WHERE v.IsPriceProtection = 0 AND v.VendorName LIKE N'%' + @Q + N'%'
      ) x
     ORDER BY x.Ord, x.Label;
END
GO

/* For a product or a vendor: every member who claimed it in the window, units claimed against units bought. */
CREATE OR ALTER PROCEDURE piv2.Investigate_Claimants
    @ModelId  int = NULL,
    @VendorId int = NULL,
    @Months   int = 12            -- 0 = all history
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @since date = CASE WHEN @Months > 0 THEN DATEADD(month, -@Months, CAST(GETDATE() AS date)) ELSE '19000101' END;
    /* Purchases count from six months before the window: a unit is often bought before it is claimed. */
    DECLARE @buyFrom date = DATEADD(month, -6, @since);

    CREATE TABLE #m (ModelId int NOT NULL PRIMARY KEY);
    INSERT #m SELECT ModelID FROM dbo.RebateCameraModels
     WHERE IsPriceProtection = 0 AND ((@ModelId IS NOT NULL AND ModelID = @ModelId) OR (@ModelId IS NULL AND VendorID = @VendorId));

    CREATE TABLE #code (ProCode int NOT NULL PRIMARY KEY);
    INSERT #code SELECT DISTINCT d.ProCode FROM dbo.RebateCameraModelsDetails d JOIN #m m ON m.ModelId = d.ParentModelID WHERE d.ProCode IS NOT NULL;

    ;WITH cl AS
    (
        SELECT r.MemberID AS MemberId, COUNT(DISTINCT r.ORDERID) AS Claims, SUM(COALESCE(r.Quantity, 0)) AS UnitsClaimed,
               SUM(CAST(COALESCE(r.Net, 0) AS decimal(19,2))) AS AmountClaimed, MIN(r.Date) AS FirstClaim, MAX(r.Date) AS LastClaim
          FROM dbo.RebateRedeem r JOIN #m m ON m.ModelId = r.ModelID
         WHERE COALESCE(r.Saved, 0) = 0 AND r.ORDERID IS NOT NULL AND r.Date >= @since
         GROUP BY r.MemberID
    ),
    bo AS
    (
        SELECT s.MemberId, SUM(s.Units) AS UnitsBought, SUM(s.Amount) AS AmountBought
          FROM piv2.MemberSalesMonth s JOIN #code c ON c.ProCode = s.ProCode
         WHERE s.MonthStart >= @buyFrom AND s.MemberId IN (SELECT MemberId FROM cl)
         GROUP BY s.MemberId
    )
    SELECT TOP (500) cl.MemberId, n.Name AS MemberName, cl.Claims, cl.UnitsClaimed, cl.AmountClaimed, cl.FirstClaim, cl.LastClaim,
           COALESCE(bo.UnitsBought, 0) AS UnitsBought, COALESCE(bo.AmountBought, 0) AS AmountBought,
           CAST(CASE WHEN COALESCE(bo.UnitsBought, 0) > 0 THEN cl.UnitsClaimed * 100.0 / bo.UnitsBought END AS decimal(9,1)) AS ClaimRatePct,
           CAST(CASE WHEN cl.UnitsClaimed > COALESCE(bo.UnitsBought, 0) THEN 1 ELSE 0 END AS bit) AS ClaimedMoreThanBought
      FROM cl
      LEFT JOIN bo ON bo.MemberId = cl.MemberId
      LEFT JOIN piv2.MemberName n ON n.MemberId = cl.MemberId
     ORDER BY CASE WHEN cl.UnitsClaimed > COALESCE(bo.UnitsBought, 0) THEN 0 ELSE 1 END,
              CASE WHEN COALESCE(bo.UnitsBought, 0) > 0 THEN cl.UnitsClaimed * 1.0 / bo.UnitsBought ELSE 999 END DESC,
              cl.UnitsClaimed DESC;

    SELECT (SELECT MAX(FinishedAt) FROM piv2.SalesRefreshLog WHERE Error IS NULL AND FinishedAt IS NOT NULL) AS SalesAsOf,
           @since AS WindowFrom, @buyFrom AS PurchasesFrom;
END
GO

/* ---------------------------------------------------------------
   One member, one or more rebate products (all they claimed when none
   are given): bought against claimed, month by month, every claim and
   what happened to it, and the flags.
     1 products   per product: bought, claimed, amounts by state, flags
     2 months     per month: units bought, units claimed (chart)
     3 timeline   every event, oldest first
     4 about      member name, window, when sales were last refreshed
   --------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE piv2.Investigate_Member
    @MemberId int,
    @ModelIds varchar(1000) = NULL,   -- comma list; NULL = every product the member claimed in the window
    @Months   int = 12                -- 0 = all history
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @since date = CASE WHEN @Months > 0 THEN DATEADD(month, -@Months, CAST(GETDATE() AS date)) ELSE '19000101' END;
    DECLARE @buyFrom date = DATEADD(month, -6, @since);

    /* Claim lines in the window (submitted, not saved drafts). */
    CREATE TABLE #l (LineId int NOT NULL PRIMARY KEY, OrderId int NOT NULL, ModelId int NOT NULL, ClaimDate datetime NULL,
                     Quantity int NULL, Net decimal(19,2) NOT NULL, Each decimal(19,2) NULL, SerialNumber nvarchar(200) NULL, ProgramWeek nvarchar(100) NULL);
    INSERT #l
    SELECT r.[KEY], r.ORDERID, r.ModelID, r.Date, r.Quantity, CAST(COALESCE(r.Net, 0) AS decimal(19,2)), r.ReimbursementAmount,
           NULLIF(LTRIM(RTRIM(CAST(r.SerialNumber AS nvarchar(200)))), N''), CAST(r.StringProgramWeek AS nvarchar(100))
      FROM dbo.RebateRedeem r
     WHERE r.MemberID = @MemberId AND COALESCE(r.Saved, 0) = 0 AND r.ORDERID IS NOT NULL AND r.Date >= @since
       AND (@ModelIds IS NULL OR r.ModelID IN (SELECT TRY_CAST(value AS int) FROM STRING_SPLIT(@ModelIds, ',')));

    CREATE TABLE #m (ModelId int NOT NULL PRIMARY KEY);
    INSERT #m SELECT DISTINCT ModelId FROM #l;
    IF @ModelIds IS NOT NULL
        INSERT #m SELECT DISTINCT TRY_CAST(value AS int) FROM STRING_SPLIT(@ModelIds, ',')
         WHERE TRY_CAST(value AS int) IS NOT NULL AND TRY_CAST(value AS int) NOT IN (SELECT ModelId FROM #m);

    CREATE TABLE #code (ModelId int NOT NULL, ProCode int NOT NULL, PRIMARY KEY (ModelId, ProCode));
    INSERT #code SELECT DISTINCT d.ParentModelID, d.ProCode FROM dbo.RebateCameraModelsDetails d JOIN #m m ON m.ModelId = d.ParentModelID WHERE d.ProCode IS NOT NULL;

    /* Latest decision per claim. */
    CREATE TABLE #d (OrderId int NOT NULL PRIMARY KEY, Status int NULL, DecidedAt datetime NULL, DecidedBy nvarchar(100) NULL,
                     Posted int NULL, DebitMemo varchar(100) NULL, RejectReason nvarchar(1000) NULL);
    INSERT #d
    SELECT o.OrderId, p.Status, p.timeEnd, p.[User], p.ComputymeProcessed, NULLIF(LTRIM(RTRIM(p.DM)), ''), CAST(p.RejectReason AS nvarchar(1000))
      FROM (SELECT DISTINCT OrderId FROM #l) o
     OUTER APPLY (SELECT TOP (1) x.Status, x.timeEnd, x.[User], x.ComputymeProcessed, x.DM, x.RejectReason
                    FROM dbo.RebateProcess x WHERE x.OrderID = o.OrderId ORDER BY x.ID DESC) p;

    /* Purchases of these products' PRO codes, by month. */
    CREATE TABLE #s (ModelId int NOT NULL, MonthStart date NOT NULL, Units decimal(19,2) NOT NULL, Amount decimal(19,2) NOT NULL,
                     PRIMARY KEY (ModelId, MonthStart));
    INSERT #s
    SELECT c.ModelId, s.MonthStart, SUM(s.Units), SUM(s.Amount)
      FROM piv2.MemberSalesMonth s JOIN #code c ON c.ProCode = s.ProCode
     WHERE s.MemberId = @MemberId AND s.MonthStart >= @buyFrom
     GROUP BY c.ModelId, s.MonthStart;

    /* Serial numbers on these lines that appear on another claim (any member). */
    CREATE TABLE #dup (LineId int NOT NULL PRIMARY KEY, Others nvarchar(400) NULL);
    INSERT #dup
    SELECT l.LineId, STRING_AGG(CAST(CONCAT(N'claim ', o.ORDERID, N' (member ', o.MemberID, N')') AS nvarchar(max)), N', ')
      FROM #l l
      JOIN dbo.RebateRedeem o ON CAST(o.SerialNumber AS nvarchar(200)) = l.SerialNumber AND o.ORDERID <> l.OrderId AND COALESCE(o.Saved, 0) = 0
     WHERE l.SerialNumber IS NOT NULL AND LEN(l.SerialNumber) >= 4
     GROUP BY l.LineId;

    /* ---- 1: products ---- */
    SELECT m.ModelId, rm.ModelNumber AS Description, rm.ModelName AS ProCodeText, v.VendorName,
           COALESCE(b.UnitsBought, 0) AS UnitsBought, COALESCE(b.AmountBought, 0) AS AmountBought,
           COALESCE(c.UnitsClaimed, 0) AS UnitsClaimed, COALESCE(c.Claims, 0) AS Claims,
           COALESCE(c.Approved, 0) AS ApprovedAmount, COALESCE(c.Declined, 0) AS DeclinedAmount,
           COALESCE(c.Support, 0) AS SupportAmount, COALESCE(c.Pending, 0) AS PendingAmount,
           c.FirstClaim, c.LastClaim,
           CAST(CASE WHEN COALESCE(c.UnitsCounted, 0) > COALESCE(b.UnitsBought, 0) THEN 1 ELSE 0 END AS bit) AS ClaimedMoreThanBought,
           COALESCE(f.NoPurchaseBefore, 0) AS ClaimsWithNoPurchaseBefore,
           COALESCE(f.RepeatedSerials, 0) AS RepeatedSerials
      FROM #m m
      JOIN dbo.RebateCameraModels rm ON rm.ModelID = m.ModelId
      LEFT JOIN dbo.RebateVendors v ON v.VendorID = rm.VendorID
      OUTER APPLY (SELECT SUM(Units) AS UnitsBought, SUM(Amount) AS AmountBought FROM #s WHERE ModelId = m.ModelId) b
      OUTER APPLY (SELECT SUM(COALESCE(l.Quantity, 0)) AS UnitsClaimed, COUNT(DISTINCT l.OrderId) AS Claims,
                          SUM(CASE WHEN COALESCE(d.Status, 0) <> 2 THEN COALESCE(l.Quantity, 0) END) AS UnitsCounted,
                          SUM(CASE WHEN d.Status = 1 THEN l.Net END) AS Approved, SUM(CASE WHEN d.Status = 2 THEN l.Net END) AS Declined,
                          SUM(CASE WHEN d.Status = 3 THEN l.Net END) AS Support,
                          SUM(CASE WHEN COALESCE(d.Status, 0) NOT IN (1, 2, 3) THEN l.Net END) AS Pending,
                          MIN(l.ClaimDate) AS FirstClaim, MAX(l.ClaimDate) AS LastClaim
                     FROM #l l LEFT JOIN #d d ON d.OrderId = l.OrderId WHERE l.ModelId = m.ModelId) c
      OUTER APPLY (SELECT SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM #s s WHERE s.ModelId = l.ModelId AND s.Units > 0
                                                      AND s.MonthStart <= DATEFROMPARTS(YEAR(l.ClaimDate), MONTH(l.ClaimDate), 1)) THEN 1 ELSE 0 END) AS NoPurchaseBefore,
                          SUM(CASE WHEN dp.LineId IS NOT NULL THEN 1 ELSE 0 END) AS RepeatedSerials
                     FROM #l l LEFT JOIN #dup dp ON dp.LineId = l.LineId WHERE l.ModelId = m.ModelId) f
     ORDER BY CASE WHEN COALESCE(c.UnitsCounted, 0) > COALESCE(b.UnitsBought, 0) THEN 0 ELSE 1 END, COALESCE(c.UnitsClaimed, 0) DESC;

    /* ---- 2: months (all chosen products together) ---- */
    ;WITH mo AS
    (
        SELECT MonthStart, SUM(Units) AS UnitsBought, CAST(0 AS decimal(19,2)) AS UnitsClaimed FROM #s GROUP BY MonthStart
        UNION ALL
        SELECT DATEFROMPARTS(YEAR(ClaimDate), MONTH(ClaimDate), 1), 0, SUM(COALESCE(Quantity, 0)) FROM #l WHERE ClaimDate IS NOT NULL
         GROUP BY DATEFROMPARTS(YEAR(ClaimDate), MONTH(ClaimDate), 1)
    )
    SELECT MonthStart, SUM(UnitsBought) AS UnitsBought, SUM(UnitsClaimed) AS UnitsClaimed
      FROM mo GROUP BY MonthStart ORDER BY MonthStart;

    /* ---- 3: timeline ---- */
    SELECT x.*
      FROM
      (
        SELECT CAST(s.MonthStart AS datetime) AS At, 'BOUGHT' AS Kind, NULL AS OrderId, s.ModelId,
               CONCAT(N'Bought ', CAST(s.Units AS decimal(19,0)), N' unit(s) this month') AS Text, s.Units AS Quantity, s.Amount, NULL AS Detail
          FROM #s s WHERE s.Units <> 0
        UNION ALL
        SELECT l.ClaimDate, 'CLAIMED', l.OrderId, l.ModelId,
               CONCAT(N'Claimed ', l.Quantity, N' × ', FORMAT(l.Each, 'C', 'en-US'), CASE WHEN l.SerialNumber IS NOT NULL THEN N' · SN ' + l.SerialNumber ELSE N'' END),
               l.Quantity, l.Net,
               CASE WHEN dp.Others IS NOT NULL THEN N'Serial also on ' + dp.Others END
          FROM #l l LEFT JOIN #dup dp ON dp.LineId = l.LineId
        UNION ALL
        SELECT d.DecidedAt, CASE d.Status WHEN 1 THEN 'APPROVED' WHEN 2 THEN 'DECLINED' WHEN 3 THEN 'NEEDS_SUPPORT' ELSE 'DECIDED' END, d.OrderId, NULL,
               CONCAT(CASE d.Status WHEN 1 THEN N'Approved' WHEN 2 THEN N'Declined' WHEN 3 THEN N'Needs support' ELSE N'Decision' END,
                      CASE WHEN d.DecidedBy IS NOT NULL THEN N' by ' + d.DecidedBy ELSE N'' END),
               NULL, NULL, d.RejectReason
          FROM #d d WHERE d.DecidedAt IS NOT NULL
        UNION ALL
        SELECT c.PostedAt, 'POSTED', c.OrderId, NULL, CONCAT(N'Credit posted to the GL: invoice ', c.InvoiceNumber), NULL, c.Amount, NULL
          FROM piv2.RebateArCredit c WHERE c.MemberId = @MemberId AND c.OrderId IN (SELECT OrderId FROM #d)
        UNION ALL
        SELECT dm.CreatedAt, 'DEBIT_MEMO', d.OrderId, NULL, CONCAT(N'On debit memo ', d.DebitMemo), NULL, NULL, NULL
          FROM #d d
          OUTER APPLY (SELECT TOP (1) CreatedAt FROM piv2.RebateDebitMemo WHERE DM = d.DebitMemo ORDER BY DebitMemoId DESC) dm
         WHERE d.DebitMemo IS NOT NULL
        UNION ALL
        SELECT e.At, 'DESK', e.ClaimId, NULL, CONCAT(N'Desk: ', e.EventType, N' by ', e.Actor), NULL, NULL, e.Reason
          FROM piv2.RebateEvent e WHERE e.Rail = 'IR' AND e.ClaimId IN (SELECT OrderId FROM #d)
      ) x
     ORDER BY CASE WHEN x.At IS NULL THEN 1 ELSE 0 END, x.At, x.OrderId;

    /* ---- 4: about ---- */
    SELECT @MemberId AS MemberId, (SELECT Name FROM piv2.MemberName WHERE MemberId = @MemberId) AS MemberName,
           @since AS WindowFrom, @buyFrom AS PurchasesFrom,
           (SELECT MAX(FinishedAt) FROM piv2.SalesRefreshLog WHERE Error IS NULL AND FinishedAt IS NOT NULL) AS SalesAsOf;
END
GO

SELECT N'investigate ready' AS Result;
