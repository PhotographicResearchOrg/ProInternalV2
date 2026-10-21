/*
    Phase 2 · 04  Rebate Desk: programs on both rails
    Database: PRO_NUKE      Safe to run twice (CREATE OR ALTER).      Run after 03.

    Instant rebates   dbo.RebateProgramDetail   one row per model and date range
    Price protection  dbo.PriceProtectionDetail one row per model and program date
                      (NewInvoiceCost, Amount = member credit, NewMap, EZPay)

    On both, Expired = 0 is "on" (open to members) and 1 is "off".

    Extending one instant-rebate program: the member site groups programs by
    vendor + exact start and end dates, so a program whose dates differ from
    the rest of its batch shows as its own group there. That is what the
    legacy screen did too; the desk says so before saving.
*/

USE PRO_NUKE;
GO
SET XACT_ABORT ON;
GO

/* =================================================================
   Instant rebates
   ================================================================= */

/* Every program, including legacy ones with no batch. @State ON/OFF, @When CURRENT/FUTURE/PAST. */
CREATE OR ALTER PROCEDURE piv2.Rebate_Programs
    @VendorId int = NULL,
    @ModelId  int = NULL,
    @BatchId  int = NULL,
    @State    varchar(5) = NULL,
    @When     varchar(10) = NULL,
    @Q        nvarchar(100) = NULL,
    @Page     int = 1,
    @PageSize int = 50,
    @Months   int = 12,     -- programs running in the last @Months months (or live); 0 = all history
    @Sort     varchar(30) = NULL,      -- column clicked on the desk (NULL = the usual order)
    @Desc     bit = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Page = CASE WHEN @Page < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN @PageSize NOT BETWEEN 1 AND 500 THEN 50 ELSE @PageSize END;
    SET @Q = NULLIF(LTRIM(RTRIM(@Q)), N'');
    DECLARE @today date = CAST(GETDATE() AS date);
    DECLARE @since date = CASE WHEN @Months > 0 THEN DATEADD(month, -@Months, CAST(GETDATE() AS date)) ELSE '19000101' END;
    IF TRY_CAST(@Q AS int) IS NOT NULL SET @since = '19000101';   -- a program or batch number is found however old

    SELECT p.ProgramID AS ProgramId, p.BatchID AS BatchId, p.ModelID AS ModelId,
           m.ModelName AS ProCodeText, m.ModelNumber AS Description, m.VendorID AS VendorId, v.VendorName,
           p.InstantRebate, p.Reimbursement, p.MAPDrop AS MapPrice,
           COALESCE(pt.VendorShare, p.Reimbursement) AS VendorShare, COALESCE(pt.ProPad, 0) AS ProPad,
           p.ProgramStartWeek AS StartDate, p.ProgramEndWeek AS EndDate, p.ExpireOn,
           p.IRType AS IrType, t.Name AS IrTypeName,
           CAST(CASE WHEN p.Expired = 0 THEN 1 ELSE 0 END AS bit) AS IsLive,
           p.DateEntered AS EnteredAt,
           COUNT(*) OVER () AS TotalRows
      FROM dbo.RebateProgramDetail p
      JOIN dbo.RebateCameraModels m ON m.ModelID = p.ModelID
      LEFT JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID
      LEFT JOIN dbo.RebateType t ON t.ID = p.IRType
      LEFT JOIN piv2.RebateProgramTerms pt ON pt.ProgramId = p.ProgramID AND pt.MemberAmount = ROUND(p.Reimbursement, 2)
     CROSS APPLY (SELECT CASE @Sort WHEN 'description'   THEN CAST(CAST(m.ModelNumber AS nvarchar(400)) AS sql_variant)
                                    WHEN 'vendorName'    THEN CAST(CAST(v.VendorName AS nvarchar(400)) AS sql_variant)
                                    WHEN 'irTypeName'    THEN CAST(CAST(t.Name AS nvarchar(400)) AS sql_variant)
                                    WHEN 'startDate'     THEN CAST(p.ProgramStartWeek AS sql_variant)
                                    WHEN 'reimbursement' THEN CAST(CAST(p.Reimbursement AS decimal(19,4)) AS sql_variant)
                                    WHEN 'instantRebate' THEN CAST(CAST(p.InstantRebate AS decimal(19,4)) AS sql_variant)
                                    WHEN 'mapPrice'      THEN CAST(CAST(p.MAPDrop AS decimal(19,4)) AS sql_variant)
                                    WHEN 'batchId'       THEN CAST(p.BatchID AS sql_variant)
                                    WHEN 'isLive'        THEN CAST(CASE WHEN p.Expired = 0 THEN 1 ELSE 0 END AS sql_variant) END AS K) s
     WHERE (p.ProgramEndWeek >= @since OR p.Expired = 0 OR @BatchId IS NOT NULL)
       AND (@VendorId IS NULL OR m.VendorID = @VendorId)
       AND (@ModelId IS NULL OR p.ModelID = @ModelId)
       AND (@BatchId IS NULL OR p.BatchID = @BatchId)
       AND (@State IS NULL OR (@State = 'ON' AND p.Expired = 0) OR (@State = 'OFF' AND COALESCE(p.Expired, 1) <> 0))
       AND (@When IS NULL
            OR (@When = 'CURRENT' AND p.ProgramStartWeek <= @today AND p.ProgramEndWeek >= @today)
            OR (@When = 'FUTURE'  AND p.ProgramStartWeek > @today)
            OR (@When = 'PAST'    AND p.ProgramEndWeek < @today)
            OR (@When = 'ENDING'  AND p.ProgramEndWeek BETWEEN @today AND DATEADD(day, 14, @today)))
       AND (@Q IS NULL
            OR m.ModelNumber LIKE N'%' + @Q + N'%'
            OR m.ModelName LIKE N'%' + @Q + N'%'
            OR v.VendorName LIKE N'%' + @Q + N'%'
            OR CAST(p.ProgramID AS nvarchar(20)) = @Q
            OR CAST(p.BatchID AS nvarchar(20)) = @Q)
     ORDER BY CASE WHEN @Sort IS NOT NULL AND s.K IS NULL THEN 1 ELSE 0 END,   -- blanks last
              CASE WHEN @Desc = 0 THEN s.K END ASC, CASE WHEN @Desc = 1 THEN s.K END DESC,
              p.ProgramStartWeek DESC, m.ModelNumber
     OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY
    OPTION (RECOMPILE);
