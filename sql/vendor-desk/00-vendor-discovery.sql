/*
    Vendor Desk · 00 · discovery (READ ONLY)

    Run in the PRO database. Creates nothing, changes nothing (temp tables only).
    Paste every result grid back so the vendor capture can be built on real data.

    Today a "vendor" lives in up to five places:
      EDA VNMST.VNMST     PRO vendor / vendor group. Products point at it (IVMST VEND, field 5).
                          Field 12 APID points at the AP vendor.
      EDA APMST.APMST     AP vendor (who we pay). Products point at it (IVMST A.VENDOR, field 37).
      EDA VENDXREF        PRO vendor -> AP vendor cross reference (AVEND). Used by IPBILL.
      PRO dbo.Vendor      PIV2 vendor grid (ids assumed = APMST ids; new ones < 9000, 9999 = PRO).
      PRO dbo.Brand       Brand.VendorID (one vendor per brand), and dbo.VendorBrand (by brand name).

    Results:
      1. Which EDA vendor/PO files exist, row counts and columns
      2. Vendor identity matrix: one row per id seen anywhere, where it appears, names, links, product counts
      3. Disagreements: each kind of mismatch with a count, then the rows
      4. Brand <-> vendor: Brand.VendorID vs VendorBrand
*/
SET NOCOUNT ON;

/* ---------- 1. EDA files ---------- */
IF OBJECT_ID('tempdb..#files') IS NOT NULL DROP TABLE #files;
CREATE TABLE #files (SchemaName sysname, TableName sysname, RowCnt bigint NULL, Columns nvarchar(max));

