-- Rollback for 006_CreateVendor.sql
-- Restores the original PIV2GetVendors (Computyme-mirror vendors only),
-- drops PIV2CreateVendor, then drops the VendorProfile columns it added.
-- Vendors created through the app stay in dbo.Vendor / dbo.VendorProfile
-- but no longer show in the vendor grid.

CREATE OR ALTER PROCEDURE dbo.PIV2GetVendors
AS
BEGIN
    SELECT
        VendorId AS Id,
        APMST.NAME,
        STREET,
        CITY_ST,
        APMST.ZIP,
        APMST.PHONE,
        SH_NAME,
        OnWeb,
		  ImageUrl -- new column
    FROM EDA.APMST.APMST
    JOIN PRO.DBO.Vendor ON APMST.ID = Vendor.VendorId
END
GO

DROP PROCEDURE IF EXISTS dbo.PIV2CreateVendor;
GO

IF COL_LENGTH('dbo.VendorProfile', 'CreatedBy') IS NOT NULL
    ALTER TABLE dbo.VendorProfile DROP COLUMN CreatedBy;
GO
IF COL_LENGTH('dbo.VendorProfile', 'CreatedAt') IS NOT NULL
    ALTER TABLE dbo.VendorProfile DROP COLUMN CreatedAt;
GO
IF COL_LENGTH('dbo.VendorProfile', 'Country') IS NOT NULL
    ALTER TABLE dbo.VendorProfile DROP COLUMN Country;
GO
IF COL_LENGTH('dbo.VendorProfile', 'Notes') IS NOT NULL
    ALTER TABLE dbo.VendorProfile DROP COLUMN Notes;
GO
IF COL_LENGTH('dbo.VendorProfile', 'Category') IS NOT NULL
    ALTER TABLE dbo.VendorProfile DROP COLUMN Category;
GO
IF COL_LENGTH('dbo.VendorProfile', 'ShortName') IS NOT NULL
    ALTER TABLE dbo.VendorProfile DROP COLUMN ShortName;
GO
