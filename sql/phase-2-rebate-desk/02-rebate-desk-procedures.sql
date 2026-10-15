/*
    Phase 2 · 02  Rebate Desk: procedures
    Database: PRO_NUKE      Safe to run twice (CREATE OR ALTER).      Run after 01.

    Business-rule refusals are THROWn in the 50700 range; the API returns
    them as 400s with the message text.

    How the B2B site reads programs (Rebates_GetOpenRebatePrograms and
    Rebates_GetRebateProgramDetails): a program is open when Expired = 0,
    and members see a program as one vendor + one exact start and end
    date. So this desk sets Expired explicitly (0 on, 1 off, never NULL),
    and changes dates for a whole batch at a time.
*/

USE PRO_NUKE;
GO
SET XACT_ABORT ON;
GO

/* =================================================================
   Look-ups
   ================================================================= */

/* Rebate vendors and price-protection vendors are separate rows in RebateVendors. @Rail: IR or PP. */
CREATE OR ALTER PROCEDURE piv2.Rebate_Vendors
    @Rail char(2) = 'IR'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SELECT VendorID AS VendorId, VendorName, ParentCompany, APMSTID AS ApVendorId, CAST(Active AS bit) AS IsActive
      FROM dbo.RebateVendors
     WHERE IsPriceProtection = CASE WHEN @Rail = 'PP' THEN 1 ELSE 0 END
     ORDER BY Active DESC, VendorName;
END
GO

CREATE OR ALTER PROCEDURE piv2.Rebate_Types
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SELECT ID AS RebateTypeId, Name FROM dbo.RebateType ORDER BY ID;
END
GO

/* =================================================================
   Templates: a vendor's saved mapping for one sheet layout
   ================================================================= */

CREATE OR ALTER PROCEDURE piv2.Rebate_FindTemplate
    @VendorId    int,
    @Fingerprint char(64)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SELECT TemplateId, VendorId, Fingerprint, SheetName, HeaderRow, Headers, Mapping, Source,
           TimesUsed, LastUsedAt, CreatedBy, CreatedAt
      FROM piv2.RebateTemplate
     WHERE VendorId = @VendorId AND Fingerprint = @Fingerprint AND IsActive = 1;
END
GO

/* Saves the mapping a person confirmed; the previous one for this layout is retired, not deleted. */
CREATE OR ALTER PROCEDURE piv2.Rebate_SaveTemplate
    @VendorId    int,
    @Fingerprint char(64),
    @SheetName   nvarchar(128),
    @HeaderRow   int,
    @Headers     nvarchar(max),
    @Mapping     nvarchar(max),
    @Source      varchar(20),
    @Actor       nvarchar(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISJSON(@Mapping) <> 1 OR ISJSON(@Headers) <> 1
        THROW 50701, 'The mapping or headers are not valid JSON.', 1;

    BEGIN TRAN;

    DECLARE @same int =
        (SELECT TemplateId FROM piv2.RebateTemplate WITH (UPDLOCK, HOLDLOCK)
          WHERE VendorId = @VendorId AND Fingerprint = @Fingerprint AND IsActive = 1
            AND Mapping = @Mapping AND SheetName = @SheetName AND HeaderRow = @HeaderRow);

    IF @same IS NOT NULL
    BEGIN
        COMMIT;
        SELECT @same AS TemplateId, CAST(0 AS bit) AS Created;
        RETURN;
    END

    UPDATE piv2.RebateTemplate
       SET IsActive = 0, RetiredBy = @Actor, RetiredAt = SYSUTCDATETIME()
     WHERE VendorId = @VendorId AND Fingerprint = @Fingerprint AND IsActive = 1;

    INSERT piv2.RebateTemplate (VendorId, Fingerprint, SheetName, HeaderRow, Headers, Mapping, Source, CreatedBy)
    VALUES (@VendorId, @Fingerprint, @SheetName, @HeaderRow, @Headers, @Mapping, @Source, @Actor);

    DECLARE @id int = SCOPE_IDENTITY();

    INSERT piv2.RebateEvent (EventType, TemplateId, Actor, Detail)
    VALUES ('TEMPLATE_SAVED', @id, @Actor, (SELECT @VendorId AS vendorId, @SheetName AS sheet, @Source AS source FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));

    COMMIT;
    SELECT @id AS TemplateId, CAST(1 AS bit) AS Created;
END
GO

CREATE OR ALTER PROCEDURE piv2.Rebate_Templates
    @VendorId int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SELECT t.TemplateId, t.VendorId, v.VendorName, t.SheetName, t.HeaderRow, t.Headers, t.Mapping, t.Source,
           t.TimesUsed, t.LastUsedAt, t.CreatedBy, t.CreatedAt
      FROM piv2.RebateTemplate t
      JOIN dbo.RebateVendors v ON v.VendorID = t.VendorId
     WHERE t.IsActive = 1 AND (@VendorId IS NULL OR t.VendorId = @VendorId)
     ORDER BY v.VendorName, t.LastUsedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE piv2.Rebate_RetireTemplate
    @TemplateId int,
    @Actor      nvarchar(100),
    @Reason     nvarchar(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@Reason)), N'') IS NULL
        THROW 50702, 'A reason is required.', 1;

    UPDATE piv2.RebateTemplate
       SET IsActive = 0, RetiredBy = @Actor, RetiredAt = SYSUTCDATETIME()
     WHERE TemplateId = @TemplateId AND IsActive = 1;

    IF @@ROWCOUNT = 0
        THROW 50703, 'That template is not active.', 1;

    INSERT piv2.RebateEvent (EventType, TemplateId, Actor, Reason) VALUES ('TEMPLATE_RETIRED', @TemplateId, @Actor, @Reason);
END
GO

/* =================================================================
   Uploads
   ================================================================= */

CREATE OR ALTER PROCEDURE piv2.Rebate_CreateUpload
    @VendorId   int,
    @FileId     bigint,
    @FileName   nvarchar(260),
    @FileSha256 char(64),
    @Actor      nvarchar(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.RebateVendors WHERE VendorID = @VendorId)
        THROW 50704, 'That rebate vendor does not exist.', 1;

    DECLARE @existing int =
        (SELECT TOP 1 UploadId FROM piv2.RebateUpload
          WHERE VendorId = @VendorId AND FileSha256 = @FileSha256 AND Status <> 'CANCELLED');

    IF @existing IS NOT NULL
    BEGIN
        DECLARE @msg nvarchar(300) = CONCAT(N'This exact file was already uploaded for this vendor as upload #', @existing,
                                            N'. Open that upload, or cancel it first.');
        THROW 50705, @msg, 1;
    END

    INSERT piv2.RebateUpload (VendorId, FileId, FileName, FileSha256, CreatedBy)
    VALUES (@VendorId, @FileId, @FileName, @FileSha256, @Actor);

    DECLARE @id int = SCOPE_IDENTITY();
    INSERT piv2.RebateEvent (EventType, UploadId, Actor, Detail)
    VALUES ('UPLOADED', @id, @Actor, (SELECT @FileName AS fileName FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));

    SELECT @id AS UploadId;
END
GO

/* LOADED once every row is loaded or skipped; PARTIAL while some wait in purgatory or are ready. */
CREATE OR ALTER PROCEDURE piv2.Rebate_RefreshUploadStatus
    @UploadId int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    UPDATE u
       SET Status = CASE
                      WHEN NOT EXISTS (SELECT 1 FROM piv2.RebateUploadRow r WHERE r.UploadId = u.UploadId AND r.Status = 'LOADED') THEN u.Status
                      WHEN EXISTS (SELECT 1 FROM piv2.RebateUploadRow r WHERE r.UploadId = u.UploadId AND r.Status IN ('READY', 'PURGATORY')) THEN 'PARTIAL'
                      ELSE 'LOADED'
                    END
      FROM piv2.RebateUpload u
     WHERE u.UploadId = @UploadId AND u.Status IN ('REVIEW', 'PARTIAL', 'LOADED');
END
GO

/* One upload: its header and counts, then every row. */
CREATE OR ALTER PROCEDURE piv2.Rebate_GetUpload
    @UploadId int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SELECT u.UploadId, u.VendorId, v.VendorName, u.FileId, u.FileName, u.SheetName, u.HeaderRow,
           u.Fingerprint, u.TemplateId, u.MappingSource, u.DefaultRebateType, u.ExpireOn, u.StartActive,
           u.Status, u.BatchId, u.CreatedBy, u.CreatedAt, u.LoadedBy, u.LoadedAt, u.CancelledBy, u.CancelReason,
           u.PadPct, u.VendorSharePct,
           SUM(CASE WHEN r.Status = 'PURGATORY' AND r.Problems LIKE '%"NO_MODEL"%' AND r.ProposedName IS NOT NULL AND r.ProductCode IS NOT NULL THEN 1 ELSE 0 END) AS RowsCreatable,
           SUM(CASE WHEN r.Status = 'READY' THEN 1 ELSE 0 END)     AS RowsReady,
           SUM(CASE WHEN r.Status = 'PURGATORY' THEN 1 ELSE 0 END) AS RowsPurgatory,
           SUM(CASE WHEN r.Status = 'LOADED' THEN 1 ELSE 0 END)    AS RowsLoaded,
           SUM(CASE WHEN r.Status = 'SKIPPED' THEN 1 ELSE 0 END)   AS RowsSkipped,
           COUNT(r.RowId)                                           AS RowsTotal
      FROM piv2.RebateUpload u
      JOIN dbo.RebateVendors v ON v.VendorID = u.VendorId
      LEFT JOIN piv2.RebateUploadRow r ON r.UploadId = u.UploadId
     WHERE u.UploadId = @UploadId
     GROUP BY u.UploadId, u.VendorId, v.VendorName, u.FileId, u.FileName, u.SheetName, u.HeaderRow,
              u.Fingerprint, u.TemplateId, u.MappingSource, u.DefaultRebateType, u.ExpireOn, u.StartActive,
              u.Status, u.BatchId, u.CreatedBy, u.CreatedAt, u.LoadedBy, u.LoadedAt, u.CancelledBy, u.CancelReason,
              u.PadPct, u.VendorSharePct;

    SELECT r.RowId, r.SourceRow, r.Raw, r.ProCode, r.VendorSku, r.Upc, r.Description, r.InstantRebate, r.Reimbursement, r.MapPrice,
           r.ProPad, r.ProPadInput, r.Reimbursement + COALESCE(r.ProPad, 0) AS MemberAmount,
           r.ProductCode, r.ProductName, r.StackCodes, r.ProposedName,
           r.StartDate, r.EndDate, r.StackProduct, r.RebateType, r.Notes, r.ModelId,
           m.ModelNumber AS ModelDescription, m.ModelName AS ModelProCode, r.ModelChosenBy,
           r.StackModelId, sm.ModelNumber AS StackDescription,
           r.Status, r.Problems, r.ProgramId, r.SkipReason, r.UpdatedBy, r.UpdatedAt
      FROM piv2.RebateUploadRow r
      LEFT JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelId
      LEFT JOIN dbo.RebateCameraModels sm ON sm.ModelID = r.StackModelId
     WHERE r.UploadId = @UploadId
     ORDER BY CASE r.Status WHEN 'PURGATORY' THEN 0 WHEN 'READY' THEN 1 WHEN 'LOADED' THEN 2 ELSE 3 END, r.SourceRow;
