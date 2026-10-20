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
               /* The AR id starts with the member number, padded to 4 digits under 10000. */
               LEFT(SUBSTRING(CAST(a.id AS varchar(50)), CASE WHEN TRY_CAST(a.Account AS int) < 10000 THEN 4
                                                             ELSE LEN(CAST(TRY_CAST(a.Account AS int) AS varchar(20))) END + 1, 50), 50),
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
   Linked models and stock padding
   ================================================================= */

/* Grows the caller's #link (ModelId, ProCode, IsLinked, LinkedFrom) with each code's predecessors and
   successors from [PRO].dbo.Product.ReplacementCode (A replaced by B), up to five steps either way. */
CREATE OR ALTER PROCEDURE piv2.Rebate_LinkModels
AS
BEGIN
    SET NOCOUNT ON;
    CREATE TABLE #rep (Code int NOT NULL, Repl int NOT NULL, PRIMARY KEY (Code, Repl));
    INSERT #rep
    SELECT DISTINCT TRY_CAST(CAST(p.ProductCode AS nvarchar(20)) AS int), TRY_CAST(LTRIM(RTRIM(CAST(p.ReplacementCode AS nvarchar(20)))) AS int)
      FROM [PRO].dbo.Product p
     WHERE TRY_CAST(LTRIM(RTRIM(CAST(p.ReplacementCode AS nvarchar(20)))) AS int) > 0
       AND TRY_CAST(CAST(p.ProductCode AS nvarchar(20)) AS int) IS NOT NULL
       AND TRY_CAST(CAST(p.ProductCode AS nvarchar(20)) AS int) <> TRY_CAST(LTRIM(RTRIM(CAST(p.ReplacementCode AS nvarchar(20)))) AS int);

    /* Walk each direction on its own (successors forward, predecessors back), so two products that share a
       successor are not linked to each other. */
    CREATE TABLE #w (ModelId int NOT NULL, ProCode int NOT NULL, Dir char(1) NOT NULL, LinkedFrom int NULL, PRIMARY KEY (ModelId, ProCode, Dir));
    INSERT #w SELECT ModelId, ProCode, 'S', NULL FROM #link WHERE IsLinked = 0
    UNION ALL SELECT ModelId, ProCode, 'P', NULL FROM #link WHERE IsLinked = 0;

    DECLARE @step int = 0;
    WHILE @step < 5
    BEGIN
        INSERT #w (ModelId, ProCode, Dir, LinkedFrom)
        SELECT x.ModelId, x.ProCode, x.Dir, MIN(x.LinkedFrom)
          FROM (SELECT w.ModelId, r.Repl AS ProCode, 'S' AS Dir, w.ProCode AS LinkedFrom FROM #w w JOIN #rep r ON r.Code = w.ProCode WHERE w.Dir = 'S'
                UNION ALL
                SELECT w.ModelId, r.Code, 'P', w.ProCode FROM #w w JOIN #rep r ON r.Repl = w.ProCode WHERE w.Dir = 'P') x
         WHERE NOT EXISTS (SELECT 1 FROM #w e WHERE e.ModelId = x.ModelId AND e.ProCode = x.ProCode AND e.Dir = x.Dir)
         GROUP BY x.ModelId, x.ProCode, x.Dir;
        IF @@ROWCOUNT = 0 BREAK;
        SET @step += 1;
    END

    INSERT #link (ModelId, ProCode, IsLinked, LinkedFrom)
    SELECT w.ModelId, w.ProCode, 1, MIN(w.LinkedFrom) FROM #w w
     WHERE NOT EXISTS (SELECT 1 FROM #link e WHERE e.ModelId = w.ModelId AND e.ProCode = w.ProCode)
     GROUP BY w.ModelId, w.ProCode;
END
GO

/* Stock padding for a member (and PRO code), newest first; removed entries are kept and shown. */
CREATE OR ALTER PROCEDURE piv2.StockPad_List
    @MemberId int = NULL,
    @ProCode  int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (500) o.ID AS PadId, o.Member AS MemberId, n.Name AS MemberName, o.ModelNumber AS ProCode,
           pr.Name AS ProductName, o.Quantity, o.Reason, o.CreatedBy, o.CreatedAt, o.RemovedBy, o.RemovedAt, o.RemovedReason
      FROM [EDA].dbo.RebateOverride o
      LEFT JOIN piv2.MemberName n ON n.MemberId = o.Member
     OUTER APPLY (SELECT TOP (1) LEFT(LTRIM(RTRIM(p.ModelName)), 200) AS Name FROM [PRO].dbo.Product p
                   WHERE CAST(p.ProductCode AS nvarchar(20)) = CAST(o.ModelNumber AS nvarchar(20))) pr
     WHERE (@MemberId IS NULL OR o.Member = @MemberId) AND (@ProCode IS NULL OR o.ModelNumber = @ProCode)
     ORDER BY CASE WHEN o.RemovedAt IS NULL THEN 0 ELSE 1 END, o.ID DESC;
END
GO

/* Adds padded units for a member and PRO code, with the reason. A change is a new entry; nothing is edited in place. */
CREATE OR ALTER PROCEDURE piv2.StockPad_Add
    @MemberId int,
    @ProCode  int,
    @Quantity int,
    @Reason   nvarchar(500),
    @Actor    nvarchar(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF NULLIF(LTRIM(RTRIM(@Reason)), N'') IS NULL THROW 50702, 'A reason is required.', 1;
    IF @MemberId IS NULL OR @MemberId <= 0 THROW 50770, 'Enter the member number.', 1;
    IF @Quantity IS NULL OR @Quantity = 0 THROW 50771, 'Enter the units to pad (a negative number takes units off).', 1;
    IF NOT EXISTS (SELECT 1 FROM [PRO].dbo.Product p WHERE CAST(p.ProductCode AS nvarchar(20)) = CAST(@ProCode AS nvarchar(20)))
        THROW 50772, 'That PRO code is not a PRO product.', 1;

    INSERT [EDA].dbo.RebateOverride (Member, ModelNumber, Quantity, Reason, CreatedBy, CreatedAt)
    VALUES (@MemberId, @ProCode, @Quantity, LTRIM(RTRIM(@Reason)), @Actor, SYSDATETIME());

    SELECT CAST(SCOPE_IDENTITY() AS int) AS PadId;
END
GO

/* Takes a padding entry out of use, with the reason; the row stays for the audit. */
CREATE OR ALTER PROCEDURE piv2.StockPad_Remove
    @PadId  int,
    @Reason nvarchar(500),
    @Actor  nvarchar(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF NULLIF(LTRIM(RTRIM(@Reason)), N'') IS NULL THROW 50702, 'A reason is required.', 1;
    UPDATE [EDA].dbo.RebateOverride
       SET RemovedBy = @Actor, RemovedAt = SYSDATETIME(), RemovedReason = LTRIM(RTRIM(@Reason))
     WHERE ID = @PadId AND RemovedAt IS NULL;
    IF @@ROWCOUNT = 0 THROW 50773, 'That padding entry does not exist or is already removed.', 1;
END
GO

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
    /* Purchases from the window start, the same as claims. */
    DECLARE @buyFrom date = @since;

    CREATE TABLE #m (ModelId int NOT NULL PRIMARY KEY);
    INSERT #m SELECT ModelID FROM dbo.RebateCameraModels
     WHERE IsPriceProtection = 0 AND ((@ModelId IS NOT NULL AND ModelID = @ModelId) OR (@ModelId IS NULL AND VendorID = @VendorId));

    /* The products' PRO codes, plus linked models (predecessors and successors). */
    CREATE TABLE #link (ModelId int NOT NULL, ProCode int NOT NULL, IsLinked bit NOT NULL, LinkedFrom int NULL, PRIMARY KEY (ModelId, ProCode));
    INSERT #link SELECT DISTINCT d.ParentModelID, d.ProCode, 0, NULL FROM dbo.RebateCameraModelsDetails d JOIN #m m ON m.ModelId = d.ParentModelID WHERE d.ProCode IS NOT NULL;
    EXEC piv2.Rebate_LinkModels;
    CREATE TABLE #code (ProCode int NOT NULL PRIMARY KEY);
    INSERT #code SELECT DISTINCT ProCode FROM #link;

    ;WITH cl AS
    (
        /* Declined claims are listed but not counted against purchases (same rule as the member view). */
        SELECT r.MemberID AS MemberId, COUNT(DISTINCT r.ORDERID) AS Claims,
               SUM(CASE WHEN COALESCE(p.Status, 0) <> 2 THEN COALESCE(r.Quantity, 0) ELSE 0 END) AS UnitsClaimed,
               SUM(CASE WHEN COALESCE(p.Status, 0) <> 2 THEN CAST(COALESCE(r.Net, 0) AS decimal(19,2)) ELSE 0 END) AS AmountClaimed,
               MIN(r.Date) AS FirstClaim, MAX(r.Date) AS LastClaim
          FROM dbo.RebateRedeem r JOIN #m m ON m.ModelId = r.ModelID
         OUTER APPLY (SELECT TOP (1) x.Status FROM dbo.RebateProcess x WHERE x.OrderID = r.ORDERID ORDER BY x.ID DESC) p
         WHERE COALESCE(r.Saved, 0) = 0 AND r.ORDERID IS NOT NULL AND r.Date >= @since
         GROUP BY r.MemberID
    ),
    bo AS
    (
        SELECT s.MemberId, SUM(s.Units) AS UnitsBought, SUM(s.Amount) AS AmountBought
          FROM piv2.MemberSalesMonth s JOIN #code c ON c.ProCode = s.ProCode
         WHERE s.MonthStart >= @buyFrom AND s.MemberId IN (SELECT MemberId FROM cl)
         GROUP BY s.MemberId
    ),
    pd AS
    (
        SELECT o.Member AS MemberId, SUM(o.Quantity) AS UnitsPadded
          FROM [EDA].dbo.RebateOverride o JOIN #code c ON c.ProCode = o.ModelNumber
         WHERE o.RemovedAt IS NULL AND o.Member IN (SELECT MemberId FROM cl)
         GROUP BY o.Member
    )
    /* Members with no purchase of these PRO codes in their whole AR history. */
    SELECT TOP (500) cl.MemberId, n.Name AS MemberName,
           CAST(CASE WHEN COALESCE(pd.UnitsPadded, 0) > 0
                       OR EXISTS (SELECT 1 FROM piv2.MemberSalesMonth s JOIN #code c ON c.ProCode = s.ProCode
                                   WHERE s.MemberId = cl.MemberId AND s.Units > 0) THEN 0 ELSE 1 END AS bit) AS NoPurchaseOnRecord, cl.Claims, cl.UnitsClaimed, cl.AmountClaimed, cl.FirstClaim, cl.LastClaim,
           COALESCE(bo.UnitsBought, 0) AS UnitsBought, COALESCE(pd.UnitsPadded, 0) AS UnitsPadded, COALESCE(bo.AmountBought, 0) AS AmountBought,
           CAST(CASE WHEN COALESCE(bo.UnitsBought, 0) + COALESCE(pd.UnitsPadded, 0) > 0 THEN cl.UnitsClaimed * 100.0 / (COALESCE(bo.UnitsBought, 0) + COALESCE(pd.UnitsPadded, 0)) END AS decimal(9,1)) AS ClaimRatePct,
           CAST(CASE WHEN cl.UnitsClaimed > COALESCE(bo.UnitsBought, 0) + COALESCE(pd.UnitsPadded, 0) THEN 1 ELSE 0 END AS bit) AS ClaimedMoreThanBought
      FROM cl
      LEFT JOIN bo ON bo.MemberId = cl.MemberId
      LEFT JOIN pd ON pd.MemberId = cl.MemberId
      LEFT JOIN piv2.MemberName n ON n.MemberId = cl.MemberId
     ORDER BY CASE WHEN COALESCE(pd.UnitsPadded, 0) <= 0
                    AND NOT EXISTS (SELECT 1 FROM piv2.MemberSalesMonth s JOIN #code c ON c.ProCode = s.ProCode
                                     WHERE s.MemberId = cl.MemberId AND s.Units > 0) THEN 0 ELSE 1 END,
              CASE WHEN cl.UnitsClaimed > COALESCE(bo.UnitsBought, 0) + COALESCE(pd.UnitsPadded, 0) THEN 0 ELSE 1 END,
              CASE WHEN COALESCE(bo.UnitsBought, 0) + COALESCE(pd.UnitsPadded, 0) > 0 THEN cl.UnitsClaimed * 1.0 / (COALESCE(bo.UnitsBought, 0) + COALESCE(pd.UnitsPadded, 0)) ELSE 999 END DESC,
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
     3 claims     one row per claim: products, units, amount, decision, AR credit, debit memo, flags
     4 purchases  by month
     5 about      member name, window, when sales were last refreshed
   --------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE piv2.Investigate_Member
    @MemberId int,
    @ModelIds varchar(1000) = NULL,   -- comma list; NULL = every product the member claimed in the window
    @Months   int = 12                -- 0 = all history
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @since date = CASE WHEN @Months > 0 THEN DATEADD(month, -@Months, CAST(GETDATE() AS date)) ELSE '19000101' END;
    DECLARE @buyFrom date = @since;   -- purchases from the window start, the same as claims

    /* Claim lines in the window (submitted, not saved drafts). */
    CREATE TABLE #l (LineId int NOT NULL PRIMARY KEY, OrderId int NOT NULL, ModelId int NOT NULL, ClaimDate datetime NULL,
                     Quantity int NULL, Net decimal(19,2) NOT NULL, Each decimal(19,2) NULL, SerialNumber nvarchar(200) NULL, ProgramWeek nvarchar(100) NULL);
    INSERT #l
    SELECT r.[KEY], r.ORDERID, r.ModelID, r.Date, r.Quantity, CAST(COALESCE(r.Net, 0) AS decimal(19,2)), r.ReimbursementAmount,
           NULLIF(LTRIM(RTRIM(CAST(r.SerialNumber AS nvarchar(200)))), N''), CAST(r.StringProgramWeek AS nvarchar(100))
      FROM dbo.RebateRedeem r
     WHERE r.MemberID = @MemberId AND COALESCE(r.Saved, 0) = 0 AND r.ORDERID IS NOT NULL AND r.ModelID IS NOT NULL AND r.Date >= @since
       AND (@ModelIds IS NULL OR r.ModelID IN (SELECT TRY_CAST(value AS int) FROM STRING_SPLIT(@ModelIds, ',')));

    CREATE TABLE #m (ModelId int NOT NULL PRIMARY KEY);
    INSERT #m SELECT DISTINCT ModelId FROM #l;
    IF @ModelIds IS NOT NULL
        INSERT #m SELECT DISTINCT TRY_CAST(value AS int) FROM STRING_SPLIT(@ModelIds, ',')
         WHERE TRY_CAST(value AS int) IS NOT NULL AND TRY_CAST(value AS int) NOT IN (SELECT ModelId FROM #m);

    CREATE TABLE #code (ModelId int NOT NULL, ProCode int NOT NULL, PRIMARY KEY (ModelId, ProCode));
    INSERT #code SELECT DISTINCT d.ParentModelID, d.ProCode FROM dbo.RebateCameraModelsDetails d JOIN #m m ON m.ModelId = d.ParentModelID WHERE d.ProCode IS NOT NULL;

    /* Linked models: a discontinued product and its successor (Product.ReplacementCode), both ways, a few steps deep.
       Their purchases and stock padding count for the product, shown apart. */
    CREATE TABLE #link (ModelId int NOT NULL, ProCode int NOT NULL, IsLinked bit NOT NULL, LinkedFrom int NULL, PRIMARY KEY (ModelId, ProCode));
    INSERT #link SELECT ModelId, ProCode, 0, NULL FROM #code;
    EXEC piv2.Rebate_LinkModels;

    /* Stock padding (EDA.RebateOverride): units a member bought elsewhere before stocking through PRO. */
    CREATE TABLE #pad (ModelId int NOT NULL PRIMARY KEY, Units int NOT NULL, Reasons nvarchar(max) NULL);
    INSERT #pad
    SELECT c.ModelId, SUM(COALESCE(o.Quantity, 0)),
           STRING_AGG(CAST(CONCAT(o.Quantity, N' × ', o.ModelNumber, N': ', COALESCE(o.Reason, N'no reason recorded'),
                                  CASE WHEN o.CreatedBy IS NOT NULL THEN N' (' + o.CreatedBy + N')' ELSE N'' END) AS nvarchar(max)), N'; ')
      FROM [EDA].dbo.RebateOverride o
      JOIN #link c ON c.ProCode = o.ModelNumber
     WHERE o.Member = @MemberId AND o.RemovedAt IS NULL
     GROUP BY c.ModelId;

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
      FROM piv2.MemberSalesMonth s JOIN #link c ON c.ProCode = s.ProCode
     WHERE s.MemberId = @MemberId AND s.MonthStart >= @buyFrom
     GROUP BY c.ModelId, s.MonthStart;

    /* Serial numbers on these lines that appear on another claim (any member). */
    CREATE TABLE #dup (LineId int NOT NULL PRIMARY KEY, Others nvarchar(max) NULL);
    INSERT #dup
    SELECT x.LineId, LEFT(STRING_AGG(CAST(CONCAT(N'claim ', x.OrderId, N' (member ', x.MemberId, N')') AS nvarchar(max)), N', '), 400)
      FROM (SELECT DISTINCT l.LineId, o.ORDERID AS OrderId, o.MemberID AS MemberId
              FROM #l l
              JOIN dbo.RebateRedeem o ON CAST(o.SerialNumber AS nvarchar(200)) = l.SerialNumber AND o.ORDERID <> l.OrderId AND COALESCE(o.Saved, 0) = 0
             WHERE l.SerialNumber IS NOT NULL AND LEN(l.SerialNumber) >= 4) x
     GROUP BY x.LineId;

    /* ---- 1: products ---- */
    SELECT m.ModelId, rm.ModelNumber AS Description, rm.ModelName AS ProCodeText, v.VendorName,
           COALESCE(b.UnitsBought, 0) AS UnitsBought, COALESCE(b.AmountBought, 0) AS AmountBought,
           COALESCE(bl.UnitsLinked, 0) AS UnitsBoughtLinked,
           COALESCE(pd.Units, 0) AS UnitsPadded, pd.Reasons AS PadReasons,
           /* Units claimed = not declined (what is compared with purchases); declined apart. */
           COALESCE(c.UnitsCounted, 0) AS UnitsClaimed, COALESCE(c.UnitsClaimed, 0) - COALESCE(c.UnitsCounted, 0) AS UnitsDeclined,
           COALESCE(c.Claims, 0) AS Claims,
           COALESCE(c.Approved, 0) AS ApprovedAmount, COALESCE(c.Declined, 0) AS DeclinedAmount,
           COALESCE(c.Support, 0) AS SupportAmount, COALESCE(c.Pending, 0) AS PendingAmount,
           c.FirstClaim, c.LastClaim,
           /* Available = bought (incl. linked models) + stock padding. */
           CAST(CASE WHEN COALESCE(c.UnitsCounted, 0) > COALESCE(b.UnitsBought, 0) + COALESCE(pd.Units, 0) THEN 1 ELSE 0 END AS bit) AS ClaimedMoreThanBought,
           COALESCE(f.NoPurchaseBefore, 0) AS ClaimsWithNoPurchaseBefore,
           COALESCE(f.RepeatedSerials, 0) AS RepeatedSerials,
           /* No purchase of any of the product's PRO codes in the member's whole AR history (not just the window). */
           CAST(CASE WHEN COALESCE(pd.Units, 0) > 0
                       OR EXISTS (SELECT 1 FROM piv2.MemberSalesMonth s JOIN #link c ON c.ProCode = s.ProCode
                                   WHERE s.MemberId = @MemberId AND c.ModelId = m.ModelId AND s.Units > 0)
                     THEN 0 ELSE 1 END AS bit) AS NoPurchaseOnRecord
      FROM #m m
      JOIN dbo.RebateCameraModels rm ON rm.ModelID = m.ModelId
      LEFT JOIN dbo.RebateVendors v ON v.VendorID = rm.VendorID
      OUTER APPLY (SELECT SUM(Units) AS UnitsBought, SUM(Amount) AS AmountBought FROM #s WHERE ModelId = m.ModelId) b
      /* The part of bought that came through a linked model. */
      OUTER APPLY (SELECT SUM(s.Units) AS UnitsLinked FROM piv2.MemberSalesMonth s JOIN #link k ON k.ProCode = s.ProCode
                    WHERE s.MemberId = @MemberId AND k.ModelId = m.ModelId AND k.IsLinked = 1 AND s.MonthStart >= @buyFrom) bl
      LEFT JOIN #pad pd ON pd.ModelId = m.ModelId
      OUTER APPLY (SELECT SUM(COALESCE(l.Quantity, 0)) AS UnitsClaimed, COUNT(DISTINCT l.OrderId) AS Claims,
                          SUM(CASE WHEN COALESCE(d.Status, 0) <> 2 THEN COALESCE(l.Quantity, 0) END) AS UnitsCounted,
                          SUM(CASE WHEN d.Status = 1 THEN l.Net END) AS Approved, SUM(CASE WHEN d.Status = 2 THEN l.Net END) AS Declined,
                          SUM(CASE WHEN d.Status = 3 THEN l.Net END) AS Support,
                          SUM(CASE WHEN COALESCE(d.Status, 0) NOT IN (1, 2, 3) THEN l.Net END) AS Pending,
                          MIN(l.ClaimDate) AS FirstClaim, MAX(l.ClaimDate) AS LastClaim
                     FROM #l l LEFT JOIN #d d ON d.OrderId = l.OrderId WHERE l.ModelId = m.ModelId) c
      OUTER APPLY (SELECT SUM(nb.NoBuy) AS NoPurchaseBefore,
                          SUM(CASE WHEN dp.LineId IS NOT NULL THEN 1 ELSE 0 END) AS RepeatedSerials
                     FROM #l l LEFT JOIN #dup dp ON dp.LineId = l.LineId
                    CROSS APPLY (SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM #pad pp WHERE pp.ModelId = l.ModelId AND pp.Units > 0)
                              AND NOT EXISTS (SELECT 1 FROM piv2.MemberSalesMonth s JOIN #link cc ON cc.ProCode = s.ProCode
                                                         WHERE s.MemberId = @MemberId AND cc.ModelId = l.ModelId AND s.Units > 0
                                                AND s.MonthStart <= DATEFROMPARTS(YEAR(l.ClaimDate), MONTH(l.ClaimDate), 1))
                                             THEN 1 ELSE 0 END AS NoBuy) nb
                    WHERE l.ModelId = m.ModelId) f
     ORDER BY CASE WHEN COALESCE(c.UnitsCounted, 0) > COALESCE(b.UnitsBought, 0) + COALESCE(pd.Units, 0) THEN 0 ELSE 1 END, COALESCE(c.UnitsClaimed, 0) DESC;

    /* ---- 2: months (all chosen products together) ---- */
    /* Purchases once per PRO code: two chosen products can share one (an IR and its trade-in). */
    CREATE TABLE #sm (MonthStart date NOT NULL PRIMARY KEY, Units decimal(19,2) NOT NULL, Amount decimal(19,2) NOT NULL);
    INSERT #sm
    SELECT s.MonthStart, SUM(s.Units), SUM(s.Amount)
      FROM piv2.MemberSalesMonth s JOIN (SELECT DISTINCT ProCode FROM #link) c ON c.ProCode = s.ProCode
     WHERE s.MemberId = @MemberId AND s.MonthStart >= @buyFrom
     GROUP BY s.MonthStart;

    ;WITH mo AS
    (
        SELECT MonthStart, Units AS UnitsBought, CAST(0 AS decimal(19,2)) AS UnitsClaimed, CAST(0 AS decimal(19,2)) AS UnitsDeclined,
               CAST(0 AS decimal(19,2)) AS UnitsPadded FROM #sm
        UNION ALL
        /* Stock padding, in the month it was entered (older or undated: the first month shown). */
        SELECT CASE WHEN o.CreatedAt >= @since THEN DATEFROMPARTS(YEAR(o.CreatedAt), MONTH(o.CreatedAt), 1)
                    ELSE DATEFROMPARTS(YEAR(COALESCE(NULLIF(@since, '19000101'), x.FirstMonth)), MONTH(COALESCE(NULLIF(@since, '19000101'), x.FirstMonth)), 1) END,
               0, 0, 0, o.Quantity
          FROM [EDA].dbo.RebateOverride o
         CROSS APPLY (SELECT COALESCE((SELECT MIN(MonthStart) FROM #sm), (SELECT MIN(ClaimDate) FROM #l), CAST(GETDATE() AS date)) AS FirstMonth) x
         WHERE o.Member = @MemberId AND o.RemovedAt IS NULL AND o.ModelNumber IN (SELECT DISTINCT ProCode FROM #link)
        UNION ALL
        SELECT DATEFROMPARTS(YEAR(l.ClaimDate), MONTH(l.ClaimDate), 1), 0,
               SUM(CASE WHEN COALESCE(d.Status, 0) <> 2 THEN COALESCE(l.Quantity, 0) ELSE 0 END),
               SUM(CASE WHEN d.Status = 2 THEN COALESCE(l.Quantity, 0) ELSE 0 END), 0
          FROM #l l LEFT JOIN #d d ON d.OrderId = l.OrderId
         WHERE l.ClaimDate IS NOT NULL
         GROUP BY DATEFROMPARTS(YEAR(l.ClaimDate), MONTH(l.ClaimDate), 1)
    )
    SELECT MonthStart, SUM(UnitsBought) AS UnitsBought, SUM(UnitsClaimed) AS UnitsClaimed, SUM(UnitsDeclined) AS UnitsDeclined,
           SUM(UnitsPadded) AS UnitsPadded
      FROM mo GROUP BY MonthStart ORDER BY MonthStart;

    /* AR credits for these claims: the nightly copy, then the live view only for posted claims it does not have yet. */
    CREATE TABLE #ar (OrderId int NOT NULL PRIMARY KEY, InvoiceNumber varchar(50) NULL, PostedAt datetime NULL, Amount decimal(19,2) NULL);
    INSERT #ar
    SELECT x.OrderId, x.InvoiceNumber, x.PostedAt, x.Amount
      FROM (SELECT c.OrderId, c.InvoiceNumber, c.PostedAt, c.Amount, ROW_NUMBER() OVER (PARTITION BY c.OrderId ORDER BY c.PostedAt DESC) AS rn
              FROM piv2.RebateArCredit c JOIN #d d ON d.OrderId = c.OrderId WHERE c.MemberId = @MemberId) x
     WHERE x.rn = 1;
    INSERT #ar
    SELECT d.OrderId, a.InvoiceNumber, a.PostedAt, a.Amount
      FROM #d d
     CROSS APPLY (SELECT TOP (1) c.InvoiceNumber, c.PostedAt, c.Amount FROM piv2.Rebate_ArCredit(@MemberId, d.OrderId) c ORDER BY c.PostedAt DESC) a
     WHERE d.Posted = 1 AND d.OrderId NOT IN (SELECT OrderId FROM #ar);

    /* ---- 3: claims, one row per claim (only these products' lines), newest first ---- */
    SELECT o.OrderId,
           MIN(l.ClaimDate) AS ClaimDate,
           STRING_AGG(CAST(CAST(rm.ModelNumber AS nvarchar(300)) AS nvarchar(max)), N'; ') WITHIN GROUP (ORDER BY l.LineId) AS Products,
           MIN(l.ModelId) AS ModelId,
           COUNT(DISTINCT l.ModelId) AS ProductCount,
           SUM(COALESCE(l.Quantity, 0)) AS Units,
           SUM(l.Net) AS Amount,
           MAX(d.Status) AS Status,
           MAX(d.DecidedAt) AS DecidedAt,
           /* The old system wrote "Cant get user" when it had no user: show nothing. */
           MAX(CASE WHEN d.DecidedBy LIKE N'%t get user%' THEN NULL ELSE d.DecidedBy END) AS DecidedBy,
           MAX(d.RejectReason) AS Reason,
           MAX(CASE WHEN d.Posted = 1 THEN 1 ELSE 0 END) AS MarkedPosted,
           MAX(d.DebitMemo) AS DebitMemo,
           MAX(ar.InvoiceNumber) AS ArInvoice, MAX(ar.PostedAt) AS ArPostedAt, MAX(ar.Amount) AS ArAmount,
           LEFT(STRING_AGG(CAST(l.SerialNumber AS nvarchar(max)), N', '), 400) AS Serials,
           LEFT(STRING_AGG(CAST(dp.Others AS nvarchar(max)), N'; '), 400) AS SerialAlsoOn,
           SUM(nb.NoBuy) AS LinesWithNoPurchaseBefore,
           /* The member's proof files for the claim (pipe list; the API turns them into links). */
           MAX(pf.ProofFiles) AS ProofFiles
      FROM (SELECT DISTINCT OrderId FROM #l) o
      JOIN #l l ON l.OrderId = o.OrderId
      JOIN dbo.RebateCameraModels rm ON rm.ModelID = l.ModelId
      LEFT JOIN #d d ON d.OrderId = o.OrderId
      LEFT JOIN #dup dp ON dp.LineId = l.LineId
     CROSS APPLY (SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM #pad pp WHERE pp.ModelId = l.ModelId AND pp.Units > 0)
                              AND NOT EXISTS (SELECT 1 FROM piv2.MemberSalesMonth s JOIN #link cc ON cc.ProCode = s.ProCode
                                                         WHERE s.MemberId = @MemberId AND cc.ModelId = l.ModelId AND s.Units > 0
                                AND s.MonthStart <= DATEFROMPARTS(YEAR(l.ClaimDate), MONTH(l.ClaimDate), 1))
                              THEN 1 ELSE 0 END AS NoBuy) nb
      LEFT JOIN #ar ar ON ar.OrderId = o.OrderId
     OUTER APPLY (SELECT STRING_AGG(CAST(f.FileName AS nvarchar(max)), N'|') AS ProofFiles
                    FROM (SELECT LTRIM(RTRIM(CAST(x.MasterFileLoc AS nvarchar(400)))) AS FileName
                            FROM dbo.RebateRedeem x WHERE x.ORDERID = o.OrderId AND COALESCE(x.Saved, 0) = 0
                          UNION
                          SELECT LTRIM(RTRIM(CAST(a.filename AS nvarchar(400)))) FROM dbo.RebateRedeemAdditionalFiles a WHERE a.orderID = o.OrderId) f
                   WHERE NULLIF(f.FileName, N'') IS NOT NULL AND f.FileName <> N'Additional Files') pf
     GROUP BY o.OrderId
     ORDER BY MIN(l.ClaimDate) DESC, o.OrderId DESC;

    /* ---- 4: purchases by month, for the table under the chart ---- */
    SELECT MonthStart, Units, Amount FROM #sm ORDER BY MonthStart DESC;

    /* ---- 5: about ---- */
    SELECT @MemberId AS MemberId, (SELECT Name FROM piv2.MemberName WHERE MemberId = @MemberId) AS MemberName,
           @since AS WindowFrom, @buyFrom AS PurchasesFrom,
           (SELECT MAX(FinishedAt) FROM piv2.SalesRefreshLog WHERE Error IS NULL AND FinishedAt IS NOT NULL) AS SalesAsOf;

    /* ---- 6: linked models: each product's own PRO codes and its predecessors / successors, with what was bought ---- */
    SELECT k.ModelId, k.ProCode, k.IsLinked, k.LinkedFrom, pr.Name AS ProductName, pr.CatNo, pr.Discontinued,
           COALESCE(sb.Units, 0) AS UnitsBought, COALESCE(op.Units, 0) AS UnitsPadded
      FROM #link k
     OUTER APPLY (SELECT TOP (1) LEFT(LTRIM(RTRIM(p.ModelName)), 200) AS Name, LEFT(LTRIM(RTRIM(p.CAT_NO)), 60) AS CatNo,
                         CAST(CASE WHEN COALESCE(p.IsDiscontinued, 0) = 1 THEN 1 ELSE 0 END AS bit) AS Discontinued
                    FROM [PRO].dbo.Product p WHERE CAST(p.ProductCode AS nvarchar(20)) = CAST(k.ProCode AS nvarchar(20))
                   ORDER BY CASE WHEN COALESCE(p.IsActive, 0) = 1 THEN 0 ELSE 1 END) pr
     OUTER APPLY (SELECT SUM(s.Units) AS Units FROM piv2.MemberSalesMonth s
                   WHERE s.MemberId = @MemberId AND s.ProCode = k.ProCode AND s.MonthStart >= @buyFrom) sb
     OUTER APPLY (SELECT SUM(o.Quantity) AS Units FROM [EDA].dbo.RebateOverride o
                   WHERE o.Member = @MemberId AND o.ModelNumber = k.ProCode AND o.RemovedAt IS NULL) op
     ORDER BY k.ModelId, k.IsLinked, k.ProCode;

    /* ---- 7: stock padding entries for this member on these codes (removed ones too, for the audit) ---- */
    SELECT o.ID AS PadId, o.Member AS MemberId, o.ModelNumber AS ProCode, o.Quantity, o.Reason, o.CreatedBy, o.CreatedAt,
           o.RemovedBy, o.RemovedAt, o.RemovedReason
      FROM [EDA].dbo.RebateOverride o
     WHERE o.Member = @MemberId AND o.ModelNumber IN (SELECT DISTINCT ProCode FROM #link)
     ORDER BY CASE WHEN o.RemovedAt IS NULL THEN 0 ELSE 1 END, o.ID DESC;
END
GO

SELECT N'investigate ready' AS Result;
