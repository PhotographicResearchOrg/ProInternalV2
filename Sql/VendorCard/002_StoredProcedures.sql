-- Stored procedures backing VendorCardController / ProDataAccess.
-- Naming follows the existing PIV2Get.../PIV2Upsert... convention used
-- elsewhere in this codebase (see PIV2GetVendors, PIV2UpdateVendorImage).

-- ===================== Card header + rollups =====================

CREATE OR ALTER PROCEDURE dbo.PIV2GetVendorCard
    @VendorId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        v.VendorId,
        v.Name,
        p.LegalName,
        p.AccountNumber,
        p.RepName,
        ISNULL(p.IsActive, 1)  AS IsActive,
        ISNULL(p.OnWeb, 0)     AS OnWeb
    FROM dbo.Vendor v
    LEFT JOIN dbo.VendorProfile p ON p.VendorId = v.VendorId
    WHERE v.VendorId = @VendorId;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2GetVendorBrands
    @VendorId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT VendorBrandId, VendorId, BrandName, SortOrder
    FROM dbo.VendorBrand
    WHERE VendorId = @VendorId
    ORDER BY SortOrder, BrandName;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2AddVendorBrand
    @VendorId INT,
    @BrandName NVARCHAR(150),
    @SortOrder INT = 0
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.VendorBrand (VendorId, BrandName, SortOrder)
    VALUES (@VendorId, @BrandName, @SortOrder);

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS VendorBrandId;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2GetVendorStats
    @VendorId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        (SELECT COUNT(*) FROM dbo.VendorContract c WHERE c.VendorId = @VendorId AND c.Status = 'active')  AS ActiveContracts,
        (SELECT COUNT(*) FROM dbo.VendorPriceList l WHERE l.VendorId = @VendorId)                          AS PriceListCount,
        (SELECT COUNT(*) FROM dbo.VendorCardContact ct
            JOIN dbo.VendorContactGroup g ON g.VendorContactGroupId = ct.VendorContactGroupId
            WHERE g.VendorId = @VendorId)                                                                  AS ContactCount,
        (SELECT MAX(ChangedAt) FROM dbo.EntityAuditLog
            WHERE EntityType = 'Vendor' AND EntityId = @VendorId)                                          AS LastChangeAt;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2ToggleVendorActive
    @VendorId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.VendorProfile WHERE VendorId = @VendorId)
        INSERT INTO dbo.VendorProfile (VendorId, IsActive) VALUES (@VendorId, 0);
    ELSE
        UPDATE dbo.VendorProfile
        SET IsActive = ~IsActive, UpdatedAt = SYSUTCDATETIME()
        WHERE VendorId = @VendorId;
END
GO

-- ===================== Terms & Financials =====================

CREATE OR ALTER PROCEDURE dbo.PIV2GetVendorTerms
    @VendorId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM dbo.VendorTerms WHERE VendorId = @VendorId;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2UpsertVendorTerms
    @VendorId INT,
    @ProDiscountPct DECIMAL(5,2) = NULL,
    @MemberDiscountPct DECIMAL(5,2) = NULL,
    @PaymentTerms NVARCHAR(100) = NULL,
    @TermsBasis NVARCHAR(100) = NULL,
    @EarlyPayDiscountText NVARCHAR(100) = NULL,
    @CreditLimit DECIMAL(14,2) = NULL,
    @Currency NVARCHAR(10) = NULL,
    @TaxStatus NVARCHAR(100) = NULL,
    @RemitMethod NVARCHAR(50) = NULL,
    @MinimumOrder DECIMAL(14,2) = NULL,
    @FobPoint NVARCHAR(50) = NULL,
    @DefaultMarkup DECIMAL(6,3) = NULL,
    @VolumeRebateText NVARCHAR(200) = NULL,
    @PriceProtectionDays INT = NULL,
    @DropShipEnabled BIT = 0,
    @PrimaryCategory NVARCHAR(150) = NULL,
    @CountryOfOrigin NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.VendorTerms WHERE VendorId = @VendorId)
        UPDATE dbo.VendorTerms SET
            ProDiscountPct = @ProDiscountPct, MemberDiscountPct = @MemberDiscountPct,
            PaymentTerms = @PaymentTerms, TermsBasis = @TermsBasis,
            EarlyPayDiscountText = @EarlyPayDiscountText, CreditLimit = @CreditLimit,
            Currency = @Currency, TaxStatus = @TaxStatus, RemitMethod = @RemitMethod,
            MinimumOrder = @MinimumOrder, FobPoint = @FobPoint, DefaultMarkup = @DefaultMarkup,
            VolumeRebateText = @VolumeRebateText, PriceProtectionDays = @PriceProtectionDays,
            DropShipEnabled = @DropShipEnabled, PrimaryCategory = @PrimaryCategory,
            CountryOfOrigin = @CountryOfOrigin
        WHERE VendorId = @VendorId;
    ELSE
        INSERT INTO dbo.VendorTerms (
            VendorId, ProDiscountPct, MemberDiscountPct, PaymentTerms, TermsBasis,
            EarlyPayDiscountText, CreditLimit, Currency, TaxStatus, RemitMethod,
            MinimumOrder, FobPoint, DefaultMarkup, VolumeRebateText, PriceProtectionDays,
            DropShipEnabled, PrimaryCategory, CountryOfOrigin
        ) VALUES (
            @VendorId, @ProDiscountPct, @MemberDiscountPct, @PaymentTerms, @TermsBasis,
            @EarlyPayDiscountText, @CreditLimit, @Currency, @TaxStatus, @RemitMethod,
            @MinimumOrder, @FobPoint, @DefaultMarkup, @VolumeRebateText, @PriceProtectionDays,
            @DropShipEnabled, @PrimaryCategory, @CountryOfOrigin
        );