INSERT #files (SchemaName, TableName, Columns)
SELECT s.name, t.name,
       STUFF((SELECT ', ' + c.name FROM EDA.sys.columns c WHERE c.object_id = t.object_id ORDER BY c.column_id
              FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '')
FROM EDA.sys.tables t
JOIN EDA.sys.schemas s ON s.schema_id = t.schema_id
WHERE s.name IN ('VNMST','APMST','VENDXREF','VENDPERC','IVPO','ORDDUE','CURRENCIES','TERMSDATA','BRANDS',
                 'PRICE.CHANGES','PRICE_CHANGES','MAP.PRICE','MAP_PRICE','KITS','VENDORD','IVEND','BVEND','IVMST.LOG','IVMST_LOG');

DECLARE @s sysname, @t sysname, @sql nvarchar(max), @n bigint;
DECLARE f CURSOR LOCAL FAST_FORWARD FOR SELECT SchemaName, TableName FROM #files;
OPEN f; FETCH NEXT FROM f INTO @s, @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'SELECT @n = COUNT_BIG(*) FROM EDA.' + QUOTENAME(@s) + N'.' + QUOTENAME(@t) + N';';
    BEGIN TRY EXEC sp_executesql @sql, N'@n bigint OUTPUT', @n = @n OUTPUT; END TRY BEGIN CATCH SET @n = NULL; END CATCH
    UPDATE #files SET RowCnt = @n WHERE SchemaName = @s AND TableName = @t;
    FETCH NEXT FROM f INTO @s, @t;
END
CLOSE f; DEALLOCATE f;

SELECT '1. EDA files' AS Result, SchemaName, TableName, RowCnt, Columns FROM #files ORDER BY SchemaName, TableName;

/* ---------- helpers: find a column by candidate names ---------- */
DECLARE @vn_id sysname, @vn_name sysname, @vn_apid sysname, @vn_pct sysname,
        @ap_id sysname, @ap_name sysname, @ap_due sysname, @ap_notuse sysname,
        @vx_id sysname, @vx_av sysname;

SELECT TOP (1) @vn_id   = c.name FROM EDA.sys.columns c JOIN EDA.sys.tables t ON t.object_id=c.object_id JOIN EDA.sys.schemas s ON s.schema_id=t.schema_id
 WHERE s.name='VNMST' AND t.name='VNMST' AND c.name IN ('ID','VNMST','@ID') ORDER BY CASE c.name WHEN 'ID' THEN 0 ELSE 1 END;
SELECT TOP (1) @vn_name = c.name FROM EDA.sys.columns c JOIN EDA.sys.tables t ON t.object_id=c.object_id JOIN EDA.sys.schemas s ON s.schema_id=t.schema_id
 WHERE s.name='VNMST' AND t.name='VNMST' AND c.name IN ('NAME','F1');
SELECT TOP (1) @vn_apid = c.name FROM EDA.sys.columns c JOIN EDA.sys.tables t ON t.object_id=c.object_id JOIN EDA.sys.schemas s ON s.schema_id=t.schema_id
 WHERE s.name='VNMST' AND t.name='VNMST' AND c.name IN ('APID','APMST','F12') ORDER BY CASE c.name WHEN 'APID' THEN 0 WHEN 'APMST' THEN 1 ELSE 2 END;
SELECT TOP (1) @vn_pct  = c.name FROM EDA.sys.columns c JOIN EDA.sys.tables t ON t.object_id=c.object_id JOIN EDA.sys.schemas s ON s.schema_id=t.schema_id
 WHERE s.name='VNMST' AND t.name='VNMST' AND c.name IN ('PCT','F8');
SELECT TOP (1) @ap_id   = c.name FROM EDA.sys.columns c JOIN EDA.sys.tables t ON t.object_id=c.object_id JOIN EDA.sys.schemas s ON s.schema_id=t.schema_id
 WHERE s.name='APMST' AND t.name='APMST' AND c.name IN ('ID','APMST','@ID') ORDER BY CASE c.name WHEN 'ID' THEN 0 ELSE 1 END;
SELECT TOP (1) @ap_name = c.name FROM EDA.sys.columns c JOIN EDA.sys.tables t ON t.object_id=c.object_id JOIN EDA.sys.schemas s ON s.schema_id=t.schema_id
 WHERE s.name='APMST' AND t.name='APMST' AND c.name IN ('NAME','F1');
SELECT TOP (1) @ap_due  = c.name FROM EDA.sys.columns c JOIN EDA.sys.tables t ON t.object_id=c.object_id JOIN EDA.sys.schemas s ON s.schema_id=t.schema_id
 WHERE s.name='APMST' AND t.name='APMST' AND c.name IN ('DUE_DAYS','DUE.DAYS','F10');
SELECT TOP (1) @ap_notuse = c.name FROM EDA.sys.columns c JOIN EDA.sys.tables t ON t.object_id=c.object_id JOIN EDA.sys.schemas s ON s.schema_id=t.schema_id
 WHERE s.name='APMST' AND t.name='APMST' AND c.name IN ('NOT_IN_USE','NOT.IN.USE','F22');
SELECT TOP (1) @vx_id   = c.name FROM EDA.sys.columns c JOIN EDA.sys.tables t ON t.object_id=c.object_id JOIN EDA.sys.schemas s ON s.schema_id=t.schema_id
 WHERE s.name='VENDXREF' AND t.name='VENDXREF' AND c.name IN ('ID','VENDXREF','@ID') ORDER BY CASE c.name WHEN 'ID' THEN 0 ELSE 1 END;
SELECT TOP (1) @vx_av   = c.name FROM EDA.sys.columns c JOIN EDA.sys.tables t ON t.object_id=c.object_id JOIN EDA.sys.schemas s ON s.schema_id=t.schema_id
 WHERE s.name='VENDXREF' AND t.name='VENDXREF' AND c.name IN ('AVEND','F1');

SELECT '1b. columns used' AS Result,
       @vn_id AS VNMST_Id, @vn_name AS VNMST_Name, @vn_apid AS VNMST_APID, @vn_pct AS VNMST_PCT,
       @ap_id AS APMST_Id, @ap_name AS APMST_Name, @ap_due AS APMST_DueDays, @ap_notuse AS APMST_NotInUse,
       @vx_id AS VENDXREF_Id, @vx_av AS VENDXREF_AVEND;

/* ---------- 2. identity matrix ---------- */
IF OBJECT_ID('tempdb..#vn') IS NOT NULL DROP TABLE #vn;
IF OBJECT_ID('tempdb..#ap') IS NOT NULL DROP TABLE #ap;
IF OBJECT_ID('tempdb..#vx') IS NOT NULL DROP TABLE #vx;
CREATE TABLE #vn (Id int PRIMARY KEY, RawId varchar(50), Name varchar(200), ApId int NULL, RawApId varchar(50), Pct varchar(30));
CREATE TABLE #ap (Id int PRIMARY KEY, RawId varchar(50), Name varchar(200), DueDays varchar(30), NotInUse varchar(30));
CREATE TABLE #vx (Id int PRIMARY KEY, RawId varchar(50), AVend int NULL, RawAVend varchar(50));

IF @vn_id IS NOT NULL
BEGIN
    SET @sql = N'INSERT #vn (Id, RawId, Name, ApId, RawApId, Pct)
        SELECT TRY_CAST(x.' + QUOTENAME(@vn_id) + N' AS int), MAX(CAST(x.' + QUOTENAME(@vn_id) + N' AS varchar(50))),
               MAX(CAST(' + ISNULL(N'x.' + QUOTENAME(@vn_name), N'NULL') + N' AS varchar(200))),
               MAX(TRY_CAST(' + ISNULL(N'x.' + QUOTENAME(@vn_apid), N'NULL') + N' AS int)),
               MAX(CAST(' + ISNULL(N'x.' + QUOTENAME(@vn_apid), N'NULL') + N' AS varchar(50))),
               MAX(CAST(' + ISNULL(N'x.' + QUOTENAME(@vn_pct), N'NULL') + N' AS varchar(30)))
        FROM EDA.VNMST.VNMST x
        WHERE TRY_CAST(x.' + QUOTENAME(@vn_id) + N' AS int) IS NOT NULL
        GROUP BY TRY_CAST(x.' + QUOTENAME(@vn_id) + N' AS int);';
    EXEC sp_executesql @sql;
END
IF @ap_id IS NOT NULL
BEGIN
    SET @sql = N'INSERT #ap (Id, RawId, Name, DueDays, NotInUse)
        SELECT TRY_CAST(x.' + QUOTENAME(@ap_id) + N' AS int), MAX(CAST(x.' + QUOTENAME(@ap_id) + N' AS varchar(50))),
               MAX(CAST(' + ISNULL(N'x.' + QUOTENAME(@ap_name), N'NULL') + N' AS varchar(200))),
               MAX(CAST(' + ISNULL(N'x.' + QUOTENAME(@ap_due), N'NULL') + N' AS varchar(30))),
               MAX(CAST(' + ISNULL(N'x.' + QUOTENAME(@ap_notuse), N'NULL') + N' AS varchar(30)))
        FROM EDA.APMST.APMST x
        WHERE TRY_CAST(x.' + QUOTENAME(@ap_id) + N' AS int) IS NOT NULL
        GROUP BY TRY_CAST(x.' + QUOTENAME(@ap_id) + N' AS int);';
    EXEC sp_executesql @sql;
END
IF @vx_id IS NOT NULL
BEGIN
    SET @sql = N'INSERT #vx (Id, RawId, AVend, RawAVend)
        SELECT TRY_CAST(x.' + QUOTENAME(@vx_id) + N' AS int), MAX(CAST(x.' + QUOTENAME(@vx_id) + N' AS varchar(50))),
               MAX(TRY_CAST(' + ISNULL(N'x.' + QUOTENAME(@vx_av), N'NULL') + N' AS int)),
               MAX(CAST(' + ISNULL(N'x.' + QUOTENAME(@vx_av), N'NULL') + N' AS varchar(50)))
        FROM EDA.VENDXREF.VENDXREF x
        WHERE TRY_CAST(x.' + QUOTENAME(@vx_id) + N' AS int) IS NOT NULL
        GROUP BY TRY_CAST(x.' + QUOTENAME(@vx_id) + N' AS int);';
    EXEC sp_executesql @sql;
END

/* product usage from the PRO copy of IVMST */
IF OBJECT_ID('tempdb..#prodvend') IS NOT NULL DROP TABLE #prodvend;
SELECT TRY_CAST(i.vend AS int) AS ProVend, TRY_CAST(i.A_VENDOR AS int) AS AVend, i.status
INTO #prodvend
FROM dbo.IVMSTData i;

IF OBJECT_ID('tempdb..#ids') IS NOT NULL DROP TABLE #ids;
SELECT Id INTO #ids FROM (
    SELECT VendorId AS Id FROM dbo.Vendor
    UNION SELECT Id FROM #vn UNION SELECT ApId FROM #vn WHERE ApId IS NOT NULL
    UNION SELECT Id FROM #ap
    UNION SELECT Id FROM #vx UNION SELECT AVend FROM #vx WHERE AVend IS NOT NULL
    UNION SELECT ProVend FROM #prodvend WHERE ProVend IS NOT NULL
    UNION SELECT AVend FROM #prodvend WHERE AVend IS NOT NULL
    UNION SELECT TRY_CAST(VendorID AS int) FROM dbo.Brand WHERE TRY_CAST(VendorID AS int) IS NOT NULL
) u;

