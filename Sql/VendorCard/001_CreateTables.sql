-- Vendor Card schema
-- New tables backing the vendor-card page. The existing Vendor table
-- (VendorId, Name, BillingTerms, Address) is left untouched; everything
-- here is an extension keyed on VendorId.
--
-- Note: dbo.VendorContact already existed in this database as an unrelated
-- lookup table (ContactType int, ContactDescription nvarchar) with 6 rows.
-- The per-vendor contact-person table below is named VendorCardContact to
-- stay out of its way.
--
-- Every CREATE is guarded so this script is safe to re-run (idempotent) --
-- useful given the above collision already caused one partial apply.
--
-- Run this against the ProConnectionString database before running
-- 002_StoredProcedures.sql. Not auto-applied by the app (no EF Core
-- migrations are used in this project).

IF OBJECT_ID('dbo.VendorProfile', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VendorProfile (
        VendorId        INT             NOT NULL PRIMARY KEY,
        LegalName       NVARCHAR(200)   NULL,
        AccountNumber   NVARCHAR(50)    NULL,
        RepName         NVARCHAR(150)   NULL,
        IsActive        BIT             NOT NULL CONSTRAINT DF_VendorProfile_IsActive DEFAULT (1),
        OnWeb           BIT             NOT NULL CONSTRAINT DF_VendorProfile_OnWeb DEFAULT (0),
        UpdatedAt       DATETIME2       NOT NULL CONSTRAINT DF_VendorProfile_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedBy       NVARCHAR(150)   NULL,
        CONSTRAINT FK_VendorProfile_Vendor FOREIGN KEY (VendorId) REFERENCES dbo.Vendor (VendorId)
    );
END
GO

IF OBJECT_ID('dbo.VendorBrand', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VendorBrand (
        VendorBrandId   INT IDENTITY(1,1) PRIMARY KEY,
        VendorId        INT             NOT NULL,
        BrandName       NVARCHAR(150)   NOT NULL,
        SortOrder       INT             NOT NULL CONSTRAINT DF_VendorBrand_SortOrder DEFAULT (0),
        CONSTRAINT FK_VendorBrand_Vendor FOREIGN KEY (VendorId) REFERENCES dbo.Vendor (VendorId)
    );
END
GO

IF OBJECT_ID('dbo.VendorTerms', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VendorTerms (
        VendorId              INT           NOT NULL PRIMARY KEY,
        ProDiscountPct        DECIMAL(5,2)  NULL,
        MemberDiscountPct     DECIMAL(5,2)  NULL,
        PaymentTerms          NVARCHAR(100) NULL,
        TermsBasis            NVARCHAR(100) NULL,
        EarlyPayDiscountText  NVARCHAR(100) NULL,
        CreditLimit           DECIMAL(14,2) NULL,
        Currency              NVARCHAR(10)  NULL,
        TaxStatus             NVARCHAR(100) NULL,
        RemitMethod           NVARCHAR(50)  NULL,
        MinimumOrder          DECIMAL(14,2) NULL,
        FobPoint              NVARCHAR(50)  NULL,
        DefaultMarkup         DECIMAL(6,3)  NULL,
        VolumeRebateText      NVARCHAR(200) NULL,
        PriceProtectionDays   INT           NULL,
        DropShipEnabled       BIT           NOT NULL CONSTRAINT DF_VendorTerms_DropShip DEFAULT (0),
        PrimaryCategory       NVARCHAR(150) NULL,
        CountryOfOrigin       NVARCHAR(100) NULL,
        CONSTRAINT FK_VendorTerms_Vendor FOREIGN KEY (VendorId) REFERENCES dbo.Vendor (VendorId)
    );
END
GO

IF OBJECT_ID('dbo.VendorContactGroup', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VendorContactGroup (
        VendorContactGroupId INT IDENTITY(1,1) PRIMARY KEY,
        VendorId              INT           NOT NULL,
        GroupName             NVARCHAR(150) NOT NULL,
        SortOrder             INT           NOT NULL CONSTRAINT DF_VendorContactGroup_SortOrder DEFAULT (0),
        CONSTRAINT FK_VendorContactGroup_Vendor FOREIGN KEY (VendorId) REFERENCES dbo.Vendor (VendorId)
    );
END
GO

-- Named VendorCardContact (not VendorContact) -- dbo.VendorContact already
-- exists in this database as an unrelated ContactType/ContactDescription
-- lookup table and must not be touched.
IF OBJECT_ID('dbo.VendorCardContact', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VendorCardContact (
        VendorContactId       INT IDENTITY(1,1) PRIMARY KEY,
        VendorContactGroupId  INT           NOT NULL,
        Name                  NVARCHAR(150) NOT NULL,
        Title                 NVARCHAR(150) NULL,
        Email                 NVARCHAR(200) NULL,
        Phone                 NVARCHAR(50)  NULL,
        IsPrimary             BIT           NOT NULL CONSTRAINT DF_VendorCardContact_IsPrimary DEFAULT (0),
        CONSTRAINT FK_VendorCardContact_Group FOREIGN KEY (VendorContactGroupId) REFERENCES dbo.VendorContactGroup (VendorContactGroupId)
    );
END
GO

IF OBJECT_ID('dbo.VendorContract', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VendorContract (
        VendorContractId INT IDENTITY(1,1) PRIMARY KEY,
        VendorId         INT           NOT NULL,
        Name             NVARCHAR(200) NOT NULL,
        ContractType     NVARCHAR(100) NULL,
        StartDate        DATE          NULL,
        EndDate          DATE          NULL,
        ValueText        NVARCHAR(100) NULL,
        Status           NVARCHAR(30)  NOT NULL CONSTRAINT DF_VendorContract_Status DEFAULT ('draft'),
        CONSTRAINT FK_VendorContract_Vendor FOREIGN KEY (VendorId) REFERENCES dbo.Vendor (VendorId)
    );
END
GO

IF OBJECT_ID('dbo.VendorPriceList', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VendorPriceList (
        VendorPriceListId INT IDENTITY(1,1) PRIMARY KEY,
        VendorId          INT           NOT NULL,
        Name              NVARCHAR(200) NOT NULL,
        EffectiveDate     DATE          NULL,
        ExpirationDate    DATE          NULL,
        SkuCount          INT           NOT NULL CONSTRAINT DF_VendorPriceList_SkuCount DEFAULT (0),
        Currency          NVARCHAR(10)  NOT NULL CONSTRAINT DF_VendorPriceList_Currency DEFAULT ('USD'),
        Status            NVARCHAR(30)  NOT NULL CONSTRAINT DF_VendorPriceList_Status DEFAULT ('draft'),
        CONSTRAINT FK_VendorPriceList_Vendor FOREIGN KEY (VendorId) REFERENCES dbo.Vendor (VendorId)
    );
END
GO

IF OBJECT_ID('dbo.VendorFreightPolicy', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VendorFreightPolicy (
        VendorId         INT           NOT NULL PRIMARY KEY,
        FreightTerms     NVARCHAR(100) NULL,
        FobPoint         NVARCHAR(50)  NULL,
        Carrier          NVARCHAR(150) NULL,
        PrepaidThreshold DECIMAL(14,2) NULL,
        FuelSurcharge    NVARCHAR(100) NULL,
        LeadTimeText     NVARCHAR(100) NULL,
        CONSTRAINT FK_VendorFreightPolicy_Vendor FOREIGN KEY (VendorId) REFERENCES dbo.Vendor (VendorId)
    );
END
GO

IF OBJECT_ID('dbo.VendorShippingPolicy', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VendorShippingPolicy (
        VendorId            INT           NOT NULL PRIMARY KEY,
        FreeFreightThreshold DECIMAL(14,2) NULL,
        AppliesTo           NVARCHAR(150) NULL,
        ProTierOverride     DECIMAL(14,2) NULL,
        Excludes            NVARCHAR(200) NULL,
        StacksWithPromos    BIT           NOT NULL CONSTRAINT DF_VendorShippingPolicy_Stacks DEFAULT (0),
        CONSTRAINT FK_VendorShippingPolicy_Vendor FOREIGN KEY (VendorId) REFERENCES dbo.Vendor (VendorId)
    );
END
GO

IF OBJECT_ID('dbo.VendorReturnPolicy', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VendorReturnPolicy (
        VendorId               INT           NOT NULL PRIMARY KEY,
        ReturnWindowDays       INT           NULL,
        RestockingFeePct       DECIMAL(5,2)  NULL,
        RmaRequired            BIT           NOT NULL CONSTRAINT DF_VendorReturnPolicy_Rma DEFAULT (1),
        ReturnFreightText      NVARCHAR(100) NULL,
        DefectiveHandlingText  NVARCHAR(200) NULL,
        NonReturnableText      NVARCHAR(200) NULL,
        CONSTRAINT FK_VendorReturnPolicy_Vendor FOREIGN KEY (VendorId) REFERENCES dbo.Vendor (VendorId)
    );
END
GO

IF OBJECT_ID('dbo.VendorRebateProgram', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VendorRebateProgram (
        VendorRebateProgramId INT IDENTITY(1,1) PRIMARY KEY,
        VendorId              INT           NOT NULL,
        Name                  NVARCHAR(200) NOT NULL,
        Code                  NVARCHAR(50)  NULL,
        AmountText            NVARCHAR(100) NULL,
        Eligibility           NVARCHAR(20)  NOT NULL CONSTRAINT DF_VendorRebateProgram_Elig DEFAULT ('all'),
        ScopeText             NVARCHAR(200) NULL,
        WindowText            NVARCHAR(100) NULL,
        Funding               NVARCHAR(100) NULL,
        ClaimMethod           NVARCHAR(100) NULL,
        Status                NVARCHAR(30)  NOT NULL CONSTRAINT DF_VendorRebateProgram_Status DEFAULT ('draft'),
        IsWebVisible          BIT           NOT NULL CONSTRAINT DF_VendorRebateProgram_Web DEFAULT (0),
        BudgetAmount          DECIMAL(14,2) NOT NULL CONSTRAINT DF_VendorRebateProgram_Budget DEFAULT (0),
        RebatedAmount         DECIMAL(14,2) NOT NULL CONSTRAINT DF_VendorRebateProgram_Rebated DEFAULT (0),
        RedemptionCount       INT           NOT NULL CONSTRAINT DF_VendorRebateProgram_Redemptions DEFAULT (0),
        CONSTRAINT FK_VendorRebateProgram_Vendor FOREIGN KEY (VendorId) REFERENCES dbo.Vendor (VendorId)
    );
END
GO

IF OBJECT_ID('dbo.VendorCustomField', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VendorCustomField (
        VendorCustomFieldId INT IDENTITY(1,1) PRIMARY KEY,
        VendorId            INT           NOT NULL,
        Section             NVARCHAR(50)  NOT NULL,
        Label               NVARCHAR(150) NOT NULL,
        DataType            NVARCHAR(30)  NOT NULL CONSTRAINT DF_VendorCustomField_DataType DEFAULT ('Text'),
        Value               NVARCHAR(500) NULL,
        IsPublishable       BIT           NOT NULL CONSTRAINT DF_VendorCustomField_Publishable DEFAULT (0),
        CONSTRAINT FK_VendorCustomField_Vendor FOREIGN KEY (VendorId) REFERENCES dbo.Vendor (VendorId)
    );
END
GO

-- Generic audit trail, intentionally not vendor-only (EntityType/EntityId)
-- so other features can reuse it instead of rolling ad hoc audit inserts.
IF OBJECT_ID('dbo.EntityAuditLog', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EntityAuditLog (
        EntityAuditLogId BIGINT IDENTITY(1,1) PRIMARY KEY,
        EntityType       NVARCHAR(50)   NOT NULL,
        EntityId         INT            NOT NULL,
        Section          NVARCHAR(50)   NULL,
        FieldName        NVARCHAR(150)  NULL,
        OldValue         NVARCHAR(500)  NULL,
        NewValue         NVARCHAR(500)  NULL,
        ChangedBy        NVARCHAR(150)  NULL,
        ChangedAt        DATETIME2      NOT NULL CONSTRAINT DF_EntityAuditLog_ChangedAt DEFAULT (SYSUTCDATETIME())
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VendorBrand_VendorId' AND object_id = OBJECT_ID('dbo.VendorBrand'))
    CREATE INDEX IX_VendorBrand_VendorId ON dbo.VendorBrand (VendorId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VendorContactGroup_VendorId' AND object_id = OBJECT_ID('dbo.VendorContactGroup'))
    CREATE INDEX IX_VendorContactGroup_VendorId ON dbo.VendorContactGroup (VendorId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VendorCardContact_GroupId' AND object_id = OBJECT_ID('dbo.VendorCardContact'))
    CREATE INDEX IX_VendorCardContact_GroupId ON dbo.VendorCardContact (VendorContactGroupId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VendorContract_VendorId' AND object_id = OBJECT_ID('dbo.VendorContract'))
    CREATE INDEX IX_VendorContract_VendorId ON dbo.VendorContract (VendorId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VendorPriceList_VendorId' AND object_id = OBJECT_ID('dbo.VendorPriceList'))
    CREATE INDEX IX_VendorPriceList_VendorId ON dbo.VendorPriceList (VendorId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VendorRebateProgram_VendorId' AND object_id = OBJECT_ID('dbo.VendorRebateProgram'))
    CREATE INDEX IX_VendorRebateProgram_VendorId ON dbo.VendorRebateProgram (VendorId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VendorCustomField_VendorId' AND object_id = OBJECT_ID('dbo.VendorCustomField'))
    CREATE INDEX IX_VendorCustomField_VendorId ON dbo.VendorCustomField (VendorId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EntityAuditLog_Entity' AND object_id = OBJECT_ID('dbo.EntityAuditLog'))
    CREATE INDEX IX_EntityAuditLog_Entity ON dbo.EntityAuditLog (EntityType, EntityId, ChangedAt DESC);
GO
