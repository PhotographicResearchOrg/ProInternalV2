/*
    Category Desk · 01  Tables and views
    Database: PRO      Safe to run twice.      Run after phase-1-platform/00 (the piv2 schema and its grant).

    Adds
      dbo.Category.Notes            internal note on a category (never shown on B2B)
      piv2.CategoryChangeLog        one row per item per publish, before and after
      piv2.CategoryPublishSeq       publish numbers
      piv2.ComputymeEgroups         synonym for Computyme's EGRP list (CONFIRM THE NAME BELOW)
      piv2.vCategoryProduct         the product columns the desk reads, in one place (CONFIRM THE NAMES BELOW)
      piv2.vCategoryTree            every category reachable from a root, with depth and path

    Nothing existing is changed apart from the new nullable Notes column. The Connection site
    and the legacy site map Category by column name and ignore a column they don't know.
*/

USE PRO;
GO
SET NOCOUNT ON;
GO

IF SCHEMA_ID(N'piv2') IS NULL
BEGIN
    RAISERROR(N'The piv2 schema is missing: run sql/phase-1-platform/00-schema-and-grant.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

/* ---------------------------------------------------------------- Category.Notes */

IF COL_LENGTH(N'dbo.Category', N'Notes') IS NULL
    ALTER TABLE dbo.Category ADD Notes nvarchar(1000) NULL;
GO

/* ---------------------------------------------------------------- change log */

IF OBJECT_ID(N'piv2.CategoryPublishSeq', N'SO') IS NULL
    CREATE SEQUENCE piv2.CategoryPublishSeq AS int START WITH 1 INCREMENT BY 1;
GO

IF OBJECT_ID(N'piv2.CategoryChangeLog', N'U') IS NULL
BEGIN
    CREATE TABLE piv2.CategoryChangeLog
    (
        ChangeId          bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_CategoryChangeLog PRIMARY KEY,
        PublishId         int            NOT NULL,
        PublishedAt       datetime2(0)   NOT NULL CONSTRAINT DF_CategoryChangeLog_At DEFAULT SYSUTCDATETIME(),
        PublishedBy       nvarchar(128)  NOT NULL,
        Comment           nvarchar(500)  NULL,
        RevertOfPublishId int            NULL,
        ItemType          varchar(10)    NOT NULL,   -- CATEGORY | PRODUCT
        ItemId            int            NOT NULL,   -- CatId or ProductData.Id
        ItemLabel         nvarchar(300)  NULL,       -- name or code + model, for the history screen
        Action            varchar(10)    NOT NULL,   -- ADD | UPDATE | DELETE (category) · MOVE (product)
        Fields            varchar(100)   NULL,       -- what changed on an UPDATE: name,parent,visible,notes,egrp
        Source            varchar(10)    NOT NULL CONSTRAINT DF_CategoryChangeLog_Source DEFAULT 'USER',  -- USER | RULE | AI | CASCADE | REVERT
        BeforeJson        nvarchar(max)  NULL,
        AfterJson         nvarchar(max)  NULL,
        CONSTRAINT CK_CategoryChangeLog_Type   CHECK (ItemType IN ('CATEGORY', 'PRODUCT')),
        CONSTRAINT CK_CategoryChangeLog_Action CHECK (Action IN ('ADD', 'UPDATE', 'DELETE', 'MOVE')),
        CONSTRAINT CK_CategoryChangeLog_Source CHECK (Source IN ('USER', 'RULE', 'AI', 'CASCADE', 'REVERT'))
    );

    CREATE INDEX IX_CategoryChangeLog_Publish ON piv2.CategoryChangeLog (PublishId);
    CREATE INDEX IX_CategoryChangeLog_Item    ON piv2.CategoryChangeLog (ItemType, ItemId, PublishId);
END
GO

/* an earlier copy of this table had 1000-character JSON columns */
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'piv2.CategoryChangeLog') AND name = N'BeforeJson' AND max_length <> -1)
BEGIN
    ALTER TABLE piv2.CategoryChangeLog ALTER COLUMN BeforeJson nvarchar(max) NULL;
    ALTER TABLE piv2.CategoryChangeLog ALTER COLUMN AfterJson  nvarchar(max) NULL;
END
GO

/* ---------------------------------------------------------------- Computyme EGRP list

   The legacy NewCats screen read Computyme's EGROUPS (columns ID and DESC_C) through the
   Entities connection. CONFIRM where that table lives in SQL and fix the name below if needed.
   If it's wrong, the desk still works; only the "Add top level from an EGRP" list comes back empty. */

