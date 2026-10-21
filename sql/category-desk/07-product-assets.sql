/* ---------------------------------------------------------------
    Product Desk · 07  Shopify & assets (read only)

    Database: PRO      Safe to run twice. Adds one procedure; reads only, changes nothing.

    piv2.Product_Assets @ProductId returns, for the product page:
      1. the product (Id, ProductCode)
      2. every ProductData column about Shopify, video, assets, images or media, with its value
         (found by name, so ShopifyProdID, ShopifyVariantID, a video or asset id column all show
         without this script naming them)
      3. images: dbo.ProductImage, and which sizes exist in the folder scans
         (dbo.ImageList = 250px, dbo.ImageList100 = 100px, dbo.ImageListFull = full size; rebuilt by FolderScan)
      4. documents: dbo.UploadFile rows for the product (Product section; file name starts with the code)
      5. Shopify change feed: the last 50 dbo.productlastchanged rows for the product
    Connection's GetProductFiles (S3 files) is called by the API alongside this.
    Tables that don't exist (FolderScan drops and rebuilds its lists while it runs) come back empty.
   --------------------------------------------------------------- */

USE PRO;
GO
SET NOCOUNT ON;
GO

CREATE OR ALTER PROCEDURE piv2.Product_Assets
    @ProductId int
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @code nvarchar(50) =
        (SELECT LTRIM(RTRIM(CAST(ProductCode AS nvarchar(50)))) FROM dbo.ProductData WHERE Id = @ProductId);

    /* 1. the product */
    SELECT @ProductId AS ProductId, @code AS ProductCode;
    IF @code IS NULL RETURN;

    /* 2. Shopify, video, asset, image and media columns on ProductData, by name */
    DECLARE @cols nvarchar(max) = N'', @sql nvarchar(max);
    SELECT @cols = @cols + N' UNION ALL SELECT N' + QUOTENAME(c.name, '''') + N' AS FieldName, '
                 + N'CAST(' + QUOTENAME(c.name) + N' AS nvarchar(4000)) AS FieldValue FROM dbo.ProductData WHERE Id = @id'
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID(N'dbo.ProductData')
      AND (c.name LIKE N'%shopify%' OR c.name LIKE N'%video%' OR c.name LIKE N'%youtube%'
           OR c.name LIKE N'%asset%' OR c.name LIKE N'%image%' OR c.name LIKE N'%media%')
      AND TYPE_NAME(c.user_type_id) NOT IN (N'image', N'varbinary', N'binary', N'timestamp', N'xml', N'geography', N'geometry')
    ORDER BY c.column_id;

    CREATE TABLE #fields (FieldName nvarchar(128), FieldValue nvarchar(4000));
    IF @cols <> N''
    BEGIN
        SET @sql = STUFF(@cols, 1, 11, N'');      -- drop the leading ' UNION ALL'
        BEGIN TRY
            INSERT #fields (FieldName, FieldValue) EXEC sp_executesql @sql, N'@id int', @id = @ProductId;
        END TRY
        BEGIN CATCH
            INSERT #fields VALUES (N'(could not read)', ERROR_MESSAGE());
        END CATCH
    END
    SELECT FieldName, NULLIF(LTRIM(RTRIM(FieldValue)), N'') AS FieldValue FROM #fields;

    /* 3. images, with the sizes the folder scans found */
    CREATE TABLE #sizes (ImageName varchar(255) COLLATE DATABASE_DEFAULT, Size varchar(10) COLLATE DATABASE_DEFAULT);
    BEGIN TRY
    IF OBJECT_ID(N'dbo.ImageList', N'U') IS NOT NULL
        INSERT #sizes EXEC sp_executesql N'SELECT ImageName, ''250'' FROM dbo.ImageList WHERE ProductCode = @c', N'@c varchar(50)', @c = @code;
    IF OBJECT_ID(N'dbo.ImageList100', N'U') IS NOT NULL
        INSERT #sizes EXEC sp_executesql N'SELECT ImageName, ''100'' FROM dbo.ImageList100 WHERE ProductCode = @c', N'@c varchar(50)', @c = @code;
    IF OBJECT_ID(N'dbo.ImageListFull', N'U') IS NOT NULL
        INSERT #sizes EXEC sp_executesql N'SELECT ImageName, ''full'' FROM dbo.ImageListFull WHERE ProductCode = @c', N'@c varchar(50)', @c = @code;
    END TRY
    BEGIN CATCH
        /* FolderScan is rebuilding a list right now: sizes are unknown this time */
        SET @sql = NULL;
    END CATCH

    SELECT x.ImageName, MIN(x.DisplayOrder) AS DisplayOrder,
           CAST(MAX(x.InProductImage) AS bit) AS InProductImage,
           CAST(MAX(CASE WHEN s.Size = '100'  THEN 1 ELSE 0 END) AS bit) AS Has100,
           CAST(MAX(CASE WHEN s.Size = '250'  THEN 1 ELSE 0 END) AS bit) AS Has250,
           CAST(MAX(CASE WHEN s.Size = 'full' THEN 1 ELSE 0 END) AS bit) AS HasFull
    FROM (SELECT CAST(pi.ImageName AS varchar(255)) AS ImageName, pi.DisplayOrder, 1 AS InProductImage
          FROM dbo.ProductImage pi WHERE pi.ProductId = @ProductId
          UNION ALL
          SELECT ImageName, NULL, 0 FROM #sizes) x
    LEFT JOIN #sizes s ON s.ImageName = x.ImageName
    GROUP BY x.ImageName
    ORDER BY MIN(ISNULL(x.DisplayOrder, 999)), x.ImageName;

    /* 4. documents (manuals, instruction books, spec sheets) */
    CREATE TABLE #docs (FileName nvarchar(255), DisplayName nvarchar(255), FileLocation nvarchar(500), Url nvarchar(500), UploadDate datetime);
    IF OBJECT_ID(N'dbo.UploadFile', N'U') IS NOT NULL
    BEGIN
    BEGIN TRY
        INSERT #docs EXEC sp_executesql N'
            SELECT TOP (200) CAST(u.FileName AS nvarchar(255)), CAST(u.DisplayName AS nvarchar(255)), CAST(u.FileLocation AS nvarchar(500)), CAST(u.Url AS nvarchar(500)), u.UploadDate
            FROM dbo.UploadFile u
            WHERE u.DisplaySection = ''Product''
              AND (u.FileName LIKE @c + ''[_.]%'' OR u.FileLocation LIKE ''%\Products\'' + @c + ''\%'')
            ORDER BY u.FileName;', N'@c nvarchar(50)', @c = @code;
    END TRY
    BEGIN CATCH
        /* UploadFile's columns differ from what FolderScan writes: the list is empty, the page still works */
        SET @sql = NULL;
    END CATCH
    END
    SELECT FileName, DisplayName, FileLocation, Url, UploadDate FROM #docs ORDER BY FileName;

    /* 5. Shopify change feed for this product */
    CREATE TABLE #feed (Id bigint, Change nvarchar(100), OldValue nvarchar(400), NewValue nvarchar(400),
                        DateChanged datetime, DateProcessed datetime, Result nvarchar(600));
    IF OBJECT_ID(N'dbo.productlastchanged', N'U') IS NOT NULL
    BEGIN
    BEGIN TRY
        INSERT #feed EXEC sp_executesql N'
            SELECT TOP (50) CAST(p.Id AS bigint), CAST(p.Change AS nvarchar(100)),
                   CAST(p.OldValue AS nvarchar(400)), CAST(p.NewValue AS nvarchar(400)),
                   p.dateChanged, p.dateProcessed,
                   LEFT(CAST(p.XML AS nvarchar(max)), 600)
            FROM dbo.productlastchanged p
            WHERE CAST(p.ProductCode AS nvarchar(50)) = @c
            ORDER BY p.dateChanged DESC, p.Id DESC;', N'@c nvarchar(50)', @c = @code;
    END TRY
    BEGIN CATCH
        /* a column name differs: retry without the result column before giving up */
        BEGIN TRY
            INSERT #feed (Id, Change, OldValue, NewValue, DateChanged, DateProcessed) EXEC sp_executesql N'
                SELECT TOP (50) CAST(p.Id AS bigint), CAST(p.Change AS nvarchar(100)), CAST(p.OldValue AS nvarchar(400)),
                       CAST(p.NewValue AS nvarchar(400)), p.dateChanged, p.dateProcessed
                FROM dbo.productlastchanged p
                WHERE CAST(p.ProductCode AS nvarchar(50)) = @c
                ORDER BY p.dateChanged DESC, p.Id DESC;', N'@c nvarchar(50)', @c = @code;
        END TRY
        BEGIN CATCH
            SET @sql = NULL;
        END CATCH
    END CATCH
    END
    SELECT Id, Change, OldValue, NewValue, DateChanged, DateProcessed, Result FROM #feed ORDER BY DateChanged DESC, Id DESC;
END
GO

PRINT N'Product Shopify & assets view ready.';
