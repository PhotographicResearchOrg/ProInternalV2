/* ---------------------------------------------------------------
    Vendor Desk · 03  Product supply: vendor, class, status and stock by warehouse on the product page

    Database: PRO      Safe to run twice. Adds one table and one procedure; changes nothing existing.

    piv2.Warehouse              where stock is held: PRO's own warehouse in Hatboro, PA (Computyme's stock),
                                and later 3PL warehouses. Seeded with PA only (insert-only).
    piv2.Product_SupplyInfo     @ProductId: three result sets
        1. the product's vendor (Computyme's actual vendor, IVMST A.VENDOR), its brand's vendor (Brand.VendorID,
           SQL master) and whether they agree; its class (Computyme vendor group, IVMST VEND); suspend status
           (IVMST field 15: 1 / 2 / 3) with its meaning
        2. stock by warehouse: PA from Computyme (on hand, member orders waiting, on order, bin locations
           IVMST P.LOC / S.LOC when the mirror has them); one row per other active warehouse with no stock yet
   --------------------------------------------------------------- */

USE PRO;
GO
SET NOCOUNT ON;
GO
IF SCHEMA_ID('piv2') IS NULL EXEC('CREATE SCHEMA piv2');
GO

IF OBJECT_ID('piv2.Warehouse', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.Warehouse
    (
        WarehouseCode  varchar(10)    NOT NULL CONSTRAINT PK_Warehouse PRIMARY KEY,
        Name           nvarchar(120)  NOT NULL,
        WarehouseType  varchar(10)    NOT NULL CONSTRAINT CK_Warehouse_Type CHECK (WarehouseType IN ('OWN','3PL','VENDOR')),
        City           nvarchar(80)   NULL,
        State          nvarchar(40)   NULL,
        Country        char(2)        NULL,
        StockSource    varchar(12)    NOT NULL CONSTRAINT CK_Warehouse_Source CHECK (StockSource IN ('COMPUTYME','PIV2','FEED')),
        Notes          nvarchar(400)  NULL,
        IsActive       bit            NOT NULL CONSTRAINT DF_Warehouse_Active DEFAULT (1),
        SortOrder      int            NOT NULL CONSTRAINT DF_Warehouse_Sort DEFAULT (0)
    );
END
GO

MERGE piv2.Warehouse AS t
USING (VALUES
 ('PA', N'PRO warehouse', 'OWN', N'Hatboro', N'PA', 'US', 'COMPUTYME',
  N'Computyme''s stock: on hand = received layers less member orders waiting (dbo.Product Inventory). Ship-to on POs (IV45.07).', 10)
) AS s (WarehouseCode, Name, WarehouseType, City, State, Country, StockSource, Notes, SortOrder)
ON t.WarehouseCode = s.WarehouseCode
WHEN NOT MATCHED BY TARGET THEN
    INSERT (WarehouseCode, Name, WarehouseType, City, State, Country, StockSource, Notes, SortOrder)
    VALUES (s.WarehouseCode, s.Name, s.WarehouseType, s.City, s.State, s.Country, s.StockSource, s.Notes, s.SortOrder);
GO

CREATE OR ALTER PROCEDURE piv2.Product_SupplyInfo
    @ProductId int
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @code nvarchar(100), @brandId int, @inv int, @due datetime, @onOrder nvarchar(30), @disc bit;
    SELECT TOP (1) @code = CAST(p.ProductCode AS nvarchar(100)), @brandId = p.BrandId, @inv = p.Inventory,
           @due = TRY_CAST(p.StockDueDate AS datetime), @onOrder = CAST(p.onOrder AS nvarchar(30)),
           @disc = CAST(ISNULL(p.IsDiscontinued, 0) AS bit)
    FROM dbo.Product p WHERE p.Id = @ProductId;

    IF @code IS NULL
        SELECT TOP (1) @code = CAST(d.ProductCode AS nvarchar(100)), @brandId = d.BrandId FROM dbo.ProductData d WHERE d.Id = @ProductId;

    /* Computyme's fields from the PRO copy of IVMST */
    DECLARE @aVend int, @class int, @status nvarchar(10), @req nvarchar(30);
    SELECT TOP (1) @aVend = TRY_CAST(CAST(i.A_VENDOR AS varchar(30)) AS int),
           @class = TRY_CAST(CAST(i.vend AS varchar(30)) AS int),
           @status = LTRIM(RTRIM(CAST(i.status AS nvarchar(10)))),
           @req = CAST(i.L_REQ AS nvarchar(30))
    FROM dbo.IVMSTData i WHERE CAST(i.ID AS nvarchar(100)) = @code;

    /* bin locations from the EDA mirror, if it carries them (IVMST attr 47 P.LOC, 48 S.LOC) */
    DECLARE @ploc nvarchar(60), @sloc nvarchar(60), @pcol sysname, @scol sysname, @sql nvarchar(max);
    SELECT @pcol = MAX(CASE WHEN c.name IN ('P_LOC','LOC','P.LOC') THEN c.name END),
           @scol = MAX(CASE WHEN c.name IN ('S_LOC','S.LOC') THEN c.name END)
    FROM EDA.sys.columns c
    JOIN EDA.sys.tables t ON t.object_id = c.object_id
    JOIN EDA.sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'IVMST' AND t.name = 'IVMST';
    IF @pcol IS NOT NULL OR @scol IS NOT NULL
    BEGIN
        SET @sql = N'SELECT TOP (1) @p = ' + ISNULL(N'CAST(x.' + QUOTENAME(@pcol) + N' AS nvarchar(60))', N'NULL')
                 + N', @s = ' + ISNULL(N'CAST(x.' + QUOTENAME(@scol) + N' AS nvarchar(60))', N'NULL')
                 + N' FROM EDA.IVMST.IVMST x WHERE CAST(x.ID AS nvarchar(100)) = @c;';
        BEGIN TRY
            EXEC sp_executesql @sql, N'@c nvarchar(100), @p nvarchar(60) OUTPUT, @s nvarchar(60) OUTPUT',
                 @c = @code, @p = @ploc OUTPUT, @s = @sloc OUTPUT;
        END TRY
        BEGIN CATCH
            SELECT @ploc = NULL, @sloc = NULL;
        END CATCH
    END

    DECLARE @apName nvarchar(200) = (SELECT TOP (1) CAST(a.NAME AS nvarchar(200)) FROM EDA.APMST.APMST a WHERE TRY_CAST(a.ID AS int) = @aVend);

    /* 1. vendor, class, status */
    SELECT @ProductId AS ProductId, @code AS ProductCode,
           @brandId AS BrandId, CAST(b.BrandName AS nvarchar(150)) AS BrandName,
           TRY_CAST(b.VendorID AS int) AS BrandVendorId,
           COALESCE((SELECT TOP (1) CAST(a.NAME AS nvarchar(200)) FROM EDA.APMST.APMST a WHERE TRY_CAST(a.ID AS int) = TRY_CAST(b.VendorID AS int)),
                    CAST(v.Name AS nvarchar(200))) AS BrandVendorName,
           @aVend AS VendorId,
           COALESCE(@apName, (SELECT TOP (1) CAST(x.Name AS nvarchar(200)) FROM dbo.Vendor x WHERE x.VendorId = @aVend)) AS VendorName,
           CAST(CASE WHEN @aVend IS NOT NULL AND TRY_CAST(b.VendorID AS int) IS NOT NULL AND @aVend <> TRY_CAST(b.VendorID AS int) THEN 1 ELSE 0 END AS bit) AS VendorsDiffer,
           @class AS ClassNo,
           COALESCE(pc.Name, (SELECT TOP (1) CAST(n.NAME AS nvarchar(120)) FROM EDA.VNMST.VNMST n WHERE TRY_CAST(n.ID AS int) = @class)) AS ClassName,
           @status AS SuspendStatus,
           CASE @status
               WHEN '1' THEN N'Suspended: selling what''s left; orders can''t exceed what''s available'
               WHEN '2' THEN N'Suspended: no stock or vendor orders left, members still waiting'
               WHEN '3' THEN N'Suspended and nothing left anywhere: the B2B site shows it discontinued, with the replacement'
               ELSE NULL END AS SuspendMeaning,
           @disc AS IsDiscontinued,
           CAST(CASE WHEN @code IS NOT NULL AND @status IS NULL AND NOT EXISTS (SELECT 1 FROM dbo.IVMSTData i WHERE CAST(i.ID AS nvarchar(100)) = @code) THEN 0 ELSE 1 END AS bit) AS InComputyme
    FROM (SELECT 1 AS x) one
    LEFT JOIN dbo.Brand b ON b.BrandId = @brandId
    LEFT JOIN dbo.Vendor v ON v.VendorId = TRY_CAST(b.VendorID AS int)
    LEFT JOIN piv2.ProductClass pc ON pc.ClassNo = @class;

    /* 2. stock by warehouse */
    SELECT w.WarehouseCode, w.Name, w.WarehouseType, w.City, w.State, w.Country, w.StockSource,
           CASE WHEN w.WarehouseCode = 'PA' AND @inv < 99999 THEN @inv END              AS OnHand,
           CAST(CASE WHEN w.WarehouseCode = 'PA' AND @inv >= 99999 THEN 1 ELSE 0 END AS bit) AS ShipsDirectMarker,
           CASE WHEN w.WarehouseCode = 'PA' THEN TRY_CAST(@req AS int) END             AS MemberOrdersWaiting,
           CASE WHEN w.WarehouseCode = 'PA' THEN TRY_CAST(@onOrder AS int) END         AS OnOrder,
           CASE WHEN w.WarehouseCode = 'PA' THEN @due END                              AS StockDue,
           CASE WHEN w.WarehouseCode = 'PA' THEN NULLIF(LTRIM(RTRIM(@ploc)), '') END   AS BinPrimary,
           CASE WHEN w.WarehouseCode = 'PA' THEN NULLIF(LTRIM(RTRIM(@sloc)), '') END   AS BinSecondary,
           CAST(CASE WHEN w.WarehouseCode = 'PA' THEN 1 ELSE 0 END AS bit)             AS HasStockFeed
    FROM piv2.Warehouse w
    WHERE w.IsActive = 1
    ORDER BY w.SortOrder, w.WarehouseCode;
END
GO

PRINT 'Vendor Desk 03 ready: piv2.Warehouse (PA), piv2.Product_SupplyInfo.';
GO
