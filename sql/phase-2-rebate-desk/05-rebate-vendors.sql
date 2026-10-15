/*
    Phase 2 · 05  Rebate Desk: vendors, programs and liability, both rails
    Database: PRO_NUKE      Safe to run twice (CREATE OR ALTER).      Run after 04.

    Product → vendor: every program points at a rebate model, and every
    model has a VendorID, so everything rolls up under a vendor (and under
    its ParentCompany, the way the member site groups them).

    Liability comes from member claims:
        instant rebates   RebateRedeem lines (Net = amount × quantity)
                          + the latest RebateProcess row for the claim
        price protection  PriceProtectionRedeem + PriceProtectionProcess

    Each claim is in one bucket, from its latest process row:
        SUBMITTED   no decision yet (no process row, or Status not 1 or 2)
        APPROVED    Status 1, not yet sent to Computyme (ComputymeProcessed empty or 0)
        SENT        Status 1, ComputymeProcessed = 1
        DECLINED    Status 2
    Liability = approved claims (sent to Computyme or not) the vendor has
    not reimbursed yet, i.e. no debit memo, at the vendor's share. Claims
    awaiting a decision are shown apart as pending. PRO pad = what members
    were credited above the vendor's share (combo products): PRO's own
    cost, never billed. Credited, reimbursed and declined are shown for
    the chosen period (by decision date). Lines a member saved but never
    submitted (Saved = 1) are left out.
*/

USE PRO_NUKE;
GO
SET XACT_ABORT ON;
GO

