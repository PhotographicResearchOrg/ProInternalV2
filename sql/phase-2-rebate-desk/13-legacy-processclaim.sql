/* ---------------------------------------------------------------
    Phase 2 · 13  Old ProcessClaim.aspx: linked models and stock padding

    Database: PRO_NUKE      Safe to run twice.      Run after 10 and 12.
    Adds one read-only procedure (piv2 only; nothing existing changes).

    piv2.Legacy_ClaimLineSupply @MemberId, @ModelId
      For one claim line on the old page: the IR model's linked models
      (Product.ReplacementCode, both ways, up to five steps, the same rule
      as the desk) with the member's units bought of each, and the active
      stock padding on every code (own and linked) with its reasons.

      One row per code:
        ProCode, ProductName, IsLinked (0 = the IR model's own code),
        LinkedFrom (the code it was reached from), UnitsBought (all history,
        net of returns, from the nightly piv2.MemberSalesMonth),
        PadUnits, PadReasons (removed pads are not counted).
      Own codes come back only when they carry padding; linked codes always.

    The old page's login needs EXECUTE on this procedure, and SELECT on
    [PRO].dbo.Product and [EDA].dbo.RebateOverride (cross-database reads
    are checked against the caller).
   --------------------------------------------------------------- */

USE PRO_NUKE;
GO
SET XACT_ABORT ON;
GO

CREATE OR ALTER PROCEDURE piv2.Legacy_ClaimLineSupply
    @MemberId int,
    @ModelId  int
AS
BEGIN
    SET NOCOUNT ON;

    CREATE TABLE #link (ModelId int NOT NULL, ProCode int NOT NULL, IsLinked bit NOT NULL, LinkedFrom int NULL, PRIMARY KEY (ModelId, ProCode));
    INSERT #link
    SELECT DISTINCT d.ParentModelID, d.ProCode, 0, NULL
      FROM dbo.RebateCameraModelsDetails d
     WHERE d.ParentModelID = @ModelId AND d.ProCode IS NOT NULL;

    EXEC piv2.Rebate_LinkModels;

    SELECT k.ProCode,
           pr.Name                                       AS ProductName,
           k.IsLinked,
           k.LinkedFrom,
           CAST(ROUND(COALESCE(b.Units, 0), 0) AS int)   AS UnitsBought,
           COALESCE(pd.Units, 0)                         AS PadUnits,
           pd.Reasons                                    AS PadReasons
      FROM #link k
     OUTER APPLY (SELECT SUM(s.Units) AS Units
                    FROM piv2.MemberSalesMonth s
                   WHERE s.MemberId = @MemberId AND s.ProCode = k.ProCode) b
     OUTER APPLY (SELECT SUM(COALESCE(o.Quantity, 0)) AS Units,
                         STRING_AGG(CAST(CONCAT(o.Quantity, N': ', COALESCE(o.Reason, N'no reason recorded'),
                                                CASE WHEN o.CreatedBy IS NOT NULL THEN N' (' + o.CreatedBy + N')' ELSE N'' END) AS nvarchar(max)), N'; ') AS Reasons
                    FROM [EDA].dbo.RebateOverride o
                   WHERE o.Member = @MemberId AND o.ModelNumber = k.ProCode AND o.RemovedAt IS NULL) pd
     OUTER APPLY (SELECT TOP (1) LEFT(LTRIM(RTRIM(p.ModelName)), 200) AS Name
                    FROM [PRO].dbo.Product p
                   WHERE CAST(p.ProductCode AS nvarchar(20)) = CAST(k.ProCode AS nvarchar(20))) pr
     WHERE k.IsLinked = 1 OR pd.Units IS NOT NULL
     ORDER BY k.IsLinked, k.ProCode;
END
GO
