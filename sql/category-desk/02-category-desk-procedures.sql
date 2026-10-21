/*
    Category Desk · 02  Procedures
    Database: PRO      Safe to run twice (CREATE OR ALTER).      Run after 01.

      piv2.CategoryDesk_ProductState()     per product: where it sits and what's wrong with it
      piv2.CategoryDesk_Tree               the tree with product counts, queue counts, EGRPs not on the tree
      piv2.CategoryDesk_Products           product search and queues, with suggested categories
      piv2.CategoryDesk_Filters            brand and vendor lists for the search
      piv2.CategoryDesk_Publish            applies a draft (categories + product moves) in one transaction
      piv2.CategoryDesk_RevertCheck        what a revert would collide with
      piv2.CategoryDesk_Revert             reverts any past publish (as a new publish)
      piv2.CategoryDesk_History            publishes, newest first
      piv2.CategoryDesk_PublishDetail      every item in one publish, before and after

    Rules refused by Publish come back as THROW 50480-50499; the API returns them as 400 with the message.

    How a product's placement is written (unchanged from today, so the Connection site keeps working):
      top level (depth 1)   TopCatId = node,  CatId = node,  SubCatId = NULL
      depth 2               TopCatId = top,   CatId = node,  SubCatId = NULL
      depth 3 and deeper    TopCatId = top,   CatId = level 2, SubCatId = node
      no category           TopCatId = NULL,  CatId = 0,     SubCatId = NULL
    Show / hide writes IsActive and IsPublic together, so the B2B site honours it whichever it reads.
*/

USE PRO;
GO
SET NOCOUNT ON;
GO

/* ================================================================ product state */

CREATE OR ALTER FUNCTION piv2.CategoryDesk_ProductState()
RETURNS TABLE
AS
RETURN
WITH egrpNode AS
(
    SELECT EGRP, MIN(CatId) AS CatId
    FROM piv2.vCategoryTree
    WHERE Depth >= 1 AND EGRP IS NOT NULL
    GROUP BY EGRP
),
parents AS
(
    SELECT DISTINCT ParentCatId AS CatId FROM dbo.Category WHERE ParentCatId IS NOT NULL
)
SELECT
    p.ProductId, p.ProductCode, p.ModelName, p.BrandId, p.BrandName, p.VendorId, p.VendorName, p.Egrp,
    p.IsDiscontinued, p.IsForSale, p.IsPublic, p.ReplacementCode, p.EnterDate,
    p.NodeId,
    t.Depth,
    t.TopId,
    t.EgrpNodeId AS NodeEgrpId,
    t.PathIds,
    t.PathNames,
    et.CatId AS EgrpNodeId,
    CASE
        WHEN p.NodeId = 0                                         THEN 'UNCATEGORIZED'
        WHEN t.CatId IS NULL OR t.Depth = 0                       THEN 'MISSING'
        WHEN p.IsDiscontinued = 0 AND t.EffectiveVisible = 0      THEN 'HIDDEN'
        WHEN et.CatId IS NOT NULL AND ISNULL(t.EgrpNodeId, -1) <> et.CatId THEN 'EGRP_MISMATCH'
        WHEN p.IsDiscontinued = 0 AND k.CatId IS NOT NULL         THEN 'ON_PARENT'
        WHEN p.IsDiscontinued = 1 AND r.NodeId = 0                THEN 'REPLACEMENT_UNCATEGORIZED'
        ELSE NULL
    END AS Problem
FROM piv2.vCategoryProduct p
LEFT JOIN piv2.vCategoryTree t ON t.CatId = p.NodeId
LEFT JOIN egrpNode et          ON et.EGRP = p.Egrp
LEFT JOIN parents k            ON k.CatId = p.NodeId
OUTER APPLY (SELECT TOP (1) rp.NodeId
             FROM piv2.vCategoryProduct rp
             WHERE p.ReplacementCode IS NOT NULL AND rp.ProductCode = p.ReplacementCode) r;
GO

/* ================================================================ tree */

CREATE OR ALTER PROCEDURE piv2.CategoryDesk_Tree
AS
BEGIN
    SET NOCOUNT ON;

    SELECT * INTO #state FROM piv2.CategoryDesk_ProductState();

    /* Counts roll up: a product counts for its node and every node above it. */
    SELECT CAST(a.value AS int) AS CatId,
           SUM(CASE WHEN s.NodeId = CAST(a.value AS int) THEN 1 ELSE 0 END)                    AS OwnCount,
           SUM(CASE WHEN s.NodeId = CAST(a.value AS int) AND s.IsDiscontinued = 0 THEN 1 ELSE 0 END) AS OwnActiveCount,
           COUNT(*)                                                                         AS TotalCount,
           SUM(CASE WHEN s.IsDiscontinued = 0 THEN 1 ELSE 0 END)                            AS ActiveCount,
           SUM(CASE WHEN s.IsDiscontinued = 1 THEN 1 ELSE 0 END)                            AS DiscontinuedCount
    INTO #counts
    FROM #state s
    CROSS APPLY STRING_SPLIT(s.PathIds, '/') a
    WHERE s.PathIds IS NOT NULL AND a.value <> ''
    GROUP BY CAST(a.value AS int);

    /* 1. nodes */
    SELECT t.CatId, t.ParentCatId, t.CatName AS Name, t.IsActive AS Visible, t.EffectiveVisible,
           t.Notes, t.EGRP AS Egrp, t.Depth, t.TopId, t.EgrpNodeId, t.PathNames,
           ISNULL(c.OwnCount, 0) AS OwnCount, ISNULL(c.OwnActiveCount, 0) AS OwnActiveCount, ISNULL(c.TotalCount, 0) AS TotalCount,
           ISNULL(c.ActiveCount, 0) AS ActiveCount, ISNULL(c.DiscontinuedCount, 0) AS DiscontinuedCount
    FROM piv2.vCategoryTree t
    LEFT JOIN #counts c ON c.CatId = t.CatId
    ORDER BY t.Depth, t.CatName;

    /* 2. summary cards */
    SELECT
        (SELECT COUNT(*) FROM #state WHERE Problem = 'UNCATEGORIZED' AND IsDiscontinued = 0)                     AS Uncategorized,
        (SELECT COUNT(*) FROM #state WHERE Problem IS NOT NULL AND Problem <> 'UNCATEGORIZED')                    AS Suspect,
        (SELECT COUNT(*) FROM piv2.vCategoryTree t LEFT JOIN #counts c ON c.CatId = t.CatId
          WHERE t.Depth > 0 AND t.EffectiveVisible = 1 AND ISNULL(c.ActiveCount, 0) = 0)                        AS VisibleEmpty,
        (SELECT COUNT(*) FROM dbo.Category c WHERE c.ParentCatId IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM dbo.Category p WHERE p.CatId = c.ParentCatId))                        AS Orphans,
        (SELECT ISNULL(MAX(PublishId), 0) FROM piv2.CategoryChangeLog)                                          AS Version;

    /* 3. Computyme EGRPs that aren't in the tree yet (replaces NewCats) */
    CREATE TABLE #egrp (Egrp int, Name nvarchar(200));
    BEGIN TRY
        /* dynamic, so a synonym that points nowhere is caught here instead of failing the whole call */
        INSERT #egrp (Egrp, Name)
        EXEC sp_executesql N'
            SELECT TRY_CAST(e.ID AS int), CAST(e.DESC_C AS nvarchar(200))
            FROM piv2.ComputymeEgroups e
            WHERE TRY_CAST(e.ID AS int) IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM dbo.Category c WHERE c.EGRP = TRY_CAST(e.ID AS int));';
    END TRY
    BEGIN CATCH
        /* synonym not pointed at the right table yet: the list is empty, the desk still works */
    END CATCH
    SELECT Egrp, Name FROM #egrp ORDER BY Egrp;

    /* 4. orphans: categories whose parent doesn't exist (the WH page can't show them) */
    SELECT c.CatId, c.CatName AS Name, c.ParentCatId
    FROM dbo.Category c
    WHERE c.ParentCatId IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM dbo.Category p WHERE p.CatId = c.ParentCatId)
    ORDER BY c.CatName;
