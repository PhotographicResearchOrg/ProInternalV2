/* ---------------------------------------------------------------
    Product Desk · 08  Product sheet: every field of a product on one page

    Database: PRO      Safe to run twice. Adds three tables and four procedures; changes nothing existing.
    Writes to dbo.ProductData only through piv2.ProductSheet_Save (one transaction, every change logged).

    What the sheet shows, besides the product contract (identity, prices, supply, logistics, content):
      - every column of dbo.ProductData (what the B2B site reads), found from the table itself, so a
        column added later (an Amazon ASIN, say) appears without changing this script;
      - every column of the dbo.Product view that isn't in ProductData: Computyme's, read only.

    piv2.ProductSheetField     labels, groups, order and locks per column (seeded below; edit freely).
                               Lock: SYSTEM (keys, dates), CATEGORY (Category Desk), SHOPIFY (set by the
                               Shopify sync), COMPUTYME (read only until Product:SqlIsMaster), CONTRACT
                               (edited in the product contract part of the page), HIDDEN (not shown).
                               A column with no row here is editable and shows under "Other fields".
    piv2.ProductSheetLog       every change: product, column, before, after, who, when.
    piv2.ProductSheetUserView  each person's chosen groups and fields.

    piv2.ProductSheet_Get      @ProductId, @SqlIsMaster: one row per column with value and lock
    piv2.ProductSheet_Save     @ProductId, @Changes (JSON [{"column":"P65","value":"..."}]), @User, @SqlIsMaster
    piv2.ProductSheet_ViewGet / _ViewSet   the person's layout
    Refusals come back as THROW 50460-50469.
   --------------------------------------------------------------- */

USE PRO;
GO
SET NOCOUNT ON;
GO

IF OBJECT_ID(N'piv2.ProductSheetField', N'U') IS NULL
    CREATE TABLE piv2.ProductSheetField
    (
        ColumnName  sysname        NOT NULL CONSTRAINT PK_ProductSheetField PRIMARY KEY,
        Label       nvarchar(100)  NOT NULL,
        GroupName   nvarchar(60)   NOT NULL,
        SortOrder   int            NOT NULL CONSTRAINT DF_ProductSheetField_Sort DEFAULT 500,
        Lock        varchar(12)    NULL,          -- SYSTEM | CATEGORY | SHOPIFY | COMPUTYME | CONTRACT | HIDDEN
        Note        nvarchar(300)  NULL
    );
GO