IF OBJECT_ID(N'piv2.ComputymeEgroups', N'SN') IS NULL
    CREATE SYNONYM piv2.ComputymeEgroups FOR EDA.EGROUPS.EGROUPS;     -- CONFIRM
GO

/* ---------------------------------------------------------------- products, as the desk reads them

   ProductData holds the category placement (TopCatId, CatId NOT NULL with 0 = none, SubCatId).
   dbo.Product (the IVMST view the B2B site reads) supplies brand name, vendor and EGRP.
   CONFIRM the dbo.Product column names marked below; they are the names the Connection site's
   Product model uses (BrandName, VendorID, egrp). Everything in the desk reads products through
   this one view, so a rename is a one-line fix here. */

CREATE OR ALTER VIEW piv2.vCategoryProduct
AS
SELECT
    d.Id                                              AS ProductId,
    d.ProductCode,
    d.ModelName,
    d.BrandId,
    COALESCE(p.BrandName, N'')                        AS BrandName,        -- CONFIRM dbo.Product.BrandName
    p.VendorID                                        AS VendorId,         -- CONFIRM dbo.Product.VendorID
    v.Name                                            AS VendorName,
    p.egrp                                            AS Egrp,             -- CONFIRM dbo.Product.egrp
    CAST(d.IsDiscontinued AS bit)                     AS IsDiscontinued,
    CAST(CASE WHEN ISNULL(d.IsForSale, 0) = 1 THEN 1 ELSE 0 END AS bit) AS IsForSale,
    CAST(CASE WHEN ISNULL(d.IsPublic, 0)  = 1 THEN 1 ELSE 0 END AS bit) AS IsPublic,
    NULLIF(LTRIM(RTRIM(d.ReplacementCode)), N'')      AS ReplacementCode,
    d.EnterDate,
    d.TopCatId,
    d.CatId,
    d.SubCatId,
    /* Where the product sits: the deepest of the three that is set. */
    COALESCE(NULLIF(d.SubCatId, 0), NULLIF(d.CatId, 0), NULLIF(d.TopCatId, 0), 0) AS NodeId
FROM dbo.ProductData d
LEFT JOIN dbo.Product p ON p.Id = d.Id
LEFT JOIN dbo.Vendor  v ON v.VendorId = p.VendorID;
GO

/* ---------------------------------------------------------------- the tree

   Every category reachable from a root (ParentCatId NULL). The Connection site shows the
   children of its first root as the top level, so Depth 1 = top level (the EGRP level).
   Visible = the category's own IsActive. EffectiveVisible = it and every ancestor are active
   (what the WH page can actually show). Categories whose parent doesn't exist are not here;
   the desk lists them as orphans. */

CREATE OR ALTER VIEW piv2.vCategoryTree
AS
WITH t AS
(
    SELECT c.CatId, c.ParentCatId, c.CatName, c.IsActive, c.Notes, c.EGRP,
           0 AS Depth,
           CAST(NULL AS int) AS TopId,
           CAST(NULL AS int) AS L2Id,
           CAST(N'/' + CAST(c.CatId AS nvarchar(12)) + N'/' AS nvarchar(1000)) AS PathIds,
           CAST(N'' AS nvarchar(2000)) AS PathNames,
           CAST(1 AS bit) AS EffectiveVisible,
           c.CatId AS RootId
    FROM dbo.Category c
    WHERE c.ParentCatId IS NULL

    UNION ALL

    SELECT c.CatId, c.ParentCatId, c.CatName, c.IsActive, c.Notes, c.EGRP,
           t.Depth + 1,
           CASE WHEN t.Depth = 0 THEN c.CatId ELSE t.TopId END,
           CASE WHEN t.Depth = 1 THEN c.CatId WHEN t.Depth >= 2 THEN t.L2Id ELSE NULL END,
           CAST(t.PathIds + CAST(c.CatId AS nvarchar(12)) + N'/' AS nvarchar(1000)),
           CAST(CASE WHEN t.Depth = 0 THEN c.CatName ELSE t.PathNames + N' › ' + c.CatName END AS nvarchar(2000)),
           CAST(CASE WHEN t.EffectiveVisible = 1 AND c.IsActive = 1 THEN 1 ELSE 0 END AS bit),
           t.RootId
    FROM dbo.Category c
    JOIN t ON c.ParentCatId = t.CatId
    WHERE t.Depth < 30          -- stops a loop in bad data
)
SELECT CatId, ParentCatId, CatName, IsActive, Notes, EGRP, Depth, TopId, L2Id,
       PathIds, PathNames, EffectiveVisible, RootId
FROM t;
GO

SET NOEXEC OFF;
GO

PRINT N'Category Desk tables and views ready.';