END
GO

/* ================================================================ products and queues */

CREATE OR ALTER PROCEDURE piv2.CategoryDesk_Products
    @Term            nvarchar(100) = NULL,
    @BrandId         int           = NULL,
    @VendorId        int           = NULL,
    @Status          varchar(15)   = NULL,     -- ACTIVE | DISCONTINUED
    @ForSale         bit           = NULL,
    @IsPublic        bit           = NULL,
    @NodeId          int           = NULL,
    @IncludeChildren bit           = 1,
    @Queue           varchar(15)   = NULL,     -- UNCATEGORIZED | SUSPECT
    @Egrp            int           = NULL,
    @NewDays         int           = NULL,
    @Page            int           = 1,
    @PageSize        int           = 100       -- 0 = every match (export and select-all), up to 50,000
AS
BEGIN
    SET NOCOUNT ON;

    SET @Term = NULLIF(LTRIM(RTRIM(@Term)), N'');
    IF @Page < 1 SET @Page = 1;
    DECLARE @all bit = CASE WHEN @PageSize = 0 THEN 1 ELSE 0 END;
    IF @PageSize = 0 SET @PageSize = 50000;
    IF @PageSize > 50000 SET @PageSize = 50000;

    DECLARE @nodePath nvarchar(1000) = (SELECT PathIds FROM piv2.vCategoryTree WHERE CatId = @NodeId);
    DECLARE @like nvarchar(110) = N'%' + @Term + N'%';

    SELECT * INTO #state FROM piv2.CategoryDesk_ProductState();

    SELECT s.*, COUNT(*) OVER () AS TotalCount
    INTO #page
    FROM #state s
    WHERE (@Term IS NULL OR s.ProductCode LIKE @like OR s.ModelName LIKE @like OR s.BrandName LIKE @like)
      AND (@BrandId  IS NULL OR s.BrandId  = @BrandId)
      AND (@VendorId IS NULL OR s.VendorId = @VendorId)
      AND (@Status IS NULL OR (@Status = 'ACTIVE' AND s.IsDiscontinued = 0) OR (@Status = 'DISCONTINUED' AND s.IsDiscontinued = 1))
      AND (@ForSale  IS NULL OR s.IsForSale = @ForSale)
      AND (@IsPublic IS NULL OR s.IsPublic  = @IsPublic)
      AND (@Egrp     IS NULL OR s.Egrp      = @Egrp)
      AND (@NewDays  IS NULL OR s.EnterDate >= DATEADD(DAY, -@NewDays, CAST(GETDATE() AS date)))
      AND (@NodeId IS NULL
           OR (@IncludeChildren = 0 AND s.NodeId = @NodeId)
           OR (@IncludeChildren = 1 AND @nodePath IS NOT NULL AND s.PathIds LIKE @nodePath + N'%'))
      AND (@Queue IS NULL
           OR (@Queue = 'UNCATEGORIZED' AND s.Problem = 'UNCATEGORIZED')
           OR (@Queue = 'SUSPECT' AND s.Problem IS NOT NULL AND s.Problem <> 'UNCATEGORIZED'))
    ORDER BY s.ProductCode
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY
    OPTION (RECOMPILE);

    /* Suggestions, for queue pages only (not for export of every match). In order:
       1 replacement of a categorized discontinued product
       2 where most products of the same brand sit, inside the product's EGRP branch
       3 the same by vendor
       5 the product's EGRP category
       Signal 4 (name match) and AI come later. */
    CREATE TABLE #sug (ProductId int PRIMARY KEY, NodeId int, Reason nvarchar(300), Confidence int, Signal varchar(12));

    IF @Queue IS NOT NULL AND @all = 0
    BEGIN
        /* Products that are placed properly: the pool the counts come from. */
        SELECT s.ProductId, s.ProductCode, s.ReplacementCode, s.BrandId, s.BrandName, s.VendorId, s.VendorName,
               s.NodeId, s.NodeEgrpId, s.Depth, s.PathNames
        INTO #pool
        FROM #state s
        WHERE s.Problem IS NULL AND s.Depth >= 1;

        INSERT #sug (ProductId, NodeId, Reason, Confidence, Signal)
        SELECT pg.ProductId,
               COALESCE(r1.NodeId, r2.NodeId, r3.NodeId, pg.EgrpNodeId),
               CASE
                   WHEN r1.NodeId IS NOT NULL THEN N'Replaces ' + r1.ProductCode + N', which is in ' + r1.PathNames
                   WHEN r2.NodeId IS NOT NULL THEN CONCAT(r2.n, N' of ', r2.total, N' ', pg.BrandName, N' products in this branch are here (', r2.n * 100 / r2.total, N'%)')
                   WHEN r3.NodeId IS NOT NULL THEN CONCAT(r3.n, N' of ', r3.total, N' ', ISNULL(pg.VendorName, N'vendor'), N' products in this branch are here (', r3.n * 100 / r3.total, N'%)')
                   WHEN pg.EgrpNodeId IS NOT NULL THEN N'Its EGRP category (from Computyme)'
               END,
               CASE
                   WHEN r1.NodeId IS NOT NULL THEN 95
                   WHEN r2.NodeId IS NOT NULL THEN r2.n * 100 / r2.total
                   WHEN r3.NodeId IS NOT NULL THEN r3.n * 100 / r3.total
                   ELSE 0
               END,
               CASE
                   WHEN r1.NodeId IS NOT NULL THEN 'REPLACEMENT'
                   WHEN r2.NodeId IS NOT NULL THEN 'BRAND'
                   WHEN r3.NodeId IS NOT NULL THEN 'VENDOR'
                   WHEN pg.EgrpNodeId IS NOT NULL THEN 'EGRP'
               END
        FROM #page pg
        OUTER APPLY (SELECT TOP (1) po.NodeId, po.ProductCode, po.PathNames
                     FROM #pool po
                     WHERE po.ReplacementCode = pg.ProductCode
                       AND (pg.EgrpNodeId IS NULL OR po.NodeEgrpId = pg.EgrpNodeId)) r1
        OUTER APPLY (SELECT TOP (1) x.NodeId, x.n, x.total
                     FROM (SELECT po.NodeId, COUNT(*) AS n, SUM(COUNT(*)) OVER () AS total
                           FROM #pool po
                           WHERE pg.BrandId IS NOT NULL AND po.BrandId = pg.BrandId AND po.ProductId <> pg.ProductId
                             AND (pg.EgrpNodeId IS NULL OR po.NodeEgrpId = pg.EgrpNodeId)
                           GROUP BY po.NodeId) x
                     WHERE x.total >= 2
                     ORDER BY x.n DESC, x.NodeId) r2
        OUTER APPLY (SELECT TOP (1) x.NodeId, x.n, x.total
                     FROM (SELECT po.NodeId, COUNT(*) AS n, SUM(COUNT(*)) OVER () AS total
                           FROM #pool po
                           WHERE pg.VendorId IS NOT NULL AND po.VendorId = pg.VendorId AND po.ProductId <> pg.ProductId
                             AND (pg.EgrpNodeId IS NULL OR po.NodeEgrpId = pg.EgrpNodeId)
                           GROUP BY po.NodeId) x
                     WHERE x.total >= 2
                     ORDER BY x.n DESC, x.NodeId) r3
        WHERE COALESCE(r1.NodeId, r2.NodeId, r3.NodeId, pg.EgrpNodeId) IS NOT NULL
          AND COALESCE(r1.NodeId, r2.NodeId, r3.NodeId, pg.EgrpNodeId) <> pg.NodeId;
    END

    SELECT pg.ProductId, pg.ProductCode, pg.ModelName, pg.BrandId, pg.BrandName, pg.VendorId, pg.VendorName, pg.Egrp,
           pg.IsDiscontinued, pg.IsForSale, pg.IsPublic, pg.ReplacementCode, pg.EnterDate,
           pg.NodeId, pg.PathNames AS NodePath, pg.EgrpNodeId, pg.Problem,
           sg.NodeId AS SuggestedNodeId, st.PathNames AS SuggestedPath, sg.Reason AS SuggestReason,
           sg.Confidence AS SuggestConfidence, sg.Signal AS SuggestSignal,
           pg.TotalCount
    FROM #page pg
    LEFT JOIN #sug sg ON sg.ProductId = pg.ProductId
    LEFT JOIN piv2.vCategoryTree st ON st.CatId = sg.NodeId
    ORDER BY pg.ProductCode;
