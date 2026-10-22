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

    piv2.ProductSheet_TextExpr how a column is shown as text (dates ISO, money 4 decimals, floats in full)
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
        Lock        varchar(12)    NULL,          -- SYSTEM | CATEGORY | SHOPIFY | MARKETPLACE | COMPUTYME | CONTRACT | HIDDEN
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

/* ---------------------------------------------------------------- 2026-10-22: clearer labels and groups
   Applied only where the row still has the label first written above, so your own edits are kept. */
MERGE piv2.ProductSheetField AS t
USING (VALUES
    (N'ASIN',                        N'Amazon ASIN',                   N'Codes',             50,  'MARKETPLACE', N'Set by the Amazon Seller Central sync (Shopify database script)')
) AS s (ColumnName, Label, GroupName, SortOrder, Lock, Note)
ON t.ColumnName = s.ColumnName
WHEN NOT MATCHED THEN
    INSERT (ColumnName, Label, GroupName, SortOrder, Lock, Note) VALUES (s.ColumnName, s.Label, s.GroupName, s.SortOrder, s.Lock, s.Note);

UPDATE f SET Label = n.Label, GroupName = n.GroupName, SortOrder = n.SortOrder, Note = n.Note
FROM piv2.ProductSheetField f
JOIN (VALUES
    (N'IsGroup',                       N'Group product',              N'Group flag (legacy)',                 N'Legacy',  10, N'Set to 1 by the old vendor product import (Rokinon); not used by the B2B site pages'),
    (N'IsClient',                      N'Client product',             N'Client flag (legacy)',                N'Legacy',  20, NULL),
    (N'SupplementalShippingSku',       N'Supplemental shipping SKU',  N'Supplemental shipping SKU (legacy)',  N'Legacy',  30, N'From the old direct-ship vendor program; not shown on the B2B site'),
    (N'SupplementalShippingProductId', N'Supplemental shipping product', N'Supplemental shipping product (legacy)', N'Legacy', 40, N'From the old direct-ship vendor program; not shown on the B2B site'),
    (N'SupplementalShippingCost',      N'Supplemental shipping cost', N'Vendor cost for the old direct-ship program (legacy)', N'Legacy', 50, N'The old Rokinon program used it as the vendor''s cost (less 9%); not a shipping charge'),
    (N'P65',                           N'Prop 65 warning',            N'Prop 65 text (product export)',       N'B2B product page', 30, N'Text sent in the product XML export; the yes/no warning is under Size & customs'),
    (N'FastShippingAvailable',         N'Air shipping available',     N'Air shipping available',              N'Stock & shipping', 40, N'1 = air shipping offered on the B2B site (Air Available), 0 = ground only')
) AS n (ColumnName, OldLabel, Label, GroupName, SortOrder, Note)
  ON n.ColumnName = f.ColumnName
WHERE f.Label = n.OldLabel;
GO

/* ---------------------------------------------------------------- a column as text
   The same text for showing a value and for logging it: dates ISO 8601 (style 126), money with 4 decimals
   (style 2), floats as plain decimals when they fit, else full precision (style 3). */
CREATE OR ALTER FUNCTION piv2.ProductSheet_TextExpr (@col nvarchar(300), @type sysname)
RETURNS nvarchar(800)
AS
BEGIN
    RETURN CASE
        WHEN @type IN (N'float', N'real')
            THEN N'COALESCE(CONVERT(nvarchar(max), TRY_CAST(' + @col + N' AS decimal(38,6))), CONVERT(nvarchar(max), ' + @col + N', 3))'
        WHEN @type IN (N'money', N'smallmoney')
            THEN N'CONVERT(nvarchar(max), ' + @col + N', 2)'
        WHEN @type IN (N'date', N'datetime', N'datetime2', N'smalldatetime', N'datetimeoffset', N'time')
            THEN N'CONVERT(nvarchar(max), ' + @col + N', 126)'
        ELSE N'CONVERT(nvarchar(max), ' + @col + N')'
    END;