IF OBJECT_ID('tempdb..#matrix') IS NOT NULL DROP TABLE #matrix;
SELECT i.Id,
       CAST(CASE WHEN v.VendorId IS NOT NULL THEN 1 ELSE 0 END AS bit) AS InPiv2Vendor,
       CAST(CASE WHEN vn.Id IS NOT NULL THEN 1 ELSE 0 END AS bit)      AS InVNMST,
       CAST(CASE WHEN ap.Id IS NOT NULL THEN 1 ELSE 0 END AS bit)      AS InAPMST,
       CAST(CASE WHEN vx.Id IS NOT NULL THEN 1 ELSE 0 END AS bit)      AS InVENDXREF,
       v.Name  AS Piv2Name,
       vn.Name AS VnmstName,
       ap.Name AS ApmstName,
       vn.ApId AS VnmstApId,
       vx.AVend AS XrefAVend,
       (SELECT COUNT(*) FROM #prodvend p WHERE p.ProVend = i.Id)                              AS ProductsAsProVendor,
       (SELECT COUNT(*) FROM #prodvend p WHERE p.ProVend = i.Id AND ISNULL(p.status,'') <> '3') AS LiveProductsAsProVendor,
       (SELECT COUNT(*) FROM #prodvend p WHERE p.AVend = i.Id)                                AS ProductsAsActualVendor,
       (SELECT COUNT(DISTINCT p.AVend) FROM #prodvend p WHERE p.ProVend = i.Id)               AS DistinctActualVendors,
       (SELECT COUNT(*) FROM dbo.Brand b WHERE TRY_CAST(b.VendorID AS int) = i.Id)            AS BrandsByBrandVendorID,
       (SELECT COUNT(*) FROM dbo.VendorBrand vb WHERE vb.VendorId = i.Id)                      AS BrandsByVendorBrand,
       vn.Pct AS VnmstPct, ap.DueDays AS ApmstDueDays, ap.NotInUse AS ApmstNotInUse
INTO #matrix
FROM #ids i
LEFT JOIN dbo.Vendor v ON v.VendorId = i.Id
LEFT JOIN #vn vn ON vn.Id = i.Id
LEFT JOIN #ap ap ON ap.Id = i.Id
LEFT JOIN #vx vx ON vx.Id = i.Id;

SELECT '2. identity matrix' AS Result, * FROM #matrix ORDER BY Id;

/* ---------- 3. disagreements ---------- */
IF OBJECT_ID('tempdb..#issues') IS NOT NULL DROP TABLE #issues;
CREATE TABLE #issues (Issue varchar(80), Id int, Detail nvarchar(400));

INSERT #issues SELECT 'VNMST APID differs from VENDXREF AVEND', Id, CONCAT('APID ', VnmstApId, ' vs AVEND ', XrefAVend)
FROM #matrix WHERE InVNMST = 1 AND InVENDXREF = 1 AND ISNULL(VnmstApId,-1) <> ISNULL(XrefAVend,-1);

INSERT #issues SELECT 'VNMST APID not in APMST', vn.Id, CONCAT('APID ', vn.RawApId)
FROM #vn vn WHERE vn.RawApId IS NOT NULL AND LTRIM(RTRIM(vn.RawApId)) <> '' AND NOT EXISTS (SELECT 1 FROM #ap a WHERE a.Id = vn.ApId);

INSERT #issues SELECT 'VNMST has no APID', vn.Id, vn.Name
FROM #vn vn WHERE vn.RawApId IS NULL OR LTRIM(RTRIM(vn.RawApId)) = '';

INSERT #issues SELECT 'VNMST id and its APID differ', vn.Id, CONCAT(vn.Name, ' -> AP ', vn.ApId)
FROM #vn vn WHERE vn.ApId IS NOT NULL AND vn.ApId <> vn.Id;

INSERT #issues SELECT 'Product PRO vendor not in VNMST', p.ProVend, CONCAT(COUNT(*), ' products')
FROM #prodvend p WHERE p.ProVend IS NOT NULL AND NOT EXISTS (SELECT 1 FROM #vn vn WHERE vn.Id = p.ProVend)
GROUP BY p.ProVend;

INSERT #issues SELECT 'Product actual vendor not in APMST', p.AVend, CONCAT(COUNT(*), ' products')
FROM #prodvend p WHERE p.AVend IS NOT NULL AND NOT EXISTS (SELECT 1 FROM #ap a WHERE a.Id = p.AVend)
GROUP BY p.AVend;

INSERT #issues SELECT 'Product actual vendor differs from its PRO vendor''s APID', p.ProVend,
       CONCAT(COUNT(*), ' products; PRO vendor APID ', MAX(vn.ApId), ', product actual vendors: ',
              STRING_AGG(CAST(p.AVend AS varchar(20)), ',') WITHIN GROUP (ORDER BY p.AVend))
FROM (SELECT DISTINCT ProVend, AVend FROM #prodvend) p
JOIN #vn vn ON vn.Id = p.ProVend
WHERE p.AVend IS NOT NULL AND vn.ApId IS NOT NULL AND p.AVend <> vn.ApId
GROUP BY p.ProVend;

INSERT #issues SELECT 'PIV2 vendor in neither VNMST nor APMST', Id, Piv2Name
FROM #matrix WHERE InPiv2Vendor = 1 AND InVNMST = 0 AND InAPMST = 0;

INSERT #issues SELECT 'PRO vendor (VNMST) missing from PIV2 vendor grid', Id, VnmstName
FROM #matrix WHERE InVNMST = 1 AND InPiv2Vendor = 0;

INSERT #issues SELECT 'AP vendor (APMST) missing from PIV2 vendor grid', Id, ApmstName
FROM #matrix WHERE InAPMST = 1 AND InPiv2Vendor = 0;

INSERT #issues SELECT 'Same id, different name VNMST vs APMST', Id, CONCAT(VnmstName, ' | ', ApmstName)
FROM #matrix WHERE InVNMST = 1 AND InAPMST = 1 AND LTRIM(RTRIM(ISNULL(VnmstName,''))) <> LTRIM(RTRIM(ISNULL(ApmstName,'')));

SELECT '3a. disagreement counts' AS Result, Issue, COUNT(*) AS Rows FROM #issues GROUP BY Issue ORDER BY Issue;
SELECT '3b. disagreements' AS Result, Issue, Id, Detail FROM #issues ORDER BY Issue, Id;

/* ---------- 4. brand <-> vendor ---------- */
SELECT '4. brand vendor links' AS Result,
       b.BrandId, b.BrandName, TRY_CAST(b.VendorID AS int) AS BrandVendorID,
       STRING_AGG(CAST(vb.VendorId AS varchar(20)), ',') AS VendorBrandVendorIds,
       CASE
         WHEN COUNT(vb.VendorId) = 0 THEN 'only Brand.VendorID'
         WHEN SUM(CASE WHEN vb.VendorId = TRY_CAST(b.VendorID AS int) THEN 1 ELSE 0 END) = 0 THEN 'DISAGREE'
         WHEN COUNT(vb.VendorId) > 1 THEN 'VendorBrand has several vendors'
         ELSE 'agree' END AS Status,
       (SELECT COUNT(*) FROM dbo.ProductData d WHERE d.BrandId = b.BrandId) AS Products
FROM dbo.Brand b
LEFT JOIN dbo.VendorBrand vb ON vb.BrandName COLLATE DATABASE_DEFAULT = b.BrandName COLLATE DATABASE_DEFAULT
GROUP BY b.BrandId, b.BrandName, b.VendorID
ORDER BY CASE WHEN SUM(CASE WHEN vb.VendorId = TRY_CAST(b.VendorID AS int) THEN 1 ELSE 0 END) = 0 AND COUNT(vb.VendorId) > 0 THEN 0 ELSE 1 END, b.BrandName;

SELECT '4b. VendorBrand names with no dbo.Brand' AS Result, vb.VendorId, vb.BrandName
FROM dbo.VendorBrand vb
WHERE NOT EXISTS (SELECT 1 FROM dbo.Brand b WHERE b.BrandName COLLATE DATABASE_DEFAULT = vb.BrandName COLLATE DATABASE_DEFAULT)
ORDER BY vb.VendorId, vb.BrandName;
