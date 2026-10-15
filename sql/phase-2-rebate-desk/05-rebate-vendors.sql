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
    Open liability = SUBMITTED + APPROVED. Unbilled = the vendor's share of
    approved claims (sent or not) with no debit memo yet: what PRO still has
    to bill the vendor for. PRO pad = what members were credited above the
    vendor's share (combo products): PRO's own cost, never billed.
    SENT and DECLINED are shown for
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
    @From     date = NULL,         -- period for SENT and DECLINED; default 1 January this year
    @To       date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @pp int = CASE WHEN @Rail = 'PP' THEN 1 ELSE 0 END;
    DECLARE @today date = CAST(GETDATE() AS date);
    SET @From = COALESCE(@From, DATEFROMPARTS(YEAR(@today), 1, 1));
    SET @To = COALESCE(@To, @today);
    DECLARE @toEx datetime = DATEADD(day, 1, CAST(@To AS datetime));

    /* ---- claims, one row per claim and model ---- */
    CREATE TABLE #claim
    (
        OrderId   int            NOT NULL,
        ModelId   int            NOT NULL,
        VendorId  int            NULL,
        MemberId  int            NULL,
        ClaimDate datetime       NULL,
        Quantity  int            NULL,
        Amount    decimal(19,2)  NOT NULL,     -- what the member is credited
        VendorAmount decimal(19,2) NOT NULL,   -- what PRO claims back: the vendor's share (no PRO pad)
        Bucket    varchar(10)    NOT NULL,
        DecidedAt datetime       NULL,
        DebitMemo varchar(100)   NULL      -- set when accounting billed the vendor for this claim
    );

    IF @pp = 0
    BEGIN
        WITH lastProc AS
        (
            SELECT OrderID, Status, ComputymeProcessed, timeEnd, DM,
                   ROW_NUMBER() OVER (PARTITION BY OrderID ORDER BY ID DESC) AS rn
              FROM dbo.RebateProcess
        )
        INSERT #claim (OrderId, ModelId, VendorId, MemberId, ClaimDate, Quantity, Amount, VendorAmount, Bucket, DecidedAt, DebitMemo)
        SELECT r.ORDERID, r.ModelID, m.VendorID, MAX(r.MemberID), MIN(r.Date), SUM(r.Quantity),
               SUM(CAST(COALESCE(r.Net, 0) AS decimal(19,2))),
               SUM(CAST(COALESCE(vs.VendorShare, r.ReimbursementAmount, 0) * COALESCE(r.Quantity, 0) AS decimal(19,2))),
               CASE WHEN p.Status = 2 THEN 'DECLINED'
                    WHEN p.Status = 1 AND COALESCE(p.ComputymeProcessed, 0) = 1 THEN 'SENT'
                    WHEN p.Status = 1 THEN 'APPROVED'
                    ELSE 'SUBMITTED' END,
               MAX(p.timeEnd), MAX(NULLIF(LTRIM(RTRIM(p.DM)), ''))
          FROM dbo.RebateRedeem r
          JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelID
          LEFT JOIN lastProc p ON p.OrderID = r.ORDERID AND p.rn = 1
          OUTER APPLY (SELECT TOP (1) t.VendorShare
                         FROM piv2.RebateProgramTerms t
                         JOIN dbo.RebateProgramDetail pd ON pd.ProgramID = t.ProgramId
                        WHERE t.ModelId = r.ModelID AND ABS(t.MemberAmount - r.ReimbursementAmount) < 0.005
                          AND pd.ModelID = r.ModelID
                          AND r.Date >= pd.ProgramStartWeek
                          AND r.Date < DATEADD(day, 1, COALESCE(pd.ExpireOn, DATEADD(day, 120, pd.ProgramEndWeek)))
                        ORDER BY pd.ProgramStartWeek DESC, t.UpdatedAt DESC) vs
         WHERE COALESCE(r.Saved, 0) = 0 AND r.ORDERID IS NOT NULL
           AND (@VendorId IS NULL OR m.VendorID = @VendorId)
         GROUP BY r.ORDERID, r.ModelID, m.VendorID, p.Status, p.ComputymeProcessed;
    END
    ELSE
    BEGIN
        WITH lastProc AS
        (
            SELECT OrderID, Status, ComputymeProcessed, timeEnd, DM,
                   ROW_NUMBER() OVER (PARTITION BY OrderID ORDER BY ID DESC) AS rn
              FROM dbo.PriceProtectionProcess
        )
        INSERT #claim (OrderId, ModelId, VendorId, MemberId, ClaimDate, Quantity, Amount, VendorAmount, Bucket, DecidedAt, DebitMemo)
        SELECT r.ORDERID, r.ModelID, m.VendorID, MAX(r.MemberID), MIN(r.Date), SUM(r.Quantity),
               SUM(CAST(COALESCE(r.Net, 0) AS decimal(19,2))),
               SUM(CAST(COALESCE(r.Net, 0) AS decimal(19,2))),
               CASE WHEN p.Status = 2 THEN 'DECLINED'
                    WHEN p.Status = 1 AND COALESCE(p.ComputymeProcessed, 0) = 1 THEN 'SENT'
                    WHEN p.Status = 1 THEN 'APPROVED'
                    ELSE 'SUBMITTED' END,
               MAX(p.timeEnd), MAX(NULLIF(LTRIM(RTRIM(p.DM)), ''))
          FROM dbo.PriceProtectionRedeem r
          JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelID
          LEFT JOIN lastProc p ON p.OrderID = r.ORDERID AND p.rn = 1
         WHERE COALESCE(r.Saved, 0) = 0 AND r.ORDERID IS NOT NULL
           AND (@VendorId IS NULL OR m.VendorID = @VendorId)
         GROUP BY r.ORDERID, r.ModelID, m.VendorID, p.Status, p.ComputymeProcessed;
    END

    /* ---- programs per product ---- */
    CREATE TABLE #prog
    (
        ModelId     int  NOT NULL PRIMARY KEY,
        Live        int  NOT NULL,
        Current_    int  NOT NULL,
        Upcoming    int  NOT NULL,
        LastDate    date NULL,
        LiveAmount  decimal(19,2) NULL     -- reimbursement (IR) or credit (PP) on the latest live program
    );

    IF @pp = 0
        INSERT #prog
        SELECT p.ModelID,
               SUM(CASE WHEN p.Expired = 0 THEN 1 ELSE 0 END),
               SUM(CASE WHEN p.Expired = 0 AND p.ProgramStartWeek <= @today AND p.ProgramEndWeek >= @today THEN 1 ELSE 0 END),
               SUM(CASE WHEN p.Expired = 0 AND p.ProgramStartWeek > @today THEN 1 ELSE 0 END),
               MAX(p.ProgramEndWeek),
               (SELECT TOP (1) x.Reimbursement FROM dbo.RebateProgramDetail x
                 WHERE x.ModelID = p.ModelID AND x.Expired = 0 ORDER BY x.ProgramStartWeek DESC)
          FROM dbo.RebateProgramDetail p
          JOIN dbo.RebateCameraModels m ON m.ModelID = p.ModelID
         WHERE (@VendorId IS NULL OR m.VendorID = @VendorId)
         GROUP BY p.ModelID;
    ELSE
        INSERT #prog
        SELECT p.ModelID,
               SUM(CASE WHEN p.Expired = 0 THEN 1 ELSE 0 END),
               SUM(CASE WHEN p.Expired = 0 AND p.ProgramDate <= @today THEN 1 ELSE 0 END),
               SUM(CASE WHEN p.Expired = 0 AND p.ProgramDate > @today THEN 1 ELSE 0 END),
               MAX(p.ProgramDate),
               (SELECT TOP (1) x.Amount FROM dbo.PriceProtectionDetails x
                 WHERE x.ModelID = p.ModelID AND x.Expired = 0 ORDER BY x.ProgramDate DESC)
          FROM dbo.PriceProtectionDetails p
          JOIN dbo.RebateCameraModels m ON m.ModelID = p.ModelID
         WHERE (@VendorId IS NULL OR m.VendorID = @VendorId)
         GROUP BY p.ModelID;

    /* ---- 1: one row per vendor ---- */
    SELECT v.VendorID AS VendorId, v.VendorName, v.ParentCompany, v.APMSTID AS ApVendorId,
           CAST(v.Active AS bit) AS IsActive,
           (SELECT COUNT(*) FROM dbo.RebateCameraModels m WHERE m.VendorID = v.VendorID AND m.IsPriceProtection = @pp AND m.Active = 1) AS ProductsActive,
           COALESCE(pg.Live, 0) AS ProgramsLive,
           COALESCE(pg.Current_, 0) AS ProgramsCurrent,
           COALESCE(pg.Upcoming, 0) AS ProgramsUpcoming,
           COALESCE(cl.SubmittedClaims, 0) AS SubmittedClaims,
           COALESCE(cl.SubmittedAmount, 0) AS SubmittedAmount,
           COALESCE(cl.ApprovedClaims, 0) AS ApprovedClaims,
           COALESCE(cl.ApprovedAmount, 0) AS ApprovedAmount,
           COALESCE(cl.SubmittedAmount, 0) + COALESCE(cl.ApprovedAmount, 0) AS OpenLiability,
           COALESCE(cl.SentClaims, 0) AS SentClaims,
           COALESCE(cl.SentAmount, 0) AS SentAmount,
           COALESCE(cl.DeclinedClaims, 0) AS DeclinedClaims,
           COALESCE(cl.DeclinedAmount, 0) AS DeclinedAmount,
           COALESCE(cl.UnbilledClaims, 0) AS UnbilledClaims,
           COALESCE(cl.UnbilledAmount, 0) AS UnbilledAmount,
           COALESCE(cl.ProPadAmount, 0) AS ProPadAmount,
           cl.OldestOpenClaim,
           @From AS PeriodFrom, @To AS PeriodTo
      FROM dbo.RebateVendors v
      OUTER APPLY
      (
          SELECT SUM(p.Live) AS Live, SUM(p.Current_) AS Current_, SUM(p.Upcoming) AS Upcoming
            FROM #prog p JOIN dbo.RebateCameraModels m ON m.ModelID = p.ModelId
           WHERE m.VendorID = v.VendorID
      ) pg
      OUTER APPLY
      (
          SELECT COUNT(DISTINCT CASE WHEN c.Bucket = 'SUBMITTED' THEN c.OrderId END) AS SubmittedClaims,
                 SUM(CASE WHEN c.Bucket = 'SUBMITTED' THEN c.Amount END) AS SubmittedAmount,
                 COUNT(DISTINCT CASE WHEN c.Bucket = 'APPROVED' THEN c.OrderId END) AS ApprovedClaims,
                 SUM(CASE WHEN c.Bucket = 'APPROVED' THEN c.Amount END) AS ApprovedAmount,
                 COUNT(DISTINCT CASE WHEN c.Bucket = 'SENT' AND c.DecidedAt >= @From AND c.DecidedAt < @toEx THEN c.OrderId END) AS SentClaims,
                 SUM(CASE WHEN c.Bucket = 'SENT' AND c.DecidedAt >= @From AND c.DecidedAt < @toEx THEN c.Amount END) AS SentAmount,
                 COUNT(DISTINCT CASE WHEN c.Bucket = 'DECLINED' AND c.DecidedAt >= @From AND c.DecidedAt < @toEx THEN c.OrderId END) AS DeclinedClaims,
                 SUM(CASE WHEN c.Bucket = 'DECLINED' AND c.DecidedAt >= @From AND c.DecidedAt < @toEx THEN c.Amount END) AS DeclinedAmount,
                 COUNT(DISTINCT CASE WHEN c.Bucket IN ('APPROVED', 'SENT') AND c.DebitMemo IS NULL THEN c.OrderId END) AS UnbilledClaims,
                 SUM(CASE WHEN c.Bucket IN ('APPROVED', 'SENT') AND c.DebitMemo IS NULL THEN c.VendorAmount END) AS UnbilledAmount,
                 SUM(CASE WHEN c.Bucket IN ('SUBMITTED', 'APPROVED', 'SENT') THEN c.Amount - c.VendorAmount END) AS ProPadAmount,
                 MIN(CASE WHEN c.Bucket IN ('SUBMITTED', 'APPROVED') THEN c.ClaimDate END) AS OldestOpenClaim
            FROM #claim c
           WHERE c.VendorId = v.VendorID
      ) cl
     WHERE v.IsPriceProtection = @pp
       AND (@VendorId IS NULL OR v.VendorID = @VendorId)
     ORDER BY COALESCE(cl.SubmittedAmount, 0) + COALESCE(cl.ApprovedAmount, 0) DESC, v.Active DESC, v.VendorName;

    IF @VendorId IS NULL RETURN;

    /* ---- 2: the vendor's products ---- */
    SELECT m.ModelID AS ModelId, m.ModelNumber AS Description, m.ModelName AS ProCodeText,
           CAST(COALESCE(m.Active, 0) AS bit) AS IsActive,
           COALESCE(p.Live, 0) AS ProgramsLive, COALESCE(p.Current_, 0) AS ProgramsCurrent, COALESCE(p.Upcoming, 0) AS ProgramsUpcoming,
           p.LastDate AS LastProgramDate, p.LiveAmount,
           COALESCE(SUM(CASE WHEN c.Bucket = 'SUBMITTED' THEN c.Amount END), 0) AS SubmittedAmount,
           COALESCE(SUM(CASE WHEN c.Bucket = 'APPROVED' THEN c.Amount END), 0) AS ApprovedAmount,
           COALESCE(SUM(CASE WHEN c.Bucket IN ('SUBMITTED', 'APPROVED') THEN c.Amount END), 0) AS OpenLiability,
           COALESCE(SUM(CASE WHEN c.Bucket IN ('SUBMITTED', 'APPROVED') THEN c.Quantity END), 0) AS OpenUnits,
           COALESCE(SUM(CASE WHEN c.Bucket = 'SENT' AND c.DecidedAt >= @From AND c.DecidedAt < @toEx THEN c.Amount END), 0) AS SentAmount,
           COALESCE(SUM(CASE WHEN c.Bucket IN ('APPROVED', 'SENT') AND c.DebitMemo IS NULL THEN c.VendorAmount END), 0) AS UnbilledAmount,
           COALESCE(SUM(CASE WHEN c.Bucket IN ('SUBMITTED', 'APPROVED', 'SENT') THEN c.Amount - c.VendorAmount END), 0) AS ProPadAmount
      FROM dbo.RebateCameraModels m
      LEFT JOIN #prog p ON p.ModelId = m.ModelID
      LEFT JOIN #claim c ON c.ModelId = m.ModelID
     WHERE m.VendorID = @VendorId AND m.IsPriceProtection = @pp
     GROUP BY m.ModelID, m.ModelNumber, m.ModelName, m.Active, p.Live, p.Current_, p.Upcoming, p.LastDate, p.LiveAmount
    HAVING COALESCE(p.Live, 0) > 0 OR COUNT(c.OrderId) > 0 OR COALESCE(m.Active, 0) = 1
     ORDER BY COALESCE(SUM(CASE WHEN c.Bucket IN ('SUBMITTED', 'APPROVED') THEN c.Amount END), 0) DESC, m.ModelNumber;

    /* ---- 3: the vendor's open claims ---- */
    SELECT c.OrderId, MAX(c.MemberId) AS MemberId, MIN(c.ClaimDate) AS ClaimDate, MIN(c.Bucket) AS Bucket,
           SUM(c.Amount) AS Amount, SUM(c.Quantity) AS Units,
           STRING_AGG(CAST(m.ModelNumber AS nvarchar(max)), N'; ') AS Products
      FROM #claim c
      JOIN dbo.RebateCameraModels m ON m.ModelID = c.ModelId
     WHERE c.Bucket IN ('SUBMITTED', 'APPROVED')
     GROUP BY c.OrderId
     ORDER BY MIN(c.ClaimDate);
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