END
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

    /* the columns: ProductData's, then the dbo.Product view's that ProductData doesn't have (Computyme's).
       Types are the base (system) types, so alias types behave like what they are. */
    CREATE TABLE #col (Source varchar(12), ColumnName sysname COLLATE DATABASE_DEFAULT, DataType sysname, MaxLength smallint,
                       Prec tinyint, Scale tinyint, IsNullable bit, IsReadOnlyType bit, ColumnId int);

    INSERT #col
    SELECT 'ProductData', c.name, TYPE_NAME(c.system_type_id), c.max_length, c.precision, c.scale, c.is_nullable,
           CAST(CASE WHEN c.is_identity = 1 OR c.is_computed = 1 THEN 1 ELSE 0 END AS bit),
           c.column_id
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID(N'dbo.ProductData')
      AND TYPE_NAME(c.user_type_id) NOT IN (N'geography', N'geometry', N'hierarchyid')
      AND TYPE_NAME(c.system_type_id) NOT IN (N'image', N'varbinary', N'binary', N'xml', N'sql_variant', N'timestamp');

    /* dbo.Product is a synonym (to the product cache, possibly in another database) or a view:
       describe what SELECT * returns, which works for all of them */
    BEGIN TRY
        INSERT #col
        SELECT 'Computyme', d.name, TYPE_NAME(d.system_type_id), d.max_length, d.precision, d.scale, d.is_nullable, 1, 1000 + d.column_ordinal
        FROM sys.dm_exec_describe_first_result_set(N'SELECT * FROM dbo.Product', NULL, 0) d
        WHERE d.is_hidden = 0 AND d.name IS NOT NULL
          AND TYPE_NAME(d.system_type_id) NOT IN (N'image', N'varbinary', N'binary', N'xml', N'sql_variant', N'timestamp')
          AND d.system_type_id <> 240                     -- CLR types (geography, geometry, hierarchyid)
          AND NOT EXISTS (SELECT 1 FROM #col x WHERE x.ColumnName = d.name COLLATE DATABASE_DEFAULT);
    END TRY
    BEGIN CATCH
        SET @ProductId = @ProductId;                      -- dbo.Product can't be described: Computyme's columns are left out
    END CATCH

    /* each column as text: dates ISO 8601, money with 4 decimals, floats without scientific notation */
    CREATE TABLE #val (Source varchar(12), ColumnName sysname COLLATE DATABASE_DEFAULT, Value nvarchar(max));
    DECLARE @list nvarchar(max), @sql nvarchar(max);

    SELECT @list = STRING_AGG(CAST(N'(N' + QUOTENAME(ColumnName, '''') + N', ' + piv2.ProductSheet_TextExpr(QUOTENAME(ColumnName), DataType) + N')' AS nvarchar(max)), N', ')
    FROM #col WHERE Source = 'ProductData';
    IF @list IS NOT NULL
    BEGIN
        SET @sql = N'SELECT ''ProductData'', v.c, v.v FROM dbo.ProductData d CROSS APPLY (VALUES ' + @list + N') v (c, v) WHERE d.Id = @id';
        INSERT #val EXEC sp_executesql @sql, N'@id int', @id = @ProductId;
    END

    SET @list = NULL;
    SELECT @list = STRING_AGG(CAST(N'(N' + QUOTENAME(ColumnName, '''') + N', ' + piv2.ProductSheet_TextExpr(QUOTENAME(ColumnName), DataType) + N')' AS nvarchar(max)), N', ')
    FROM #col WHERE Source = 'Computyme';
    IF @list IS NOT NULL
    BEGIN
    BEGIN TRY
        SET @sql = N'SELECT ''Computyme'', v.c, v.v FROM (SELECT TOP (1) * FROM dbo.Product WHERE Id = @id) p CROSS APPLY (VALUES ' + @list + N') v (c, v)';
        INSERT #val EXEC sp_executesql @sql, N'@id int', @id = @ProductId;
    END TRY
    BEGIN CATCH
        /* the view has no Id column or can't be read: Computyme's extra columns are left out */
        DELETE #col WHERE Source = 'Computyme';
    END CATCH
    END

    /* names for codes: categories by name, EGRP with Computyme's description */
    CREATE TABLE #disp (Source varchar(12), ColumnName sysname COLLATE DATABASE_DEFAULT, DisplayValue nvarchar(400));

    INSERT #disp (Source, ColumnName, DisplayValue)
    SELECT v.Source, v.ColumnName, LTRIM(RTRIM(k.CatName))
    FROM #val v
    JOIN dbo.Category k ON k.CatId = TRY_CAST(v.Value AS int)
    WHERE v.ColumnName IN (N'TopCatId', N'CatId', N'SubCatId') AND TRY_CAST(v.Value AS int) > 0;

    /* Computyme's group columns (EGRP and any other GRP/GROUP column on IVMSTData), read only, under Category */
    DECLARE @code nvarchar(100) = (SELECT LTRIM(RTRIM(CAST(ProductCode AS nvarchar(100)))) FROM dbo.ProductData WHERE Id = @ProductId);
    DECLARE @idType nvarchar(200) =
        (SELECT TYPE_NAME(c.system_type_id)
                + CASE WHEN TYPE_NAME(c.system_type_id) IN (N'varchar', N'char') THEN N'(' + CASE WHEN c.max_length = -1 THEN N'max' ELSE CAST(c.max_length AS nvarchar(6)) END + N')'
                       WHEN TYPE_NAME(c.system_type_id) IN (N'nvarchar', N'nchar') THEN N'(' + CASE WHEN c.max_length = -1 THEN N'max' ELSE CAST(c.max_length / 2 AS nvarchar(6)) END + N')'
                       WHEN TYPE_NAME(c.system_type_id) IN (N'decimal', N'numeric') THEN N'(' + CAST(c.precision AS nvarchar(3)) + N',' + CAST(c.scale AS nvarchar(3)) + N')'
                       ELSE N'' END
         FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.IVMSTData') AND c.name = N'ID');

    SET @list = NULL;
    SELECT @list = STRING_AGG(CAST(N'(N' + QUOTENAME(c.name, '''') + N', ' + piv2.ProductSheet_TextExpr(QUOTENAME(c.name), TYPE_NAME(c.system_type_id)) + N')' AS nvarchar(max)), N', ')
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID(N'dbo.IVMSTData')
      AND (c.name LIKE N'%GRP%' OR c.name LIKE N'%GROUP%')
      AND TYPE_NAME(c.system_type_id) NOT IN (N'image', N'varbinary', N'binary', N'xml', N'sql_variant', N'timestamp')
      AND NOT EXISTS (SELECT 1 FROM #col x WHERE x.ColumnName = c.name COLLATE DATABASE_DEFAULT);

    IF @list IS NOT NULL AND @idType IS NOT NULL AND @code IS NOT NULL
    BEGIN
    BEGIN TRY
        /* the code is converted to ID's own type as a parameter, so ID's index can be used */
        SET @sql = N'SELECT ''Computyme'', v.c, v.v FROM (SELECT TOP (1) * FROM dbo.IVMSTData WHERE ID = @c) x CROSS APPLY (VALUES ' + @list + N') v (c, v)';
        DECLARE @sqlParams nvarchar(300) = N'@c ' + @idType;
        INSERT #val EXEC sp_executesql @sql, @sqlParams, @c = @code;

        INSERT #col (Source, ColumnName, DataType, MaxLength, Prec, Scale, IsNullable, IsReadOnlyType, ColumnId)
        SELECT 'Computyme', c.name, TYPE_NAME(c.system_type_id), c.max_length, c.precision, c.scale, c.is_nullable, 1,
               900 + ROW_NUMBER() OVER (ORDER BY c.column_id)                  -- 901-999 marks Computyme's group columns
        FROM sys.columns c
        WHERE c.object_id = OBJECT_ID(N'dbo.IVMSTData')
          AND EXISTS (SELECT 1 FROM #val v WHERE v.Source = 'Computyme' AND v.ColumnName = c.name COLLATE DATABASE_DEFAULT)
          AND NOT EXISTS (SELECT 1 FROM #col x WHERE x.ColumnName = c.name COLLATE DATABASE_DEFAULT);
    END TRY
    BEGIN CATCH
        SET @list = NULL;          -- IVMSTData can't be read for this product: its group columns are left out
    END CATCH
    END

    /* EGRP's description from Computyme's list (piv2.ComputymeEgroups) */
    BEGIN TRY
        INSERT #disp (Source, ColumnName, DisplayValue)
        EXEC sp_executesql N'
            SELECT v.Source, v.ColumnName, CAST(e.DESC_C AS nvarchar(400))
            FROM #val v
            JOIN piv2.ComputymeEgroups e ON TRY_CAST(e.ID AS int) = TRY_CAST(v.Value AS int)
            WHERE v.ColumnName IN (N''egrp'', N''E_GRP'') AND TRY_CAST(v.Value AS int) IS NOT NULL;';
    END TRY
    BEGIN CATCH
        SET @list = NULL;          -- the EGROUPS synonym isn't readable: EGRP shows as a number
    END CATCH

    SELECT c.Source, c.ColumnName, c.DataType, c.MaxLength, c.Prec, c.Scale, c.IsNullable,
           v.Value,
           dsp.DisplayValue,
           ISNULL(f.Label, CASE WHEN c.ColumnName IN (N'E_GRP') THEN N'EGRP (Computyme)'
                                WHEN c.Source = 'Computyme' AND c.ColumnId BETWEEN 900 AND 999 THEN c.ColumnName + N' (Computyme)'
                                ELSE c.ColumnName END)                    AS Label,
           ISNULL(f.GroupName, CASE WHEN c.Source = 'Computyme' AND c.ColumnId BETWEEN 900 AND 999 THEN N'Category'
                                    WHEN c.Source = 'Computyme' THEN N'Computyme' ELSE N'Other fields' END) AS GroupName,
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
    LEFT JOIN #disp dsp ON dsp.Source = c.Source AND dsp.ColumnName = c.ColumnName
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
    IF ISNULL(ISJSON(@Changes), 0) <> 1
        THROW 50461, N'The changes aren''t valid JSON.', 1;

    CREATE TABLE #chg (ColumnName sysname COLLATE DATABASE_DEFAULT, Value nvarchar(max), IsNull bit,
                       TypeSql nvarchar(200), DataType sysname NULL, MaxChars int, IsNullable bit, Lock varchar(12));

    /* strict: a value that is an object or an array is refused instead of becoming NULL */
    INSERT #chg (ColumnName, Value, IsNull)
    SELECT j.[column], j.[value], CASE WHEN j.[value] IS NULL THEN 1 ELSE 0 END
    FROM OPENJSON(@Changes) WITH ([column] sysname '$.column', [value] nvarchar(max) 'strict $.value') j
    WHERE j.[column] IS NOT NULL;

    DECLARE @msg nvarchar(400);

    SELECT TOP (1) @msg = CONCAT(N'A column was sent twice: ', ColumnName, N'.')
    FROM #chg GROUP BY ColumnName HAVING COUNT(*) > 1;
    IF @msg IS NOT NULL THROW 50462, @msg, 1;

    /* the column as stored (exact name, base type); types the sheet doesn't edit stay unknown and are refused */
    UPDATE x SET
        ColumnName = ISNULL(c.name, x.ColumnName),
        DataType   = CASE WHEN TYPE_NAME(c.user_type_id) IN (N'geography', N'geometry', N'hierarchyid')
                            OR TYPE_NAME(c.system_type_id) IN (N'image', N'varbinary', N'binary', N'xml', N'sql_variant', N'timestamp')
                          THEN NULL ELSE TYPE_NAME(c.system_type_id) END,
        IsNullable = c.is_nullable,
        MaxChars   = CASE WHEN TYPE_NAME(c.system_type_id) IN (N'nvarchar', N'nchar') AND c.max_length > 0 THEN c.max_length / 2
                          WHEN TYPE_NAME(c.system_type_id) IN (N'varchar', N'char') AND c.max_length > 0 THEN c.max_length
                          ELSE NULL END,
        TypeSql    = TYPE_NAME(c.system_type_id)
                     + CASE WHEN TYPE_NAME(c.system_type_id) IN (N'varchar', N'char')
                                 THEN N'(' + CASE WHEN c.max_length = -1 THEN N'max' ELSE CAST(c.max_length AS nvarchar(6)) END + N')'
                            WHEN TYPE_NAME(c.system_type_id) IN (N'nvarchar', N'nchar')
                                 THEN N'(' + CASE WHEN c.max_length = -1 THEN N'max' ELSE CAST(c.max_length / 2 AS nvarchar(6)) END + N')'
                            WHEN TYPE_NAME(c.system_type_id) IN (N'decimal', N'numeric')
                                 THEN N'(' + CAST(c.precision AS nvarchar(3)) + N',' + CAST(c.scale AS nvarchar(3)) + N')'
                            WHEN TYPE_NAME(c.system_type_id) IN (N'datetime2', N'time', N'datetimeoffset')
                                 THEN N'(' + CAST(c.scale AS nvarchar(3)) + N')'
                            ELSE N'' END,
        Lock       = CASE
                         WHEN c.is_identity = 1 OR c.is_computed = 1 THEN 'SYSTEM'
                         WHEN f.Lock = 'COMPUTYME' AND @SqlIsMaster = 1 THEN NULL
                         ELSE f.Lock
                     END
    FROM #chg x
    LEFT JOIN sys.columns c ON c.object_id = OBJECT_ID(N'dbo.ProductData') AND c.name = x.ColumnName COLLATE DATABASE_DEFAULT
    LEFT JOIN piv2.ProductSheetField f ON f.ColumnName = x.ColumnName COLLATE DATABASE_DEFAULT;

    SELECT TOP (1) @msg = CONCAT(x.ColumnName, N' isn''t a product field that can be changed here.') FROM #chg x WHERE x.DataType IS NULL;
    IF @msg IS NOT NULL THROW 50463, @msg, 1;

    /* a blank number, date or yes/no means "no value", not 0 or 1900-01-01 */
    UPDATE #chg SET IsNull = 1
    WHERE IsNull = 0 AND LTRIM(RTRIM(Value)) = N''
      AND DataType NOT IN (N'varchar', N'nvarchar', N'char', N'nchar', N'text', N'ntext');

    SELECT TOP (1) @msg = CONCAT(x.ColumnName, N' is locked (',
                                 CASE x.Lock WHEN 'COMPUTYME' THEN N'set in Computyme until product data moves to SQL'
                                             WHEN 'CATEGORY'  THEN N'change it with the Categories section or the Category Desk'
                                             WHEN 'SHOPIFY'   THEN N'set by the Shopify sync'
                                             WHEN 'CONTRACT'  THEN N'edit it in the product fields above'
                                             WHEN 'MARKETPLACE' THEN N'set by the marketplace sync'
                                             ELSE N'kept by the system' END, N').')
    FROM #chg x WHERE x.Lock IS NOT NULL;
    IF @msg IS NOT NULL THROW 50464, @msg, 1;

    SELECT TOP (1) @msg = CONCAT(x.ColumnName, N' can''t be empty.') FROM #chg x WHERE x.IsNull = 1 AND x.IsNullable = 0;
    IF @msg IS NOT NULL THROW 50465, @msg, 1;

    SELECT TOP (1) @msg = CONCAT(x.ColumnName, N' is too long (', LEN(x.Value), N' characters; the most is ', x.MaxChars, N').')
    FROM #chg x WHERE x.IsNull = 0 AND x.MaxChars IS NOT NULL AND LEN(x.Value) > x.MaxChars;
    IF @msg IS NOT NULL THROW 50466, @msg, 1;

    /* every value must convert to its column's type */
    DECLARE @col sysname, @val nvarchar(max), @type nvarchar(200), @dtype sysname, @ok bit, @sql nvarchar(max);
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

    /* write and log, all or nothing; values logged the same way the sheet shows them */
    DECLARE @old nvarchar(max), @new nvarchar(max), @isNull bit;
    DECLARE @stamp bit = CASE WHEN COL_LENGTH(N'dbo.ProductData', N'LastUpdated') IS NOT NULL THEN 1 ELSE 0 END;
    BEGIN TRAN;
        DECLARE w CURSOR LOCAL FAST_FORWARD FOR SELECT ColumnName, Value, TypeSql, DataType, IsNull FROM #chg;
        OPEN w;
        FETCH NEXT FROM w INTO @col, @val, @type, @dtype, @isNull;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @sql = N'SELECT @old = ' + piv2.ProductSheet_TextExpr(QUOTENAME(@col), @dtype) + N' FROM dbo.ProductData WITH (UPDLOCK) WHERE Id = @id;
                         UPDATE dbo.ProductData SET ' + QUOTENAME(@col) + N' = '
                       + CASE WHEN @isNull = 1 THEN N'NULL' ELSE N'CONVERT(' + @type + N', @v)' END
                       + N' WHERE Id = @id;
                         SELECT @new = ' + piv2.ProductSheet_TextExpr(QUOTENAME(@col), @dtype) + N' FROM dbo.ProductData WHERE Id = @id;';
            EXEC sp_executesql @sql, N'@id int, @v nvarchar(max), @old nvarchar(max) OUTPUT, @new nvarchar(max) OUTPUT',
                 @id = @ProductId, @v = @val, @old = @old OUTPUT, @new = @new OUTPUT;

            INSERT piv2.ProductSheetLog (ProductId, ColumnName, OldValue, NewValue, ChangedBy)
            VALUES (@ProductId, @col, @old, @new, @User);

            FETCH NEXT FROM w INTO @col, @val, @type, @dtype, @isNull;
        END
        CLOSE w; DEALLOCATE w;

        /* so anything that looks for recently changed products sees it */
        IF @stamp = 1
            EXEC sp_executesql N'UPDATE dbo.ProductData SET LastUpdated = GETDATE() WHERE Id = @id;', N'@id int', @id = @ProductId;
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
    IF ISNULL(ISJSON(@ViewJson), 0) <> 1 THROW 50468, N'The layout isn''t valid JSON.', 1;
    MERGE piv2.ProductSheetUserView AS t
    USING (SELECT @UserName AS UserName) AS s ON t.UserName = s.UserName
    WHEN MATCHED THEN UPDATE SET ViewJson = @ViewJson, UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (UserName, ViewJson) VALUES (@UserName, @ViewJson);
END
GO

PRINT N'Product sheet ready.';