END
GO

-- ===================== Contacts =====================

CREATE OR ALTER PROCEDURE dbo.PIV2AddVendorContactGroup
    @VendorId INT,
    @GroupName NVARCHAR(150),
    @SortOrder INT = 0
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.VendorContactGroup (VendorId, GroupName, SortOrder)
    VALUES (@VendorId, @GroupName, @SortOrder);

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS VendorContactGroupId;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2GetVendorContacts
    @VendorId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT g.VendorContactGroupId, g.VendorId, g.GroupName, g.SortOrder AS GroupSortOrder,
           c.VendorContactId, c.Name AS ContactName, c.Title, c.Email, c.Phone, c.IsPrimary
    FROM dbo.VendorContactGroup g
    LEFT JOIN dbo.VendorCardContact c ON c.VendorContactGroupId = g.VendorContactGroupId
    WHERE g.VendorId = @VendorId
    ORDER BY g.SortOrder, g.GroupName, c.IsPrimary DESC, c.Name;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2AddVendorContact
    @VendorContactGroupId INT,
    @Name NVARCHAR(150),
    @Title NVARCHAR(150) = NULL,
    @Email NVARCHAR(200) = NULL,
    @Phone NVARCHAR(50) = NULL,
    @IsPrimary BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.VendorCardContact (VendorContactGroupId, Name, Title, Email, Phone, IsPrimary)
    VALUES (@VendorContactGroupId, @Name, @Title, @Email, @Phone, @IsPrimary);

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS VendorContactId;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2UpdateVendorContact
    @VendorContactId INT,
    @Name NVARCHAR(150),
    @Title NVARCHAR(150) = NULL,
    @Email NVARCHAR(200) = NULL,
    @Phone NVARCHAR(50) = NULL,
    @IsPrimary BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.VendorCardContact
    SET Name = @Name, Title = @Title, Email = @Email, Phone = @Phone, IsPrimary = @IsPrimary
    WHERE VendorContactId = @VendorContactId;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2DeleteVendorContact
    @VendorContactId INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.VendorCardContact WHERE VendorContactId = @VendorContactId;
END
GO

-- ===================== Contracts =====================

CREATE OR ALTER PROCEDURE dbo.PIV2GetVendorContracts
    @VendorId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT VendorContractId, VendorId, Name, ContractType, StartDate, EndDate, ValueText, Status
    FROM dbo.VendorContract
    WHERE VendorId = @VendorId
    ORDER BY StartDate DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2AddVendorContract
    @VendorId INT,
    @Name NVARCHAR(200),
    @ContractType NVARCHAR(100) = NULL,
    @StartDate DATE = NULL,
    @EndDate DATE = NULL,
    @ValueText NVARCHAR(100) = NULL,
    @Status NVARCHAR(30) = 'draft'
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.VendorContract (VendorId, Name, ContractType, StartDate, EndDate, ValueText, Status)
    VALUES (@VendorId, @Name, @ContractType, @StartDate, @EndDate, @ValueText, @Status);

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS VendorContractId;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2UpdateVendorContract
    @VendorContractId INT,
    @Name NVARCHAR(200),
    @ContractType NVARCHAR(100) = NULL,
    @StartDate DATE = NULL,
    @EndDate DATE = NULL,
    @ValueText NVARCHAR(100) = NULL,
    @Status NVARCHAR(30) = 'draft'
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.VendorContract SET
        Name = @Name, ContractType = @ContractType, StartDate = @StartDate,
        EndDate = @EndDate, ValueText = @ValueText, Status = @Status
    WHERE VendorContractId = @VendorContractId;