CREATE OR ALTER PROCEDURE piv2.Rebate_VendorLiability
    @Rail     char(2) = 'IR',
    @VendorId int = NULL,          -- one vendor: adds its products and open claims
    @From     date = NULL,         -- period for credited, reimbursed and declined; default 1 January this year
    @To       date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @pp int = CASE WHEN UPPER(@Rail) = 'PP' THEN 1 ELSE 0 END;
    DECLARE @today date = CAST(GETDATE() AS date);
    SET @From = COALESCE(@From, DATEFROMPARTS(YEAR(@today), 1, 1));
    SET @To = COALESCE(@To, @today);
    DECLARE @toEx datetime = DATEADD(day, 1, CAST(@To AS datetime));

    /* ---- the rail's products: a model's own flag decides its rail ---- */
    CREATE TABLE #m (ModelId int NOT NULL PRIMARY KEY, VendorId int NULL, Active int NOT NULL);
    INSERT #m
    SELECT m.ModelID, m.VendorID, COALESCE(m.Active, 0)
      FROM dbo.RebateCameraModels m
     WHERE m.IsPriceProtection = @pp
       AND (@VendorId IS NULL OR m.VendorID = @VendorId);

    /* ---- latest decision per claim: one pass over the process table ---- */
    CREATE TABLE #d (OrderId int NOT NULL PRIMARY KEY, Status int NULL, ComputymeProcessed int NULL, DecidedAt datetime NULL, DebitMemo varchar(100) NULL);
    IF @pp = 0
        INSERT #d
        SELECT OrderID, Status, ComputymeProcessed, timeEnd, NULLIF(LTRIM(RTRIM(DM)), '')
          FROM (SELECT OrderID, Status, ComputymeProcessed, timeEnd, DM,
                       ROW_NUMBER() OVER (PARTITION BY OrderID ORDER BY ID DESC) AS rn
                  FROM dbo.RebateProcess WHERE OrderID IS NOT NULL) x
         WHERE x.rn = 1;
    ELSE
        INSERT #d
        SELECT OrderID, Status, ComputymeProcessed, timeEnd, NULLIF(LTRIM(RTRIM(DM)), '')
          FROM (SELECT OrderID, Status, ComputymeProcessed, timeEnd, DM,
                       ROW_NUMBER() OVER (PARTITION BY OrderID ORDER BY ID DESC) AS rn
                  FROM dbo.PriceProtectionProcess WHERE OrderID IS NOT NULL) x
         WHERE x.rn = 1;

    /* ---- claims, one row per claim and product ----
       Amount        what the member was credited
       VendorAmount  what PRO claims back: the vendor's share (IR: without PRO pad) */
    CREATE TABLE #claim
    (
        OrderId      int            NOT NULL,
        ModelId      int            NOT NULL,
        VendorId     int            NULL,
        MemberId     int            NULL,
        ClaimDate    datetime       NULL,
        Quantity     int            NULL,
        Amount       decimal(19,2)  NOT NULL,
        VendorAmount decimal(19,2)  NOT NULL,
        Bucket       varchar(10)    NOT NULL,
        DecidedAt    datetime       NULL,
        DebitMemo    varchar(100)   NULL
    );

    IF @pp = 0
    BEGIN
        /* Vendor share for desk-loaded programs (piv2.RebateProgramTerms); legacy claims use the amount itself. */
        CREATE TABLE #tm (ModelId int NOT NULL PRIMARY KEY);
        INSERT #tm SELECT DISTINCT ModelId FROM piv2.RebateProgramTerms WHERE ModelId IS NOT NULL;

        INSERT #claim (OrderId, ModelId, VendorId, MemberId, ClaimDate, Quantity, Amount, VendorAmount, Bucket, DecidedAt, DebitMemo)
        SELECT r.ORDERID, r.ModelID, m.VendorId, MAX(r.MemberID), MIN(r.Date), SUM(r.Quantity),
               SUM(CAST(COALESCE(r.Net, 0) AS decimal(19,2))),
               SUM(CAST(CASE WHEN tm.ModelId IS NULL THEN COALESCE(r.Net, 0)
                             ELSE COALESCE(vs.VendorShare, r.ReimbursementAmount, 0) * COALESCE(r.Quantity, 0) END AS decimal(19,2))),
               CASE WHEN d.Status = 2 THEN 'DECLINED'
                    WHEN d.Status = 1 AND COALESCE(d.ComputymeProcessed, 0) = 1 THEN 'SENT'
                    WHEN d.Status = 1 THEN 'APPROVED'
                    ELSE 'SUBMITTED' END,
               d.DecidedAt, d.DebitMemo
          FROM dbo.RebateRedeem r
          JOIN #m m ON m.ModelId = r.ModelID
          LEFT JOIN #d d ON d.OrderId = r.ORDERID
          LEFT JOIN #tm tm ON tm.ModelId = r.ModelID
          OUTER APPLY (SELECT TOP (1) t.VendorShare
                         FROM piv2.RebateProgramTerms t
                         JOIN dbo.RebateProgramDetail pd ON pd.ProgramID = t.ProgramId
                        WHERE tm.ModelId IS NOT NULL
                          AND t.ModelId = r.ModelID AND ABS(t.MemberAmount - r.ReimbursementAmount) < 0.005
                          AND r.Date >= pd.ProgramStartWeek
                          AND r.Date < DATEADD(day, 1, COALESCE(pd.ExpireOn, DATEADD(day, 120, pd.ProgramEndWeek)))
                        ORDER BY pd.ProgramStartWeek DESC, t.UpdatedAt DESC) vs
         WHERE COALESCE(r.Saved, 0) = 0 AND r.ORDERID IS NOT NULL
         GROUP BY r.ORDERID, r.ModelID, m.VendorId, d.Status, d.ComputymeProcessed, d.DecidedAt, d.DebitMemo;
    END
    ELSE
        INSERT #claim (OrderId, ModelId, VendorId, MemberId, ClaimDate, Quantity, Amount, VendorAmount, Bucket, DecidedAt, DebitMemo)
        SELECT r.ORDERID, r.ModelID, m.VendorId, MAX(r.MemberID), MIN(r.Date), SUM(r.Quantity),
               SUM(CAST(COALESCE(r.Net, 0) AS decimal(19,2))),
               SUM(CAST(COALESCE(r.Net, 0) AS decimal(19,2))),
               CASE WHEN d.Status = 2 THEN 'DECLINED'
                    WHEN d.Status = 1 AND COALESCE(d.ComputymeProcessed, 0) = 1 THEN 'SENT'
                    WHEN d.Status = 1 THEN 'APPROVED'
                    ELSE 'SUBMITTED' END,
               d.DecidedAt, d.DebitMemo
          FROM dbo.PriceProtectionRedeem r
          JOIN #m m ON m.ModelId = r.ModelID
          LEFT JOIN #d d ON d.OrderId = r.ORDERID
         WHERE COALESCE(r.Saved, 0) = 0 AND r.ORDERID IS NOT NULL
         GROUP BY r.ORDERID, r.ModelID, m.VendorId, d.Status, d.ComputymeProcessed, d.DecidedAt, d.DebitMemo;

    CREATE INDEX IX_claim_vendor ON #claim (VendorId) INCLUDE (Bucket, Amount, VendorAmount, DebitMemo, DecidedAt, ClaimDate, OrderId);

    /* ---- programs per product, in one pass ---- */
    CREATE TABLE #prog
    (
        ModelId     int  NOT NULL PRIMARY KEY,
        Live        int  NOT NULL,
        Current_    int  NOT NULL,
        Upcoming    int  NOT NULL,
        LastDate    date NULL,
        LiveAmount  decimal(19,2) NULL     -- member amount (IR) or credit (PP) on the latest live program
    );

    IF @pp = 0
        INSERT #prog
        SELECT x.ModelID,
               SUM(CASE WHEN x.Expired = 0 THEN 1 ELSE 0 END),
               SUM(CASE WHEN x.Expired = 0 AND x.ProgramStartWeek <= @today AND x.ProgramEndWeek >= @today THEN 1 ELSE 0 END),
               SUM(CASE WHEN x.Expired = 0 AND x.ProgramStartWeek > @today THEN 1 ELSE 0 END),
               MAX(x.ProgramEndWeek),
               MAX(CASE WHEN x.LiveRank = 1 AND x.Expired = 0 THEN x.Reimbursement END)
          FROM (SELECT p.ModelID, p.Expired, p.ProgramStartWeek, p.ProgramEndWeek, p.Reimbursement,
                       ROW_NUMBER() OVER (PARTITION BY p.ModelID, CASE WHEN p.Expired = 0 THEN 0 ELSE 1 END
                                          ORDER BY p.ProgramStartWeek DESC) AS LiveRank
                  FROM dbo.RebateProgramDetail p
                  JOIN #m m ON m.ModelId = p.ModelID) x
         GROUP BY x.ModelID;
    ELSE
        INSERT #prog
        SELECT x.ModelID,
               SUM(CASE WHEN x.Expired = 0 THEN 1 ELSE 0 END),
               SUM(CASE WHEN x.Expired = 0 AND x.ProgramDate <= @today THEN 1 ELSE 0 END),
               SUM(CASE WHEN x.Expired = 0 AND x.ProgramDate > @today THEN 1 ELSE 0 END),
               MAX(x.ProgramDate),
               MAX(CASE WHEN x.LiveRank = 1 AND x.Expired = 0 THEN x.Amount END)
          FROM (SELECT p.ModelID, p.Expired, p.ProgramDate, p.Amount,
                       ROW_NUMBER() OVER (PARTITION BY p.ModelID, CASE WHEN p.Expired = 0 THEN 0 ELSE 1 END
                                          ORDER BY p.ProgramDate DESC) AS LiveRank
                  FROM dbo.PriceProtectionDetail p
                  JOIN #m m ON m.ModelId = p.ModelID) x
         GROUP BY x.ModelID;

    /* ---- per vendor ---- */
    CREATE TABLE #v
    (
        VendorId int NOT NULL PRIMARY KEY,
        ProductsActive int NOT NULL, ProgramsLive int NOT NULL, ProgramsCurrent int NOT NULL, ProgramsUpcoming int NOT NULL
    );
    INSERT #v
    SELECT m.VendorId, SUM(CASE WHEN m.Active = 1 THEN 1 ELSE 0 END),
           COALESCE(SUM(p.Live), 0), COALESCE(SUM(p.Current_), 0), COALESCE(SUM(p.Upcoming), 0)
      FROM #m m LEFT JOIN #prog p ON p.ModelId = m.ModelId
     WHERE m.VendorId IS NOT NULL
     GROUP BY m.VendorId;

    /* Liability = approved claims the vendor has not reimbursed yet (no debit memo), at the vendor's share. */
    SELECT v.VendorID AS VendorId, v.VendorName, v.ParentCompany, v.APMSTID AS ApVendorId,
           CAST(v.Active AS bit) AS IsActive,
           COALESCE(pv.ProductsActive, 0) AS ProductsActive,
           COALESCE(pv.ProgramsLive, 0) AS ProgramsLive,
           COALESCE(pv.ProgramsCurrent, 0) AS ProgramsCurrent,
           COALESCE(pv.ProgramsUpcoming, 0) AS ProgramsUpcoming,
           COALESCE(cl.LiabilityClaims, 0) AS LiabilityClaims,
           COALESCE(cl.Liability, 0) AS Liability,
           COALESCE(cl.UnsentAmount, 0) AS UnsentAmount,
           COALESCE(cl.PendingClaims, 0) AS PendingClaims,
           COALESCE(cl.PendingAmount, 0) AS PendingAmount,
           COALESCE(cl.CreditedClaims, 0) AS CreditedClaims,
           COALESCE(cl.CreditedAmount, 0) AS CreditedAmount,
           COALESCE(cl.ReimbursedAmount, 0) AS ReimbursedAmount,
           COALESCE(cl.DeclinedClaims, 0) AS DeclinedClaims,
           COALESCE(cl.DeclinedAmount, 0) AS DeclinedAmount,
           COALESCE(cl.ProPadAmount, 0) AS ProPadAmount,
           cl.OldestUnreimbursed,
           @From AS PeriodFrom, @To AS PeriodTo
      FROM dbo.RebateVendors v
      LEFT JOIN #v pv ON pv.VendorId = v.VendorID
      OUTER APPLY
      (
          SELECT COUNT(DISTINCT CASE WHEN c.Bucket IN ('APPROVED', 'SENT') AND c.DebitMemo IS NULL THEN c.OrderId END) AS LiabilityClaims,
                 SUM(CASE WHEN c.Bucket IN ('APPROVED', 'SENT') AND c.DebitMemo IS NULL THEN c.VendorAmount END) AS Liability,
                 SUM(CASE WHEN c.Bucket = 'APPROVED' THEN c.Amount END) AS UnsentAmount,
                 COUNT(DISTINCT CASE WHEN c.Bucket = 'SUBMITTED' THEN c.OrderId END) AS PendingClaims,
                 SUM(CASE WHEN c.Bucket = 'SUBMITTED' THEN c.Amount END) AS PendingAmount,
                 COUNT(DISTINCT CASE WHEN c.Bucket = 'SENT' AND c.DecidedAt >= @From AND c.DecidedAt < @toEx THEN c.OrderId END) AS CreditedClaims,
                 SUM(CASE WHEN c.Bucket = 'SENT' AND c.DecidedAt >= @From AND c.DecidedAt < @toEx THEN c.Amount END) AS CreditedAmount,
                 SUM(CASE WHEN c.Bucket IN ('APPROVED', 'SENT') AND c.DebitMemo IS NOT NULL AND c.DecidedAt >= @From AND c.DecidedAt < @toEx THEN c.VendorAmount END) AS ReimbursedAmount,
                 COUNT(DISTINCT CASE WHEN c.Bucket = 'DECLINED' AND c.DecidedAt >= @From AND c.DecidedAt < @toEx THEN c.OrderId END) AS DeclinedClaims,
                 SUM(CASE WHEN c.Bucket = 'DECLINED' AND c.DecidedAt >= @From AND c.DecidedAt < @toEx THEN c.Amount END) AS DeclinedAmount,
                 SUM(CASE WHEN c.Bucket IN ('APPROVED', 'SENT') AND c.DecidedAt >= @From AND c.DecidedAt < @toEx THEN c.Amount - c.VendorAmount END) AS ProPadAmount,
                 MIN(CASE WHEN c.Bucket IN ('APPROVED', 'SENT') AND c.DebitMemo IS NULL THEN c.ClaimDate END) AS OldestUnreimbursed
            FROM #claim c
           WHERE c.VendorId = v.VendorID
      ) cl
     WHERE (v.IsPriceProtection = @pp OR pv.VendorId IS NOT NULL)
       AND (@VendorId IS NULL OR v.VendorID = @VendorId)
     ORDER BY COALESCE(cl.Liability, 0) DESC, v.Active DESC, v.VendorName;

    IF @VendorId IS NULL RETURN;

    /* ---- 2: the vendor's products ---- */
    SELECT m.ModelID AS ModelId, m.ModelNumber AS Description, m.ModelName AS ProCodeText,
           CAST(COALESCE(m.Active, 0) AS bit) AS IsActive,
           COALESCE(p.Live, 0) AS ProgramsLive, COALESCE(p.Current_, 0) AS ProgramsCurrent, COALESCE(p.Upcoming, 0) AS ProgramsUpcoming,
           p.LastDate AS LastProgramDate, p.LiveAmount,
           COALESCE(c.Liability, 0) AS Liability, COALESCE(c.LiabilityUnits, 0) AS LiabilityUnits,
           COALESCE(c.PendingAmount, 0) AS PendingAmount,
           COALESCE(c.CreditedAmount, 0) AS CreditedAmount,
           COALESCE(c.ProPadAmount, 0) AS ProPadAmount
      FROM #m mm
      JOIN dbo.RebateCameraModels m ON m.ModelID = mm.ModelId
      LEFT JOIN #prog p ON p.ModelId = mm.ModelId
      LEFT JOIN
      (
          SELECT ModelId,
                 SUM(CASE WHEN Bucket IN ('APPROVED', 'SENT') AND DebitMemo IS NULL THEN VendorAmount END) AS Liability,
                 SUM(CASE WHEN Bucket IN ('APPROVED', 'SENT') AND DebitMemo IS NULL THEN Quantity END) AS LiabilityUnits,
                 SUM(CASE WHEN Bucket = 'SUBMITTED' THEN Amount END) AS PendingAmount,
                 SUM(CASE WHEN Bucket = 'SENT' AND DecidedAt >= @From AND DecidedAt < @toEx THEN Amount END) AS CreditedAmount,
                 SUM(CASE WHEN Bucket IN ('APPROVED', 'SENT') AND DecidedAt >= @From AND DecidedAt < @toEx THEN Amount - VendorAmount END) AS ProPadAmount,
                 COUNT(*) AS Claims
            FROM #claim GROUP BY ModelId
      ) c ON c.ModelId = mm.ModelId
     WHERE mm.VendorId = @VendorId
       AND (COALESCE(p.Live, 0) > 0 OR c.Claims > 0 OR mm.Active = 1)
     ORDER BY COALESCE(c.Liability, 0) DESC, m.ModelNumber;

    /* ---- 3: the claims behind the liability (not reimbursed), and claims awaiting a decision ---- */
    SELECT TOP (500) c.OrderId, MAX(c.MemberId) AS MemberId, MIN(c.ClaimDate) AS ClaimDate,
           CASE WHEN MIN(c.Bucket) = 'SUBMITTED' THEN 'SUBMITTED' ELSE MAX(c.Bucket) END AS Bucket,
           SUM(c.Amount) AS Amount, SUM(c.VendorAmount) AS VendorAmount, SUM(c.Quantity) AS Units,
           STRING_AGG(CAST(m.ModelNumber AS nvarchar(max)), N'; ') AS Products
      FROM #claim c
      JOIN dbo.RebateCameraModels m ON m.ModelID = c.ModelId
     WHERE c.Bucket = 'SUBMITTED' OR (c.Bucket IN ('APPROVED', 'SENT') AND c.DebitMemo IS NULL)
     GROUP BY c.OrderId
     ORDER BY MIN(c.ClaimDate);
END
GO

/* ---------------------------------------------------------------
   For the vendor card (PRO dbo.Vendor = Computyme AP vendor id):
   the rebate vendors linked to it through RebateVendors.APMSTID, and
   their live and upcoming programs on both rails. Liability comes
   from Rebate_VendorLiability for each linked rebate vendor.
   --------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE piv2.Rebate_ForApVendor
    @ApVendorId nvarchar(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ap nvarchar(50) = NULLIF(LTRIM(RTRIM(@ApVendorId)), N'');
    DECLARE @apInt int = TRY_CAST(@ap AS int);
    DECLARE @today date = CAST(GETDATE() AS date);

    CREATE TABLE #v (VendorId int NOT NULL PRIMARY KEY, VendorName nvarchar(200) NULL, Rail char(2) NOT NULL, IsActive bit NOT NULL);
    INSERT #v
    SELECT v.VendorID, v.VendorName, CASE WHEN v.IsPriceProtection = 1 THEN 'PP' ELSE 'IR' END, CAST(COALESCE(v.Active, 0) AS bit)
      FROM dbo.RebateVendors v
     WHERE @ap IS NOT NULL
       AND (LTRIM(RTRIM(v.APMSTID)) = @ap OR (@apInt IS NOT NULL AND TRY_CAST(LTRIM(RTRIM(v.APMSTID)) AS int) = @apInt));

    SELECT VendorId, VendorName, Rail, IsActive FROM #v ORDER BY Rail, VendorName;

    /* Live programs and ones starting later, newest first (capped). */
    SELECT TOP (300) x.*
      FROM
      (
        SELECT 'IR' AS Rail, p.ProgramID AS ProgramId, p.BatchID AS BatchId, m.ModelID AS ModelId, m.ModelNumber AS Description,
               m.ModelName AS ProCode, t.Name AS TypeName, p.ProgramStartWeek AS StartDate, p.ProgramEndWeek AS EndDate,
               p.InstantRebate, p.Reimbursement AS MemberAmount, p.MAPDrop AS MapPrice,
               CASE WHEN p.ProgramStartWeek > @today THEN 'UPCOMING' ELSE 'RUNNING' END AS State
          FROM dbo.RebateProgramDetail p
          JOIN dbo.RebateCameraModels m ON m.ModelID = p.ModelID
          JOIN #v v ON v.VendorId = m.VendorID
          LEFT JOIN dbo.RebateType t ON t.ID = p.IRType
         WHERE p.Expired = 0 AND p.ProgramEndWeek >= @today
        UNION ALL
        SELECT 'PP', p.ProgramID, NULL, m.ModelID, m.ModelNumber, m.ModelName, N'Price protection', p.ProgramDate, NULL,
               NULL, p.Amount, p.NewMap,
               CASE WHEN p.ProgramDate > @today THEN 'UPCOMING' ELSE 'RUNNING' END
          FROM dbo.PriceProtectionDetail p
          JOIN dbo.RebateCameraModels m ON m.ModelID = p.ModelID
          JOIN #v v ON v.VendorId = m.VendorID
         WHERE p.Expired = 0
      ) x
     ORDER BY x.StartDate DESC, x.Description;
END
GO

/* A vendor's standing terms (instant rebates): catalog prefix, brands, default share and pad. */
CREATE OR ALTER PROCEDURE piv2.Rebate_GetVendorTerms
    @VendorId int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SELECT v.VendorID AS VendorId, v.VendorName, t.CatalogPrefix, t.BrandIds, t.VendorSharePct, t.ComboPadPct,
           COALESCE(t.ExpireDays, 60) AS ExpireDays, t.DefaultRebateType, t.Notes, t.UpdatedBy, t.UpdatedAt
      FROM dbo.RebateVendors v
      LEFT JOIN piv2.RebateVendorTerms t ON t.VendorId = v.VendorID
     WHERE v.VendorID = @VendorId;
END
GO

CREATE OR ALTER PROCEDURE piv2.Rebate_SaveVendorTerms
    @VendorId          int,
    @CatalogPrefix     nvarchar(20) = NULL,
    @BrandIds          varchar(200) = NULL,
    @VendorSharePct    decimal(5,2) = NULL,
    @ComboPadPct       decimal(5,2) = NULL,
    @ExpireDays        int = NULL,
    @DefaultRebateType int = NULL,
    @Notes             nvarchar(1000) = NULL,
    @Actor             nvarchar(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.RebateVendors WHERE VendorID = @VendorId)
        THROW 50704, 'That rebate vendor does not exist.', 1;
    IF @VendorSharePct NOT BETWEEN 0 AND 100 OR @ComboPadPct NOT BETWEEN 0 AND 100
        THROW 50745, 'Percentages are between 0 and 100.', 1;
    IF @ExpireDays NOT BETWEEN 0 AND 365
        THROW 50746, 'The claim window is 0 to 365 days.', 1;
    IF EXISTS (SELECT 1 FROM STRING_SPLIT(COALESCE(@BrandIds, ''), ',') WHERE LTRIM(RTRIM(value)) <> '' AND TRY_CAST(value AS int) IS NULL)
        THROW 50747, 'Brand ids are numbers separated by commas.', 1;

    BEGIN TRAN;

    DECLARE @before nvarchar(max) =
        (SELECT CatalogPrefix AS catalogPrefix, BrandIds AS brandIds, VendorSharePct AS vendorSharePct, ComboPadPct AS comboPadPct,
                ExpireDays AS expireDays, DefaultRebateType AS defaultRebateType
           FROM piv2.RebateVendorTerms WITH (UPDLOCK, HOLDLOCK) WHERE VendorId = @VendorId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

    MERGE piv2.RebateVendorTerms AS t
    USING (SELECT @VendorId AS VendorId) AS s ON t.VendorId = s.VendorId
    WHEN MATCHED THEN UPDATE SET
         CatalogPrefix = NULLIF(LTRIM(RTRIM(@CatalogPrefix)), N''), BrandIds = NULLIF(REPLACE(@BrandIds, ' ', ''), ''),
         VendorSharePct = @VendorSharePct, ComboPadPct = @ComboPadPct, ExpireDays = @ExpireDays,
         DefaultRebateType = @DefaultRebateType, Notes = NULLIF(LTRIM(RTRIM(@Notes)), N''),
         UpdatedBy = @Actor, UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (VendorId, CatalogPrefix, BrandIds, VendorSharePct, ComboPadPct, ExpireDays, DefaultRebateType, Notes, UpdatedBy)
         VALUES (@VendorId, NULLIF(LTRIM(RTRIM(@CatalogPrefix)), N''), NULLIF(REPLACE(@BrandIds, ' ', ''), ''),
                 @VendorSharePct, @ComboPadPct, @ExpireDays, @DefaultRebateType, NULLIF(LTRIM(RTRIM(@Notes)), N''), @Actor);

    INSERT piv2.RebateEvent (EventType, Actor, Detail)
    VALUES ('VENDOR_TERMS', @Actor,
            (SELECT @VendorId AS vendorId, JSON_QUERY(@before) AS [before],
                    JSON_QUERY((SELECT @CatalogPrefix AS catalogPrefix, @BrandIds AS brandIds, @VendorSharePct AS vendorSharePct,
                                       @ComboPadPct AS comboPadPct, @ExpireDays AS expireDays, @DefaultRebateType AS defaultRebateType
                                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS [after]
              FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));

    COMMIT;
END
GO

SELECT N'vendors ready' AS Result;