END
GO

/* ---------------------------------------------------------------
   The checks. Resolves each row's rebate model, then records every
   problem; a row with any problem goes to purgatory, the rest are
   READY. Runs on READY and PURGATORY rows only.
   --------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE piv2.Rebate_ValidateUpload
    @UploadId int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @vendor int = (SELECT VendorId FROM piv2.RebateUpload WHERE UploadId = @UploadId);
    DECLARE @defaultType int = (SELECT DefaultRebateType FROM piv2.RebateUpload WHERE UploadId = @UploadId);

    DECLARE @padPct decimal(5,2) = (SELECT PadPct FROM piv2.RebateUpload WHERE UploadId = @UploadId);
    DECLARE @prefix nvarchar(20) = (SELECT NULLIF(LTRIM(RTRIM(CatalogPrefix)), N'') FROM piv2.RebateVendorTerms WHERE VendorId = @vendor);
    DECLARE @brands varchar(200) = (SELECT NULLIF(LTRIM(RTRIM(BrandIds)), '') FROM piv2.RebateVendorTerms WHERE VendorId = @vendor);

    IF OBJECT_ID('tempdb..#problem') IS NOT NULL DROP TABLE #problem;
    CREATE TABLE #problem (RowId bigint NOT NULL, Code varchar(40) NOT NULL, Message nvarchar(800) NOT NULL, Candidates nvarchar(max) NULL);

    /* ---- 1. PRO products, from [PRO].dbo.Product (no Computyme) ----
       Only the products this upload's rows can refer to are read: their PRO codes, SKUs
       (as sent, with the vendor's catalog prefix, and loosely without dashes, spaces,
       dots and underscores) and UPCs (compared as numbers, so leading zeros do not matter),
       limited to the vendor's brands when its terms name them. */
    IF OBJECT_ID('tempdb..#want') IS NOT NULL DROP TABLE #want;
    CREATE TABLE #want (Kind char(1) NOT NULL, Value nvarchar(200) NOT NULL);

    INSERT #want (Kind, Value)
    SELECT DISTINCT k.Kind, k.Value
      FROM piv2.RebateUploadRow r
     CROSS APPLY
     (
        SELECT 'C' AS Kind, LTRIM(RTRIM(x.value)) AS Value FROM STRING_SPLIT(REPLACE(COALESCE(r.ProCode, N''), N'+', N','), ',') x
        UNION ALL SELECT 'C', LTRIM(RTRIM(x.value)) FROM STRING_SPLIT(REPLACE(COALESCE(r.StackProduct, N''), N'+', N','), ',') x
        UNION ALL SELECT 'S', UPPER(LTRIM(RTRIM(r.VendorSku)))
        UNION ALL SELECT 'S', UPPER(COALESCE(@prefix, N'') + LTRIM(RTRIM(r.VendorSku)))
        UNION ALL SELECT 'S', UPPER(LTRIM(RTRIM(x.value))) FROM STRING_SPLIT(REPLACE(COALESCE(r.StackProduct, N''), N'+', N','), ',') x
        UNION ALL SELECT 'S', UPPER(COALESCE(@prefix, N'') + LTRIM(RTRIM(x.value))) FROM STRING_SPLIT(REPLACE(COALESCE(r.StackProduct, N''), N'+', N','), ',') x
        UNION ALL SELECT 'K', REPLACE(REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(r.VendorSku))), N'-', N''), N' ', N''), N'_', N''), N'.', N'')
        UNION ALL SELECT 'K', REPLACE(REPLACE(REPLACE(REPLACE(UPPER(COALESCE(@prefix, N'') + LTRIM(RTRIM(r.VendorSku))), N'-', N''), N' ', N''), N'_', N''), N'.', N'')
        UNION ALL SELECT 'U', CONVERT(nvarchar(30), TRY_CONVERT(decimal(20, 0), r.Upc))
     ) k
     WHERE r.UploadId = @UploadId AND r.Status IN ('READY', 'PURGATORY') AND NULLIF(k.Value, N'') IS NOT NULL;

    IF OBJECT_ID('tempdb..#pk') IS NOT NULL DROP TABLE #pk;
    CREATE TABLE #pk
    (
        ProductCode nvarchar(20)  NOT NULL,
        ModelName   nvarchar(400) NULL,
        CatNo       nvarchar(200) NULL,
        CatKey      nvarchar(200) NULL,
        UpcKey      nvarchar(30)  NULL,
        Rank_       int           NOT NULL      -- active and not discontinued first
    );

    INSERT #pk (ProductCode, ModelName, CatNo, CatKey, UpcKey, Rank_)
    SELECT x.ProductCode, x.ModelName, x.CatNo, x.CatKey, x.UpcKey, x.Rank_
      FROM
      (
        SELECT CAST(p.ProductCode AS nvarchar(20)) AS ProductCode, LEFT(LTRIM(RTRIM(p.ModelName)), 400) AS ModelName,
               LEFT(UPPER(LTRIM(RTRIM(p.CAT_NO))), 200) AS CatNo,
               LEFT(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(p.CAT_NO))), N'-', N''), N' ', N''), N'_', N''), N'.', N''), 200) AS CatKey,
               CONVERT(nvarchar(30), TRY_CONVERT(decimal(20, 0), p.UPC)) AS UpcKey,
               CASE WHEN COALESCE(p.IsActive, 0) = 1 AND COALESCE(p.IsDiscontinued, 0) = 0 THEN 0 ELSE 1 END AS Rank_
          FROM [PRO].dbo.Product p
         WHERE p.ProductCode IS NOT NULL
           AND (@brands IS NULL OR p.BrandId IN (SELECT TRY_CAST(value AS int) FROM STRING_SPLIT(@brands, ',')))
      ) x
     WHERE x.ProductCode IN (SELECT Value FROM #want WHERE Kind = 'C')
        OR x.CatNo IN (SELECT Value FROM #want WHERE Kind = 'S')
        OR x.CatKey IN (SELECT Value FROM #want WHERE Kind = 'K')
        OR x.UpcKey IN (SELECT Value FROM #want WHERE Kind = 'U');

    CREATE INDEX IX_pk_code ON #pk (ProductCode);

    /* Rows that name their PRO code(s): a comma list rolls several products (colours) into one rebate product. */
    IF OBJECT_ID('tempdb..#match') IS NOT NULL DROP TABLE #match;
    CREATE TABLE #match (RowId bigint NOT NULL, ProductCode nvarchar(20) NOT NULL, Pri int NOT NULL, Seq int NOT NULL, Rank_ int NOT NULL);

    /* Seq is the code's position in the text, so the first code typed is the primary one. */
    INSERT #match (RowId, ProductCode, Pri, Seq, Rank_)
    SELECT r.RowId, k.ProductCode, 1, x.Seq, MIN(k.Rank_)
      FROM piv2.RebateUploadRow r
     CROSS APPLY (SELECT LTRIM(RTRIM(value)) AS Code,
                         CHARINDEX(N',' + LTRIM(RTRIM(value)) + N',', N',' + REPLACE(REPLACE(r.ProCode, N'+', N','), N' ', N'') + N',') AS Seq
                    FROM STRING_SPLIT(REPLACE(r.ProCode, N'+', N','), ',') WHERE LTRIM(RTRIM(value)) <> N'') x
      JOIN #pk k ON k.ProductCode = x.Code
     WHERE r.UploadId = @UploadId AND r.Status IN ('READY', 'PURGATORY') AND r.ProCode IS NOT NULL
     GROUP BY r.RowId, k.ProductCode, x.Seq;

    /* PRO codes the row names that PRO does not have. */
    INSERT #problem (RowId, Code, Message)
    SELECT r.RowId, 'NO_PRODUCT', CONCAT(N'PRO code ', x.Code, N' is not a PRO product', CASE WHEN @brands IS NOT NULL THEN N' of this vendor''s brands' ELSE N'' END, N'.')
      FROM piv2.RebateUploadRow r
     CROSS APPLY (SELECT LTRIM(RTRIM(value)) AS Code FROM STRING_SPLIT(REPLACE(r.ProCode, N'+', N','), ',') WHERE LTRIM(RTRIM(value)) <> N'') x
     WHERE r.UploadId = @UploadId AND r.Status IN ('READY', 'PURGATORY') AND r.ProCode IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM #pk k WHERE k.ProductCode = x.Code);

    /* Otherwise the vendor's SKU and UPC: catalog number with PRO's prefix, as sent, loosely, then UPC. */
    INSERT #match (RowId, ProductCode, Pri, Seq, Rank_)
    SELECT r.RowId, x.ProductCode, x.Pri, 1, x.Rank_
      FROM piv2.RebateUploadRow r
     CROSS APPLY
     (
        SELECT k.ProductCode, 2 AS Pri, k.Rank_ FROM #pk k
         WHERE @prefix IS NOT NULL AND r.VendorSku IS NOT NULL AND k.CatNo = UPPER(@prefix + LTRIM(RTRIM(r.VendorSku)))
        UNION
        SELECT k.ProductCode, 3, k.Rank_ FROM #pk k
         WHERE r.VendorSku IS NOT NULL AND k.CatNo = UPPER(LTRIM(RTRIM(r.VendorSku)))
        UNION
        SELECT k.ProductCode, 4, k.Rank_ FROM #pk k
         WHERE r.VendorSku IS NOT NULL
           AND k.CatKey IN (REPLACE(REPLACE(REPLACE(REPLACE(UPPER(COALESCE(@prefix, N'') + LTRIM(RTRIM(r.VendorSku))), N'-', N''), N' ', N''), N'_', N''), N'.', N''),
                            REPLACE(REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(r.VendorSku))), N'-', N''), N' ', N''), N'_', N''), N'.', N''))
        UNION
        SELECT k.ProductCode, 5, k.Rank_ FROM #pk k
         WHERE r.Upc IS NOT NULL AND k.UpcKey = CONVERT(nvarchar(30), TRY_CONVERT(decimal(20, 0), r.Upc))
     ) x
     WHERE r.UploadId = @UploadId AND r.Status IN ('READY', 'PURGATORY') AND r.ProCode IS NULL;

    /* The products each row resolved to: a named list as given; a SKU/UPC match at its best level,
       active products first. Two different products at that level are ambiguous. */
    IF OBJECT_ID('tempdb..#res') IS NOT NULL DROP TABLE #res;
    SELECT m.RowId, m.ProductCode, m.Seq
      INTO #res
      FROM #match m
     WHERE m.Pri = 1
        OR (m.Pri = (SELECT MIN(m2.Pri) FROM #match m2 WHERE m2.RowId = m.RowId)
            AND m.Rank_ = (SELECT MIN(m3.Rank_) FROM #match m3 WHERE m3.RowId = m.RowId
                            AND m3.Pri = (SELECT MIN(m4.Pri) FROM #match m4 WHERE m4.RowId = m.RowId)));

    /* The candidates go with the problem, so the desk can list them to tick. */
    INSERT #problem (RowId, Code, Message, Candidates)
    SELECT x.RowId, 'AMBIGUOUS_PRODUCT',
           CONCAT(N'Several PRO products match (', COUNT(*), N'). Pick one, or tick several to roll them into one rebate product.'),
           (SELECT TOP (25) c.ProductCode AS code, k2.ModelName AS name
              FROM (SELECT DISTINCT ProductCode FROM #res WHERE RowId = x.RowId) c
              JOIN (SELECT ProductCode, MAX(ModelName) AS ModelName FROM #pk GROUP BY ProductCode) k2 ON k2.ProductCode = c.ProductCode
             ORDER BY k2.ModelName
               FOR JSON PATH)
      FROM (SELECT DISTINCT RowId, ProductCode FROM #res) x
      JOIN piv2.RebateUploadRow r ON r.RowId = x.RowId AND r.ProCode IS NULL
      JOIN (SELECT ProductCode, MAX(ModelName) AS ModelName FROM #pk GROUP BY ProductCode) k ON k.ProductCode = x.ProductCode
     GROUP BY x.RowId
    HAVING COUNT(*) > 1;

    UPDATE r
       SET ProductCode = CASE WHEN r.ProCode IS NOT NULL
                              THEN (SELECT LEFT(STRING_AGG(x.ProductCode, N',') WITHIN GROUP (ORDER BY x.Seq), 200)
                                      FROM (SELECT DISTINCT ProductCode, Seq FROM #res WHERE RowId = r.RowId) x)
                              WHEN (SELECT COUNT(DISTINCT ProductCode) FROM #res WHERE RowId = r.RowId) = 1
                              THEN (SELECT MIN(ProductCode) FROM #res WHERE RowId = r.RowId) END
      FROM piv2.RebateUploadRow r
     WHERE r.UploadId = @UploadId AND r.Status IN ('READY', 'PURGATORY');

    UPDATE r
       SET ProductName = (SELECT TOP (1) k.ModelName FROM #pk k
                           WHERE k.ProductCode = LEFT(r.ProductCode, CHARINDEX(N',', r.ProductCode + N',') - 1) ORDER BY k.Rank_)
      FROM piv2.RebateUploadRow r
     WHERE r.UploadId = @UploadId AND r.Status IN ('READY', 'PURGATORY');

    INSERT #problem (RowId, Code, Message)
    SELECT r.RowId, 'NO_PRODUCT',
           CONCAT(N'No PRO product matches',
                  CASE WHEN r.VendorSku IS NOT NULL THEN CONCAT(N' SKU ', r.VendorSku, CASE WHEN @prefix IS NOT NULL THEN CONCAT(N' (as ', @prefix, r.VendorSku, N')') ELSE N'' END) ELSE N'' END,
                  CASE WHEN r.Upc IS NOT NULL THEN CONCAT(N' or UPC ', r.Upc) ELSE N'' END,
                  CASE WHEN r.VendorSku IS NULL AND r.Upc IS NULL THEN N': the row has no PRO code, SKU or UPC' ELSE N'' END,
                  N'. Enter the PRO code, or set the vendor''s catalog prefix in vendor terms.')
      FROM piv2.RebateUploadRow r
     WHERE r.UploadId = @UploadId AND r.Status IN ('READY', 'PURGATORY')
       AND r.ProCode IS NULL AND r.ProductCode IS NULL
       AND NOT EXISTS (SELECT 1 FROM #problem p WHERE p.RowId = r.RowId AND p.Code = 'AMBIGUOUS_PRODUCT');

    /* Instant-rebate products, once, with the keys the disposition compares on. A "combo" name
       (trade-in, WITH ...) is never the plain IR product of a PRO code. */
    IF OBJECT_ID('tempdb..#models') IS NOT NULL DROP TABLE #models;
    SELECT m.ModelID,
           UPPER(LTRIM(RTRIM(m.ModelNumber))) AS NumKey,
           REPLACE(UPPER(LTRIM(RTRIM(m.ModelNumber))), N' ', N'') AS NumNoSpace,
           UPPER(LTRIM(RTRIM(m.ModelName))) AS NameKey,
           COALESCE(m.Active, 0) AS Active,
           CASE WHEN m.ModelNumber LIKE N'% TRADE-IN TRADE-UP%' OR m.ModelNumber LIKE N'% WITH %' THEN 1 ELSE 0 END AS IsCombo
      INTO #models
      FROM dbo.RebateCameraModels m
     WHERE m.IsPriceProtection = 0;
    CREATE INDEX IX_models_num ON #models (NumKey);
    CREATE INDEX IX_models_nospace ON #models (NumNoSpace);
    CREATE INDEX IX_models_name ON #models (NameKey);

    /* ---- 2. Stack products: PRO codes or vendor SKUs, separated by , or + ---- */
    IF OBJECT_ID('tempdb..#stack') IS NOT NULL DROP TABLE #stack;
    SELECT r.RowId, x.Seq, x.Token,
           (SELECT TOP (1) k.ProductCode FROM #pk k
             WHERE k.ProductCode = x.Token
                OR (@prefix IS NOT NULL AND k.CatNo = UPPER(@prefix + x.Token))
                OR k.CatNo = UPPER(x.Token)
             ORDER BY CASE WHEN k.ProductCode = x.Token THEN 0 ELSE 1 END, k.Rank_) AS ProductCode
      INTO #stack
      FROM piv2.RebateUploadRow r
     CROSS APPLY (SELECT LTRIM(RTRIM(value)) AS Token,
                         CHARINDEX(N',' + LTRIM(RTRIM(value)) + N',', N',' + REPLACE(REPLACE(r.StackProduct, N'+', N','), N' ', N'') + N',') AS Seq
                    FROM STRING_SPLIT(REPLACE(r.StackProduct, N'+', N','), ',') WHERE LTRIM(RTRIM(value)) <> N'') x
     WHERE r.UploadId = @UploadId AND r.Status IN ('READY', 'PURGATORY') AND r.StackProduct IS NOT NULL;

    INSERT #problem (RowId, Code, Message)
    SELECT RowId, 'STACK_UNKNOWN', CONCAT(N'No PRO product matches stack product ', Token, N'.')
      FROM #stack WHERE ProductCode IS NULL;

    /* A bundle or free-with-purchase row names what it comes with; without it the name is incomplete. */
    INSERT #problem (RowId, Code, Message)
    SELECT r.RowId, 'NO_STACK', N'A bundle or free-with-purchase row needs its stack product (the PRO code or SKU it comes with).'
      FROM piv2.RebateUploadRow r
     WHERE r.UploadId = @UploadId AND r.Status IN ('READY', 'PURGATORY')
       AND COALESCE(r.RebateType, @defaultType) IN (4, 7) AND r.StackProduct IS NULL;

    UPDATE r
       SET StackCodes = (SELECT LEFT(STRING_AGG(s.ProductCode, N',') WITHIN GROUP (ORDER BY s.Seq), 200) FROM #stack s
                          WHERE s.RowId = r.RowId AND s.ProductCode IS NOT NULL),
           /* The stack product's own plain IR product, for the RebateQualifiers link at load. */
           StackModelId = (SELECT TOP (1) d.ParentModelID
                             FROM #stack s
                             JOIN dbo.RebateCameraModelsDetails d ON CAST(d.ProCode AS nvarchar(20)) = s.ProductCode
                             JOIN #models m ON m.ModelID = d.ParentModelID AND m.IsCombo = 0
                            WHERE s.RowId = r.RowId AND s.ProductCode IS NOT NULL
                            ORDER BY s.Seq, m.Active DESC, m.ModelID DESC)
      FROM piv2.RebateUploadRow r
     WHERE r.UploadId = @UploadId AND r.Status IN ('READY', 'PURGATORY');

    /* ---- 3. The rebate product name, by the naming rule set (RebateIrController) ----
         IR (2)                 ModelName
         Trade-in trade-up (3)  ModelName TRADE-IN TRADE-UP
         Bundle (4), FWP (7)    ModelName WITH stack WITH stack ...   (no name until every stack resolves)
         Coupon (5)             ModelName WITH COUPON CODE
         Social media (6)       ModelName WITH SOCIAL MEDIA */
    UPDATE r
       SET ProposedName =
           CASE WHEN r.ProductName IS NULL THEN NULL
                WHEN COALESCE(r.RebateType, @defaultType) IN (4, 7)
                     AND (r.StackProduct IS NULL OR EXISTS (SELECT 1 FROM #stack s WHERE s.RowId = r.RowId AND s.ProductCode IS NULL)) THEN NULL
                ELSE
             LEFT(REPLACE(REPLACE(LTRIM(RTRIM(
                r.ProductName +
                CASE COALESCE(r.RebateType, @defaultType)
                     WHEN 3 THEN N' TRADE-IN TRADE-UP'
                     WHEN 4 THEN COALESCE(sn.Chain, N'')
                     WHEN 7 THEN COALESCE(sn.Chain, N'')
                     WHEN 5 THEN N' WITH COUPON CODE'
                     WHEN 6 THEN N' WITH SOCIAL MEDIA'
                     ELSE N'' END)), N'   ', N' '), N'  ', N' '), 400)
           END
      FROM piv2.RebateUploadRow r
     OUTER APPLY
     (
        SELECT STRING_AGG(CAST(N' WITH ' + LTRIM(RTRIM(k.ModelName)) AS nvarchar(max)), N'') WITHIN GROUP (ORDER BY s.Seq) AS Chain
          FROM #stack s
          CROSS APPLY (SELECT TOP (1) ModelName FROM #pk WHERE ProductCode = s.ProductCode ORDER BY Rank_) k
         WHERE s.RowId = r.RowId AND s.ProductCode IS NOT NULL
     ) sn
     WHERE r.UploadId = @UploadId AND r.Status IN ('READY', 'PURGATORY');

    /* ---- 4. Disposition, in PIV2GetDispositionModelId's order ----
       A product a person picked is kept. Otherwise:
         1 the rule-set name: ModelNumber exactly, then ignoring spaces
         2 plain IR rows only: the file's description the same two ways, then the PRO code
           through RebateCameraModelsDetails (never a combo-named product)
         3 the rule-set name as ModelName
       A trade-in, bundle, coupon or social row must find its own named product, never the IR one.
       Ties go to active products, then the newest, as the procedure does. */
    UPDATE r
       SET ModelId = CASE WHEN r.ModelChosenBy IS NOT NULL THEN r.ModelId ELSE d.ModelID END
      FROM piv2.RebateUploadRow r
     OUTER APPLY
     (
        SELECT TOP (1) x.ModelID
          FROM
          (
            SELECT m.ModelID, 11 AS Pri, m.Active FROM #models m
             WHERE r.ProposedName IS NOT NULL AND m.NumKey = UPPER(LTRIM(RTRIM(r.ProposedName)))
            UNION ALL
            SELECT m.ModelID, 12, m.Active FROM #models m
             WHERE r.ProposedName IS NOT NULL AND m.NumNoSpace = REPLACE(UPPER(LTRIM(RTRIM(r.ProposedName))), N' ', N'')
            UNION ALL
            SELECT m.ModelID, 21, m.Active FROM #models m
             WHERE COALESCE(r.RebateType, @defaultType) = 2 AND r.Description IS NOT NULL AND m.IsCombo = 0
               AND m.NumKey = UPPER(LTRIM(RTRIM(r.Description)))
            UNION ALL
            SELECT m.ModelID, 22, m.Active FROM #models m
             WHERE COALESCE(r.RebateType, @defaultType) = 2 AND r.Description IS NOT NULL AND m.IsCombo = 0
               AND m.NumNoSpace = REPLACE(UPPER(LTRIM(RTRIM(r.Description))), N' ', N'')
            UNION ALL
            SELECT dd.ParentModelID, 30, m.Active
              FROM dbo.RebateCameraModelsDetails dd
              JOIN #models m ON m.ModelID = dd.ParentModelID AND m.IsCombo = 0
             WHERE COALESCE(r.RebateType, @defaultType) = 2
               AND r.ProductCode IS NOT NULL
               AND dd.ProCode = TRY_CAST(LEFT(r.ProductCode, CHARINDEX(N',', r.ProductCode + N',') - 1) AS int)
            UNION ALL
            SELECT m.ModelID, 40, m.Active FROM #models m
             WHERE r.ProposedName IS NOT NULL AND m.NameKey = UPPER(LTRIM(RTRIM(r.ProposedName)))
          ) x
         ORDER BY x.Pri, x.Active DESC, x.ModelID DESC
     ) d
     WHERE r.UploadId = @UploadId AND r.Status IN ('READY', 'PURGATORY');

    /* ---- 5. Amounts: PRO's pad, set per line (the file's pad column or typed on the line);
           a combo line (Bundle, Free with purchase) with none of its own takes the upload's %. ---- */
    UPDATE r
       SET ProPad = CASE WHEN r.ProPadInput IS NOT NULL THEN r.ProPadInput
                         WHEN COALESCE(r.RebateType, @defaultType) IN (4, 7) AND COALESCE(@padPct, 0) > 0 AND r.Reimbursement > 0
                         THEN ROUND(r.Reimbursement * @padPct / 100.0, 2) ELSE 0 END
      FROM piv2.RebateUploadRow r
     WHERE r.UploadId = @UploadId AND r.Status IN ('READY', 'PURGATORY');

    INSERT #problem (RowId, Code, Message)
    SELECT r.RowId, 'MODEL_RETIRED', CONCAT(N'Rebate model ', m.ModelID, N' (', m.ModelNumber, N') is retired. Reactivate it in Products or pick another.')
      FROM piv2.RebateUploadRow r
      JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelId
     WHERE r.UploadId = @UploadId AND r.Status IN ('READY', 'PURGATORY') AND COALESCE(m.Active, 0) = 0;

    ;WITH r AS
    (
        SELECT RowId, ProCode, Description, ModelId, StartDate, EndDate, InstantRebate, Reimbursement, MapPrice, ProposedName, ProPadInput,
               COALESCE(RebateType, @defaultType) AS IRType
          FROM piv2.RebateUploadRow
         WHERE UploadId = @UploadId AND Status IN ('READY', 'PURGATORY')
    )
    INSERT #problem (RowId, Code, Message)
    SELECT RowId, 'NO_MODEL',
           CASE WHEN ProposedName IS NOT NULL
                THEN CONCAT(N'No rebate product named "', LEFT(ProposedName, 200), N'" yet. Create it (one click), or pick an existing one.')
                ELSE N'No rebate product matches. Resolve the PRO product first.' END
      FROM r WHERE ModelId IS NULL
       AND NOT EXISTS (SELECT 1 FROM #problem p WHERE p.RowId = r.RowId AND p.Code IN ('NO_PRODUCT', 'AMBIGUOUS_PRODUCT', 'NO_STACK', 'STACK_UNKNOWN'))
    UNION ALL
    SELECT RowId, 'NO_DATES', N'Start date and end date are both required.'
      FROM r WHERE StartDate IS NULL OR EndDate IS NULL
    UNION ALL
    SELECT RowId, 'DATES_REVERSED', N'The start date is after the end date.'
      FROM r WHERE StartDate > EndDate
    UNION ALL
    SELECT RowId, 'BAD_REIMBURSEMENT', N'The vendor reimbursement (what PRO claims back) must be more than zero.'
      FROM r WHERE Reimbursement IS NULL OR Reimbursement <= 0
    UNION ALL
    SELECT RowId, 'NEGATIVE_AMOUNT', N'Instant rebate, MAP and PRO pad cannot be negative.'
      FROM r WHERE InstantRebate < 0 OR MapPrice < 0 OR ProPadInput < 0
    UNION ALL
    SELECT RowId, 'NO_TYPE', N'Rebate type is missing and the upload has no default.'
      FROM r WHERE IRType IS NULL
    UNION ALL
    SELECT r.RowId, 'UNKNOWN_TYPE',
           CASE WHEN r.IRType = -1 THEN N'The rebate type in the file is not one PRO uses (IR, TITU, Bundle, Coupon, Social, FWP).'
                ELSE CONCAT(N'Rebate type ', r.IRType, N' does not exist.') END
      FROM r WHERE r.IRType IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.RebateType t WHERE t.ID = r.IRType);

    /* The same model, type and dates twice in one file: the later rows are held. */
    ;WITH d AS
    (
        SELECT RowId,
               ROW_NUMBER() OVER (PARTITION BY ModelId, COALESCE(RebateType, @defaultType), StartDate, EndDate ORDER BY SourceRow) AS n
          FROM piv2.RebateUploadRow
         WHERE UploadId = @UploadId AND Status IN ('READY', 'PURGATORY')
           AND ModelId IS NOT NULL AND StartDate IS NOT NULL AND EndDate IS NOT NULL
    )
    INSERT #problem (RowId, Code, Message)
    SELECT RowId, 'DUPLICATE_IN_FILE', N'The same model, type and dates appear earlier in this file.'
      FROM d WHERE n > 1;

    /* Two rows of this file for the same product and type whose dates overlap (but are not identical): the later one waits. */
    INSERT #problem (RowId, Code, Message)
    SELECT DISTINCT b.RowId, 'OVERLAP_IN_FILE',
           CONCAT(N'Overlaps row ', a.SourceRow, N' of this file for the same product and rebate type.')
      FROM piv2.RebateUploadRow a
      JOIN piv2.RebateUploadRow b
        ON b.UploadId = a.UploadId AND b.SourceRow > a.SourceRow
       AND b.ModelId = a.ModelId
       AND COALESCE(b.RebateType, @defaultType) = COALESCE(a.RebateType, @defaultType)
       AND b.StartDate <= a.EndDate AND b.EndDate >= a.StartDate
       AND NOT (b.StartDate = a.StartDate AND b.EndDate = a.EndDate)
     WHERE a.UploadId = @UploadId
       AND a.Status IN ('READY', 'PURGATORY', 'LOADED') AND b.Status IN ('READY', 'PURGATORY')
       AND a.ModelId IS NOT NULL AND a.StartDate IS NOT NULL AND b.StartDate IS NOT NULL;

    /* Against live programs: an exact copy, or dates that overlap one already open for members. */
    INSERT #problem (RowId, Code, Message)
    SELECT r.RowId,
           CASE WHEN p.ProgramStartWeek = r.StartDate AND p.ProgramEndWeek = r.EndDate
                     AND ROUND(p.Reimbursement, 2) = r.Reimbursement + COALESCE(r.ProPad, 0) THEN 'ALREADY_LOADED' ELSE 'OVERLAP' END,
           CONCAT(CASE WHEN p.ProgramStartWeek = r.StartDate AND p.ProgramEndWeek = r.EndDate
                            AND ROUND(p.Reimbursement, 2) = r.Reimbursement + COALESCE(r.ProPad, 0)
                       THEN N'Already loaded and live: program ' ELSE N'Overlaps live program ' END,
                  p.ProgramID, COALESCE(CONCAT(N' in batch ', p.BatchID), N''),
                  N' (', CONVERT(nvarchar(10), p.ProgramStartWeek, 23), N' to ', CONVERT(nvarchar(10), p.ProgramEndWeek, 23), N').')
      FROM piv2.RebateUploadRow r
     CROSS APPLY
     (
        SELECT TOP (1) pd.ProgramID, pd.BatchID, pd.ProgramStartWeek, pd.ProgramEndWeek, pd.Reimbursement
          FROM dbo.RebateProgramDetail pd
         WHERE pd.ModelID = r.ModelId
           AND pd.IRType = COALESCE(r.RebateType, @defaultType)
           AND pd.Expired = 0
           AND pd.ProgramStartWeek <= r.EndDate
           AND pd.ProgramEndWeek >= r.StartDate
         ORDER BY pd.ProgramStartWeek DESC
     ) p
     WHERE r.UploadId = @UploadId AND r.Status IN ('READY', 'PURGATORY')
       AND r.ModelId IS NOT NULL AND r.StartDate IS NOT NULL AND r.EndDate IS NOT NULL;

    UPDATE r
       SET Problems = (SELECT p.Code AS code, p.Message AS message, JSON_QUERY(p.Candidates) AS candidates
                         FROM #problem p WHERE p.RowId = r.RowId FOR JSON PATH),
           Status   = CASE WHEN EXISTS (SELECT 1 FROM #problem p WHERE p.RowId = r.RowId) THEN 'PURGATORY' ELSE 'READY' END
      FROM piv2.RebateUploadRow r
     WHERE r.UploadId = @UploadId AND r.Status IN ('READY', 'PURGATORY');
END
GO

/* ---------------------------------------------------------------
   Store the mapped rows for an upload (replacing any earlier mapping
   that has not loaded anything yet) and run the checks.
   @Rows: JSON array produced by the API from the confirmed mapping.
   --------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE piv2.Rebate_SetMapping
    @UploadId          int,
    @SheetName         nvarchar(128),
    @HeaderRow         int,
    @Fingerprint       char(64),
    @TemplateId        int = NULL,
    @MappingSource     varchar(20),
    @DefaultRebateType int = NULL,
    @ExpireOn          date = NULL,
    @StartActive       bit = 1,
    @PadPct            decimal(5,2) = NULL,
    @VendorSharePct    decimal(5,2) = NULL,
    @Rows              nvarchar(max),
    @Actor             nvarchar(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISJSON(@Rows) <> 1
        THROW 50706, 'The mapped rows are not valid JSON.', 1;

    BEGIN TRAN;

    DECLARE @status varchar(20) = (SELECT Status FROM piv2.RebateUpload WITH (UPDLOCK) WHERE UploadId = @UploadId);

    IF @status IS NULL
        THROW 50707, 'That upload does not exist.', 1;
    IF @status NOT IN ('MAPPING', 'REVIEW')
        THROW 50708, 'This upload has already loaded rows; its mapping can no longer change.', 1;

    DELETE FROM piv2.RebateUploadRow WHERE UploadId = @UploadId;

    INSERT piv2.RebateUploadRow
        (UploadId, SourceRow, Raw, ProCode, VendorSku, Upc, Description, InstantRebate, Reimbursement, MapPrice, ProPadInput,
         StartDate, EndDate, StackProduct, RebateType, Notes, Status)
    SELECT @UploadId, j.SourceRow, COALESCE(j.Raw, N'{}'),
           NULLIF(LTRIM(RTRIM(j.ProCode)), N''), NULLIF(LTRIM(RTRIM(j.VendorSku)), N''), NULLIF(LTRIM(RTRIM(j.Upc)), N''),
           NULLIF(LTRIM(RTRIM(j.Description)), N''),
           j.InstantRebate, j.Reimbursement, j.MapPrice, j.ProPad, j.StartDate, j.EndDate,
           NULLIF(LTRIM(RTRIM(j.StackProduct)), N''), j.RebateType, NULLIF(LTRIM(RTRIM(j.Notes)), N''),
           'PURGATORY'
      FROM OPENJSON(@Rows)
      WITH
      (
          SourceRow      int            '$.sourceRow',
          Raw            nvarchar(max)  '$.raw' AS JSON,
          ProCode        nvarchar(50)   '$.proCode',
          VendorSku      nvarchar(100)  '$.vendorSku',
          Upc            nvarchar(20)   '$.upc',
          Description    nvarchar(400)  '$.description',
          InstantRebate  decimal(19,2)  '$.instantRebate',
          Reimbursement  decimal(19,2)  '$.reimbursement',
          MapPrice       decimal(19,2)  '$.mapPrice',
          ProPad         decimal(19,2)  '$.proPad',
          StartDate      date           '$.startDate',
          EndDate        date           '$.endDate',
          StackProduct   nvarchar(400)  '$.stackProduct',
          RebateType     int            '$.rebateType',
          Notes          nvarchar(1000) '$.notes'
      ) j;

    UPDATE piv2.RebateUpload
       SET SheetName = @SheetName, HeaderRow = @HeaderRow, Fingerprint = @Fingerprint,
           TemplateId = @TemplateId, MappingSource = @MappingSource,
           DefaultRebateType = @DefaultRebateType, ExpireOn = @ExpireOn, StartActive = @StartActive,
           PadPct = @PadPct, VendorSharePct = @VendorSharePct,
           Status = 'REVIEW'
     WHERE UploadId = @UploadId;

    IF @TemplateId IS NOT NULL
        UPDATE piv2.RebateTemplate SET TimesUsed = TimesUsed + 1, LastUsedAt = SYSUTCDATETIME() WHERE TemplateId = @TemplateId;

    EXEC piv2.Rebate_ValidateUpload @UploadId;

    INSERT piv2.RebateEvent (EventType, UploadId, TemplateId, Actor, Detail)
    SELECT 'MAPPED', @UploadId, @TemplateId, @Actor,
           (SELECT @MappingSource AS source,
                   SUM(CASE WHEN Status = 'READY' THEN 1 ELSE 0 END) AS ready,
                   SUM(CASE WHEN Status = 'PURGATORY' THEN 1 ELSE 0 END) AS purgatory
              FROM piv2.RebateUploadRow WHERE UploadId = @UploadId
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

    COMMIT;

    EXEC piv2.Rebate_GetUpload @UploadId;
END
GO

CREATE OR ALTER PROCEDURE piv2.Rebate_Uploads
    @Status varchar(20) = NULL,
    @Take   int = 50
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SELECT TOP (CASE WHEN @Take BETWEEN 1 AND 500 THEN @Take ELSE 50 END)
           u.UploadId, u.VendorId, v.VendorName, u.FileName, u.Status, u.BatchId, u.MappingSource,
           u.CreatedBy, u.CreatedAt, u.LoadedBy, u.LoadedAt,
           (SELECT COUNT(*) FROM piv2.RebateUploadRow r WHERE r.UploadId = u.UploadId AND r.Status = 'PURGATORY') AS RowsPurgatory,
           (SELECT COUNT(*) FROM piv2.RebateUploadRow r WHERE r.UploadId = u.UploadId AND r.Status = 'LOADED')    AS RowsLoaded,
           (SELECT COUNT(*) FROM piv2.RebateUploadRow r WHERE r.UploadId = u.UploadId)                            AS RowsTotal
      FROM piv2.RebateUpload u
      JOIN dbo.RebateVendors v ON v.VendorID = u.VendorId
     WHERE (@Status IS NULL AND u.Status <> 'CANCELLED') OR u.Status = @Status
     ORDER BY u.UploadId DESC;
END
GO

CREATE OR ALTER PROCEDURE piv2.Rebate_CancelUpload
    @UploadId int,
    @Actor    nvarchar(100),
    @Reason   nvarchar(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@Reason)), N'') IS NULL
        THROW 50702, 'A reason is required.', 1;

    IF EXISTS (SELECT 1 FROM piv2.RebateUploadRow WHERE UploadId = @UploadId AND Status = 'LOADED')
        THROW 50709, 'Rows from this upload are already loaded; turn the batch off instead of cancelling the upload.', 1;

    UPDATE piv2.RebateUpload
       SET Status = 'CANCELLED', CancelledBy = @Actor, CancelReason = @Reason
     WHERE UploadId = @UploadId AND Status <> 'CANCELLED';

    IF @@ROWCOUNT = 0
        THROW 50707, 'That upload does not exist or is already cancelled.', 1;

    INSERT piv2.RebateEvent (EventType, UploadId, Actor, Reason) VALUES ('UPLOAD_CANCELLED', @UploadId, @Actor, @Reason);
END
GO

/* =================================================================
   Purgatory: fix, skip, restore
   ================================================================= */

CREATE OR ALTER PROCEDURE piv2.Rebate_UpdateRow
    @RowId         bigint,
    @ProCode       nvarchar(50),
    @VendorSku     nvarchar(100) = NULL,
    @Upc           nvarchar(20) = NULL,
    @StackProduct  nvarchar(400) = NULL,
    @Description   nvarchar(400),
    @InstantRebate decimal(19,2),
    @Reimbursement decimal(19,2),
    @MapPrice      decimal(19,2),
    @ProPad        decimal(19,2) = NULL,   -- this line's PRO pad; NULL = the upload's default
    @StartDate     date,
    @EndDate       date,
    @RebateType    int,
    @Notes         nvarchar(1000),
    @Actor         nvarchar(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @upload int, @status varchar(20), @before nvarchar(max);

    SELECT @upload = UploadId, @status = Status,
           @before = (SELECT ProCode AS proCode, Description AS description, InstantRebate AS instantRebate,
                             Reimbursement AS reimbursement, MapPrice AS mapPrice, StartDate AS startDate,
                             EndDate AS endDate, RebateType AS rebateType
                        FROM piv2.RebateUploadRow WHERE RowId = @RowId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
      FROM piv2.RebateUploadRow WHERE RowId = @RowId;

    IF @upload IS NULL
        THROW 50710, 'That row does not exist.', 1;
    IF @status NOT IN ('READY', 'PURGATORY')
        THROW 50711, 'Only rows that have not loaded or been skipped can be changed.', 1;

    BEGIN TRAN;

    UPDATE piv2.RebateUploadRow
       SET ProCode = NULLIF(LTRIM(RTRIM(@ProCode)), N''), Description = NULLIF(LTRIM(RTRIM(@Description)), N''),
           VendorSku = NULLIF(LTRIM(RTRIM(@VendorSku)), N''), Upc = NULLIF(LTRIM(RTRIM(@Upc)), N''),
           StackProduct = NULLIF(LTRIM(RTRIM(@StackProduct)), N''),
           InstantRebate = @InstantRebate, Reimbursement = @Reimbursement, MapPrice = @MapPrice, ProPadInput = @ProPad,
           StartDate = @StartDate, EndDate = @EndDate, RebateType = @RebateType,
           Notes = NULLIF(LTRIM(RTRIM(@Notes)), N''),
           UpdatedBy = @Actor, UpdatedAt = SYSUTCDATETIME()
     WHERE RowId = @RowId;

    EXEC piv2.Rebate_ValidateUpload @upload;

    INSERT piv2.RebateEvent (EventType, UploadId, RowId, Actor, Detail)
    SELECT 'ROW_FIXED', @upload, @RowId, @Actor,
           (SELECT JSON_QUERY(@before) AS [before],
                   JSON_QUERY((SELECT ProCode AS proCode, Description AS description, InstantRebate AS instantRebate,
                                      Reimbursement AS reimbursement, MapPrice AS mapPrice, StartDate AS startDate,
                                      EndDate AS endDate, RebateType AS rebateType, Status AS status
                                 FROM piv2.RebateUploadRow WHERE RowId = @RowId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS [after]
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

    COMMIT;

    SELECT r.RowId, r.Status, r.Problems, r.ModelId, m.ModelNumber AS ModelDescription
      FROM piv2.RebateUploadRow r
      LEFT JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelId
     WHERE r.RowId = @RowId;
END
GO

CREATE OR ALTER PROCEDURE piv2.Rebate_SkipRow
    @RowId  bigint,
    @Actor  nvarchar(100),
    @Reason nvarchar(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@Reason)), N'') IS NULL
        THROW 50702, 'A reason is required.', 1;

    DECLARE @upload int = (SELECT UploadId FROM piv2.RebateUploadRow WHERE RowId = @RowId AND Status IN ('READY', 'PURGATORY'));
    IF @upload IS NULL
        THROW 50711, 'Only rows that have not loaded or been skipped can be skipped.', 1;

    UPDATE piv2.RebateUploadRow
       SET Status = 'SKIPPED', SkipReason = @Reason, UpdatedBy = @Actor, UpdatedAt = SYSUTCDATETIME()
     WHERE RowId = @RowId;

    EXEC piv2.Rebate_RefreshUploadStatus @upload;

    INSERT piv2.RebateEvent (EventType, UploadId, RowId, Actor, Reason) VALUES ('ROW_SKIPPED', @upload, @RowId, @Actor, @Reason);
END
GO

CREATE OR ALTER PROCEDURE piv2.Rebate_RestoreRow
    @RowId  bigint,
    @Actor  nvarchar(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @upload int = (SELECT UploadId FROM piv2.RebateUploadRow WHERE RowId = @RowId AND Status = 'SKIPPED');
    IF @upload IS NULL
        THROW 50712, 'Only skipped rows can be restored.', 1;

    UPDATE piv2.RebateUploadRow
       SET Status = 'PURGATORY', SkipReason = NULL, UpdatedBy = @Actor, UpdatedAt = SYSUTCDATETIME()
     WHERE RowId = @RowId;

    EXEC piv2.Rebate_ValidateUpload @upload;
    EXEC piv2.Rebate_RefreshUploadStatus @upload;

    INSERT piv2.RebateEvent (EventType, UploadId, RowId, Actor) VALUES ('ROW_RESTORED', @upload, @RowId, @Actor);
END
GO

/* A person sets the row's disposition (from the candidates, or any instant-rebate model). */
CREATE OR ALTER PROCEDURE piv2.Rebate_PickModel
    @RowId   bigint,
    @ModelId int = NULL,       -- NULL hands the row back to automatic matching
    @Actor   nvarchar(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @upload int = (SELECT UploadId FROM piv2.RebateUploadRow WHERE RowId = @RowId AND Status IN ('READY', 'PURGATORY'));
    IF @upload IS NULL
        THROW 50711, 'Only rows that have not loaded or been skipped can be changed.', 1;

    IF @ModelId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.RebateCameraModels WHERE ModelID = @ModelId AND IsPriceProtection = 0)
        THROW 50722, 'That is not an instant-rebate model.', 1;

    BEGIN TRAN;

    UPDATE piv2.RebateUploadRow
       SET ModelId = @ModelId,
           ModelChosenBy = CASE WHEN @ModelId IS NULL THEN NULL ELSE @Actor END,
           UpdatedBy = @Actor, UpdatedAt = SYSUTCDATETIME()
     WHERE RowId = @RowId;

    EXEC piv2.Rebate_ValidateUpload @upload;

    INSERT piv2.RebateEvent (EventType, UploadId, RowId, ModelId, Actor)
    VALUES ('ROW_DISPOSITION', @upload, @RowId, @ModelId, @Actor);

    COMMIT;

    SELECT r.RowId, r.Status, r.Problems, r.ModelId, m.ModelNumber AS ModelDescription, r.ModelChosenBy
      FROM piv2.RebateUploadRow r
      LEFT JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelId
     WHERE r.RowId = @RowId;
END
GO
/* ---------------------------------------------------------------
   Creates the rebate products the rule set named but that do not
   exist yet, for an upload's purgatory rows (or the chosen ones),
   one product per name with the row's PRO code(s). Then checks again.
   --------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE piv2.Rebate_CreateMissingProducts
    @UploadId int,
    @Actor    nvarchar(100),
    @RowIds   nvarchar(max) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @vendor int = (SELECT VendorId FROM piv2.RebateUpload WHERE UploadId = @UploadId);
    IF @vendor IS NULL
        THROW 50707, 'That upload does not exist.', 1;

    DECLARE @chosen TABLE (RowId bigint PRIMARY KEY);
    IF @RowIds IS NOT NULL
        INSERT @chosen SELECT DISTINCT TRY_CAST(value AS bigint) FROM STRING_SPLIT(@RowIds, ',') WHERE TRY_CAST(value AS bigint) IS NOT NULL;

    BEGIN TRAN;

    DECLARE @want TABLE (Name nvarchar(400) PRIMARY KEY, Codes nvarchar(200) NOT NULL);

    INSERT @want (Name, Codes)
    SELECT r.ProposedName, MIN(r.ProductCode)
      FROM piv2.RebateUploadRow r
     WHERE r.UploadId = @UploadId AND r.Status = 'PURGATORY' AND r.ModelId IS NULL
       AND r.ProposedName IS NOT NULL AND r.ProductCode IS NOT NULL
       AND (@RowIds IS NULL OR r.RowId IN (SELECT RowId FROM @chosen))
       AND NOT EXISTS (SELECT 1 FROM dbo.RebateCameraModels m
                        WHERE m.IsPriceProtection = 0
                          AND REPLACE(UPPER(LTRIM(RTRIM(m.ModelNumber))), N' ', N'') = REPLACE(UPPER(LTRIM(RTRIM(r.ProposedName))), N' ', N''))
     GROUP BY r.ProposedName;

    DECLARE @made TABLE (ModelId int, Name nvarchar(400), Codes nvarchar(200));

    MERGE dbo.RebateCameraModels AS t
    USING @want AS w ON 1 = 0
    WHEN NOT MATCHED THEN
        INSERT (ModelNumber, ModelName, ModelColor, VendorID, Active, ProductGroupID, IsPriceProtection, OrderID, SerialNumbersRequired)
        VALUES (LEFT(w.Name, 255), LEFT(w.Codes, CHARINDEX(N',', w.Codes + N',') - 1), N'None', @vendor, 1, NULL, 0, NULL, 0)
    OUTPUT inserted.ModelID, w.Name, w.Codes INTO @made (ModelId, Name, Codes);

    INSERT dbo.RebateCameraModelsDetails (ParentModelID, ProCode, ProDescription, ProColor)
    SELECT m.ModelId, TRY_CAST(LTRIM(RTRIM(c.value)) AS int), LEFT(m.Name, 255), LEFT(m.Name, 255)
      FROM @made m
     CROSS APPLY STRING_SPLIT(m.Codes, ',') c
     WHERE TRY_CAST(LTRIM(RTRIM(c.value)) AS int) IS NOT NULL;

    INSERT piv2.RebateEvent (EventType, UploadId, ModelId, Actor, Detail)
    SELECT 'PRODUCT_ADDED', @UploadId, m.ModelId, @Actor,
           (SELECT m.Name AS description, m.Codes AS proCodes, 'naming rule set' AS source FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
      FROM @made m;

    EXEC piv2.Rebate_ValidateUpload @UploadId;

    COMMIT;

    SELECT (SELECT COUNT(*) FROM @made) AS Created;
END
GO

CREATE OR ALTER PROCEDURE piv2.Rebate_Purgatory
    @VendorId int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SELECT r.RowId, r.UploadId, u.VendorId, v.VendorName, u.FileName, r.SourceRow,
           r.ProCode, r.Description, r.InstantRebate, r.Reimbursement, r.MapPrice,
           r.StartDate, r.EndDate, r.StackProduct, r.RebateType, u.DefaultRebateType, r.Notes, r.Problems,
           r.ModelId, m.ModelNumber AS ModelDescription, r.ModelChosenBy,
           r.VendorSku, r.Upc, r.ProductCode, r.ProductName, r.StackCodes, r.ProposedName, r.ProPad, r.ProPadInput, r.Raw,
           r.UpdatedBy, r.UpdatedAt, u.CreatedAt AS UploadedAt
      FROM piv2.RebateUploadRow r
      JOIN piv2.RebateUpload u ON u.UploadId = r.UploadId
      JOIN dbo.RebateVendors v ON v.VendorID = u.VendorId
      LEFT JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelId
     WHERE r.Status = 'PURGATORY' AND u.Status <> 'CANCELLED'
       AND (@VendorId IS NULL OR u.VendorId = @VendorId)
     ORDER BY u.UploadId DESC, r.SourceRow;
END
GO

/* =================================================================
   Load: approve an upload (or chosen rows) into RebateProgramDetail
   ================================================================= */
CREATE OR ALTER PROCEDURE piv2.Rebate_Load
    @UploadId int,
    @Actor    nvarchar(100),
    @RowIds   nvarchar(max) = NULL    -- comma list; NULL loads every READY row
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRAN;

    DECLARE @status varchar(20), @batch int, @startActive bit, @expireOn date, @defaultType int;

    SELECT @status = Status, @batch = BatchId, @startActive = StartActive, @expireOn = ExpireOn, @defaultType = DefaultRebateType
      FROM piv2.RebateUpload WITH (UPDLOCK, HOLDLOCK)
     WHERE UploadId = @UploadId;

    IF @status IS NULL
        THROW 50707, 'That upload does not exist.', 1;
    IF @status NOT IN ('REVIEW', 'PARTIAL', 'LOADED')
        THROW 50713, 'Map this upload before loading it.', 1;

    /* Checks again inside the transaction, one load at a time: live programs may have changed since the review. */
    EXEC sp_getapplock @Resource = N'piv2.RebateProgramsLive', @LockMode = N'Exclusive', @LockOwner = N'Transaction', @LockTimeout = 30000;
    EXEC piv2.Rebate_ValidateUpload @UploadId;

    DECLARE @chosen TABLE (RowId bigint PRIMARY KEY);
    IF @RowIds IS NOT NULL
        INSERT @chosen SELECT DISTINCT TRY_CAST(value AS bigint) FROM STRING_SPLIT(@RowIds, ',') WHERE TRY_CAST(value AS bigint) IS NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM piv2.RebateUploadRow r
                    WHERE r.UploadId = @UploadId AND r.Status = 'READY'
                      AND (@RowIds IS NULL OR r.RowId IN (SELECT RowId FROM @chosen)))
    BEGIN
        ROLLBACK;
        THROW 50714, 'Nothing to load: no ready rows were chosen. Rows with problems stay in purgatory until they are fixed.', 1;
    END

    IF @batch IS NULL
    BEGIN
        SELECT @batch = NEXT VALUE FOR piv2.RebateBatchSeq;
        UPDATE piv2.RebateUpload SET BatchId = @batch WHERE UploadId = @UploadId;
    END

    DECLARE @map TABLE (RowId bigint PRIMARY KEY, ProgramId int NOT NULL);

    MERGE dbo.RebateProgramDetail AS t
    USING
    (
        SELECT r.RowId, r.ModelId, r.InstantRebate, r.Reimbursement + COALESCE(r.ProPad, 0) AS MemberAmount, r.MapPrice,
               r.StartDate, r.EndDate, COALESCE(r.RebateType, @defaultType) AS IRType
          FROM piv2.RebateUploadRow r
         WHERE r.UploadId = @UploadId AND r.Status = 'READY'
           AND (@RowIds IS NULL OR r.RowId IN (SELECT RowId FROM @chosen))
    ) AS s
    ON 1 = 0
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (ModelID, InstantRebate, Reimbursement, MAPDrop, ProgramStartWeek, ProgramEndWeek,
                Expired, ExpireOn, IRType, BatchID)
        VALUES (s.ModelId, s.InstantRebate, s.MemberAmount, s.MapPrice, s.StartDate, s.EndDate,
                CASE WHEN @startActive = 1 THEN 0 ELSE 1 END, @expireOn, s.IRType, @batch)
    OUTPUT s.RowId, inserted.ProgramID INTO @map (RowId, ProgramId);

    UPDATE r
       SET Status = 'LOADED', ProgramId = m.ProgramId, UpdatedBy = @Actor, UpdatedAt = SYSUTCDATETIME()
      FROM piv2.RebateUploadRow r
      JOIN @map m ON m.RowId = r.RowId;

    /* What the member amount is made of: the vendor's share (claimed back) and PRO's pad (not). */
    INSERT piv2.RebateProgramTerms (ProgramId, MemberAmount, ModelId, VendorShare, ProPad, UpdatedBy)
    SELECT m.ProgramId, r.Reimbursement + COALESCE(r.ProPad, 0), r.ModelId, r.Reimbursement, COALESCE(r.ProPad, 0), @Actor
      FROM @map m JOIN piv2.RebateUploadRow r ON r.RowId = m.RowId;

    /* A stack product in the file becomes a qualifier link (row's model qualifies with the stack model), once. */
    INSERT dbo.RebateQualifiers (PROQualifierID, PROAssociatedID, PROAssociatedName)
    SELECT DISTINCT r.ModelId, r.StackModelId, sm.ModelNumber
      FROM piv2.RebateUploadRow r
      JOIN @map m ON m.RowId = r.RowId
      JOIN dbo.RebateCameraModels sm ON sm.ModelID = r.StackModelId
     WHERE r.StackModelId IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.RebateQualifiers q
                        WHERE q.PROQualifierID = r.ModelId AND q.PROAssociatedID = r.StackModelId);

    UPDATE piv2.RebateUpload
       SET LoadedBy = COALESCE(LoadedBy, @Actor), LoadedAt = COALESCE(LoadedAt, SYSUTCDATETIME()),
           Status = CASE WHEN Status = 'REVIEW' THEN 'PARTIAL' ELSE Status END
     WHERE UploadId = @UploadId;

    EXEC piv2.Rebate_RefreshUploadStatus @UploadId;

    DECLARE @loaded int = (SELECT COUNT(*) FROM @map);

    INSERT piv2.RebateEvent (EventType, BatchId, UploadId, Actor, Detail)
    SELECT 'LOADED', @batch, @UploadId, @Actor,
           (SELECT @loaded AS loaded,
                   (SELECT COUNT(*) FROM piv2.RebateUploadRow WHERE UploadId = @UploadId AND Status = 'PURGATORY') AS inPurgatory,
                   CASE WHEN @startActive = 1 THEN 'on' ELSE 'off' END AS loadedAs
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

    COMMIT;

    SELECT @batch AS BatchId, @loaded AS Loaded,
           (SELECT COUNT(*) FROM piv2.RebateUploadRow WHERE UploadId = @UploadId AND Status = 'PURGATORY') AS InPurgatory,
           (SELECT Status FROM piv2.RebateUpload WHERE UploadId = @UploadId) AS UploadStatus;
END
GO

/* =================================================================
   Batches and programs after load
   ================================================================= */

CREATE OR ALTER PROCEDURE piv2.Rebate_Overview
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SELECT
        (SELECT COUNT(*) FROM dbo.RebateProgramDetail WHERE Expired = 0)                                 AS ProgramsLive,
        (SELECT COUNT(DISTINCT BatchID) FROM dbo.RebateProgramDetail WHERE Expired = 0 AND BatchID IS NOT NULL) AS BatchesLive,
        (SELECT COUNT(*) FROM dbo.RebateProgramDetail
          WHERE Expired = 0 AND ProgramEndWeek BETWEEN CAST(GETDATE() AS date) AND DATEADD(day, 14, CAST(GETDATE() AS date))) AS EndingIn14Days,
        (SELECT COUNT(*) FROM piv2.RebateUploadRow r JOIN piv2.RebateUpload u ON u.UploadId = r.UploadId
          WHERE r.Status = 'PURGATORY' AND u.Status <> 'CANCELLED')                                       AS PurgatoryRows,
        (SELECT COUNT(*) FROM piv2.RebateUpload WHERE Status IN ('MAPPING', 'REVIEW', 'PARTIAL'))          AS UploadsOpen,
        (SELECT COUNT(*) FROM piv2.RebateTemplate WHERE IsActive = 1)                                      AS Templates,
        (SELECT COUNT(*) FROM dbo.PriceProtectionDetail WHERE Expired = 0)                                AS PriceProtectionLive,
        (SELECT COUNT(*) FROM dbo.RebateCameraModels WHERE IsPriceProtection = 0 AND Active = 1)           AS RebateModelsActive,
        (SELECT COUNT(*) FROM dbo.RebateCameraModels WHERE IsPriceProtection = 1 AND Active = 1)           AS PriceModelsActive;
END
GO

CREATE OR ALTER PROCEDURE piv2.Rebate_Batches
    @Q        nvarchar(100) = NULL,    -- batch number or vendor name
    @VendorId int = NULL,
    @State    varchar(10) = NULL,      -- LIVE, OFF, MIXED, or NULL for all
    @Page     int = 1,
    @PageSize int = 50
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Page = CASE WHEN @Page < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN @PageSize NOT BETWEEN 1 AND 200 THEN 50 ELSE @PageSize END;

    ;WITH b AS
    (
        SELECT p.BatchID AS BatchId,
               MIN(v.VendorID) AS VendorId,
               MIN(v.VendorName) AS VendorName,
               COUNT(*) AS Programs,
               SUM(CASE WHEN p.Expired = 0 THEN 1 ELSE 0 END) AS LivePrograms,
               MIN(p.ProgramStartWeek) AS ProgramStart,
               MAX(p.ProgramEndWeek) AS ProgramEnd,
               MAX(p.ExpireOn) AS ExpireOn,
               MIN(p.IRType) AS IrType,
               MIN(t.Name) AS IrTypeName,
               CASE WHEN COUNT(DISTINCT p.IRType) > 1 THEN 1 ELSE 0 END AS MixedTypes,
               MIN(p.DateEntered) AS EnteredAt
          FROM dbo.RebateProgramDetail p
          JOIN dbo.RebateCameraModels m ON m.ModelID = p.ModelID
          JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID AND v.IsPriceProtection = 0
          LEFT JOIN dbo.RebateType t ON t.ID = p.IRType
         WHERE p.BatchID IS NOT NULL
         GROUP BY p.BatchID
    )
    SELECT b.*,
           CASE WHEN b.LivePrograms = b.Programs THEN 'LIVE' WHEN b.LivePrograms = 0 THEN 'OFF' ELSE 'MIXED' END AS State,
           u.UploadId, u.CreatedBy AS LoadedBy,
           COUNT(*) OVER () AS TotalRows
      FROM b
      LEFT JOIN piv2.RebateUpload u ON u.BatchId = b.BatchId
     WHERE (@VendorId IS NULL OR b.VendorId = @VendorId)
       AND (@Q IS NULL OR CAST(b.BatchId AS nvarchar(20)) = @Q OR b.VendorName LIKE N'%' + @Q + N'%')
       AND (@State IS NULL
            OR (@State = 'LIVE'  AND b.LivePrograms = b.Programs)
            OR (@State = 'OFF'   AND b.LivePrograms = 0)
            OR (@State = 'MIXED' AND b.LivePrograms > 0 AND b.LivePrograms < b.Programs))
     ORDER BY b.ProgramStart DESC, b.BatchId DESC
     OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY
    OPTION (RECOMPILE);
END
GO

CREATE OR ALTER PROCEDURE piv2.Rebate_BatchPrograms
    @BatchId int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SELECT p.ProgramID AS ProgramId, p.BatchID AS BatchId, p.ModelID AS ModelId,
           m.ModelName AS ProCode, m.ModelNumber AS Description, v.VendorName,
           p.InstantRebate, p.Reimbursement, p.MAPDrop AS MapPrice,
           COALESCE(pt.VendorShare, p.Reimbursement) AS VendorShare, COALESCE(pt.ProPad, 0) AS ProPad,
           p.ProgramStartWeek AS StartDate, p.ProgramEndWeek AS EndDate, p.ExpireOn,
           p.IRType AS IrType, t.Name AS IrTypeName, CAST(CASE WHEN p.Expired = 0 THEN 1 ELSE 0 END AS bit) AS IsLive,
           p.DateEntered AS EnteredAt
      FROM dbo.RebateProgramDetail p
      JOIN dbo.RebateCameraModels m ON m.ModelID = p.ModelID
      LEFT JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID
      LEFT JOIN dbo.RebateType t ON t.ID = p.IRType
      LEFT JOIN piv2.RebateProgramTerms pt ON pt.ProgramId = p.ProgramID AND pt.MemberAmount = ROUND(p.Reimbursement, 2)
     WHERE p.BatchID = @BatchId
     ORDER BY m.ModelNumber;
END
GO

/* Live programs elsewhere that these would collide with. Shared by the "turn on" and "change dates" checks. */
CREATE OR ALTER PROCEDURE piv2.Rebate_ThrowIfOverlap
    @ProgramIds nvarchar(max),     -- the programs about to be live, comma list
    @NewStart   date = NULL,       -- NULL: use each program's own dates
    @NewEnd     date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ids TABLE (ProgramId int PRIMARY KEY);
    INSERT @ids SELECT DISTINCT TRY_CAST(value AS int) FROM STRING_SPLIT(@ProgramIds, ',') WHERE TRY_CAST(value AS int) IS NOT NULL;

    /* One overlap check at a time, held to the caller's commit, so two loads cannot both pass. */
    IF @@TRANCOUNT > 0
        EXEC sp_getapplock @Resource = N'piv2.RebateProgramsLive', @LockMode = N'Exclusive', @LockOwner = N'Transaction', @LockTimeout = 30000;

    /* Within the set itself: two of these programs for the same product and type with overlapping dates. */
    DECLARE @self nvarchar(400) =
    (
        SELECT TOP (1) CONCAT(N'Programs ', a.ProgramID, N' and ', b.ProgramID,
                              N' are for the same product and rebate type and their dates overlap. Change one before turning them on.')
          FROM dbo.RebateProgramDetail a
          JOIN @ids ia ON ia.ProgramId = a.ProgramID
          JOIN dbo.RebateProgramDetail b ON b.ModelID = a.ModelID AND b.IRType = a.IRType AND b.ProgramID > a.ProgramID
          JOIN @ids ib ON ib.ProgramId = b.ProgramID
         WHERE COALESCE(@NewStart, b.ProgramStartWeek) <= COALESCE(@NewEnd, a.ProgramEndWeek)
           AND COALESCE(@NewEnd, b.ProgramEndWeek) >= COALESCE(@NewStart, a.ProgramStartWeek)
    );
    IF @self IS NOT NULL
        THROW 50723, @self, 1;

    DECLARE @clash nvarchar(400) =
    (
        SELECT TOP (1) CONCAT(N'Program ', mine.ProgramID, N' would overlap live program ', other.ProgramID,
                              COALESCE(CONCAT(N' in batch ', other.BatchID), N''), N' for the same model and rebate type (',
                              CONVERT(nvarchar(10), other.ProgramStartWeek, 23), N' to ', CONVERT(nvarchar(10), other.ProgramEndWeek, 23),
                              N'). Turn that one off or change its dates first.')
          FROM dbo.RebateProgramDetail mine
          JOIN @ids i ON i.ProgramId = mine.ProgramID
          JOIN dbo.RebateProgramDetail other
            ON other.ModelID = mine.ModelID
           AND other.IRType = mine.IRType
           AND other.Expired = 0
           AND other.ProgramID NOT IN (SELECT ProgramId FROM @ids)
           AND other.ProgramStartWeek <= COALESCE(@NewEnd, mine.ProgramEndWeek)
           AND other.ProgramEndWeek >= COALESCE(@NewStart, mine.ProgramStartWeek)
    );

    IF @clash IS NOT NULL
        THROW 50715, @clash, 1;
END
GO

CREATE OR ALTER PROCEDURE piv2.Rebate_SetBatchActive
    @BatchId int,
    @Active  bit,
    @Actor   nvarchar(100),
    @Reason  nvarchar(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@Reason)), N'') IS NULL
        THROW 50702, 'A reason is required.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.RebateProgramDetail WHERE BatchID = @BatchId)
        THROW 50716, 'That batch does not exist.', 1;

    BEGIN TRAN;

    IF @Active = 1
    BEGIN
        DECLARE @ids nvarchar(max) =
            (SELECT STRING_AGG(CAST(ProgramID AS nvarchar(max)), ',') FROM dbo.RebateProgramDetail WITH (UPDLOCK) WHERE BatchID = @BatchId);
        EXEC piv2.Rebate_ThrowIfOverlap @ids;
    END

    UPDATE dbo.RebateProgramDetail
       SET Expired = CASE WHEN @Active = 1 THEN 0 ELSE 1 END
     WHERE BatchID = @BatchId;

    DECLARE @n int = @@ROWCOUNT;

    INSERT piv2.RebateEvent (EventType, BatchId, Actor, Reason, Detail)
    VALUES (CASE WHEN @Active = 1 THEN 'BATCH_ON' ELSE 'BATCH_OFF' END, @BatchId, @Actor, @Reason,
            (SELECT @n AS programs FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));

    COMMIT;
    SELECT @n AS Programs;
END
GO

/* Members see a program as vendor + exact dates, so dates move for the whole batch together. */
CREATE OR ALTER PROCEDURE piv2.Rebate_ChangeBatchDates
    @BatchId   int,
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
    IF NOT EXISTS (SELECT 1 FROM dbo.RebateProgramDetail WHERE BatchID = @BatchId)
        THROW 50716, 'That batch does not exist.', 1;

    BEGIN TRAN;

    DECLARE @before nvarchar(max) =
        (SELECT MIN(ProgramStartWeek) AS startDate, MAX(ProgramEndWeek) AS endDate, MAX(ExpireOn) AS expireOn
           FROM dbo.RebateProgramDetail WITH (UPDLOCK) WHERE BatchID = @BatchId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

    DECLARE @live nvarchar(max) =
        (SELECT STRING_AGG(CAST(ProgramID AS nvarchar(max)), ',') FROM dbo.RebateProgramDetail WHERE BatchID = @BatchId AND Expired = 0);

    IF @live IS NOT NULL
        EXEC piv2.Rebate_ThrowIfOverlap @live, @StartDate, @EndDate;

    UPDATE dbo.RebateProgramDetail
       SET ProgramStartWeek = @StartDate,
           ProgramEndWeek   = @EndDate,
           ExpireOn         = COALESCE(@ExpireOn, ExpireOn)
     WHERE BatchID = @BatchId;

    DECLARE @n int = @@ROWCOUNT;

    INSERT piv2.RebateEvent (EventType, BatchId, Actor, Reason, Detail)
    VALUES ('BATCH_DATES', @BatchId, @Actor, @Reason,
            (SELECT JSON_QUERY(@before) AS [before],
                    JSON_QUERY((SELECT @StartDate AS startDate, @EndDate AS endDate, @ExpireOn AS expireOn FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS [after],
                    @n AS programs
              FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));

    COMMIT;
    SELECT @n AS Programs;
END
GO

/* Amounts and MAP for one program. Claims already submitted keep the amount they were submitted with. */
CREATE OR ALTER PROCEDURE piv2.Rebate_ChangeProgram
    @ProgramId     int,
    @InstantRebate decimal(19,2),
    @VendorShare   decimal(19,2),          -- claimed back from the vendor per unit
    @ProPad        decimal(19,2) = 0,      -- PRO's own money per unit; member amount = share + pad
    @MapPrice      decimal(19,2),
    @Actor         nvarchar(100),
    @Reason        nvarchar(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @ProPad = COALESCE(@ProPad, 0);

    IF NULLIF(LTRIM(RTRIM(@Reason)), N'') IS NULL
        THROW 50702, 'A reason is required.', 1;
    IF @VendorShare IS NULL OR @VendorShare < 0 OR @VendorShare + @ProPad <= 0
        THROW 50719, 'The member amount (vendor share + PRO pad) must be more than zero.', 1;
    IF @InstantRebate < 0 OR @MapPrice < 0 OR @ProPad < 0
        THROW 50720, 'Instant rebate, PRO pad and MAP cannot be negative.', 1;

    BEGIN TRAN;

    DECLARE @batch int, @model int, @before nvarchar(max);
    SELECT @batch = p.BatchID, @model = p.ModelID,
           @before = (SELECT p2.InstantRebate AS instantRebate, p2.Reimbursement AS memberAmount,
                             COALESCE(t.VendorShare, p2.Reimbursement) AS vendorShare, COALESCE(t.ProPad, 0) AS proPad, p2.MAPDrop AS mapPrice
                        FROM dbo.RebateProgramDetail p2
                        LEFT JOIN piv2.RebateProgramTerms t ON t.ProgramId = p2.ProgramID AND t.MemberAmount = ROUND(p2.Reimbursement, 2)
                       WHERE p2.ProgramID = @ProgramId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
      FROM dbo.RebateProgramDetail p WITH (UPDLOCK)
     WHERE p.ProgramID = @ProgramId;

    IF @before IS NULL
        THROW 50721, 'That program does not exist.', 1;

    UPDATE dbo.RebateProgramDetail
       SET InstantRebate = @InstantRebate, Reimbursement = @VendorShare + @ProPad, MAPDrop = @MapPrice
     WHERE ProgramID = @ProgramId;

    /* A row per amount: claims already made at the old amount keep finding the old split. */
    MERGE piv2.RebateProgramTerms AS t
    USING (SELECT @ProgramId AS ProgramId, @VendorShare + @ProPad AS MemberAmount) AS s
       ON t.ProgramId = s.ProgramId AND t.MemberAmount = s.MemberAmount
    WHEN MATCHED THEN UPDATE SET VendorShare = @VendorShare, ProPad = @ProPad, UpdatedBy = @Actor, UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (ProgramId, MemberAmount, ModelId, VendorShare, ProPad, UpdatedBy)
         VALUES (@ProgramId, @VendorShare + @ProPad, @model, @VendorShare, @ProPad, @Actor);

    INSERT piv2.RebateEvent (EventType, BatchId, ProgramId, ModelId, Actor, Reason, Detail)
    VALUES ('PROGRAM_CHANGED', @batch, @ProgramId, @model, @Actor, @Reason,
            (SELECT JSON_QUERY(@before) AS [before],
                    JSON_QUERY((SELECT @InstantRebate AS instantRebate, @VendorShare + @ProPad AS memberAmount,
                                       @VendorShare AS vendorShare, @ProPad AS proPad, @MapPrice AS mapPrice
                                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS [after]
              FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));

    COMMIT;
END
GO

CREATE OR ALTER PROCEDURE piv2.Rebate_SetProgramActive
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

    BEGIN TRAN;

    DECLARE @batch int = (SELECT BatchID FROM dbo.RebateProgramDetail WITH (UPDLOCK) WHERE ProgramID = @ProgramId);
    IF NOT EXISTS (SELECT 1 FROM dbo.RebateProgramDetail WHERE ProgramID = @ProgramId)
        THROW 50721, 'That program does not exist.', 1;

    IF @Active = 1
    BEGIN
        DECLARE @one nvarchar(20) = CAST(@ProgramId AS nvarchar(20));
        EXEC piv2.Rebate_ThrowIfOverlap @one;
    END

    UPDATE dbo.RebateProgramDetail
       SET Expired = CASE WHEN @Active = 1 THEN 0 ELSE 1 END
     WHERE ProgramID = @ProgramId;

    INSERT piv2.RebateEvent (EventType, BatchId, ProgramId, ModelId, Actor, Reason)
    VALUES (CASE WHEN @Active = 1 THEN 'PROGRAM_ON' ELSE 'PROGRAM_OFF' END, @batch, @ProgramId,
            (SELECT ModelID FROM dbo.RebateProgramDetail WHERE ProgramID = @ProgramId), @Actor, @Reason);

    COMMIT;
END
GO

CREATE OR ALTER PROCEDURE piv2.Rebate_History
    @Rail      char(2) = NULL,
    @BatchId   int = NULL,
    @ProgramId int = NULL,
    @UploadId  int = NULL,
    @ModelId   int = NULL,
    @Take      int = 200
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SELECT TOP (CASE WHEN @Take BETWEEN 1 AND 1000 THEN @Take ELSE 200 END)
           e.EventId, e.Rail, e.EventType, e.BatchId, e.ProgramId, e.UploadId, e.RowId, e.TemplateId,
           e.ModelId, m.ModelNumber AS ModelDescription, e.Actor, e.Reason, e.Detail, e.At
      FROM piv2.RebateEvent e
      LEFT JOIN dbo.RebateCameraModels m ON m.ModelID = e.ModelId
     WHERE (@Rail IS NULL OR e.Rail = @Rail)
       AND (@BatchId IS NULL OR e.BatchId = @BatchId)
       AND (@ProgramId IS NULL OR e.ProgramId = @ProgramId)
       AND (@UploadId IS NULL OR e.UploadId = @UploadId)
       AND (@ModelId IS NULL OR e.ModelId = @ModelId)
     ORDER BY e.EventId DESC;
END
GO

SELECT N'procedures ready' AS Result;
