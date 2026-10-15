/*
    Phase 2 · 03  Rebate Desk: products (rebate models), both rails
    Database: PRO_NUKE      Safe to run twice (CREATE OR ALTER).      Run after 02.

    A rebate "product" is a row in dbo.RebateCameraModels, exactly as the
    legacy Add product screen made it:
        VendorID            the rebate vendor (or price-protection vendor)
        ModelNumber         the description members see
        ModelName           the PRO code(s), comma separated; the member site
                            joins it to IVMST for the catalog number
        IsPriceProtection   0 instant rebate, 1 price protection
        Active              0 retired
        SerialNumbersRequired
    and one dbo.RebateCameraModelsDetails row per PRO code it covers.
    Programs point at the model (ModelID), never at a PRO code.

    Stacks: dbo.RebateQualifiers, PROQualifierID = the model that qualifies,
    PROAssociatedID = the model it stacks with.

    PRO codes are looked up in [PRO].dbo.ProductData (same server, as the
    member site's SubmitRebate already does with [PRO].dbo.roster).
*/

USE PRO_NUKE;
GO
SET XACT_ABORT ON;
GO

/* Products for one rail, with their PRO codes and how many programs are live. */
CREATE OR ALTER PROCEDURE piv2.Rebate_Products
    @Rail     char(2) = 'IR',
    @VendorId int = NULL,
    @Q        nvarchar(100) = NULL,      -- description, PRO code or model id
    @Active   bit = NULL,
    @Page     int = 1,
    @PageSize int = 50
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Page = CASE WHEN @Page < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN @PageSize NOT BETWEEN 1 AND 200 THEN 50 ELSE @PageSize END;
    SET @Q = NULLIF(LTRIM(RTRIM(@Q)), N'');

    DECLARE @pp int = CASE WHEN @Rail = 'PP' THEN 1 ELSE 0 END;

    SELECT m.ModelID AS ModelId, m.VendorID AS VendorId, v.VendorName, m.ModelNumber AS Description,
           m.ModelName AS ProCodeText, CAST(COALESCE(m.Active, 0) AS bit) AS IsActive,
           CAST(COALESCE(m.SerialNumbersRequired, 0) AS bit) AS SerialNumbersRequired,
           (SELECT STRING_AGG(CAST(d.ProCode AS nvarchar(20)), N', ') FROM dbo.RebateCameraModelsDetails d WHERE d.ParentModelID = m.ModelID) AS ProCodes,
           CASE WHEN @pp = 1
                THEN (SELECT COUNT(*) FROM dbo.PriceProtectionDetails p WHERE p.ModelID = m.ModelID AND p.Expired = 0)
                ELSE (SELECT COUNT(*) FROM dbo.RebateProgramDetail p WHERE p.ModelID = m.ModelID AND p.Expired = 0) END AS ProgramsLive,
           CASE WHEN @pp = 1
                THEN (SELECT MAX(p.ProgramDate) FROM dbo.PriceProtectionDetails p WHERE p.ModelID = m.ModelID)
                ELSE (SELECT MAX(p.ProgramEndWeek) FROM dbo.RebateProgramDetail p WHERE p.ModelID = m.ModelID) END AS LastProgramDate,
           (SELECT COUNT(*) FROM dbo.RebateQualifiers q WHERE q.PROQualifierID = m.ModelID) AS Stacks,
           COUNT(*) OVER () AS TotalRows
      FROM dbo.RebateCameraModels m
      LEFT JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID
     WHERE m.IsPriceProtection = @pp
       AND (@VendorId IS NULL OR m.VendorID = @VendorId)
       AND (@Active IS NULL OR COALESCE(m.Active, 0) = @Active)
       AND (@Q IS NULL
            OR m.ModelNumber LIKE N'%' + @Q + N'%'
            OR m.ModelName LIKE N'%' + @Q + N'%'
            OR CAST(m.ModelID AS nvarchar(20)) = @Q
            OR EXISTS (SELECT 1 FROM dbo.RebateCameraModelsDetails d
                        WHERE d.ParentModelID = m.ModelID AND CAST(d.ProCode AS nvarchar(20)) = @Q))
     ORDER BY COALESCE(m.Active, 0) DESC, m.ModelNumber
     OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* One product: the model, its PRO codes, its stacks both ways, and its programs. */