END
GO

-- ===================== Price lists =====================

CREATE OR ALTER PROCEDURE dbo.PIV2GetVendorPriceLists
    @VendorId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT VendorPriceListId, VendorId, Name, EffectiveDate, ExpirationDate, SkuCount, Currency, Status
    FROM dbo.VendorPriceList
    WHERE VendorId = @VendorId
    ORDER BY EffectiveDate DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2AddVendorPriceList
    @VendorId INT,
    @Name NVARCHAR(200),
    @EffectiveDate DATE = NULL,
    @ExpirationDate DATE = NULL,
    @SkuCount INT = 0,
    @Currency NVARCHAR(10) = 'USD',
    @Status NVARCHAR(30) = 'draft'
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.VendorPriceList (VendorId, Name, EffectiveDate, ExpirationDate, SkuCount, Currency, Status)
    VALUES (@VendorId, @Name, @EffectiveDate, @ExpirationDate, @SkuCount, @Currency, @Status);

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS VendorPriceListId;
END
GO

-- ===================== Policies =====================

CREATE OR ALTER PROCEDURE dbo.PIV2GetVendorFreightPolicy
    @VendorId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM dbo.VendorFreightPolicy WHERE VendorId = @VendorId;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2UpsertVendorFreightPolicy
    @VendorId INT,
    @FreightTerms NVARCHAR(100) = NULL,
    @FobPoint NVARCHAR(50) = NULL,
    @Carrier NVARCHAR(150) = NULL,
    @PrepaidThreshold DECIMAL(14,2) = NULL,
    @FuelSurcharge NVARCHAR(100) = NULL,
    @LeadTimeText NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.VendorFreightPolicy WHERE VendorId = @VendorId)
        UPDATE dbo.VendorFreightPolicy SET
            FreightTerms = @FreightTerms, FobPoint = @FobPoint, Carrier = @Carrier,
            PrepaidThreshold = @PrepaidThreshold, FuelSurcharge = @FuelSurcharge, LeadTimeText = @LeadTimeText
        WHERE VendorId = @VendorId;
    ELSE
        INSERT INTO dbo.VendorFreightPolicy (VendorId, FreightTerms, FobPoint, Carrier, PrepaidThreshold, FuelSurcharge, LeadTimeText)
        VALUES (@VendorId, @FreightTerms, @FobPoint, @Carrier, @PrepaidThreshold, @FuelSurcharge, @LeadTimeText);
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2GetVendorShippingPolicy
    @VendorId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM dbo.VendorShippingPolicy WHERE VendorId = @VendorId;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2UpsertVendorShippingPolicy
    @VendorId INT,
    @FreeFreightThreshold DECIMAL(14,2) = NULL,
    @AppliesTo NVARCHAR(150) = NULL,
    @ProTierOverride DECIMAL(14,2) = NULL,
    @Excludes NVARCHAR(200) = NULL,
    @StacksWithPromos BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.VendorShippingPolicy WHERE VendorId = @VendorId)
        UPDATE dbo.VendorShippingPolicy SET
            FreeFreightThreshold = @FreeFreightThreshold, AppliesTo = @AppliesTo,
            ProTierOverride = @ProTierOverride, Excludes = @Excludes, StacksWithPromos = @StacksWithPromos
        WHERE VendorId = @VendorId;
    ELSE
        INSERT INTO dbo.VendorShippingPolicy (VendorId, FreeFreightThreshold, AppliesTo, ProTierOverride, Excludes, StacksWithPromos)
        VALUES (@VendorId, @FreeFreightThreshold, @AppliesTo, @ProTierOverride, @Excludes, @StacksWithPromos);
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2GetVendorReturnPolicy
    @VendorId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM dbo.VendorReturnPolicy WHERE VendorId = @VendorId;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2UpsertVendorReturnPolicy
    @VendorId INT,
    @ReturnWindowDays INT = NULL,
    @RestockingFeePct DECIMAL(5,2) = NULL,
    @RmaRequired BIT = 1,
    @ReturnFreightText NVARCHAR(100) = NULL,
    @DefectiveHandlingText NVARCHAR(200) = NULL,
    @NonReturnableText NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.VendorReturnPolicy WHERE VendorId = @VendorId)
        UPDATE dbo.VendorReturnPolicy SET
            ReturnWindowDays = @ReturnWindowDays, RestockingFeePct = @RestockingFeePct,
            RmaRequired = @RmaRequired, ReturnFreightText = @ReturnFreightText,
            DefectiveHandlingText = @DefectiveHandlingText, NonReturnableText = @NonReturnableText
        WHERE VendorId = @VendorId;
    ELSE
        INSERT INTO dbo.VendorReturnPolicy (VendorId, ReturnWindowDays, RestockingFeePct, RmaRequired, ReturnFreightText, DefectiveHandlingText, NonReturnableText)
        VALUES (@VendorId, @ReturnWindowDays, @RestockingFeePct, @RmaRequired, @ReturnFreightText, @DefectiveHandlingText, @NonReturnableText);
