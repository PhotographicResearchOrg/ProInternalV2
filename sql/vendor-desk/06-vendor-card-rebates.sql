/* ---------------------------------------------------------------
    Vendor Desk · 06  Vendor card rebates: match a rebate vendor by brand when it has no AP vendor

    Database: PRO_NUKE      Safe to run twice (CREATE OR ALTER). Changes no data.
    Run after sql/phase-2-rebate-desk/05-rebate-vendors.sql (this replaces piv2.Rebate_ForApVendor from it).

    The Vendor Desk's Instant Rebates tile and tab find rebate vendors through RebateVendors.APMSTID.
    Most rebate vendors don't have it set, so the card said "Not linked". Now, when nothing carries the
    AP vendor, rebate vendors with no AP vendor are matched through their brands
    (RebateVendorTerms.BrandIds against [PRO].dbo.Brand.VendorID) and returned with LinkedBy = 'BRAND'.
    The first result set gains one column, LinkedBy ('AP' or 'BRAND'); everything else is unchanged.
   --------------------------------------------------------------- */

USE PRO_NUKE;
GO
SET XACT_ABORT ON;
GO

CREATE OR ALTER PROCEDURE piv2.Rebate_ForApVendor
    @ApVendorId nvarchar(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ap nvarchar(50) = NULLIF(LTRIM(RTRIM(@ApVendorId)), N'');
    DECLARE @apInt int = TRY_CAST(@ap AS int);
    DECLARE @today date = CAST(GETDATE() AS date);

    CREATE TABLE #v (VendorId int NOT NULL PRIMARY KEY, VendorName nvarchar(200) NULL, Rail char(2) NOT NULL, IsActive bit NOT NULL,
                     LinkedBy varchar(5) NOT NULL DEFAULT ('AP'));
    INSERT #v (VendorId, VendorName, Rail, IsActive)
    SELECT v.VendorID, v.VendorName, CASE WHEN v.IsPriceProtection = 1 THEN 'PP' ELSE 'IR' END, CAST(COALESCE(v.Active, 0) AS bit)
      FROM dbo.RebateVendors v
     WHERE @ap IS NOT NULL
       AND (LTRIM(RTRIM(v.APMSTID)) = @ap OR (@apInt IS NOT NULL AND TRY_CAST(LTRIM(RTRIM(v.APMSTID)) AS int) = @apInt));

    /* No rebate vendor carries this AP vendor: match through brands instead. A rebate vendor with no AP
       vendor set whose brands (RebateVendorTerms.BrandIds) include a brand that points at this vendor
       ([PRO].dbo.Brand.VendorID, the B2B link) is shown as linked by brand. Read only. */
    IF NOT EXISTS (SELECT 1 FROM #v) AND @apInt IS NOT NULL
        INSERT #v (VendorId, VendorName, Rail, IsActive, LinkedBy)
        SELECT DISTINCT v.VendorID, v.VendorName, CASE WHEN v.IsPriceProtection = 1 THEN 'PP' ELSE 'IR' END,
               CAST(COALESCE(v.Active, 0) AS bit), 'BRAND'
          FROM dbo.RebateVendors v
          JOIN piv2.RebateVendorTerms t ON t.VendorId = v.VendorID
         CROSS APPLY STRING_SPLIT(COALESCE(t.BrandIds, ''), ',') s
          JOIN [PRO].dbo.Brand b ON b.BrandID = TRY_CAST(LTRIM(RTRIM(s.value)) AS int)
         WHERE NULLIF(LTRIM(RTRIM(v.APMSTID)), N'') IS NULL
           AND TRY_CAST(b.VendorID AS int) = @apInt;

    SELECT VendorId, VendorName, Rail, IsActive, LinkedBy FROM #v ORDER BY Rail, VendorName;

    /* Live programs and ones starting later, newest first (capped). */
    SELECT TOP (300) x.*
      FROM
      (
        SELECT 'IR' AS Rail, p.ProgramID AS ProgramId, p.BatchID AS BatchId, m.ModelID AS ModelId, m.ModelNumber AS Description,
               m.ModelName AS ProCode, t.Name AS TypeName, p.ProgramStartWeek AS StartDate, p.ProgramEndWeek AS EndDate,
               p.InstantRebate, p.Reimbursement AS MemberAmount, p.MAPDrop AS MapPrice,
               CASE WHEN p.ProgramStartWeek > @today THEN 'UPCOMING' ELSE 'RUNNING' END AS State
          FROM dbo.RebateProgramDetail p
          JOIN dbo.RebateCameraModels m ON m.ModelID = p.ModelID
          JOIN #v v ON v.VendorId = m.VendorID
          LEFT JOIN dbo.RebateType t ON t.ID = p.IRType
         WHERE p.Expired = 0 AND p.ProgramEndWeek >= @today
        UNION ALL
        SELECT 'PP', p.ProgramID, NULL, m.ModelID, m.ModelNumber, m.ModelName, N'Price protection', p.ProgramDate, NULL,
               NULL, p.Amount, p.NewMap,
               CASE WHEN p.ProgramDate > @today THEN 'UPCOMING' ELSE 'RUNNING' END
          FROM dbo.PriceProtectionDetail p
          JOIN dbo.RebateCameraModels m ON m.ModelID = p.ModelID
          JOIN #v v ON v.VendorId = m.VendorID
         WHERE p.Expired = 0
      ) x
     ORDER BY x.StartDate DESC, x.Description;
END
GO

PRINT 'Vendor Desk 06 ready: vendor card rebates match by brand when no AP vendor is set.';
GO
