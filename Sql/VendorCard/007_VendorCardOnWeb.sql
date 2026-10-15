-- Vendor card "Live on web" toggle did not persist.
--
-- ToggleVendorWebStatus (shared with the vendor grid) flips dbo.Vendor.OnWeb,
-- and PIV2GetVendors reads that column, but PIV2GetVendorCard read
-- dbo.VendorProfile.OnWeb, which nothing updates after the vendor is created.
-- A toggle on the card was saved but reloaded as the stale profile value, and a
-- toggle on the grid never showed on the card. dbo.Vendor.OnWeb is the column
-- the storefront and the grid use, so the card now reads it too.
--
-- Safe to re-run. Run after 001-006.

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
        ISNULL(v.OnWeb, 0)     AS OnWeb
    FROM dbo.Vendor v
    LEFT JOIN dbo.VendorProfile p ON p.VendorId = v.VendorId
    WHERE v.VendorId = @VendorId;
END
GO