CREATE OR ALTER PROCEDURE piv2.Rebate_GetProduct
    @ModelId int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SELECT m.ModelID AS ModelId, m.VendorID AS VendorId, v.VendorName, m.ModelNumber AS Description,
           m.ModelName AS ProCodeText, CAST(COALESCE(m.Active, 0) AS bit) AS IsActive,
           CAST(m.IsPriceProtection AS bit) AS IsPriceProtection,
           CAST(COALESCE(m.SerialNumbersRequired, 0) AS bit) AS SerialNumbersRequired
      FROM dbo.RebateCameraModels m
      LEFT JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID
     WHERE m.ModelID = @ModelId;

    SELECT d.ID AS DetailId, d.ProCode, pd.ModelName AS ProModelName,
           CAST(CASE WHEN pd.ProductCode IS NULL THEN 0 ELSE 1 END AS bit) AS KnownToPro
      FROM dbo.RebateCameraModelsDetails d
      OUTER APPLY (SELECT TOP (1) p.ProductCode, p.ModelName FROM [PRO].dbo.ProductData p
                    WHERE p.ProductCode = CAST(d.ProCode AS varchar(20))) pd
     WHERE d.ParentModelID = @ModelId
     ORDER BY d.ProCode;

    /* Stacks: this product qualifies with ... (Direction OUT), and ... qualify with this product (IN). */
    SELECT 'OUT' AS Direction, q.ID AS QualifierId, m.ModelID AS ModelId, m.ModelNumber AS Description, m.ModelName AS ProCodeText
      FROM dbo.RebateQualifiers q JOIN dbo.RebateCameraModels m ON m.ModelID = q.PROAssociatedID
     WHERE q.PROQualifierID = @ModelId
    UNION ALL
    SELECT 'IN', q.ID, m.ModelID, m.ModelNumber, m.ModelName
      FROM dbo.RebateQualifiers q JOIN dbo.RebateCameraModels m ON m.ModelID = q.PROQualifierID
     WHERE q.PROAssociatedID = @ModelId
     ORDER BY 1, 4;

    IF (SELECT IsPriceProtection FROM dbo.RebateCameraModels WHERE ModelID = @ModelId) = 1
        SELECT p.ProgramID AS ProgramId, NULL AS BatchId, p.Amount AS Reimbursement, p.NewInvoiceCost AS InstantRebate,
               p.NewMap AS MapPrice, p.ProgramDate AS StartDate, CAST(NULL AS datetime) AS EndDate,
               CAST(NULL AS datetime) AS ExpireOn, NULL AS IrType, CAST(NULL AS nvarchar(50)) AS IrTypeName,
               CAST(CASE WHEN p.Expired = 0 THEN 1 ELSE 0 END AS bit) AS IsLive, p.EZPay AS EzPay
          FROM dbo.PriceProtectionDetails p
         WHERE p.ModelID = @ModelId
         ORDER BY p.ProgramDate DESC;
    ELSE
        SELECT p.ProgramID AS ProgramId, p.BatchID AS BatchId, p.Reimbursement, p.InstantRebate,
               p.MAPDrop AS MapPrice, p.ProgramStartWeek AS StartDate, p.ProgramEndWeek AS EndDate,
               p.ExpireOn, p.IRType AS IrType, t.Name AS IrTypeName,
               CAST(CASE WHEN p.Expired = 0 THEN 1 ELSE 0 END AS bit) AS IsLive, CAST(NULL AS money) AS EzPay
          FROM dbo.RebateProgramDetail p
          LEFT JOIN dbo.RebateType t ON t.ID = p.IRType
         WHERE p.ModelID = @ModelId
         ORDER BY p.ProgramStartWeek DESC;
END
GO

