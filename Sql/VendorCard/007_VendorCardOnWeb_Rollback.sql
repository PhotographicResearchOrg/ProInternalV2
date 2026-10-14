-- Rollback for 007_VendorCardOnWeb.sql.
-- Restores PIV2GetVendorCard as defined in 002 (OnWeb read from dbo.VendorProfile).

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