IF OBJECT_ID(N'piv2.ProductSheetLog', N'U') IS NULL
BEGIN
    CREATE TABLE piv2.ProductSheetLog
    (
        LogId       bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProductSheetLog PRIMARY KEY,
        ProductId   int            NOT NULL,
        ColumnName  sysname        NOT NULL,
        OldValue    nvarchar(max)  NULL,
        NewValue    nvarchar(max)  NULL,
        ChangedBy   nvarchar(128)  NOT NULL,
        ChangedAt   datetime2(0)   NOT NULL CONSTRAINT DF_ProductSheetLog_At DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_ProductSheetLog_Product ON piv2.ProductSheetLog (ProductId, ChangedAt DESC);
END
GO

IF OBJECT_ID(N'piv2.ProductSheetUserView', N'U') IS NULL
    CREATE TABLE piv2.ProductSheetUserView
    (
        UserName    nvarchar(128)  NOT NULL CONSTRAINT PK_ProductSheetUserView PRIMARY KEY,
        ViewJson    nvarchar(max)  NOT NULL,
        UpdatedAt   datetime2(0)   NOT NULL CONSTRAINT DF_ProductSheetUserView_At DEFAULT SYSUTCDATETIME()
    );
GO

/* ---------------------------------------------------------------- labels, groups and locks
   Only rows that aren't there yet are added, so your own edits to this table are kept. */
MERGE piv2.ProductSheetField AS t
USING (VALUES
    -- system
    (N'Id',                          N'Product id',                    N'System',            10,  'SYSTEM',   NULL),
    (N'ProductCode',                 N'Product code',                  N'System',            20,  'SYSTEM',   NULL),
    (N'EnterDate',                   N'Entered',                       N'System',            30,  'SYSTEM',   NULL),
    (N'LastUpdated',                 N'Last updated',                  N'System',            40,  'SYSTEM',   NULL),
    (N'UpdatedBy',                   N'Updated by',                    N'System',            50,  'SYSTEM',   NULL),
    -- edited in the contract part of the page
    (N'ModelName',                   N'Name',                          N'Identity',          10,  'CONTRACT', NULL),
    (N'BrandId',                     N'Brand',                         N'Identity',          20,  'CONTRACT', NULL),
    (N'IsForSale',                   N'For sale',                      N'Status',            10,  'CONTRACT', NULL),
    (N'ReplacementCode',             N'Replaced by',                   N'Status',            40,  'CONTRACT', NULL),
    -- identity
    (N'ModelVersion',                N'Model version',                 N'Identity',          30,  NULL,       NULL),
    (N'AddtionalText',               N'Additional text',               N'Identity',          40,  NULL,       NULL),
    (N'VendorID',                    N'Vendor id',                     N'Identity',          50,  NULL,       NULL),
    (N'RANK',                        N'Rank',                          N'Identity',          60,  NULL,       NULL),
    (N'IsGroup',                     N'Group product',                 N'Identity',          70,  NULL,       NULL),
    (N'IsClient',                    N'Client product',                N'Identity',          80,  NULL,       NULL),
    -- status
    (N'IsPublic',                    N'Shown on web (IsPublic)',       N'Status',            20,  NULL,       N'Also sets the Shopify product active or archived through the Shopify sync'),
    (N'IsActive',                    N'Active',                        N'Status',            30,  'COMPUTYME', NULL),
    (N'IsDiscontinued',              N'Discontinued',                  N'Status',            35,  'COMPUTYME', NULL),
    (N'hold',                        N'Hold',                          N'Status',            50,  NULL,       NULL),
    -- codes
    (N'UPC',                         N'UPC',                           N'Codes',             10,  'COMPUTYME', NULL),
    (N'CAT_NO',                      N'Vendor catalog number',         N'Codes',             20,  'COMPUTYME', NULL),
    (N'ShopifyProdID',               N'Shopify product id',            N'Codes',             30,  'SHOPIFY',  N'Set when the product is created in Shopify'),
    (N'ShopifyVariantID',            N'Shopify variant id',            N'Codes',             40,  'SHOPIFY',  N'Set when the product is created in Shopify'),
    -- category (Category Desk)
    (N'TopCatId',                    N'Top category',                  N'Category',          10,  'CATEGORY', N'Change it with the Categories section or the Category Desk'),
    (N'CatId',                       N'Category',                      N'Category',          20,  'CATEGORY', N'Change it with the Categories section or the Category Desk'),
    (N'SubCatId',                    N'Sub-category',                  N'Category',          30,  'CATEGORY', N'Change it with the Categories section or the Category Desk'),
    (N'egrp',                        N'EGRP',                          N'Category',          40,  'COMPUTYME', NULL),
    -- B2B product page
    (N'Features',                    N'Features (B2B page HTML)',      N'B2B product page',  10,  NULL,       NULL),
    (N'Specs',                       N'Specs (B2B page HTML)',         N'B2B product page',  20,  NULL,       NULL),
    (N'P65',                         N'Prop 65 warning',               N'B2B product page',  30,  NULL,       NULL),
    (N'OutOfStockMessage',           N'Out-of-stock message',          N'B2B product page',  40,  NULL,       NULL),
    (N'StockDueDate',                N'Stock due date',                N'B2B product page',  50,  NULL,       NULL),
    (N'InstructionBook',             N'Instruction book',              N'B2B product page',  60,  NULL,       NULL),
    (N'FAQ',                         N'FAQ',                           N'B2B product page',  70,  NULL,       NULL),
    (N'FAQDoc',                      N'FAQ document',                  N'B2B product page',  80,  NULL,       NULL),
    (N'special1',                    N'Special 1',                     N'B2B product page',  90,  NULL,       NULL),
    (N'special2',                    N'Special 2',                     N'B2B product page',  100, NULL,       NULL),
    (N'REBATE',                      N'Rebate',                        N'B2B product page',  110, NULL,       NULL),
    (N'BrandRebate',                 N'Brand rebate',                  N'B2B product page',  120, NULL,       NULL),
    -- prices (Computyme until cutover)
    (N'Retail',                      N'Member price',                  N'Prices',            10,  'COMPUTYME', NULL),
    (N'CartonPricingRetail',         N'Carton price',                  N'Prices',            20,  'COMPUTYME', NULL),
    (N'AuthorizedPrice',             N'Authorized dealer price',       N'Prices',            30,  'COMPUTYME', NULL),
    (N'MAP',                         N'MAP',                           N'Prices',            40,  'COMPUTYME', NULL),
    (N'CUST_RETAIL',                 N'Consumer retail',               N'Prices',            50,  'COMPUTYME', NULL),
    (N'DS_CHG',                      N'Drop-ship charge',              N'Prices',            60,  'COMPUTYME', NULL),
    (N'LAST_VALUE',                  N'Last cost',                     N'Prices',            70,  'COMPUTYME', NULL),
    (N'LtlCost',                     N'Distributor cost',              N'Prices',            80,  NULL,       NULL),
    (N'SpecialPriceQuantity',        N'Special price quantity',        N'Prices',            90,  'COMPUTYME', NULL),
    -- stock and shipping
    (N'Inventory',                   N'Units in stock',                N'Stock & shipping',  10,  'COMPUTYME', NULL),
    (N'Multiple',                    N'Order multiple',                N'Stock & shipping',  20,  'COMPUTYME', NULL),
    (N'Carton',                      N'Carton quantity',               N'Stock & shipping',  30,  'COMPUTYME', NULL),
    (N'FastShippingAvailable',       N'Air shipping available',        N'Stock & shipping',  40,  NULL,       NULL),
    (N'IsDropShipElibible',          N'Drop-ship eligible',            N'Stock & shipping',  50,  'CONTRACT', NULL),
    (N'SupplementalShippingSku',     N'Supplemental shipping SKU',     N'Stock & shipping',  60,  NULL,       NULL),
    (N'SupplementalShippingProductId', N'Supplemental shipping product', N'Stock & shipping', 70, NULL,       NULL),
    (N'SupplementalShippingCost',    N'Supplemental shipping cost',    N'Stock & shipping',  80,  NULL,       NULL),
    (N'RequireSerialForSar',         N'Serial number required for returns', N'Stock & shipping', 90, NULL,   NULL)
) AS s (ColumnName, Label, GroupName, SortOrder, Lock, Note)
ON t.ColumnName = s.ColumnName
WHEN NOT MATCHED THEN
    INSERT (ColumnName, Label, GroupName, SortOrder, Lock, Note) VALUES (s.ColumnName, s.Label, s.GroupName, s.SortOrder, s.Lock, s.Note);
GO

/* ---------------------------------------------------------------- read */
CREATE OR ALTER PROCEDURE piv2.ProductSheet_Get
    @ProductId   int,
    @SqlIsMaster bit = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.ProductData WHERE Id = @ProductId)
    BEGIN
        SELECT CAST(NULL AS sysname) AS ColumnName WHERE 1 = 0;
        RETURN;
    END

    /* the columns: ProductData's, then the dbo.Product view's that ProductData doesn't have (Computyme's) */
    CREATE TABLE #col (Source varchar(12), ColumnName sysname COLLATE DATABASE_DEFAULT, DataType sysname, MaxLength smallint,
                       Prec tinyint, Scale tinyint, IsNullable bit, IsReadOnlyType bit, ColumnId int);

    INSERT #col
    SELECT 'ProductData', c.name, TYPE_NAME(c.user_type_id), c.max_length, c.precision, c.scale, c.is_nullable,
           CAST(CASE WHEN c.is_identity = 1 OR c.is_computed = 1 OR TYPE_NAME(c.user_type_id) IN (N'timestamp', N'rowversion') THEN 1 ELSE 0 END AS bit),
           c.column_id
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID(N'dbo.ProductData')
      AND TYPE_NAME(c.user_type_id) NOT IN (N'image', N'varbinary', N'binary', N'xml', N'geography', N'geometry', N'hierarchyid', N'sql_variant');

    /* dbo.Product is a synonym (to the product cache) or a view: read the columns of what it points at */
    DECLARE @productObj int = OBJECT_ID(N'dbo.Product');
    IF EXISTS (SELECT 1 FROM sys.synonyms WHERE object_id = @productObj)
        SELECT @productObj = OBJECT_ID(base_object_name) FROM sys.synonyms WHERE object_id = @productObj;

    IF @productObj IS NOT NULL
        INSERT #col
        SELECT 'Computyme', c.name, TYPE_NAME(c.user_type_id), c.max_length, c.precision, c.scale, c.is_nullable, 1, 1000 + c.column_id
        FROM sys.columns c
        WHERE c.object_id = @productObj
          AND TYPE_NAME(c.user_type_id) NOT IN (N'image', N'varbinary', N'binary', N'xml', N'geography', N'geometry', N'hierarchyid', N'sql_variant')
          AND NOT EXISTS (SELECT 1 FROM #col x WHERE x.ColumnName = c.name COLLATE DATABASE_DEFAULT);

    /* the values, unpivoted as text (dates as ISO 8601, so the page can show and send them back unchanged) */
    CREATE TABLE #val (Source varchar(12), ColumnName sysname COLLATE DATABASE_DEFAULT, Value nvarchar(max));
    DECLARE @list nvarchar(max), @sql nvarchar(max);

    SELECT @list = STRING_AGG(CAST(N'(N' + QUOTENAME(ColumnName, '''') + N', CONVERT(nvarchar(max), '
                   + CASE WHEN DataType IN (N'float', N'real') THEN N'CAST(' + QUOTENAME(ColumnName) + N' AS decimal(38,6))' ELSE QUOTENAME(ColumnName) END
                   + CASE WHEN DataType IN (N'date', N'datetime', N'datetime2', N'smalldatetime', N'datetimeoffset', N'time') THEN N', 126' ELSE N'' END
                   + N'))' AS nvarchar(max)), N', ')
    FROM #col WHERE Source = 'ProductData';
    IF @list IS NOT NULL
    BEGIN
        SET @sql = N'SELECT ''ProductData'', v.c, v.v FROM dbo.ProductData d CROSS APPLY (VALUES ' + @list + N') v (c, v) WHERE d.Id = @id';
        INSERT #val EXEC sp_executesql @sql, N'@id int', @id = @ProductId;
    END

    SET @list = NULL;
    SELECT @list = STRING_AGG(CAST(N'(N' + QUOTENAME(ColumnName, '''') + N', CONVERT(nvarchar(max), '
                   + CASE WHEN DataType IN (N'float', N'real') THEN N'CAST(' + QUOTENAME(ColumnName) + N' AS decimal(38,6))' ELSE QUOTENAME(ColumnName) END
                   + CASE WHEN DataType IN (N'date', N'datetime', N'datetime2', N'smalldatetime', N'datetimeoffset', N'time') THEN N', 126' ELSE N'' END
                   + N'))' AS nvarchar(max)), N', ')
    FROM #col WHERE Source = 'Computyme';
    IF @list IS NOT NULL
    BEGIN
    BEGIN TRY
        SET @sql = N'SELECT TOP (1) ''Computyme'', v.c, v.v FROM dbo.Product p CROSS APPLY (VALUES ' + @list + N') v (c, v) WHERE p.Id = @id';
        INSERT #val EXEC sp_executesql @sql, N'@id int', @id = @ProductId;
    END TRY
    BEGIN CATCH
        /* the view has no Id column or can't be read: Computyme's extra columns are left out */
        DELETE #col WHERE Source = 'Computyme';
    END CATCH
    END

    SELECT c.Source, c.ColumnName, c.DataType, c.MaxLength, c.Prec, c.Scale, c.IsNullable,
           v.Value,
           ISNULL(f.Label, c.ColumnName)                                  AS Label,
           ISNULL(f.GroupName, CASE WHEN c.Source = 'Computyme' THEN N'Computyme' ELSE N'Other fields' END) AS GroupName,
           ISNULL(f.SortOrder, 500 + c.ColumnId)                          AS SortOrder,
           CASE
               WHEN c.Source = 'Computyme'                            THEN 'COMPUTYME'
               WHEN c.IsReadOnlyType = 1                              THEN 'SYSTEM'
               WHEN f.Lock = 'COMPUTYME' AND @SqlIsMaster = 1         THEN NULL
               ELSE f.Lock
           END                                                            AS Lock,
           f.Note
    FROM #col c
    LEFT JOIN #val v ON v.Source = c.Source AND v.ColumnName = c.ColumnName
    LEFT JOIN piv2.ProductSheetField f ON f.ColumnName = c.ColumnName COLLATE DATABASE_DEFAULT
    WHERE ISNULL(f.Lock, '') <> 'HIDDEN'
    ORDER BY GroupName, SortOrder, c.ColumnName;
END
GO

/* ---------------------------------------------------------------- save
   Only columns that changed are sent. Each is checked (exists, not locked, converts to its type, fits),
   then all are written in one transaction and logged. */
CREATE OR ALTER PROCEDURE piv2.ProductSheet_Save
    @ProductId   int,
    @Changes     nvarchar(max),
    @User        nvarchar(128),
    @SqlIsMaster bit = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.ProductData WHERE Id = @ProductId)
        THROW 50460, N'That product doesn''t exist.', 1;
    IF ISJSON(@Changes) <> 1
        THROW 50461, N'The changes aren''t valid JSON.', 1;

    CREATE TABLE #chg (ColumnName sysname COLLATE DATABASE_DEFAULT, Value nvarchar(max), IsNull bit,
                       TypeSql nvarchar(200), DataType sysname, MaxChars int, IsNullable bit, Lock varchar(12));

    INSERT #chg (ColumnName, Value, IsNull)
    SELECT j.[column], j.[value], CASE WHEN j.[value] IS NULL THEN 1 ELSE 0 END
    FROM OPENJSON(@Changes) WITH ([column] sysname '$.column', [value] nvarchar(max) '$.value') j
    WHERE j.[column] IS NOT NULL;

    DECLARE @msg nvarchar(400);

    SELECT TOP (1) @msg = CONCAT(N'A column was sent twice: ', ColumnName, N'.')
    FROM #chg GROUP BY ColumnName HAVING COUNT(*) > 1;
    IF @msg IS NOT NULL THROW 50462, @msg, 1;

    UPDATE x SET
        DataType   = TYPE_NAME(c.user_type_id),
        IsNullable = c.is_nullable,
        MaxChars   = CASE WHEN TYPE_NAME(c.user_type_id) IN (N'nvarchar', N'nchar') AND c.max_length > 0 THEN c.max_length / 2
                          WHEN TYPE_NAME(c.user_type_id) IN (N'varchar', N'char') AND c.max_length > 0 THEN c.max_length
                          ELSE NULL END,
        TypeSql    = TYPE_NAME(c.user_type_id)
                     + CASE WHEN TYPE_NAME(c.user_type_id) IN (N'varchar', N'char', N'varbinary', N'binary')
                                 THEN N'(' + CASE WHEN c.max_length = -1 THEN N'max' ELSE CAST(c.max_length AS nvarchar(6)) END + N')'
                            WHEN TYPE_NAME(c.user_type_id) IN (N'nvarchar', N'nchar')
                                 THEN N'(' + CASE WHEN c.max_length = -1 THEN N'max' ELSE CAST(c.max_length / 2 AS nvarchar(6)) END + N')'
                            WHEN TYPE_NAME(c.user_type_id) IN (N'decimal', N'numeric')
                                 THEN N'(' + CAST(c.precision AS nvarchar(3)) + N',' + CAST(c.scale AS nvarchar(3)) + N')'
                            WHEN TYPE_NAME(c.user_type_id) IN (N'datetime2', N'time', N'datetimeoffset')
                                 THEN N'(' + CAST(c.scale AS nvarchar(3)) + N')'
                            ELSE N'' END,
        Lock       = CASE
                         WHEN c.is_identity = 1 OR c.is_computed = 1 OR TYPE_NAME(c.user_type_id) IN (N'timestamp', N'rowversion') THEN 'SYSTEM'
                         WHEN f.Lock = 'COMPUTYME' AND @SqlIsMaster = 1 THEN NULL
                         ELSE f.Lock
                     END
    FROM #chg x
    LEFT JOIN sys.columns c ON c.object_id = OBJECT_ID(N'dbo.ProductData') AND c.name = x.ColumnName COLLATE DATABASE_DEFAULT
    LEFT JOIN piv2.ProductSheetField f ON f.ColumnName = x.ColumnName COLLATE DATABASE_DEFAULT;

    SELECT TOP (1) @msg = CONCAT(x.ColumnName, N' isn''t a product field that can be changed here.') FROM #chg x WHERE x.DataType IS NULL;
    IF @msg IS NOT NULL THROW 50463, @msg, 1;

    SELECT TOP (1) @msg = CONCAT(x.ColumnName, N' is locked (',
                                 CASE x.Lock WHEN 'COMPUTYME' THEN N'set in Computyme until product data moves to SQL'
                                             WHEN 'CATEGORY'  THEN N'change it with the Categories section or the Category Desk'
                                             WHEN 'SHOPIFY'   THEN N'set by the Shopify sync'
                                             WHEN 'CONTRACT'  THEN N'edit it in the product fields above'
                                             ELSE N'kept by the system' END, N').')
    FROM #chg x WHERE x.Lock IS NOT NULL;
    IF @msg IS NOT NULL THROW 50464, @msg, 1;

    SELECT TOP (1) @msg = CONCAT(x.ColumnName, N' can''t be empty.') FROM #chg x WHERE x.IsNull = 1 AND x.IsNullable = 0;
    IF @msg IS NOT NULL THROW 50465, @msg, 1;

    SELECT TOP (1) @msg = CONCAT(x.ColumnName, N' is too long (', LEN(x.Value), N' characters; the most is ', x.MaxChars, N').')
    FROM #chg x WHERE x.MaxChars IS NOT NULL AND LEN(x.Value) > x.MaxChars;
    IF @msg IS NOT NULL THROW 50466, @msg, 1;

    /* every value must convert to its column's type */
    DECLARE @col sysname, @val nvarchar(max), @type nvarchar(200), @ok bit, @sql nvarchar(max);
    DECLARE chk CURSOR LOCAL FAST_FORWARD FOR SELECT ColumnName, Value, TypeSql FROM #chg WHERE IsNull = 0 AND DataType NOT IN (N'varchar', N'nvarchar', N'char', N'nchar', N'text', N'ntext');
    OPEN chk;
    FETCH NEXT FROM chk INTO @col, @val, @type;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = N'SET @ok = CASE WHEN TRY_CONVERT(' + @type + N', @v) IS NULL THEN 0 ELSE 1 END;';
        EXEC sp_executesql @sql, N'@v nvarchar(max), @ok bit OUTPUT', @v = @val, @ok = @ok OUTPUT;
        IF @ok = 0
        BEGIN
            CLOSE chk; DEALLOCATE chk;
            SET @msg = CONCAT(@col, N': "', LEFT(@val, 60), N'" isn''t a valid ', @type, N'.');
            THROW 50467, @msg, 1;
        END
        FETCH NEXT FROM chk INTO @col, @val, @type;
    END
    CLOSE chk; DEALLOCATE chk;

    /* write and log, all or nothing */
    DECLARE @old nvarchar(max), @isNull bit;
    BEGIN TRAN;
        DECLARE w CURSOR LOCAL FAST_FORWARD FOR SELECT ColumnName, Value, TypeSql, IsNull FROM #chg;
        OPEN w;
        FETCH NEXT FROM w INTO @col, @val, @type, @isNull;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @sql = N'SELECT @old = CONVERT(nvarchar(max), ' + QUOTENAME(@col) + N') FROM dbo.ProductData WITH (UPDLOCK) WHERE Id = @id;
                         UPDATE dbo.ProductData SET ' + QUOTENAME(@col) + N' = '
                       + CASE WHEN @isNull = 1 THEN N'NULL' ELSE N'CONVERT(' + @type + N', @v)' END
                       + N' WHERE Id = @id;';
            EXEC sp_executesql @sql, N'@id int, @v nvarchar(max), @old nvarchar(max) OUTPUT', @id = @ProductId, @v = @val, @old = @old OUTPUT;

            INSERT piv2.ProductSheetLog (ProductId, ColumnName, OldValue, NewValue, ChangedBy)
            VALUES (@ProductId, @col, @old, CASE WHEN @isNull = 1 THEN NULL ELSE @val END, @User);

            FETCH NEXT FROM w INTO @col, @val, @type, @isNull;
        END
        CLOSE w; DEALLOCATE w;
    COMMIT;

    SELECT COUNT(*) AS Saved FROM #chg;
END
GO

/* ---------------------------------------------------------------- recent changes for the page */
CREATE OR ALTER PROCEDURE piv2.ProductSheet_History
    @ProductId int
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (100) l.LogId, l.ColumnName, ISNULL(f.Label, l.ColumnName) AS Label, l.OldValue, l.NewValue, l.ChangedBy, l.ChangedAt
    FROM piv2.ProductSheetLog l
    LEFT JOIN piv2.ProductSheetField f ON f.ColumnName = l.ColumnName
    WHERE l.ProductId = @ProductId
    ORDER BY l.ChangedAt DESC, l.LogId DESC;
END
GO

/* ---------------------------------------------------------------- each person's layout */
CREATE OR ALTER PROCEDURE piv2.ProductSheet_ViewGet
    @UserName nvarchar(128)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ViewJson FROM piv2.ProductSheetUserView WHERE UserName = @UserName;
END
GO

CREATE OR ALTER PROCEDURE piv2.ProductSheet_ViewSet
    @UserName nvarchar(128),
    @ViewJson nvarchar(max)
AS
BEGIN
    SET NOCOUNT ON;
    IF ISJSON(@ViewJson) <> 1 THROW 50468, N'The layout isn''t valid JSON.', 1;
    MERGE piv2.ProductSheetUserView AS t
    USING (SELECT @UserName AS UserName) AS s ON t.UserName = s.UserName
    WHEN MATCHED THEN UPDATE SET ViewJson = @ViewJson, UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (UserName, ViewJson) VALUES (@UserName, @ViewJson);
END
GO

PRINT N'Product sheet ready.';