/* Typeahead for PRO codes and for existing rebate models. */
CREATE OR ALTER PROCEDURE piv2.Rebate_FindProCodes
    @Q nvarchar(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @Q = NULLIF(LTRIM(RTRIM(@Q)), N'');
    IF @Q IS NULL RETURN;

    SELECT TOP (25) p.ProductCode, p.ModelName,
           CAST(COALESCE(p.IsDiscontinued, 0) AS bit) AS IsDiscontinued,
           (SELECT STRING_AGG(CONCAT(m.ModelID, N' ', m.ModelNumber,
                                     CASE WHEN m.IsPriceProtection = 1 THEN N' (price)' ELSE N' (rebate)' END), N'; ')
              FROM dbo.RebateCameraModelsDetails d JOIN dbo.RebateCameraModels m ON m.ModelID = d.ParentModelID
             WHERE CAST(d.ProCode AS varchar(20)) = p.ProductCode) AS UsedBy
      FROM [PRO].dbo.ProductData p
     WHERE p.ProductCode LIKE @Q + N'%' OR p.ModelName LIKE N'%' + @Q + N'%'
     ORDER BY CASE WHEN p.ProductCode = @Q THEN 0 ELSE 1 END, p.ProductCode;
END
GO

/* ---------------------------------------------------------------
   Create or change a product. @ProCodes: comma list of PRO codes; it
   replaces the product's list. The same description cannot exist twice
   on one rail (the legacy rule, ignoring spaces and case).
   Returns the model id and any PRO codes PRO does not know (allowed,
   but shown as a warning).
   --------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE piv2.Rebate_SaveProduct
    @ModelId               int = NULL,
    @Rail                  char(2),
    @VendorId              int,
    @Description           nvarchar(255),
    @ProCodes              nvarchar(1000),
    @SerialNumbersRequired bit = 0,
    @Actor                 nvarchar(100),
    @Reason                nvarchar(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @pp int = CASE WHEN @Rail = 'PP' THEN 1 ELSE 0 END;
    SET @Description = NULLIF(LTRIM(RTRIM(@Description)), N'');

    IF @Description IS NULL
        THROW 50730, 'A description is required.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.RebateVendors WHERE VendorID = @VendorId AND IsPriceProtection = @pp)
        THROW 50731, 'Pick a vendor from this rail (rebate vendors and price-protection vendors are separate).', 1;
    IF @ModelId IS NOT NULL AND NULLIF(LTRIM(RTRIM(@Reason)), N'') IS NULL
        THROW 50702, 'A reason is required.', 1;

    DECLARE @codes TABLE (ProCode int PRIMARY KEY);
    INSERT @codes
    SELECT DISTINCT TRY_CAST(LTRIM(RTRIM(value)) AS int)
      FROM STRING_SPLIT(COALESCE(@ProCodes, N''), ',')
     WHERE TRY_CAST(LTRIM(RTRIM(value)) AS int) IS NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM @codes)
        THROW 50732, 'At least one PRO code is required.', 1;

    IF EXISTS (SELECT 1 FROM STRING_SPLIT(COALESCE(@ProCodes, N''), ',')
                WHERE NULLIF(LTRIM(RTRIM(value)), N'') IS NOT NULL AND TRY_CAST(LTRIM(RTRIM(value)) AS int) IS NULL)
        THROW 50733, 'PRO codes must be numbers, separated by commas.', 1;

    DECLARE @dupe int =
        (SELECT TOP (1) ModelID FROM dbo.RebateCameraModels
          WHERE IsPriceProtection = @pp
            AND REPLACE(LOWER(ModelNumber), N' ', N'') = REPLACE(LOWER(@Description), N' ', N'')
            AND (@ModelId IS NULL OR ModelID <> @ModelId));
    IF @dupe IS NOT NULL
    BEGIN
        DECLARE @dmsg nvarchar(300) = CONCAT(N'Product ', @dupe, N' already has this description on this rail.');
        THROW 50734, @dmsg, 1;
    END

    /* The same PRO code on two live products of one rail makes uploads ambiguous: refuse adding one.
       (Codes a product already has are left alone, so legacy duplicates do not block an edit.) */
    DECLARE @clash nvarchar(400) =
        (SELECT TOP (1) CONCAT(N'PRO code ', d.ProCode, N' already belongs to product ', m.ModelID, N' (', m.ModelNumber,
                               N'). Remove it there first, or retire that product.')
           FROM dbo.RebateCameraModelsDetails d
           JOIN dbo.RebateCameraModels m ON m.ModelID = d.ParentModelID
           JOIN @codes c ON c.ProCode = d.ProCode
          WHERE m.IsPriceProtection = @pp AND COALESCE(m.Active, 0) = 1
            AND (@ModelId IS NULL OR m.ModelID <> @ModelId)
            AND NOT EXISTS (SELECT 1 FROM dbo.RebateCameraModelsDetails mine
                             WHERE mine.ParentModelID = @ModelId AND mine.ProCode = c.ProCode));
    IF @clash IS NOT NULL
        THROW 50735, @clash, 1;

    DECLARE @codeText nvarchar(255) = (SELECT STRING_AGG(CAST(ProCode AS nvarchar(20)), N',') WITHIN GROUP (ORDER BY ProCode) FROM @codes);

    BEGIN TRAN;

    DECLARE @before nvarchar(max) = NULL;

    IF @ModelId IS NULL
    BEGIN
        INSERT dbo.RebateCameraModels (ModelNumber, ModelName, ModelColor, VendorID, Active, ProductGroupID, IsPriceProtection, OrderID, SerialNumbersRequired)
        VALUES (@Description, @codeText, N'None', @VendorId, 1, NULL, @pp, NULL, CASE WHEN @SerialNumbersRequired = 1 THEN 1 ELSE 0 END);
        SET @ModelId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        SELECT @before = (SELECT m.VendorID AS vendorId, m.ModelNumber AS description, m.ModelName AS proCodes,
                                 m.SerialNumbersRequired AS serialNumbersRequired
                            FROM dbo.RebateCameraModels m WHERE m.ModelID = @ModelId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        IF @before IS NULL
            THROW 50736, 'That product does not exist.', 1;
        IF (SELECT IsPriceProtection FROM dbo.RebateCameraModels WHERE ModelID = @ModelId) <> @pp
            THROW 50737, 'That product belongs to the other rail.', 1;

        UPDATE dbo.RebateCameraModels
           SET VendorID = @VendorId, ModelNumber = @Description, ModelName = @codeText,
               SerialNumbersRequired = CASE WHEN @SerialNumbersRequired = 1 THEN 1 ELSE 0 END
         WHERE ModelID = @ModelId;

        DELETE d FROM dbo.RebateCameraModelsDetails d
         WHERE d.ParentModelID = @ModelId AND d.ProCode NOT IN (SELECT ProCode FROM @codes);
    END

    INSERT dbo.RebateCameraModelsDetails (ParentModelID, ProCode, ProDescription, ProColor)
    SELECT @ModelId, c.ProCode, @Description, @Description
      FROM @codes c
     WHERE NOT EXISTS (SELECT 1 FROM dbo.RebateCameraModelsDetails d WHERE d.ParentModelID = @ModelId AND d.ProCode = c.ProCode);

    UPDATE dbo.RebateCameraModelsDetails SET ProDescription = @Description, ProColor = @Description WHERE ParentModelID = @ModelId;

    INSERT piv2.RebateEvent (Rail, EventType, ModelId, Actor, Reason, Detail)
    VALUES (@Rail, CASE WHEN @before IS NULL THEN 'PRODUCT_ADDED' ELSE 'PRODUCT_CHANGED' END, @ModelId, @Actor, @Reason,
            (SELECT JSON_QUERY(@before) AS [before],
                    JSON_QUERY((SELECT @VendorId AS vendorId, @Description AS description, @codeText AS proCodes,
                                       @SerialNumbersRequired AS serialNumbersRequired FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS [after]
              FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));

    COMMIT;

    SELECT @ModelId AS ModelId,
           (SELECT STRING_AGG(CAST(c.ProCode AS nvarchar(20)), N', ')
              FROM @codes c
             WHERE NOT EXISTS (SELECT 1 FROM [PRO].dbo.ProductData p WHERE p.ProductCode = CAST(c.ProCode AS varchar(20)))) AS UnknownProCodes;
END
GO

/* Retire or reactivate. Retiring is refused while the product has live programs. */
CREATE OR ALTER PROCEDURE piv2.Rebate_SetProductActive
    @ModelId int,
    @Active  bit,
    @Actor   nvarchar(100),
    @Reason  nvarchar(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@Reason)), N'') IS NULL
        THROW 50702, 'A reason is required.', 1;

    DECLARE @pp int = (SELECT IsPriceProtection FROM dbo.RebateCameraModels WHERE ModelID = @ModelId);
    IF @pp IS NULL
        THROW 50736, 'That product does not exist.', 1;

    IF @Active = 0 AND (EXISTS (SELECT 1 FROM dbo.RebateProgramDetail WHERE ModelID = @ModelId AND Expired = 0)
                        OR EXISTS (SELECT 1 FROM dbo.PriceProtectionDetails WHERE ModelID = @ModelId AND Expired = 0))
        THROW 50738, 'This product has live programs. Turn them off first.', 1;

    UPDATE dbo.RebateCameraModels SET Active = CASE WHEN @Active = 1 THEN 1 ELSE 0 END WHERE ModelID = @ModelId;

    INSERT piv2.RebateEvent (Rail, EventType, ModelId, Actor, Reason)
    VALUES (CASE WHEN @pp = 1 THEN 'PP' ELSE 'IR' END, CASE WHEN @Active = 1 THEN 'PRODUCT_ON' ELSE 'PRODUCT_RETIRED' END,
            @ModelId, @Actor, @Reason);
END
GO

/* Replaces the list of products this one stacks with. @StackModelIds: comma list, may be empty. */
CREATE OR ALTER PROCEDURE piv2.Rebate_SetStacks
    @ModelId       int,
    @StackModelIds nvarchar(max),
    @Actor         nvarchar(100),
    @Reason        nvarchar(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @pp int = (SELECT IsPriceProtection FROM dbo.RebateCameraModels WHERE ModelID = @ModelId);
    IF @pp IS NULL
        THROW 50736, 'That product does not exist.', 1;

    DECLARE @ids TABLE (ModelId int PRIMARY KEY);
    INSERT @ids
    SELECT DISTINCT TRY_CAST(value AS int) FROM STRING_SPLIT(COALESCE(@StackModelIds, N''), ',')
     WHERE TRY_CAST(value AS int) IS NOT NULL AND TRY_CAST(value AS int) <> @ModelId;

    IF EXISTS (SELECT 1 FROM @ids i WHERE NOT EXISTS (SELECT 1 FROM dbo.RebateCameraModels m WHERE m.ModelID = i.ModelId))
        THROW 50739, 'One of the stack products does not exist.', 1;

    BEGIN TRAN;

    DECLARE @before nvarchar(max) =
        (SELECT STRING_AGG(CAST(PROAssociatedID AS nvarchar(20)), N',') FROM dbo.RebateQualifiers WITH (UPDLOCK) WHERE PROQualifierID = @ModelId);

    DELETE q FROM dbo.RebateQualifiers q
     WHERE q.PROQualifierID = @ModelId AND q.PROAssociatedID NOT IN (SELECT ModelId FROM @ids);

    INSERT dbo.RebateQualifiers (PROQualifierID, PROAssociatedID, PROAssociatedName)
    SELECT @ModelId, m.ModelID, m.ModelNumber
      FROM @ids i JOIN dbo.RebateCameraModels m ON m.ModelID = i.ModelId
     WHERE NOT EXISTS (SELECT 1 FROM dbo.RebateQualifiers q WHERE q.PROQualifierID = @ModelId AND q.PROAssociatedID = i.ModelId);

    INSERT piv2.RebateEvent (Rail, EventType, ModelId, Actor, Reason, Detail)
    VALUES (CASE WHEN @pp = 1 THEN 'PP' ELSE 'IR' END, 'STACKS_CHANGED', @ModelId, @Actor, @Reason,
            (SELECT @before AS [before], (SELECT STRING_AGG(CAST(ModelId AS nvarchar(20)), N',') FROM @ids) AS [after]
              FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));

    COMMIT;
END
GO

SELECT N'products ready' AS Result;