END
GO

/* ================================================================ filter lists */

CREATE OR ALTER PROCEDURE piv2.CategoryDesk_Filters
AS
BEGIN
    SET NOCOUNT ON;

    SELECT DISTINCT p.BrandId AS Id, p.BrandName AS Name
    FROM piv2.vCategoryProduct p
    WHERE p.BrandId IS NOT NULL AND p.BrandName <> N''
    ORDER BY p.BrandName;

    SELECT DISTINCT p.VendorId AS Id, p.VendorName AS Name
    FROM piv2.vCategoryProduct p
    WHERE p.VendorId IS NOT NULL AND p.VendorName IS NOT NULL
    ORDER BY p.VendorName;
END
GO

/* ================================================================ publish

   @Changes (JSON):
   {
     "categories": [ { "id": 123 | -1 (new, temporary id), "parentId": 456 | -2, "name": "...", "visible": true,
                       "notes": "...", "egrp": null, "isPublic": null, "delete": false, "restore": false, "source": "USER" } ],
     "products":   [ { "productId": 9001, "nodeId": 123 | -1 | 0, "source": "USER" | "RULE" | "AI" } ]
   }
   A category entry carries its whole desired state (name, parent, visible, notes).
   "restore" re-creates a deleted category with its old id (used by revert).
   @BaseVersion: the Version the draft was started from. If a later publish touched the same
   categories or products, the publish is refused so nobody overwrites work they haven't seen.
*/

