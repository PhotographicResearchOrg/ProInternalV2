/* Category desk discovery. Read-only. Run in Pro (SSMS), send back the results.
   Each block is its own batch, so one failing block doesn't stop the rest. */

USE PRO;
GO

-- 1. How the B2B site reads categories and filters by them
SELECT name, OBJECT_DEFINITION(object_id) AS definition
FROM sys.procedures
WHERE name IN ('Shop_GetActiveCategories', 'Warehouse_Search_FIX',
               'Shop_CategoryGetProducts', 'Product_GetProductCategories');
GO

-- 2. Anything else in the database that reads Category or the product category columns
SELECT OBJECT_SCHEMA_NAME(m.object_id) AS schema_name, OBJECT_NAME(m.object_id) AS object_name, o.type_desc
FROM sys.sql_modules m
JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE '%Category%'
   OR m.definition LIKE '%TopCatId%'
   OR m.definition LIKE '%SubCatId%'
ORDER BY object_name;
GO

-- 3. Category and ProductData category columns
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Category'
   OR (TABLE_NAME = 'ProductData' AND COLUMN_NAME LIKE '%Cat%')
ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO

-- 4. Tree shape today: depth, roots, flags
WITH tree AS (
    SELECT CatId, ParentCatId, 0 AS depth
    FROM dbo.Category WHERE ParentCatId IS NULL
    UNION ALL
    SELECT c.CatId, c.ParentCatId, t.depth + 1
    FROM dbo.Category c JOIN tree t ON c.ParentCatId = t.CatId
)
SELECT depth,
       COUNT(*)                                        AS nodes,
       SUM(CASE WHEN c.IsActive = 1 THEN 1 ELSE 0 END) AS active,
       SUM(CASE WHEN c.IsPublic = 1 THEN 1 ELSE 0 END) AS public_,
       SUM(CASE WHEN c.EGRP IS NOT NULL THEN 1 ELSE 0 END) AS egrp_nodes
FROM tree t JOIN dbo.Category c ON c.CatId = t.CatId
GROUP BY depth ORDER BY depth;
GO

-- 5. Orphans: nodes whose parent doesn't exist (invisible on B2B)
SELECT c.CatId, c.CatName, c.ParentCatId
FROM dbo.Category c
LEFT JOIN dbo.Category p ON p.CatId = c.ParentCatId
WHERE c.ParentCatId IS NOT NULL AND p.CatId IS NULL;
GO

-- 6. Where products sit today
SELECT
    COUNT(*)                                                             AS products,
    SUM(CASE WHEN ISNULL(TopCatId,0) = 0 THEN 1 ELSE 0 END)              AS no_top,
    SUM(CASE WHEN ISNULL(CatId,0) = 0 THEN 1 ELSE 0 END)                 AS no_cat,
    SUM(CASE WHEN ISNULL(SubCatId,0) = 0 THEN 1 ELSE 0 END)              AS no_sub,
    SUM(CASE WHEN ISNULL(TopCatId,0)=0 AND ISNULL(CatId,0)=0
              AND ISNULL(SubCatId,0)=0 THEN 1 ELSE 0 END)                AS uncategorized
FROM dbo.ProductData;
GO

-- 7. Products pointing at a category that's missing or inactive
SELECT 'missing' AS problem, COUNT(*) AS products
FROM dbo.ProductData d
WHERE ISNULL(d.SubCatId, ISNULL(d.CatId, d.TopCatId)) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.Category c
                  WHERE c.CatId = COALESCE(NULLIF(d.SubCatId,0), NULLIF(d.CatId,0), d.TopCatId))
UNION ALL
SELECT 'inactive', COUNT(*)
FROM dbo.ProductData d
JOIN dbo.Category c ON c.CatId = COALESCE(NULLIF(d.SubCatId,0), NULLIF(d.CatId,0), d.TopCatId)
WHERE c.IsActive = 0;
GO

-- 8. Is each product inside its Computyme EGRP category? (IVMSTData.E_GRP; the EGRP category can be at any level)
WITH tree AS (
    SELECT CatId, EGRP, CAST(CASE WHEN EGRP IS NOT NULL THEN CatId END AS int) AS EgrpNodeId
    FROM dbo.Category WHERE ParentCatId IS NULL
    UNION ALL
    SELECT c.CatId, c.EGRP, CASE WHEN c.EGRP IS NOT NULL THEN c.CatId ELSE t.EgrpNodeId END
    FROM dbo.Category c JOIN tree t ON c.ParentCatId = t.CatId
),
prod AS (
    SELECT d.Id, COALESCE(NULLIF(d.SubCatId, 0), NULLIF(d.CatId, 0), NULLIF(d.TopCatId, 0), 0) AS NodeId,
           (SELECT TOP (1) TRY_CAST(i.E_GRP AS int) FROM dbo.IVMSTData i WHERE i.ID = d.ProductCode) AS Egrp
    FROM dbo.ProductData d
)
SELECT
    SUM(CASE WHEN p.NodeId = 0 THEN 1 ELSE 0 END)                                      AS no_category,
    SUM(CASE WHEN p.Egrp IS NULL THEN 1 ELSE 0 END)                                     AS no_egrp_in_computyme,
    SUM(CASE WHEN e.CatId IS NULL AND p.Egrp IS NOT NULL THEN 1 ELSE 0 END)             AS egrp_not_in_tree,
    SUM(CASE WHEN p.NodeId <> 0 AND t.EgrpNodeId = e.CatId THEN 1 ELSE 0 END)          AS inside_its_egrp,
    SUM(CASE WHEN p.NodeId <> 0 AND e.CatId IS NOT NULL AND ISNULL(t.EgrpNodeId, -1) <> e.CatId THEN 1 ELSE 0 END) AS outside_its_egrp
FROM prod p
LEFT JOIN tree t ON t.CatId = p.NodeId
LEFT JOIN (SELECT EGRP, MIN(CatId) AS CatId FROM dbo.Category WHERE EGRP IS NOT NULL GROUP BY EGRP) e ON e.EGRP = p.Egrp
OPTION (MAXRECURSION 50);
GO