END
GO

-- ===================== Instant rebates =====================

CREATE OR ALTER PROCEDURE dbo.PIV2GetVendorRebatePrograms
    @VendorId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT VendorRebateProgramId, VendorId, Name, Code, AmountText, Eligibility, ScopeText,
           WindowText, Funding, ClaimMethod, Status, IsWebVisible, BudgetAmount, RebatedAmount, RedemptionCount
    FROM dbo.VendorRebateProgram
    WHERE VendorId = @VendorId
    ORDER BY
        CASE Status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'expired' THEN 2 ELSE 3 END,
        Name;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2AddVendorRebateProgram
    @VendorId INT,
    @Name NVARCHAR(200),
    @Code NVARCHAR(50) = NULL,
    @AmountText NVARCHAR(100) = NULL,
    @Eligibility NVARCHAR(20) = 'all',
    @ScopeText NVARCHAR(200) = NULL,
    @WindowText NVARCHAR(100) = NULL,
    @Funding NVARCHAR(100) = NULL,
    @ClaimMethod NVARCHAR(100) = NULL,
    @Status NVARCHAR(30) = 'draft',
    @IsWebVisible BIT = 0,
    @BudgetAmount DECIMAL(14,2) = 0
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.VendorRebateProgram (
        VendorId, Name, Code, AmountText, Eligibility, ScopeText, WindowText,
        Funding, ClaimMethod, Status, IsWebVisible, BudgetAmount
    ) VALUES (
        @VendorId, @Name, @Code, @AmountText, @Eligibility, @ScopeText, @WindowText,
        @Funding, @ClaimMethod, @Status, @IsWebVisible, @BudgetAmount
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS VendorRebateProgramId;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2UpdateVendorRebateProgram
    @VendorRebateProgramId INT,
    @Name NVARCHAR(200),
    @Code NVARCHAR(50) = NULL,
    @AmountText NVARCHAR(100) = NULL,
    @Eligibility NVARCHAR(20) = 'all',
    @ScopeText NVARCHAR(200) = NULL,
    @WindowText NVARCHAR(100) = NULL,
    @Funding NVARCHAR(100) = NULL,
    @ClaimMethod NVARCHAR(100) = NULL,
    @Status NVARCHAR(30) = 'draft',
    @IsWebVisible BIT = 0,
    @BudgetAmount DECIMAL(14,2) = 0
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.VendorRebateProgram SET
        Name = @Name, Code = @Code, AmountText = @AmountText, Eligibility = @Eligibility,
        ScopeText = @ScopeText, WindowText = @WindowText, Funding = @Funding,
        ClaimMethod = @ClaimMethod, Status = @Status, IsWebVisible = @IsWebVisible,
        BudgetAmount = @BudgetAmount
    WHERE VendorRebateProgramId = @VendorRebateProgramId;
END
GO

-- ===================== Custom fields =====================
-- Moved to 004_CustomFieldProcedures.sql (definition / value split).

-- ===================== Generic audit log =====================

CREATE OR ALTER PROCEDURE dbo.PIV2GetEntityAuditLog
    @EntityType NVARCHAR(50),
    @EntityId INT,
    @Take INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (@Take) EntityAuditLogId, EntityType, EntityId, Section, FieldName, OldValue, NewValue, ChangedBy, ChangedAt
    FROM dbo.EntityAuditLog
    WHERE EntityType = @EntityType AND EntityId = @EntityId
    ORDER BY ChangedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2InsertEntityAuditLog
    @EntityType NVARCHAR(50),
    @EntityId INT,
    @Section NVARCHAR(50) = NULL,
    @FieldName NVARCHAR(150) = NULL,
    @OldValue NVARCHAR(500) = NULL,
    @NewValue NVARCHAR(500) = NULL,
    @ChangedBy NVARCHAR(150) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.EntityAuditLog (EntityType, EntityId, Section, FieldName, OldValue, NewValue, ChangedBy)
    VALUES (@EntityType, @EntityId, @Section, @FieldName, @OldValue, @NewValue, @ChangedBy);
END
GO