CREATE OR ALTER PROCEDURE piv2.CategoryDesk_Publish
    @Changes      nvarchar(max),
    @Comment      nvarchar(500) = NULL,
    @User         nvarchar(128),
    @SqlIsMaster  bit = 0,
    @BaseVersion  int = NULL,
    @RevertOf     int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISJSON(@Changes) <> 1
        THROW 50480, N'The changes could not be read.', 1;

    DECLARE @root int = (SELECT MIN(CatId) FROM dbo.Category WHERE ParentCatId IS NULL);
    DECLARE @msg nvarchar(2000), @n int;

    CREATE TABLE #c
    (
        Id int NOT NULL PRIMARY KEY, ParentId int NULL, Name nvarchar(200) NULL, Visible bit NULL,
        Notes nvarchar(1000) NULL, Egrp int NULL, IsPublic bit NULL, Extra nvarchar(max) NULL,
        IsDelete bit NOT NULL, IsRestore bit NOT NULL, Source varchar(10) NOT NULL,
        RealId int NULL, RealParentId int NULL
    );
    CREATE TABLE #p (ProductId int NOT NULL PRIMARY KEY, NodeId int NOT NULL, Source varchar(10) NOT NULL, RealNodeId int NULL);

    BEGIN TRY
        INSERT #c (Id, ParentId, Name, Visible, Notes, Egrp, IsPublic, Extra, IsDelete, IsRestore, Source)
        SELECT j.id, j.parentId, NULLIF(LTRIM(RTRIM(j.name)), N''), j.visible, NULLIF(LTRIM(RTRIM(j.notes)), N''),
               j.egrp, j.isPublic, j.extra, ISNULL(j.[delete], 0), ISNULL(j.[restore], 0), ISNULL(UPPER(j.source), 'USER')
        FROM OPENJSON(@Changes, '$.categories')
             WITH (id int '$.id', parentId int '$.parentId', name nvarchar(200) '$.name', visible bit '$.visible',
                   notes nvarchar(1000) '$.notes', egrp int '$.egrp', isPublic bit '$.isPublic',
                   extra nvarchar(max) '$.extra' AS JSON,
                   [delete] bit '$.delete', [restore] bit '$.restore', source varchar(10) '$.source') j;

        INSERT #p (ProductId, NodeId, Source)
        SELECT j.productId, j.nodeId, ISNULL(UPPER(j.source), 'USER')
        FROM OPENJSON(@Changes, '$.products')
             WITH (productId int '$.productId', nodeId int '$.nodeId', source varchar(10) '$.source') j;
    END TRY
    BEGIN CATCH
        THROW 50480, N'The changes could not be read: a category or product appears twice, or a value is missing.', 1;
    END CATCH;

    IF EXISTS (SELECT 1 FROM #c WHERE Source NOT IN ('USER', 'RULE', 'AI', 'REVERT'))
       OR EXISTS (SELECT 1 FROM #p WHERE Source NOT IN ('USER', 'RULE', 'AI', 'REVERT'))
        THROW 50480, N'Unknown change source.', 1;

    IF NOT EXISTS (SELECT 1 FROM #c) AND NOT EXISTS (SELECT 1 FROM #p)
        THROW 50480, N'There is nothing to publish.', 1;

    BEGIN TRAN;

    /* One publish at a time. */
    DECLARE @lock int;
    EXEC @lock = sp_getapplock @Resource = N'piv2.CategoryDesk_Publish', @LockMode = N'Exclusive', @LockOwner = N'Transaction', @LockTimeout = 30000;
    IF @lock < 0 THROW 50497, N'Another publish is in progress. Try again in a moment.', 1;

    /* ---------------------------------------------------------- someone else got there first */
    IF @BaseVersion IS NOT NULL
    BEGIN
        SELECT TOP (1) @msg = CONCAT(l.PublishedBy, N' changed ', l.ItemLabel, N' in publish #', l.PublishId,
                                     N' after you started. Reload to see their changes; your draft stays in this browser until you discard it.')
        FROM piv2.CategoryChangeLog l
        WHERE l.PublishId > @BaseVersion
          AND ((l.ItemType = 'CATEGORY' AND l.ItemId IN (SELECT Id FROM #c WHERE Id > 0))
            OR (l.ItemType = 'PRODUCT'  AND l.ItemId IN (SELECT ProductId FROM #p)))
        ORDER BY l.PublishId;
        IF @msg IS NOT NULL THROW 50481, @msg, 1;
    END

    /* ---------------------------------------------------------- the categories named must exist (or not, for restore) */
    SELECT TOP (1) @msg = CONCAT(N'Category ', c.Id, N' no longer exists. Reload the desk.')
    FROM #c c WHERE c.Id > 0 AND c.IsRestore = 0 AND NOT EXISTS (SELECT 1 FROM dbo.Category k WHERE k.CatId = c.Id);
    IF @msg IS NOT NULL THROW 50482, @msg, 1;

    DELETE FROM #c WHERE IsRestore = 1 AND EXISTS (SELECT 1 FROM dbo.Category k WHERE k.CatId = #c.Id);   -- already back

    SELECT TOP (1) @msg = CONCAT(N'Category ', ISNULL(c.Name, CAST(c.Id AS nvarchar(12))), N' needs a name of 100 characters or fewer.')
    FROM #c c WHERE c.IsDelete = 0 AND (c.Name IS NULL OR LEN(c.Name) > 100);
    IF @msg IS NOT NULL THROW 50483, @msg, 1;

    SELECT TOP (1) @msg = CONCAT(N'Category ', c.Name, N' needs a parent.')
    FROM #c c WHERE c.IsDelete = 0 AND c.ParentId IS NULL AND (c.Id < 0 OR c.IsRestore = 1 OR EXISTS (SELECT 1 FROM dbo.Category k WHERE k.CatId = c.Id AND k.ParentCatId IS NOT NULL));
    IF @msg IS NOT NULL THROW 50483, @msg, 1;

    /* ---------------------------------------------------------- ids for new categories
       A new EGRP category keeps the old convention (EGRP + 5000) when that id is free.
       Everything else takes the next free id from 10000 up. */
    UPDATE #c SET RealId = Id WHERE Id > 0;

    /* never reuse an id, even of a deleted category, so history and revert stay unambiguous */
    DECLARE @tmp int, @egrp int, @new int, @next int =
        (SELECT ISNULL(MAX(v), 9999) + 1
         FROM (SELECT MAX(CatId) FROM dbo.Category WHERE CatId BETWEEN 10000 AND 1999999999
               UNION ALL
               SELECT MAX(ItemId) FROM piv2.CategoryChangeLog WHERE ItemType = 'CATEGORY' AND ItemId BETWEEN 10000 AND 1999999999) x(v));

    DECLARE ids CURSOR LOCAL FAST_FORWARD FOR SELECT Id, Egrp FROM #c WHERE Id < 0 ORDER BY Id DESC;
    OPEN ids;
    FETCH NEXT FROM ids INTO @tmp, @egrp;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @new = NULL;
        IF @egrp IS NOT NULL AND @egrp + 5000 < 10000
           AND NOT EXISTS (SELECT 1 FROM dbo.Category WHERE CatId = @egrp + 5000)
           AND NOT EXISTS (SELECT 1 FROM #c WHERE RealId = @egrp + 5000)
           AND NOT EXISTS (SELECT 1 FROM piv2.CategoryChangeLog WHERE ItemType = 'CATEGORY' AND ItemId = @egrp + 5000)
            SET @new = @egrp + 5000;
        IF @new IS NULL
        BEGIN
            SET @new = @next;
            SET @next += 1;
        END
        UPDATE #c SET RealId = @new WHERE Id = @tmp;
        FETCH NEXT FROM ids INTO @tmp, @egrp;
    END
    CLOSE ids; DEALLOCATE ids;

    UPDATE c SET RealParentId = CASE WHEN c.ParentId < 0 THEN t.RealId ELSE c.ParentId END
    FROM #c c LEFT JOIN #c t ON t.Id = c.ParentId;

    SELECT TOP (1) @msg = CONCAT(N'Category ', c.Name, N' points at a new parent that isn''t in this publish.')
    FROM #c c WHERE c.IsDelete = 0 AND c.ParentId < 0 AND c.RealParentId IS NULL;
    IF @msg IS NOT NULL THROW 50483, @msg, 1;

    UPDATE p SET RealNodeId = CASE WHEN p.NodeId < 0 THEN c.RealId ELSE p.NodeId END
    FROM #p p LEFT JOIN #c c ON c.Id = p.NodeId;

    /* ---------------------------------------------------------- the tree as it will be */
    SELECT k.CatId, k.ParentCatId, k.CatName, k.IsActive, k.Notes, k.EGRP, CAST(0 AS bit) AS IsDeleted, CAST(0 AS bit) AS IsChanged
    INTO #prop
    FROM dbo.Category k;

    UPDATE pr SET ParentCatId = CASE WHEN c.ParentId IS NULL THEN pr.ParentCatId ELSE c.RealParentId END,
                  CatName = ISNULL(c.Name, pr.CatName), IsActive = ISNULL(c.Visible, pr.IsActive),
                  Notes = CASE WHEN c.IsDelete = 1 THEN pr.Notes ELSE c.Notes END,
                  EGRP = CASE WHEN c.IsDelete = 1 THEN pr.EGRP WHEN @SqlIsMaster = 1 OR c.Source = 'REVERT' THEN c.Egrp ELSE pr.EGRP END,
                  IsDeleted = c.IsDelete, IsChanged = 1
    FROM #prop pr JOIN #c c ON c.RealId = pr.CatId;

    INSERT #prop (CatId, ParentCatId, CatName, IsActive, Notes, EGRP, IsDeleted, IsChanged)
    SELECT c.RealId, c.RealParentId, c.Name, ISNULL(c.Visible, 1), c.Notes, c.Egrp, 0, 1
    FROM #c c WHERE (c.Id < 0 OR c.IsRestore = 1) AND c.IsDelete = 0;

    /* every live category whose parent is live */
    SELECT TOP (1) @msg = CONCAT(N'The parent of ', pr.CatName, N' is missing or being deleted. Delete its sub-categories too, or move them first.')
    FROM #prop pr
    WHERE pr.IsDeleted = 0 AND pr.ParentCatId IS NOT NULL AND pr.IsChanged = 1
      AND NOT EXISTS (SELECT 1 FROM #prop q WHERE q.CatId = pr.ParentCatId AND q.IsDeleted = 0);
    IF @msg IS NULL
        SELECT TOP (1) @msg = CONCAT(N'Delete the sub-categories of ', q.CatName, N' too, or move them first.')
        FROM #prop pr JOIN #prop q ON q.CatId = pr.ParentCatId
        WHERE pr.IsDeleted = 0 AND q.IsDeleted = 1;
    IF @msg IS NOT NULL THROW 50491, @msg, 1;

    /* walk the proposed tree from the roots; EgrpNodeId = the EGRP category a node will be in */
    CREATE TABLE #reach (CatId int PRIMARY KEY, Depth int, TopId int NULL, L2Id int NULL, EgrpNodeId int NULL, PathIds nvarchar(1000), EffVisible bit);
    WITH w AS
    (
        SELECT pr.CatId, 0 AS Depth, CAST(NULL AS int) AS TopId, CAST(NULL AS int) AS L2Id, CAST(NULL AS int) AS EgrpNodeId,
               CAST(N'/' + CAST(pr.CatId AS nvarchar(12)) + N'/' AS nvarchar(1000)) AS PathIds, CAST(1 AS bit) AS EffVisible
        FROM #prop pr WHERE pr.ParentCatId IS NULL AND pr.IsDeleted = 0
        UNION ALL
        SELECT pr.CatId, w.Depth + 1,
               CASE WHEN w.Depth = 0 THEN pr.CatId ELSE w.TopId END,
               CASE WHEN w.Depth = 1 THEN pr.CatId WHEN w.Depth >= 2 THEN w.L2Id END,
               CASE WHEN pr.EGRP IS NOT NULL THEN pr.CatId ELSE w.EgrpNodeId END,
               CAST(w.PathIds + CAST(pr.CatId AS nvarchar(12)) + N'/' AS nvarchar(1000)),
               CAST(CASE WHEN w.EffVisible = 1 AND pr.IsActive = 1 THEN 1 ELSE 0 END AS bit)
        FROM #prop pr JOIN w ON pr.ParentCatId = w.CatId
        WHERE pr.IsDeleted = 0 AND w.Depth < 30
    )
    INSERT #reach SELECT CatId, Depth, TopId, L2Id, EgrpNodeId, PathIds, EffVisible FROM w;

    SELECT TOP (1) @msg = CONCAT(N'Moving ', pr.CatName, N' there would put it inside itself.')
    FROM #prop pr WHERE pr.IsChanged = 1 AND pr.IsDeleted = 0 AND NOT EXISTS (SELECT 1 FROM #reach r WHERE r.CatId = pr.CatId);
    IF @msg IS NOT NULL THROW 50484, @msg, 1;

    /* sibling names are unique */
    /* only a new clash counts: a row that is new, renamed or moved into a name already used there */
    SELECT TOP (1) @msg = CONCAT(N'There are two categories called ', MIN(pr.CatName), N' in the same place.')
    FROM #prop pr
    LEFT JOIN dbo.Category k ON k.CatId = pr.CatId
    WHERE pr.IsDeleted = 0
    GROUP BY pr.ParentCatId, UPPER(pr.CatName)
    HAVING COUNT(*) > 1
       AND MAX(CASE WHEN pr.IsChanged = 1 AND (k.CatId IS NULL OR ISNULL(k.ParentCatId, -1) <> ISNULL(pr.ParentCatId, -1)
                                               OR UPPER(k.CatName) <> UPPER(pr.CatName)) THEN 1 ELSE 0 END) = 1;
    IF @msg IS NOT NULL THROW 50487, @msg, 1;

    /* ---------------------------------------------------------- EGRP categories
       An EGRP category (Category.EGRP set) is Computyme's wherever it sits: at the top level or under
       a web group. Groups above it are web-only, so an EGRP category can be regrouped. */
    SELECT t.CatId, t.Depth, t.TopId, t.EgrpNodeId, t.PathIds INTO #now FROM piv2.vCategoryTree t;

    /* an EGRP category can't sit inside another one (always) */
    SELECT TOP (1) @msg = CONCAT(pr.CatName, N' (EGRP ', pr.EGRP, N') can''t go inside another EGRP category (', ek.CatName, N'). Put it under a group or at the top level.')
    FROM #prop pr
    JOIN #reach rp ON rp.CatId = pr.ParentCatId
    JOIN #prop ek  ON ek.CatId = rp.EgrpNodeId
    WHERE pr.IsDeleted = 0 AND pr.EGRP IS NOT NULL AND rp.EgrpNodeId IS NOT NULL
      /* already nested like that in today's data: leave it alone */
      AND NOT EXISTS (SELECT 1 FROM dbo.Category k JOIN #now np ON np.CatId = k.ParentCatId
                      WHERE k.CatId = pr.CatId AND np.EgrpNodeId IS NOT NULL);
    IF @msg IS NOT NULL THROW 50488, @msg, 1;

    SELECT TOP (1) @msg = CONCAT(N'EGRP ', pr.EGRP, N' is already in the tree.')
    FROM #prop pr WHERE pr.IsDeleted = 0 AND pr.EGRP IS NOT NULL
    GROUP BY pr.EGRP HAVING COUNT(*) > 1 AND MAX(CAST(pr.IsChanged AS int)) = 1;
    IF @msg IS NOT NULL THROW 50494, @msg, 1;

    IF @SqlIsMaster = 0
    BEGIN
        /* a new category can only be an EGRP category if that EGRP exists in Computyme's list */
        SELECT TOP (1) @msg = CONCAT(N'A new EGRP category must be one of Computyme''s EGRPs (', pr.EGRP, N' isn''t new here).')
        FROM #prop pr JOIN #c c ON c.RealId = pr.CatId
        WHERE c.Id < 0 AND pr.EGRP IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Category k WHERE k.EGRP = pr.EGRP);
        IF @msg IS NOT NULL THROW 50489, @msg, 1;

        /* a web category inside an EGRP category stays inside it: moving between EGRPs is a Computyme change */
        SELECT TOP (1) @msg = CONCAT(pr.CatName, N' can''t leave its EGRP category (', ek.CatName, N'). Moving between EGRPs is done in Computyme until product data moves to SQL.')
        FROM #prop pr
        JOIN #now n ON n.CatId = pr.CatId AND n.EgrpNodeId IS NOT NULL AND n.EgrpNodeId <> pr.CatId
        JOIN #reach r ON r.CatId = pr.CatId
        JOIN dbo.Category ek ON ek.CatId = n.EgrpNodeId
        WHERE pr.IsChanged = 1 AND pr.EGRP IS NULL AND ISNULL(r.EgrpNodeId, -1) <> n.EgrpNodeId;
        IF @msg IS NOT NULL THROW 50490, @msg, 1;
    END

    /* ---------------------------------------------------------- product moves */
    SELECT TOP (1) @msg = CONCAT(N'Product ', p.ProductId, N' isn''t in the product table.')
    FROM #p p WHERE NOT EXISTS (SELECT 1 FROM dbo.ProductData d WHERE d.Id = p.ProductId);
    IF @msg IS NOT NULL THROW 50492, @msg, 1;

    SELECT TOP (1) @msg = CONCAT(N'A product is being moved to a category that won''t exist (', p.NodeId, N').')
    FROM #p p WHERE p.RealNodeId IS NULL OR (p.RealNodeId <> 0 AND NOT EXISTS (SELECT 1 FROM #reach r WHERE r.CatId = p.RealNodeId AND r.Depth >= 1));
    IF @msg IS NOT NULL THROW 50492, @msg, 1;

    /* each product's EGRP category (where its Computyme EGRP sits in the tree) */
    SELECT cp.ProductId, cp.ProductCode, cp.Egrp, MIN(pr.CatId) AS EgrpNodeId
    INTO #pegrp
    FROM piv2.vCategoryProduct cp
    JOIN #prop pr ON pr.EGRP = cp.Egrp AND pr.IsDeleted = 0
    WHERE cp.Egrp IS NOT NULL
    GROUP BY cp.ProductId, cp.ProductCode, cp.Egrp;

    IF @SqlIsMaster = 0
    BEGIN
        SELECT @n = COUNT(*), @msg = MIN(CONCAT(pe.ProductCode, N' (EGRP ', pe.Egrp, N')'))
        FROM #p p
        JOIN #pegrp pe ON pe.ProductId = p.ProductId
        JOIN #reach r ON r.CatId = p.RealNodeId
        WHERE p.RealNodeId <> 0 AND ISNULL(r.EgrpNodeId, -1) <> pe.EgrpNodeId;
        IF @n > 0
        BEGIN
            SET @msg = CONCAT(@n, N' product(s), for example ', @msg, N', would leave their EGRP category. A product''s EGRP comes from Computyme; change it there, or pick a category inside its EGRP.');
            THROW 50486, @msg, 1;
        END
        SET @msg = NULL;
    END

    /* nothing may be left in a category being deleted */
    SELECT @n = COUNT(*), @msg = MIN(k.CatName)
    FROM piv2.vCategoryProduct cp
    JOIN #prop k ON k.CatId = cp.NodeId AND k.IsDeleted = 1
    WHERE NOT EXISTS (SELECT 1 FROM #p p WHERE p.ProductId = cp.ProductId);
    IF @n > 0
    BEGIN
        SET @msg = CONCAT(@n, N' product(s) are still in ', @msg, N'. Move them to another category before deleting it.');
        THROW 50485, @msg, 1;
    END
    SET @msg = NULL;

    /* ---------------------------------------------------------- hiding a category hides everything under it */
    SELECT pr.CatId
    INTO #cascade
    FROM #prop pr
    JOIN #reach r ON r.CatId = pr.CatId
    WHERE pr.IsDeleted = 0 AND pr.IsActive = 1 AND r.EffVisible = 0
      AND EXISTS (SELECT 1 FROM #prop ch
                  JOIN #reach cr ON cr.CatId = ch.CatId
                  JOIN dbo.Category k ON k.CatId = ch.CatId
                  WHERE ch.IsChanged = 1 AND ch.IsActive = 0 AND k.IsActive = 1     -- being hidden in this publish
                    AND r.PathIds LIKE cr.PathIds + N'%');

    UPDATE #prop SET IsActive = 0, IsChanged = 1 WHERE CatId IN (SELECT CatId FROM #cascade);

    /* ---------------------------------------------------------- before images */
    DECLARE @publishId int;
    SET @publishId = NEXT VALUE FOR piv2.CategoryPublishSeq;

    SELECT k.CatId, k.ParentCatId, k.CatName, k.IsActive, k.IsPublic, k.Notes, k.EGRP,
           k.SalesCopy, k.ImageName, k.DisplayOrder, k.TemplateId, k.ProConsumer, k.Type
    INTO #before
    FROM dbo.Category k
    WHERE k.CatId IN (SELECT CatId FROM #prop WHERE IsChanged = 1);

    /* products whose path changes: the ones moved, and everything under a category that moved */
    SELECT n.PathIds INTO #moved
    FROM #prop pr JOIN dbo.Category k ON k.CatId = pr.CatId JOIN #now n ON n.CatId = pr.CatId
    WHERE pr.IsDeleted = 0 AND ISNULL(pr.ParentCatId, -1) <> ISNULL(k.ParentCatId, -1);

    SELECT DISTINCT cp.ProductId
    INTO #repath
    FROM piv2.vCategoryProduct cp
    JOIN #now nn ON nn.CatId = cp.NodeId
    WHERE EXISTS (SELECT 1 FROM #moved m WHERE nn.PathIds LIKE m.PathIds + N'%');

    /* an orphan branch being attached to the tree: every product in it gets a path */
    INSERT #repath (ProductId)
    SELECT cp.ProductId
    FROM piv2.vCategoryProduct cp
    WHERE cp.NodeId <> 0
      AND NOT EXISTS (SELECT 1 FROM #now n WHERE n.CatId = cp.NodeId)
      AND EXISTS (SELECT 1 FROM #reach r WHERE r.CatId = cp.NodeId AND r.Depth >= 1)
      AND NOT EXISTS (SELECT 1 FROM #repath x WHERE x.ProductId = cp.ProductId);

    INSERT #repath (ProductId) SELECT p.ProductId FROM #p p WHERE NOT EXISTS (SELECT 1 FROM #repath r WHERE r.ProductId = p.ProductId);

    SELECT d.Id AS ProductId, d.TopCatId, d.CatId, d.SubCatId,
           COALESCE(NULLIF(d.SubCatId, 0), NULLIF(d.CatId, 0), NULLIF(d.TopCatId, 0), 0) AS NodeId
    INTO #pbefore
    FROM dbo.ProductData d JOIN #repath r ON r.ProductId = d.Id;

    /* moving a category must not carry products out of their EGRP category either */
    IF @SqlIsMaster = 0
    BEGIN
        SELECT @n = COUNT(*), @msg = MIN(CONCAT(pe.ProductCode, N' (EGRP ', pe.Egrp, N')'))
        FROM #pbefore b
        JOIN #pegrp pe ON pe.ProductId = b.ProductId
        JOIN #now nb   ON nb.CatId = b.NodeId
        JOIN #reach ra ON ra.CatId = b.NodeId
        WHERE NOT EXISTS (SELECT 1 FROM #p p WHERE p.ProductId = b.ProductId)
          AND nb.EgrpNodeId = pe.EgrpNodeId
          AND ISNULL(ra.EgrpNodeId, -1) <> pe.EgrpNodeId;
        IF @n > 0
        BEGIN
            SET @msg = CONCAT(N'That move would take ', @n, N' product(s), for example ', @msg, N', out of their EGRP category. Move the products first, or keep the category inside the EGRP.');
            THROW 50498, @msg, 1;
        END
        SET @msg = NULL;
    END

    /* ---------------------------------------------------------- apply */
    INSERT dbo.Category (CatId, CatName, ParentCatId, IsActive, IsPublic, EGRP, Type, Notes)
    SELECT pr.CatId, pr.CatName, pr.ParentCatId, pr.IsActive, ISNULL(c.IsPublic, pr.IsActive), pr.EGRP, 'folder', pr.Notes
    FROM #prop pr JOIN #c c ON c.RealId = pr.CatId
    WHERE (c.Id < 0 OR c.IsRestore = 1) AND c.IsDelete = 0;

    /* a restored category gets back the columns the desk doesn't edit */
    UPDATE k SET
        SalesCopy    = x.salesCopy,
        ImageName    = x.imageName,
        DisplayOrder = x.displayOrder,
        TemplateId   = x.templateId,
        ProConsumer  = x.proConsumer,
        Type         = ISNULL(x.[type], k.Type)
    FROM dbo.Category k
    JOIN #c c ON c.RealId = k.CatId
    CROSS APPLY OPENJSON(c.Extra)
         WITH (salesCopy nvarchar(max) '$.salesCopy', imageName nvarchar(400) '$.imageName',
               displayOrder int '$.displayOrder', templateId int '$.templateId',
               proConsumer int '$.proConsumer', [type] nvarchar(100) '$.type') x
    WHERE c.IsRestore = 1 AND c.Extra IS NOT NULL;

    UPDATE k SET
        CatName     = pr.CatName,
        ParentCatId = pr.ParentCatId,
        IsActive    = pr.IsActive,
        IsPublic    = CASE WHEN c.IsPublic IS NOT NULL THEN c.IsPublic
                           WHEN pr.IsActive <> k.IsActive THEN pr.IsActive
                           ELSE k.IsPublic END,
        Notes       = pr.Notes,
        EGRP        = pr.EGRP
    FROM dbo.Category k
    JOIN #prop pr ON pr.CatId = k.CatId AND pr.IsChanged = 1 AND pr.IsDeleted = 0
    LEFT JOIN #c c ON c.RealId = k.CatId;

    /* products: explicit moves first, then everything whose path changed */
    UPDATE d SET d.TopCatId = NULL, d.CatId = 0, d.SubCatId = NULL
    FROM dbo.ProductData d JOIN #p p ON p.ProductId = d.Id AND p.RealNodeId = 0;

    WITH target AS
    (
        SELECT b.ProductId, ISNULL(p.RealNodeId, b.NodeId) AS NodeId
        FROM #pbefore b LEFT JOIN #p p ON p.ProductId = b.ProductId
        WHERE ISNULL(p.RealNodeId, b.NodeId) <> 0
    )
    UPDATE d SET
        d.TopCatId = r.TopId,
        d.CatId    = CASE WHEN r.Depth = 1 THEN r.CatId WHEN r.Depth = 2 THEN r.CatId ELSE r.L2Id END,
        d.SubCatId = CASE WHEN r.Depth >= 3 THEN r.CatId ELSE NULL END
    FROM dbo.ProductData d
    JOIN target t ON t.ProductId = d.Id
    JOIN #reach r ON r.CatId = t.NodeId AND r.Depth >= 1;

    DELETE k FROM dbo.Category k JOIN #prop pr ON pr.CatId = k.CatId AND pr.IsDeleted = 1;

    /* ---------------------------------------------------------- history */
    INSERT piv2.CategoryChangeLog (PublishId, PublishedBy, Comment, RevertOfPublishId, ItemType, ItemId, ItemLabel, Action, Fields, Source, BeforeJson, AfterJson)
    SELECT @publishId, @User, @Comment, @RevertOf, 'CATEGORY', x.CatId,
           LEFT(COALESCE(a.CatName, b.CatName), 300),
           CASE WHEN b.CatId IS NULL THEN 'ADD' WHEN a.CatId IS NULL THEN 'DELETE' ELSE 'UPDATE' END,
           CASE WHEN a.CatId IS NOT NULL AND b.CatId IS NOT NULL THEN
               NULLIF(CONCAT(
                   CASE WHEN a.CatName COLLATE Latin1_General_BIN2 <> b.CatName COLLATE Latin1_General_BIN2 THEN 'name,' END,
                   CASE WHEN ISNULL(a.ParentCatId, -1) <> ISNULL(b.ParentCatId, -1) THEN 'parent,' END,
                   CASE WHEN a.IsActive <> b.IsActive OR a.IsPublic <> b.IsPublic THEN 'visible,' END,
                   CASE WHEN ISNULL(a.Notes, N'') COLLATE Latin1_General_BIN2 <> ISNULL(b.Notes, N'') COLLATE Latin1_General_BIN2 THEN 'notes,' END,
                   CASE WHEN ISNULL(a.EGRP, -1) <> ISNULL(b.EGRP, -1) THEN 'egrp,' END), '')
           END,
           CASE WHEN x.CatId IN (SELECT CatId FROM #cascade) AND c.RealId IS NULL THEN 'CASCADE' ELSE ISNULL(c.Source, 'USER') END,
           (SELECT b.CatId AS id, b.ParentCatId AS parentId, b.CatName AS name, b.IsActive AS isActive, b.IsPublic AS isPublic,
                   b.Notes AS notes, b.EGRP AS egrp,
                   b.SalesCopy AS [extra.salesCopy], b.ImageName AS [extra.imageName], b.DisplayOrder AS [extra.displayOrder],
                   b.TemplateId AS [extra.templateId], b.ProConsumer AS [extra.proConsumer], b.Type AS [extra.type]
            WHERE b.CatId IS NOT NULL FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           (SELECT a.CatId AS id, a.ParentCatId AS parentId, a.CatName AS name, a.IsActive AS isActive, a.IsPublic AS isPublic,
                   a.Notes AS notes, a.EGRP AS egrp WHERE a.CatId IS NOT NULL FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM (SELECT CatId FROM #prop WHERE IsChanged = 1) x
    LEFT JOIN #before b ON b.CatId = x.CatId
    LEFT JOIN dbo.Category a ON a.CatId = x.CatId
    LEFT JOIN #c c ON c.RealId = x.CatId
    WHERE NOT (b.CatId IS NOT NULL AND a.CatId IS NOT NULL
               AND a.CatName COLLATE Latin1_General_BIN2 = b.CatName COLLATE Latin1_General_BIN2
               AND ISNULL(a.ParentCatId, -1) = ISNULL(b.ParentCatId, -1)
               AND a.IsActive = b.IsActive AND a.IsPublic = b.IsPublic
               AND ISNULL(a.Notes, N'') COLLATE Latin1_General_BIN2 = ISNULL(b.Notes, N'') COLLATE Latin1_General_BIN2
               AND ISNULL(a.EGRP, -1) = ISNULL(b.EGRP, -1));

    INSERT piv2.CategoryChangeLog (PublishId, PublishedBy, Comment, RevertOfPublishId, ItemType, ItemId, ItemLabel, Action, Fields, Source, BeforeJson, AfterJson)
    SELECT @publishId, @User, @Comment, @RevertOf, 'PRODUCT', p.ProductId,
           LEFT(CONCAT(d.ProductCode, N' ', d.ModelName), 300), 'MOVE', NULL, p.Source,
           (SELECT b.NodeId AS nodeId, b.TopCatId AS topCatId, b.CatId AS catId, b.SubCatId AS subCatId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           (SELECT COALESCE(NULLIF(d.SubCatId, 0), NULLIF(d.CatId, 0), NULLIF(d.TopCatId, 0), 0) AS nodeId,
                   d.TopCatId AS topCatId, d.CatId AS catId, d.SubCatId AS subCatId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM #p p
    JOIN dbo.ProductData d ON d.Id = p.ProductId
    JOIN #pbefore b ON b.ProductId = p.ProductId
    WHERE b.NodeId <> COALESCE(NULLIF(d.SubCatId, 0), NULLIF(d.CatId, 0), NULLIF(d.TopCatId, 0), 0);

    COMMIT;

    /* 1. result */
    SELECT @publishId AS PublishId,
           (SELECT COUNT(*) FROM piv2.CategoryChangeLog WHERE PublishId = @publishId AND ItemType = 'CATEGORY') AS CategoryChanges,
           (SELECT COUNT(*) FROM piv2.CategoryChangeLog WHERE PublishId = @publishId AND ItemType = 'PRODUCT')  AS ProductChanges,
           (SELECT COUNT(*) FROM #repath) - (SELECT COUNT(*) FROM #p)                                           AS ProductsRepathed;

    /* 2. the ids given to new categories */
    SELECT Id AS TempId, RealId AS CatId FROM #c WHERE Id < 0;
END
GO

/* ================================================================ revert */

CREATE OR ALTER PROCEDURE piv2.CategoryDesk_RevertCheck
    @PublishId int
AS
BEGIN
    SET NOCOUNT ON;

    /* Items in this publish that a later publish changed again. */
    SELECT l.ItemType, l.ItemId, l.ItemLabel,
           later.PublishId AS LaterPublishId, later.PublishedBy AS LaterBy, later.PublishedAt AS LaterAt
    FROM piv2.CategoryChangeLog l
    CROSS APPLY (SELECT TOP (1) x.PublishId, x.PublishedBy, x.PublishedAt
                 FROM piv2.CategoryChangeLog x
                 WHERE x.ItemType = l.ItemType AND x.ItemId = l.ItemId AND x.PublishId > l.PublishId
                 ORDER BY x.PublishId DESC) later
    WHERE l.PublishId = @PublishId
    ORDER BY l.ItemType, l.ItemLabel;
END
GO

CREATE OR ALTER PROCEDURE piv2.CategoryDesk_Revert
    @PublishId     int,
    @SkipConflicts bit = 1,
    @User          nvarchar(128),
    @SqlIsMaster   bit = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM piv2.CategoryChangeLog WHERE PublishId = @PublishId)
        THROW 50495, N'That publish doesn''t exist.', 1;

    SELECT l.*
    INTO #items
    FROM piv2.CategoryChangeLog l
    WHERE l.PublishId = @PublishId
      AND (@SkipConflicts = 0 OR NOT EXISTS (SELECT 1 FROM piv2.CategoryChangeLog x
                                              WHERE x.ItemType = l.ItemType AND x.ItemId = l.ItemId AND x.PublishId > l.PublishId));

    IF NOT EXISTS (SELECT 1 FROM #items)
        THROW 50496, N'Everything in that publish has been changed since. Nothing was reverted.', 1;

    DECLARE @changes nvarchar(max) =
    (
        SELECT
            (SELECT
                 i.ItemId                                                     AS id,
                 JSON_VALUE(i.BeforeJson, '$.parentId')                       AS parentId,
                 ISNULL(JSON_VALUE(i.BeforeJson, '$.name'), i.ItemLabel)      AS name,
                 CAST(JSON_VALUE(i.BeforeJson, '$.isActive') AS bit)          AS visible,
                 CAST(JSON_VALUE(i.BeforeJson, '$.isPublic') AS bit)          AS isPublic,
                 JSON_VALUE(i.BeforeJson, '$.notes')                          AS notes,
                 JSON_VALUE(i.BeforeJson, '$.egrp')                           AS egrp,
                 JSON_QUERY(i.BeforeJson, '$.extra')                          AS extra,
                 CAST(CASE WHEN i.Action = 'ADD' THEN 1 ELSE 0 END AS bit)    AS [delete],
                 CAST(CASE WHEN i.Action = 'DELETE' THEN 1 ELSE 0 END AS bit) AS [restore],
                 'REVERT'                                                     AS source
             FROM #items i
             WHERE i.ItemType = 'CATEGORY'
               AND NOT (i.Action = 'ADD' AND NOT EXISTS (SELECT 1 FROM dbo.Category k WHERE k.CatId = i.ItemId))
             FOR JSON PATH, INCLUDE_NULL_VALUES)                              AS categories,
            (SELECT
                 i.ItemId                                                     AS productId,
                 CAST(JSON_VALUE(i.BeforeJson, '$.nodeId') AS int)            AS nodeId,
                 'REVERT'                                                     AS source
             FROM #items i
             WHERE i.ItemType = 'PRODUCT'
             FOR JSON PATH)                                                   AS products
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    DECLARE @comment nvarchar(500) = CONCAT(N'Revert of publish #', @PublishId);

    EXEC piv2.CategoryDesk_Publish
        @Changes = @changes, @Comment = @comment, @User = @User,
        @SqlIsMaster = @SqlIsMaster, @BaseVersion = NULL, @RevertOf = @PublishId;
END
GO

/* ================================================================ history */

CREATE OR ALTER PROCEDURE piv2.CategoryDesk_History
    @Top int = 500
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (@Top)
        l.PublishId,
        MIN(l.PublishedAt)                                          AS PublishedAt,
        MIN(l.PublishedBy)                                          AS PublishedBy,
        MIN(l.Comment)                                              AS Comment,
        MIN(l.RevertOfPublishId)                                    AS RevertOfPublishId,
        (SELECT MAX(r.PublishId) FROM piv2.CategoryChangeLog r WHERE r.RevertOfPublishId = l.PublishId) AS RevertedByPublishId,
        SUM(CASE WHEN l.ItemType = 'CATEGORY' THEN 1 ELSE 0 END)    AS CategoryChanges,
        SUM(CASE WHEN l.ItemType = 'PRODUCT'  THEN 1 ELSE 0 END)    AS ProductChanges,
        SUM(CASE WHEN l.Source = 'AI'   THEN 1 ELSE 0 END)          AS FromAi,
        SUM(CASE WHEN l.Source = 'RULE' THEN 1 ELSE 0 END)          AS FromSuggestion
    FROM piv2.CategoryChangeLog l
    GROUP BY l.PublishId
    ORDER BY l.PublishId DESC;
END
GO

CREATE OR ALTER PROCEDURE piv2.CategoryDesk_PublishDetail
    @PublishId int
AS
BEGIN
    SET NOCOUNT ON;

    SELECT l.ChangeId, l.PublishId, l.PublishedAt, l.PublishedBy, l.Comment, l.ItemType, l.ItemId, l.ItemLabel,
           l.Action, l.Fields, l.Source, l.BeforeJson, l.AfterJson,
           bef.PathNames AS BeforePath, aft.PathNames AS AfterPath
    FROM piv2.CategoryChangeLog l
    LEFT JOIN piv2.vCategoryTree bef
           ON bef.CatId = CASE WHEN l.ItemType = 'PRODUCT' THEN TRY_CAST(JSON_VALUE(l.BeforeJson, '$.nodeId') AS int)
                              ELSE TRY_CAST(JSON_VALUE(l.BeforeJson, '$.parentId') AS int) END
    LEFT JOIN piv2.vCategoryTree aft
           ON aft.CatId = CASE WHEN l.ItemType = 'PRODUCT' THEN TRY_CAST(JSON_VALUE(l.AfterJson, '$.nodeId') AS int)
                              ELSE TRY_CAST(JSON_VALUE(l.AfterJson, '$.parentId') AS int) END
    WHERE l.PublishId = @PublishId
    ORDER BY l.ItemType, l.ItemLabel;
END
GO

PRINT N'Category Desk procedures ready.';
