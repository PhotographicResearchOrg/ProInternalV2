-- Create vendor.
--
-- Backs POST api/VendorCard (VendorCardController.CreateVendor). Field set
-- follows the canonical vendor contract in
-- Schemas/OrderIntegration/v1.0/vendors/vendor.schema.json: required are
-- vendorId, vendor.name, vendor.status and terms.currency; the rest is
-- optional.
--
-- 1. VendorProfile gains the contract fields dbo.Vendor has no column for
--    (shortName, category, notes, MAIN address country) plus CreatedAt /
--    CreatedBy. A non-NULL CreatedAt marks a vendor created in PRO.
-- 2. PIV2CreateVendor inserts dbo.Vendor + dbo.VendorProfile. dbo.Vendor.
--    VendorId is not an IDENTITY, so when no id is supplied the next free id
--    below 9000 is taken (9000+ holds internal rows such as 9999 PRO).
-- 3. PIV2GetVendors now starts from dbo.Vendor so PRO-created vendors (not
--    yet in the Computyme mirror EDA.APMST.APMST) appear in the vendor grid.
--    Legacy vendors that were never in APMST stay hidden as before. Columns
--    are aliased to the Vendor model's property names (CITY_ST/SH_NAME never
--    bound to CityState/ShortName).
--
-- Safe to re-run. Run after 001-005.

IF COL_LENGTH('dbo.VendorProfile', 'ShortName') IS NULL
    ALTER TABLE dbo.VendorProfile ADD ShortName NVARCHAR(100) NULL;
GO
IF COL_LENGTH('dbo.VendorProfile', 'Category') IS NULL
    ALTER TABLE dbo.VendorProfile ADD Category NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.VendorProfile', 'Notes') IS NULL
    ALTER TABLE dbo.VendorProfile ADD Notes NVARCHAR(2000) NULL;
GO
IF COL_LENGTH('dbo.VendorProfile', 'Country') IS NULL
    ALTER TABLE dbo.VendorProfile ADD Country NCHAR(2) NULL;
GO
IF COL_LENGTH('dbo.VendorProfile', 'CreatedAt') IS NULL
    ALTER TABLE dbo.VendorProfile ADD CreatedAt DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.VendorProfile', 'CreatedBy') IS NULL
    ALTER TABLE dbo.VendorProfile ADD CreatedBy NVARCHAR(150) NULL;
GO

-- Returns the new VendorId, or -1 when @VendorId is already taken.
-- Joins the caller's transaction when there is one (ProDataAccess.CreateVendor
-- adds terms + contact in the same transaction), otherwise opens its own.
CREATE OR ALTER PROCEDURE dbo.PIV2CreateVendor
    @VendorId      INT = NULL,
    @Name          VARCHAR(200),
    @IsActive      BIT = 1,
    @LegalName     NVARCHAR(200) = NULL,
    @ShortName     NVARCHAR(100) = NULL,
    @Category      NVARCHAR(50) = NULL,
    @AccountNumber NVARCHAR(50) = NULL,
    @RepName       NVARCHAR(150) = NULL,
    @Website       VARCHAR(100) = NULL,
    @Notes         NVARCHAR(2000) = NULL,
    @Address       VARCHAR(100) = NULL,
    @City          VARCHAR(50) = NULL,
    @State         VARCHAR(50) = NULL,
    @Zip           VARCHAR(50) = NULL,
    @Country       NCHAR(2) = NULL,
    @Phone         VARCHAR(50) = NULL,
    @CreatedBy     NVARCHAR(150) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @OwnTran BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;
    IF @OwnTran = 1 BEGIN TRAN;

    IF @VendorId IS NULL
    BEGIN
        -- range lock so two concurrent creates can't pick the same id
        SELECT @VendorId = ISNULL(MAX(VendorId), 0) + 1
        FROM dbo.Vendor WITH (UPDLOCK, HOLDLOCK)
        WHERE VendorId < 9000;

        IF @VendorId >= 9000
            THROW 50001, 'No free vendor ids below 9000; supply a vendor number.', 1;
    END
    ELSE IF EXISTS (SELECT 1 FROM dbo.Vendor WITH (UPDLOCK, HOLDLOCK) WHERE VendorId = @VendorId)
    BEGIN
        -- nothing written yet; just release our own transaction if we opened one
        IF @OwnTran = 1 COMMIT;
        SELECT -1 AS VendorId;
        RETURN;
    END

    INSERT INTO dbo.Vendor (VendorId, Name, Address, City, State, Zip, Phone, Website, Active, OnWeb)
    VALUES (@VendorId, @Name, @Address, @City, @State, @Zip, @Phone, @Website, @IsActive, 0);

    INSERT INTO dbo.VendorProfile (
        VendorId, LegalName, AccountNumber, RepName, IsActive, OnWeb,
        ShortName, Category, Notes, Country, CreatedAt, CreatedBy, UpdatedBy
    ) VALUES (
        @VendorId, @LegalName, @AccountNumber, @RepName, @IsActive, 0,
        @ShortName, @Category, @Notes, @Country, SYSUTCDATETIME(), @CreatedBy, @CreatedBy
    );

    IF @OwnTran = 1 COMMIT;

    SELECT @VendorId AS VendorId;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2GetVendors
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        v.VendorId                                    AS Id,
        COALESCE(a.NAME, v.Name)                      AS Name,
        COALESCE(a.STREET, v.Address)                 AS Street,
        COALESCE(a.CITY_ST,
            NULLIF(CONCAT_WS(', ', NULLIF(v.City, ''), NULLIF(v.State, '')), '')) AS CityState,
        COALESCE(a.ZIP, v.Zip)                        AS Zip,
        COALESCE(a.PHONE, v.Phone)                    AS Phone,
        COALESCE(a.SH_NAME, p.ShortName)              AS ShortName,
        v.OnWeb,
        v.ImageUrl
    FROM PRO.dbo.Vendor v
    LEFT JOIN EDA.APMST.APMST a ON a.ID = v.VendorId
    LEFT JOIN PRO.dbo.VendorProfile p ON p.VendorId = v.VendorId
    WHERE a.ID IS NOT NULL OR p.CreatedAt IS NOT NULL;
END
GO