END
GO

/* Extend or shorten one program. Amounts are changed separately (legacy rule: never both at once). */
CREATE OR ALTER PROCEDURE piv2.Rebate_ChangeProgramDates
    @ProgramId int,
    @StartDate date,
    @EndDate   date,
    @ExpireOn  date = NULL,
    @Actor     nvarchar(100),
    @Reason    nvarchar(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@Reason)), N'') IS NULL
        THROW 50702, 'A reason is required.', 1;
    IF @StartDate IS NULL OR @EndDate IS NULL OR @StartDate > @EndDate
        THROW 50717, 'Give a start date on or before the end date.', 1;
    IF @ExpireOn IS NOT NULL AND @ExpireOn < @EndDate
        THROW 50718, 'The claim expiry cannot be before the program ends.', 1;

    BEGIN TRAN;

    DECLARE @batch int, @model int, @live int, @before nvarchar(max);
    SELECT @batch = BatchID, @model = ModelID, @live = CASE WHEN Expired = 0 THEN 1 ELSE 0 END,
           @before = (SELECT ProgramStartWeek AS startDate, ProgramEndWeek AS endDate, ExpireOn AS expireOn
                        FROM dbo.RebateProgramDetail WHERE ProgramID = @ProgramId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
      FROM dbo.RebateProgramDetail WITH (UPDLOCK)
     WHERE ProgramID = @ProgramId;

    IF @model IS NULL
        THROW 50721, 'That program does not exist.', 1;

    IF @live = 1
    BEGIN
        DECLARE @one nvarchar(20) = CAST(@ProgramId AS nvarchar(20));
        EXEC piv2.Rebate_ThrowIfOverlap @one, @StartDate, @EndDate;
    END

    UPDATE dbo.RebateProgramDetail
       SET ProgramStartWeek = @StartDate, ProgramEndWeek = @EndDate, ExpireOn = COALESCE(@ExpireOn, ExpireOn)
     WHERE ProgramID = @ProgramId;

    INSERT piv2.RebateEvent (EventType, BatchId, ProgramId, ModelId, Actor, Reason, Detail)
    VALUES ('PROGRAM_DATES', @batch, @ProgramId, @model, @Actor, @Reason,
            (SELECT JSON_QUERY(@before) AS [before],
                    JSON_QUERY((SELECT @StartDate AS startDate, @EndDate AS endDate, @ExpireOn AS expireOn FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS [after]
              FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));

    COMMIT;
END
GO

/* ---------------------------------------------------------------
   Manual entry: one program, optionally repeated weekly for
   @RepeatWeeks more weeks (the legacy "rolling weeks"). The set gets
   its own batch number so it can be managed together. A week that
   already has the same model and dates is skipped, as legacy did.
   --------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE piv2.Rebate_AddPrograms
    @ModelId       int,
    @IRType        int,
    @InstantRebate decimal(19,2),
    @Reimbursement decimal(19,2),          -- the vendor's share per unit
    @ProPad        decimal(19,2) = 0,      -- PRO's pad per unit (combo products); member amount = share + pad
    @MapPrice      decimal(19,2),
    @StartDate     date,
    @EndDate       date,
    @ExpireOn      date,
    @RepeatWeeks   int = 0,
    @StartActive   bit = 0,
    @Actor         nvarchar(100),
    @Reason        nvarchar(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.RebateCameraModels WHERE ModelID = @ModelId AND IsPriceProtection = 0)
        THROW 50722, 'That is not an instant-rebate model.', 1;
    IF EXISTS (SELECT 1 FROM dbo.RebateCameraModels WHERE ModelID = @ModelId AND COALESCE(Active, 0) = 0)
        THROW 50740, 'That product is retired. Reactivate it first.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.RebateType WHERE ID = @IRType)
        THROW 50741, 'Pick a rebate type.', 1;
    IF @Reimbursement IS NULL OR @Reimbursement <= 0
        THROW 50719, 'Member reimbursement must be more than zero.', 1;
    IF @InstantRebate < 0 OR @MapPrice < 0 OR COALESCE(@ProPad, 0) < 0
        THROW 50720, 'Instant rebate, PRO pad and MAP cannot be negative.', 1;
    IF @StartDate IS NULL OR @EndDate IS NULL OR @StartDate > @EndDate
        THROW 50717, 'Give a start date on or before the end date.', 1;
    IF @ExpireOn IS NULL OR @ExpireOn < @EndDate
        THROW 50718, 'The claim expiry is required and cannot be before the program ends.', 1;
    IF @RepeatWeeks NOT BETWEEN 0 AND 52
        THROW 50742, 'Repeat for 0 to 52 more weeks.', 1;
    IF @RepeatWeeks > 0 AND DATEDIFF(day, @StartDate, @EndDate) >= 7
        THROW 50744, 'Weekly repeats need a program of 7 days or less; longer ones would overlap the next week.', 1;

    DECLARE @weeks TABLE (N int PRIMARY KEY);
    ;WITH n AS (SELECT 0 AS N UNION ALL SELECT N + 1 FROM n WHERE N < @RepeatWeeks)
    INSERT @weeks SELECT N FROM n OPTION (MAXRECURSION 60);

    BEGIN TRAN;

    DECLARE @batch int = NEXT VALUE FOR piv2.RebateBatchSeq;
    DECLARE @new TABLE (ProgramId int PRIMARY KEY);

    INSERT dbo.RebateProgramDetail
        (ModelID, InstantRebate, Reimbursement, MAPDrop, ProgramStartWeek, ProgramEndWeek, Expired, ExpireOn, IRType, BatchID)
    OUTPUT inserted.ProgramID INTO @new (ProgramId)
    SELECT @ModelId, @InstantRebate, @Reimbursement + COALESCE(@ProPad, 0), @MapPrice,
           DATEADD(day, 7 * w.N, @StartDate), DATEADD(day, 7 * w.N, @EndDate),
           CASE WHEN @StartActive = 1 THEN 0 ELSE 1 END,
           DATEADD(day, 7 * w.N, @ExpireOn), @IRType, @batch
      FROM @weeks w
     WHERE NOT EXISTS (SELECT 1 FROM dbo.RebateProgramDetail x
                        WHERE x.ModelID = @ModelId
                          AND x.ProgramStartWeek = DATEADD(day, 7 * w.N, @StartDate)
                          AND x.ProgramEndWeek = DATEADD(day, 7 * w.N, @EndDate));

    DECLARE @added int = (SELECT COUNT(*) FROM @new);

    INSERT piv2.RebateProgramTerms (ProgramId, MemberAmount, ModelId, VendorShare, ProPad, UpdatedBy)
    SELECT ProgramId, @Reimbursement + COALESCE(@ProPad, 0), @ModelId, @Reimbursement, COALESCE(@ProPad, 0), @Actor FROM @new;

    IF @added = 0
    BEGIN
        ROLLBACK;
        THROW 50743, 'Every one of those weeks already has a program for this product with the same dates.', 1;
    END

    IF @StartActive = 1
    BEGIN
        DECLARE @ids nvarchar(max) = (SELECT STRING_AGG(CAST(ProgramId AS nvarchar(max)), ',') FROM @new);
        EXEC piv2.Rebate_ThrowIfOverlap @ids;
    END

    INSERT piv2.RebateEvent (EventType, BatchId, ModelId, Actor, Reason, Detail)
    VALUES ('PROGRAMS_ADDED', @batch, @ModelId, @Actor, @Reason,
            (SELECT @added AS added, (@RepeatWeeks + 1 - @added) AS skippedExisting,
                    @Reimbursement AS reimbursement, @StartDate AS firstStart,
                    CASE WHEN @StartActive = 1 THEN 'on' ELSE 'off' END AS loadedAs
              FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));

    COMMIT;

    SELECT @batch AS BatchId, @added AS Added, (@RepeatWeeks + 1 - @added) AS SkippedExisting;
END
GO

/* =================================================================
   Price protection
   ================================================================= */

CREATE OR ALTER PROCEDURE piv2.PP_Programs
    @VendorId int = NULL,
    @ModelId  int = NULL,
    @State    varchar(5) = NULL,       -- ON / OFF
    @From     date = NULL,
    @To       date = NULL,
    @Q        nvarchar(100) = NULL,
    @Page     int = 1,
    @PageSize int = 50,
    @Months   int = 12,     -- programs dated in the last @Months months (or live); 0 = all history
    @Sort     varchar(30) = NULL,      -- column clicked on the desk (NULL = the usual order)
    @Desc     bit = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Page = CASE WHEN @Page < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN @PageSize NOT BETWEEN 1 AND 500 THEN 50 ELSE @PageSize END;
    SET @Q = NULLIF(LTRIM(RTRIM(@Q)), N'');
    DECLARE @since date = CASE WHEN @Months > 0 THEN DATEADD(month, -@Months, CAST(GETDATE() AS date)) ELSE '19000101' END;
    IF TRY_CAST(@Q AS int) IS NOT NULL SET @since = '19000101';   -- a program number is found however old

    SELECT p.ProgramID AS ProgramId, p.ModelID AS ModelId, m.ModelName AS ProCodeText, m.ModelNumber AS Description,
           m.VendorID AS VendorId, v.VendorName,
           p.ProgramDate, p.NewInvoiceCost, p.Amount, p.NewMap AS MapPrice, p.EZPay AS EzPay,
           CAST(CASE WHEN p.Expired = 0 THEN 1 ELSE 0 END AS bit) AS IsLive,
           COUNT(*) OVER () AS TotalRows
      FROM dbo.PriceProtectionDetail p
      JOIN dbo.RebateCameraModels m ON m.ModelID = p.ModelID
      LEFT JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID
     CROSS APPLY (SELECT CASE @Sort WHEN 'description'    THEN CAST(CAST(m.ModelNumber AS nvarchar(400)) AS sql_variant)
                                    WHEN 'vendorName'     THEN CAST(CAST(v.VendorName AS nvarchar(400)) AS sql_variant)
                                    WHEN 'programDate'    THEN CAST(p.ProgramDate AS sql_variant)
                                    WHEN 'amount'         THEN CAST(CAST(p.Amount AS decimal(19,4)) AS sql_variant)
                                    WHEN 'newInvoiceCost' THEN CAST(CAST(p.NewInvoiceCost AS decimal(19,4)) AS sql_variant)
                                    WHEN 'mapPrice'       THEN CAST(CAST(p.NewMap AS decimal(19,4)) AS sql_variant)
                                    WHEN 'isLive'         THEN CAST(CASE WHEN p.Expired = 0 THEN 1 ELSE 0 END AS sql_variant) END AS K) s
     WHERE (p.ProgramDate >= @since OR p.Expired = 0)
       AND (@VendorId IS NULL OR m.VendorID = @VendorId)
       AND (@ModelId IS NULL OR p.ModelID = @ModelId)
       AND (@State IS NULL OR (@State = 'ON' AND p.Expired = 0) OR (@State = 'OFF' AND p.Expired <> 0))
       AND (@From IS NULL OR p.ProgramDate >= @From)
       AND (@To IS NULL OR p.ProgramDate <= @To)
       AND (@Q IS NULL
            OR m.ModelNumber LIKE N'%' + @Q + N'%'
            OR m.ModelName LIKE N'%' + @Q + N'%'
            OR v.VendorName LIKE N'%' + @Q + N'%'
            OR CAST(p.ProgramID AS nvarchar(20)) = @Q)
     ORDER BY CASE WHEN @Sort IS NOT NULL AND s.K IS NULL THEN 1 ELSE 0 END,   -- blanks last
              CASE WHEN @Desc = 0 THEN s.K END ASC, CASE WHEN @Desc = 1 THEN s.K END DESC,
              p.ProgramDate DESC, m.ModelNumber
     OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY
    OPTION (RECOMPILE);
END
GO

/* One price-protection program. Legacy rule: one per product and program date. */
CREATE OR ALTER PROCEDURE piv2.PP_AddProgram
    @ModelId        int,
    @ProgramDate    date,
    @NewInvoiceCost decimal(19,2),
    @Amount         decimal(19,2),
    @NewMap         decimal(19,2),
    @StartActive    bit = 0,
    @Actor          nvarchar(100),
    @Reason         nvarchar(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.RebateCameraModels WHERE ModelID = @ModelId AND IsPriceProtection = 1)
        THROW 50750, 'That is not a price-protection product.', 1;
    IF EXISTS (SELECT 1 FROM dbo.RebateCameraModels WHERE ModelID = @ModelId AND COALESCE(Active, 0) = 0)
        THROW 50740, 'That product is retired. Reactivate it first.', 1;
    IF @ProgramDate IS NULL
        THROW 50751, 'A program date is required.', 1;
    IF @Amount IS NULL OR @Amount <= 0
        THROW 50752, 'The credit amount must be more than zero.', 1;
    IF @NewInvoiceCost < 0 OR @NewMap < 0
        THROW 50753, 'New invoice cost and MAP cannot be negative.', 1;

    BEGIN TRAN;

    IF EXISTS (SELECT 1 FROM dbo.PriceProtectionDetail WITH (UPDLOCK, HOLDLOCK) WHERE ModelID = @ModelId AND ProgramDate = @ProgramDate)
        THROW 50754, 'This product already has price protection on that date.', 1;

    INSERT dbo.PriceProtectionDetail (ModelID, NewInvoiceCost, Amount, NewMap, EZPay, ProgramDate, Expired)
    VALUES (@ModelId, COALESCE(@NewInvoiceCost, 0), @Amount, COALESCE(@NewMap, 0), 0, @ProgramDate,
            CASE WHEN @StartActive = 1 THEN 0 ELSE 1 END);

    DECLARE @id int = SCOPE_IDENTITY();

    INSERT piv2.RebateEvent (Rail, EventType, ProgramId, ModelId, Actor, Reason, Detail)
    VALUES ('PP', 'PROGRAM_ADDED', @id, @ModelId, @Actor, @Reason,
            (SELECT @ProgramDate AS programDate, @NewInvoiceCost AS newInvoiceCost, @Amount AS amount, @NewMap AS newMap,
                    CASE WHEN @StartActive = 1 THEN 'on' ELSE 'off' END AS loadedAs
              FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));

    COMMIT;
    SELECT @id AS ProgramId;
END
GO

/* Amounts and date. EZPay is left as it is (see the deploy notes). */
CREATE OR ALTER PROCEDURE piv2.PP_ChangeProgram
    @ProgramId      int,
    @ProgramDate    date,
    @NewInvoiceCost decimal(19,2),
    @Amount         decimal(19,2),
    @NewMap         decimal(19,2),
    @Actor          nvarchar(100),
    @Reason         nvarchar(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@Reason)), N'') IS NULL
        THROW 50702, 'A reason is required.', 1;
    IF @ProgramDate IS NULL
        THROW 50751, 'A program date is required.', 1;
    IF @Amount IS NULL OR @Amount <= 0
        THROW 50752, 'The credit amount must be more than zero.', 1;
    IF @NewInvoiceCost < 0 OR @NewMap < 0
        THROW 50753, 'New invoice cost and MAP cannot be negative.', 1;

    BEGIN TRAN;

    DECLARE @model int, @before nvarchar(max);
    SELECT @model = ModelID,
           @before = (SELECT ProgramDate AS programDate, NewInvoiceCost AS newInvoiceCost, Amount AS amount, NewMap AS newMap
                        FROM dbo.PriceProtectionDetail WHERE ProgramID = @ProgramId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
      FROM dbo.PriceProtectionDetail WITH (UPDLOCK)
     WHERE ProgramID = @ProgramId;

    IF @model IS NULL
        THROW 50755, 'That price-protection program does not exist.', 1;

    IF EXISTS (SELECT 1 FROM dbo.PriceProtectionDetail WHERE ModelID = @model AND ProgramDate = @ProgramDate AND ProgramID <> @ProgramId)
        THROW 50754, 'This product already has price protection on that date.', 1;

    UPDATE dbo.PriceProtectionDetail
       SET ProgramDate = @ProgramDate, NewInvoiceCost = COALESCE(@NewInvoiceCost, 0), Amount = @Amount, NewMap = COALESCE(@NewMap, 0)
     WHERE ProgramID = @ProgramId;

    INSERT piv2.RebateEvent (Rail, EventType, ProgramId, ModelId, Actor, Reason, Detail)
    VALUES ('PP', 'PROGRAM_CHANGED', @ProgramId, @model, @Actor, @Reason,
            (SELECT JSON_QUERY(@before) AS [before],
                    JSON_QUERY((SELECT @ProgramDate AS programDate, @NewInvoiceCost AS newInvoiceCost, @Amount AS amount, @NewMap AS newMap
                                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS [after]
              FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));

    COMMIT;
END
GO

CREATE OR ALTER PROCEDURE piv2.PP_SetProgramActive
    @ProgramId int,
    @Active    bit,
    @Actor     nvarchar(100),
    @Reason    nvarchar(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@Reason)), N'') IS NULL
        THROW 50702, 'A reason is required.', 1;

    DECLARE @model int = (SELECT ModelID FROM dbo.PriceProtectionDetail WHERE ProgramID = @ProgramId);
    IF @model IS NULL
        THROW 50755, 'That price-protection program does not exist.', 1;

    UPDATE dbo.PriceProtectionDetail SET Expired = CASE WHEN @Active = 1 THEN 0 ELSE 1 END WHERE ProgramID = @ProgramId;

    INSERT piv2.RebateEvent (Rail, EventType, ProgramId, ModelId, Actor, Reason)
    VALUES ('PP', CASE WHEN @Active = 1 THEN 'PROGRAM_ON' ELSE 'PROGRAM_OFF' END, @ProgramId, @model, @Actor, @Reason);
END
GO

SELECT N'programs ready' AS Result;
