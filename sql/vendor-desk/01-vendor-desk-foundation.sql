/* ---------------------------------------------------------------
    Vendor Desk · 01  Cutover map, brand ↔ vendor, vendor record, direct billing, product classes

    Database: PRO      Safe to run twice. Adds piv2 tables, functions and procedures.
    Writes to existing objects in ONE place only: piv2.BrandVendor_Set updates dbo.Brand.VendorID
    (one brand, logged). That column is what the B2B vendor filter reads, so a move shows on the site.
    Nothing is written to EDA (the Computyme mirror) and no existing object is altered or dropped.

    Cutover map
      piv2.CutoverSection        one row per section: who is master today (COMPUTYME / SQL / MIXED /
                                 EXTENSION), where the data lives, what the B2B site reads, next step
      piv2.CutoverSectionLog     every owner change
      piv2.Cutover_List, piv2.Cutover_SetOwner

    Brand ↔ vendor (SQL is master; dbo.VendorBrand is empty and no longer used)
      piv2.BrandVendorHistory    every move: brand, from, to, why, who, when
      piv2.BrandVendor_List      every brand with its vendor, products, and callouts
      piv2.BrandVendor_Set       move a brand to a vendor (or clear it)
      piv2.BrandVendor_History

    Vendor record (Computyme is master: EDA.APMST.APMST, read only)
      piv2.VendorComputymeField  labels, groups and notes for the APMST columns (seeded; edit freely)
      piv2.ParseDueDays          "30DAYS" / "10TH" / "15CM" into structured terms
      piv2.Vendor_ComputymeRecord  every APMST field for one vendor + parsed terms + usage counts

    Direct billing (Computyme values read only; the split is a PIV2 extension)
      piv2.VendorBillingSplit    per AP vendor: cash discount, PRO share, special deduction, passed to member
      piv2.VendorBillingSplitLog
      piv2.VendorBilling_Get, piv2.VendorBilling_Save

    Product classes (Computyme's vendor groups 479/497/... locked; new PIV2 classes editable)
      piv2.ProductClass, piv2.ProductClassLog
      piv2.ProductClass_List, piv2.ProductClass_Save

    Refusals come back as THROW 50520-50539.
   --------------------------------------------------------------- */

USE PRO;
GO
SET NOCOUNT ON;
GO
IF SCHEMA_ID('piv2') IS NULL EXEC('CREATE SCHEMA piv2');
GO

/* =============================================================== Cutover map */

IF OBJECT_ID('piv2.CutoverSection', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.CutoverSection
    (
        SectionKey      varchar(40)    NOT NULL CONSTRAINT PK_CutoverSection PRIMARY KEY,
        Area            nvarchar(40)   NOT NULL,
        Name            nvarchar(120)  NOT NULL,
        Owner           varchar(12)    NOT NULL
            CONSTRAINT CK_CutoverSection_Owner CHECK (Owner IN ('COMPUTYME','SQL','MIXED','EXTENSION')),
        Summary         nvarchar(800)  NULL,
        ComputymeSource nvarchar(300)  NULL,
        SqlObjects      nvarchar(300)  NULL,
        B2BReads        nvarchar(300)  NULL,
        PivScreen       nvarchar(120)  NULL,
        NextStep        nvarchar(600)  NULL,
        SortOrder       int            NOT NULL CONSTRAINT DF_CutoverSection_Sort DEFAULT (0),
        UpdatedAt       datetime2(0)   NOT NULL CONSTRAINT DF_CutoverSection_At DEFAULT (SYSUTCDATETIME()),
        UpdatedBy       nvarchar(150)  NULL
    );
END
GO
IF OBJECT_ID('piv2.CutoverSectionLog', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.CutoverSectionLog
    (
        Id          int IDENTITY(1,1) NOT NULL CONSTRAINT PK_CutoverSectionLog PRIMARY KEY,
        SectionKey  varchar(40)    NOT NULL,
        OldOwner    varchar(12)    NULL,
        NewOwner    varchar(12)    NOT NULL,
        Note        nvarchar(600)  NULL,
        ChangedBy   nvarchar(150)  NULL,
        ChangedAt   datetime2(0)   NOT NULL CONSTRAINT DF_CutoverSectionLog_At DEFAULT (SYSUTCDATETIME())
    );
END
GO

/* Seed: insert-only, so edits made on the screen are kept when this runs again. */
MERGE piv2.CutoverSection AS t
USING (VALUES
 ('vendors.master',      N'Vendors',    N'Vendor master (name, addresses, terms, surcharge)', 'COMPUTYME',
  N'The AP vendor record. Every product''s actual vendor and every brand''s vendor point here. PIV2 shows it locked.',
  N'APMST (EDA.APMST.APMST)', N'dbo.Vendor (id, name), dbo.VendorProfile', NULL, N'Vendor Desk › Vendor record',
  N'Cut over with AP: copy APMST into dbo.Vendor/VendorProfile, flip, send new vendors back to Computyme until AP moves.', 10),
 ('vendors.extension',   N'Vendors',    N'Vendor contacts, contracts, price lists, policies, currency, custom fields', 'EXTENSION',
  N'Exists only in PIV2. Computyme has nothing to send back.',
  NULL, N'dbo.VendorProfile, VendorTerms, VendorCardContact, VendorContract, VendorPriceList, Vendor*Policy', NULL, N'Vendor Desk',
  N'Fill in. Currency per vendor replaces the "Y" suffix on raw costs.', 20),
 ('vendors.directbilling', N'Vendors',  N'Direct billing (member buys direct, PRO bills a surcharge)', 'MIXED',
  N'Computyme holds the vendor cash discount (APMST PCT), PRO surcharge and the add-to-member-bill flag, and the program records in VNMST. The split PRO keeps vs passes on is a PIV2 extension.',
  N'APMST PCT / SUR_CHG_PCT / CODE; VNMST (program vendors, APID → APMST); EDI.UPDATE, AR7, UPD.EDICREDITS', N'piv2.VendorBillingSplit', NULL, N'Vendor Desk › Direct billing',
  N'Confirm the program is still running; define the split per vendor; cut over with member billing (AR).', 30),
 ('brands.vendorlink',   N'Brands',     N'Brand → vendor', 'SQL',
  N'Only exists in SQL. dbo.VendorBrand is empty; dbo.Brand.VendorID is the link. Moves are logged.',
  NULL, N'dbo.Brand.VendorID, piv2.BrandVendorHistory', N'Warehouse_Search_FIX vendor filter (Brand.VendorID)', N'Brands & vendors',
  N'Fix the brands with no vendor; point ProMaster at a real vendor.', 40),
 ('products.class',      N'Products',   N'Product class (Computyme "vendor group" 479, 497, 992 …)', 'MIXED',
  N'The class on each product is Computyme''s (IVMST VEND, field 5). The rules hard-coded against those numbers are written down in PIV2; new PIV2 classes are extensions.',
  N'IVMST field 5 VEND; D_IVMST TERMS2, PTERMS, NETNET, DATING', N'piv2.ProductClass', N'dbo.Product FastShippingAvailable (VEND 479)', N'Brands & vendors › Product classes',
  N'Cut over with product maintenance; then classes drive terms and fast shipping from the table.', 50),
 ('products.core',       N'Products',   N'Product prices, cost, stock, pack sizes', 'COMPUTYME',
  N'Prices 1-3, PCT, raw cost, MAP, retail, stock, multiples. PIV2 shows them locked until Product:SqlIsMaster.',
  N'IVMST (PRO.dbo.IVMSTData copy)', N'dbo.Product (view), Product:SqlIsMaster', N'dbo.Product: Retail, CartonPricingRetail, AuthorizedPrice, MAP, Inventory, Multiple, Carton', N'Product Desk › All fields',
  N'Cut over with product maintenance (IV.MNT.PROD.N).', 60),
 ('products.status',     N'Products',   N'Suspend / discontinued status', 'COMPUTYME',
  N'IVMST field 15: 1 suspended, 2 suspended with member orders waiting, 3 suspended and nothing left. Recalculated by order entry, billing and receiving. Status 3 is the B2B site''s Discontinued, which then shows the replacement product.',
  N'IVMST field 15 STATUS; IV15, IV3, IV5, IV7, IV.UPD.SCANORD, UPD.WEBORDERS', NULL, N'dbo.Product IsDiscontinued (status 3) → replacement shown', N'Product Desk',
  N'B2B-critical. Cut over with order entry, not before.', 70),
 ('products.content',    N'Products',   N'Product content (model, features, specs, images, web flags)', 'SQL',
  N'Lives in ProductData; edited in the Product Desk.',
  NULL, N'dbo.ProductData', N'dbo.Product: ModelName, Features, Specs, IsActive, IsPublic, IsForSale', N'Product Desk › All fields', NULL, 80),
 ('products.replacement', N'Products',  N'Replacement product', 'SQL',
  N'ProductData.ReplacementCode; the B2B site shows it on discontinued products.',
  NULL, N'dbo.ProductData.ReplacementCode', N'dbo.Product ReplacementCode', N'Product Desk header', NULL, 90),
 ('products.categories', N'Products',   N'Categories', 'MIXED',
  N'PIV2 category tree. EGRP categories stay Computyme''s until Product:SqlIsMaster.',
  N'IVMST E_GRP (EGROUPS)', N'Category Desk tables', N'Category ids on dbo.Product', N'Category Desk', NULL, 100),
 ('products.directship', N'Products',   N'Products outside Computyme (direct ship)', 'SQL',
  N'Loaded into VendorProduct; inventory 99999+ means ships direct.',
  NULL, N'dbo.VendorProduct, dbo.DiscontinuedList', N'Warehouse_Search_FIX direct-ship filter (Inventory ≥ 99999)', N'Product load (to rebuild)', N'Replace the legacy loader.', 110),
 ('pricing.client',      N'Pricing',    N'Client (B2B) price markup', 'SQL',
  N'+5% on retail and carton price for client accounts (brand 17 excepted), drop-ship charge ×2. Hard-coded in the B2B search.',
  NULL, N'dbo.Warehouse_Search_FIX', N'Warehouse_Search_FIX', NULL, N'Move the 5% into a setting (needs your approval: B2B procedure).', 120),
 ('pricing.history',     N'Pricing',    N'Price change history', 'COMPUTYME',
  N'IVMST.LOG (who, field, old, new, when) and IVMST field 11 change dates.',
  N'IVMST.LOG (EDA.IVMST_LOG)', NULL, NULL, N'Product Desk (planned)', N'Show on the product page.', 130),
 ('purchasing.po',       N'Purchasing', N'Purchase orders', 'COMPUTYME',
  N'Not cut over. PIV2 shows Computyme''s POs; it does not create them.',
  N'IVPO (EDA.IVPO), IVMST fields 20-23', NULL, N'dbo.Product onOrder', N'Product Desk › Order (planned)', N'Display first; PO build later.', 140),
 ('purchasing.suggest',  N'Purchasing', N'Suggested order', 'COMPUTYME',
  N'Computyme''s rule shown with its inputs; buyers can adjust; forecast and market research beside it.',
  N'IV21, DH1, D_IVMST MIN.STK', NULL, NULL, N'Product Desk › Order (planned)', NULL, 150),
 ('purchasing.duedates', N'Purchasing', N'Stock due dates', 'COMPUTYME',
  N'One due date per product, no PO link.',
  N'ORDDUE (EDA.ORDDUE)', NULL, N'dbo.Product StockDueDate', N'Product Desk', NULL, 160),
 ('purchasing.receiving', N'Purchasing', N'Receiving and cost layers', 'COMPUTYME',
  NULL, N'IV.ORD.REC(.N), RECLOG, IVMST fields 24-26', NULL, N'dbo.Product Inventory', NULL, NULL, 170),
 ('orders.member',       N'Orders',     N'Member orders and backorders', 'COMPUTYME',
  N'Web and EDI orders are imported into Computyme; the Integration desk carries canonical orders.',
  N'IVORD, ORDHIST, UPD.WEBORDERS, UPD.MEMEDI, IV11.AUTO', N'Integration desk', NULL, N'Integration desk', NULL, 180),
 ('members.master',      N'Members',    N'Member accounts', 'MIXED',
  N'ARMST is Computyme''s; the Member Desk adds PIV2 fields.',
  N'ARMST', N'Member Desk tables', NULL, N'Member Desk', NULL, 190),
 ('accounting.ar',       N'Accounting', N'Receivables and member billing', 'COMPUTYME', NULL, N'ARMST, ARINV, ARSHIP, AR programs', NULL, NULL, NULL, NULL, 200),
 ('accounting.ap',       N'Accounting', N'Payables and vendor payments', 'COMPUTYME', NULL, N'APMST, APHIST, AP programs', NULL, NULL, NULL, NULL, 210),
 ('rebates',             N'Rebates',    N'Instant rebates', 'SQL', NULL, NULL, N'Rebate Desk (PRO_NUKE)', NULL, N'Rebate Desk', NULL, 220),
 ('warehouse',           N'Warehouse',  N'Warehouse distribution (pick, pack, ship)', 'COMPUTYME',
  N'Stays in Computyme: this is what Computyme ends up running.', N'IV.INP.SCANORD, packing lists, ship tickets', NULL, NULL, NULL, N'Stays.', 230)
) AS s (SectionKey, Area, Name, Owner, Summary, ComputymeSource, SqlObjects, B2BReads, PivScreen, NextStep, SortOrder)
ON t.SectionKey = s.SectionKey
WHEN NOT MATCHED BY TARGET THEN
    INSERT (SectionKey, Area, Name, Owner, Summary, ComputymeSource, SqlObjects, B2BReads, PivScreen, NextStep, SortOrder, UpdatedBy)
    VALUES (s.SectionKey, s.Area, s.Name, s.Owner, s.Summary, s.ComputymeSource, s.SqlObjects, s.B2BReads, s.PivScreen, s.NextStep, s.SortOrder, N'seed');
GO

CREATE OR ALTER PROCEDURE piv2.Cutover_List
AS
BEGIN
    SET NOCOUNT ON;
    SELECT SectionKey, Area, Name, Owner, Summary, ComputymeSource, SqlObjects, B2BReads, PivScreen, NextStep,
           SortOrder, UpdatedAt, UpdatedBy
    FROM piv2.CutoverSection
    ORDER BY SortOrder, Name;

    SELECT TOP (100) l.Id, l.SectionKey, s.Name, l.OldOwner, l.NewOwner, l.Note, l.ChangedBy, l.ChangedAt
    FROM piv2.CutoverSectionLog l
    LEFT JOIN piv2.CutoverSection s ON s.SectionKey = l.SectionKey
    ORDER BY l.Id DESC;
END
GO

CREATE OR ALTER PROCEDURE piv2.Cutover_SetOwner
    @SectionKey varchar(40),
    @Owner      varchar(12),
    @NextStep   nvarchar(600) = NULL,
    @Note       nvarchar(600),
    @User       nvarchar(150)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @Owner NOT IN ('COMPUTYME','SQL','MIXED','EXTENSION')
        THROW 50520, 'Owner must be COMPUTYME, SQL, MIXED or EXTENSION.', 1;
    IF NULLIF(LTRIM(RTRIM(@Note)), '') IS NULL
        THROW 50521, 'Say why the owner is changing.', 1;

    DECLARE @old varchar(12);
    BEGIN TRAN;
        SELECT @old = Owner FROM piv2.CutoverSection WITH (UPDLOCK, HOLDLOCK) WHERE SectionKey = @SectionKey;
        IF @@ROWCOUNT = 0 THROW 50522, 'That section doesn''t exist.', 1;

        UPDATE piv2.CutoverSection
           SET Owner = @Owner, NextStep = COALESCE(@NextStep, NextStep), UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @User
         WHERE SectionKey = @SectionKey;

        INSERT piv2.CutoverSectionLog (SectionKey, OldOwner, NewOwner, Note, ChangedBy)
        VALUES (@SectionKey, @old, @Owner, @Note, @User);
    COMMIT;
END
GO

/* =============================================================== Brand ↔ vendor */

IF OBJECT_ID('piv2.BrandVendorHistory', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.BrandVendorHistory
    (
        Id           int IDENTITY(1,1) NOT NULL CONSTRAINT PK_BrandVendorHistory PRIMARY KEY,
        BrandId      int            NOT NULL,
        BrandName    nvarchar(150)  NULL,
        OldVendorId  int            NULL,
        NewVendorId  int            NULL,
        Reason       nvarchar(400)  NULL,
        ChangedBy    nvarchar(150)  NULL,
        ChangedAt    datetime2(0)   NOT NULL CONSTRAINT DF_BrandVendorHistory_At DEFAULT (SYSUTCDATETIME())
    );
    CREATE INDEX IX_BrandVendorHistory_Brand ON piv2.BrandVendorHistory (BrandId, Id DESC);
END
GO

/* Products per brand with their Computyme actual vendor (IVMST A.VENDOR) and status (3 = discontinued). */
CREATE OR ALTER VIEW piv2.vBrandProductVendor
AS
    SELECT d.Id AS ProductId, d.ProductCode, d.BrandId,
           TRY_CAST(NULLIF(LTRIM(RTRIM(CAST(i.A_VENDOR AS varchar(30)))), '') AS int) AS ActualVendorId,
           TRY_CAST(NULLIF(LTRIM(RTRIM(CAST(i.vend AS varchar(30)))), '') AS int)     AS ClassNo,
           CAST(CASE WHEN CAST(i.status AS varchar(10)) = '3' THEN 1 ELSE 0 END AS bit) AS IsDiscontinued,
           CAST(CASE WHEN i.ID IS NULL THEN 0 ELSE 1 END AS bit)                       AS InComputyme
    FROM dbo.ProductData d
    LEFT JOIN dbo.IVMSTData i ON i.ID = d.ProductCode;
GO

CREATE OR ALTER PROCEDURE piv2.BrandVendor_List
    @VendorId int = NULL          -- one vendor's brands; NULL = every brand
AS
BEGIN
    SET NOCOUNT ON;

    IF OBJECT_ID('tempdb..#ap') IS NOT NULL DROP TABLE #ap;
    SELECT TRY_CAST(a.ID AS int) AS Id, MAX(CAST(a.NAME AS nvarchar(200))) AS Name
    INTO #ap
    FROM EDA.APMST.APMST a
    WHERE TRY_CAST(a.ID AS int) IS NOT NULL
    GROUP BY TRY_CAST(a.ID AS int);

    IF OBJECT_ID('tempdb..#bp') IS NOT NULL DROP TABLE #bp;
    SELECT p.BrandId,
           COUNT(*) AS Products,
           SUM(CASE WHEN p.InComputyme = 1 AND p.IsDiscontinued = 0 THEN 1 ELSE 0 END) AS LiveProducts,
           SUM(CASE WHEN p.ActualVendorId IS NOT NULL
                     AND p.ActualVendorId <> ISNULL(TRY_CAST(b.VendorID AS int), -1) THEN 1 ELSE 0 END) AS BoughtElsewhere
    INTO #bp
    FROM piv2.vBrandProductVendor p
    JOIN dbo.Brand b ON b.BrandId = p.BrandId
    GROUP BY p.BrandId;

    /* the vendors this brand's products are actually bought from, most products first */
    IF OBJECT_ID('tempdb..#bv') IS NOT NULL DROP TABLE #bv;
    SELECT x.BrandId,
           STRING_AGG(CAST(CONCAT(x.ActualVendorId, ' ', ISNULL(ap.Name, N'?'), ' (', x.N, ')') AS nvarchar(max)), N', ')
               WITHIN GROUP (ORDER BY x.N DESC) AS ActualVendors
    INTO #bv
    FROM (SELECT BrandId, ActualVendorId, COUNT(*) AS N
          FROM piv2.vBrandProductVendor
          WHERE ActualVendorId IS NOT NULL
          GROUP BY BrandId, ActualVendorId) x
    LEFT JOIN #ap ap ON ap.Id = x.ActualVendorId
    GROUP BY x.BrandId;

    SELECT b.BrandId,
           CAST(b.BrandName AS nvarchar(150))                 AS BrandName,
           TRY_CAST(b.VendorID AS int)                         AS VendorId,
           COALESCE(ap.Name, CAST(v.Name AS nvarchar(200)))    AS VendorName,
           CASE
               WHEN TRY_CAST(b.VendorID AS int) IS NULL THEN 'NO_VENDOR'
               WHEN ap.Id IS NULL AND v.VendorId IS NULL THEN 'UNKNOWN_VENDOR'
               WHEN ap.Id IS NULL AND vp.CreatedAt IS NULL THEN 'NOT_AP_VENDOR'
               ELSE 'OK'
           END                                                  AS LinkStatus,
           ISNULL(bp.Products, 0)                               AS Products,
           ISNULL(bp.LiveProducts, 0)                           AS LiveProducts,
           ISNULL(bp.BoughtElsewhere, 0)                        AS BoughtElsewhere,
           bv.ActualVendors,
           h.ChangedAt                                          AS LastMovedAt,
           h.ChangedBy                                          AS LastMovedBy
    FROM dbo.Brand b
    LEFT JOIN #ap ap ON ap.Id = TRY_CAST(b.VendorID AS int)
    LEFT JOIN dbo.Vendor v ON v.VendorId = TRY_CAST(b.VendorID AS int)
    LEFT JOIN dbo.VendorProfile vp ON vp.VendorId = v.VendorId
    LEFT JOIN #bp bp ON bp.BrandId = b.BrandId
    LEFT JOIN #bv bv ON bv.BrandId = b.BrandId
    OUTER APPLY (SELECT TOP (1) ChangedAt, ChangedBy FROM piv2.BrandVendorHistory x
                 WHERE x.BrandId = b.BrandId ORDER BY x.Id DESC) h
    WHERE @VendorId IS NULL OR TRY_CAST(b.VendorID AS int) = @VendorId
    ORDER BY CASE WHEN TRY_CAST(b.VendorID AS int) IS NULL THEN 0 ELSE 1 END, ISNULL(bp.Products, 0) DESC, b.BrandName;
END
GO

CREATE OR ALTER PROCEDURE piv2.BrandVendor_Set
    @BrandId  int,
    @VendorId int = NULL,          -- NULL clears the link
    @Reason   nvarchar(400),
    @User     nvarchar(150)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@Reason)), '') IS NULL
        THROW 50523, 'Say why the brand is moving. It shows in the brand''s history.', 1;

    IF @VendorId IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.Vendor WHERE VendorId = @VendorId)
        THROW 50524, 'That vendor isn''t in the vendor list.', 1;

    IF @VendorId IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM EDA.APMST.APMST a WHERE TRY_CAST(a.ID AS int) = @VendorId)
       AND NOT EXISTS (SELECT 1 FROM dbo.VendorProfile p WHERE p.VendorId = @VendorId AND p.CreatedAt IS NOT NULL)
        THROW 50525, 'That vendor is neither an AP vendor nor one created in PIV2, so it can''t be paid. Pick a live vendor.', 1;

    DECLARE @old int, @name nvarchar(150);
    BEGIN TRAN;
        SELECT @old = TRY_CAST(VendorID AS int), @name = CAST(BrandName AS nvarchar(150))
        FROM dbo.Brand WITH (UPDLOCK, HOLDLOCK)
        WHERE BrandId = @BrandId;
        IF @@ROWCOUNT = 0 THROW 50526, 'That brand doesn''t exist.', 1;

        IF ISNULL(@old, -1) <> ISNULL(@VendorId, -1)
        BEGIN
            UPDATE dbo.Brand SET VendorID = @VendorId WHERE BrandId = @BrandId;
            INSERT piv2.BrandVendorHistory (BrandId, BrandName, OldVendorId, NewVendorId, Reason, ChangedBy)
            VALUES (@BrandId, @name, @old, @VendorId, @Reason, @User);
        END
    COMMIT;

    SELECT @BrandId AS BrandId, @old AS OldVendorId, @VendorId AS NewVendorId;
END
GO

CREATE OR ALTER PROCEDURE piv2.BrandVendor_History
    @BrandId int = NULL,
    @VendorId int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (500) h.Id, h.BrandId, h.BrandName, h.OldVendorId, h.NewVendorId, h.Reason, h.ChangedBy, h.ChangedAt
    FROM piv2.BrandVendorHistory h
    WHERE (@BrandId IS NULL OR h.BrandId = @BrandId)
      AND (@VendorId IS NULL OR h.OldVendorId = @VendorId OR h.NewVendorId = @VendorId)
    ORDER BY h.Id DESC;
END
GO

/* =============================================================== Vendor record (APMST, read only) */

IF OBJECT_ID('piv2.VendorComputymeField', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.VendorComputymeField
    (
        ColumnName  sysname        NOT NULL CONSTRAINT PK_VendorComputymeField PRIMARY KEY,
        Label       nvarchar(120)  NOT NULL,
        GroupName   nvarchar(60)   NOT NULL,
        SortOrder   int            NOT NULL,
        Note        nvarchar(400)  NULL,
        Hidden      bit            NOT NULL CONSTRAINT DF_VendorComputymeField_Hidden DEFAULT (0)
    );
END
GO

MERGE piv2.VendorComputymeField AS t
USING (VALUES
 ('ID',          N'AP vendor number',              N'Identity', 10, N'APMST key. The vendor number everywhere in PIV2.', 0),
 ('NAME',        N'Name',                          N'Identity', 20, NULL, 0),
 ('SH_NAME',     N'Short name',                    N'Identity', 30, NULL, 0),
 ('TYPE',        N'Type',                          N'Identity', 40, N'APMST field 2. Codes not documented; confirm.', 0),
 ('NAME2',       N'Additional name / address',     N'Main address', 110, NULL, 0),
 ('STREET',      N'Street',                        N'Main address', 120, NULL, 0),
 ('CITY_ST',     N'City, state',                   N'Main address', 130, N'City and state in one field.', 0),
 ('ZIP',         N'ZIP',                           N'Main address', 140, NULL, 0),
 ('PHONE',       N'Phone',                         N'Main address', 150, NULL, 0),
 ('P_ADD1',      N'Payment address 1',             N'Payment address', 210, N'Blank = pay to the main address (APMST L.ADD rules).', 0),
 ('P_ADD2',      N'Payment address 2',             N'Payment address', 220, NULL, 0),
 ('P_CSZ',       N'Payment city, state, ZIP',      N'Payment address', 230, NULL, 0),
 ('P_PHONE',     N'Payment phone',                 N'Payment address', 240, NULL, 0),
 ('R_ADD',       N'Rep address',                   N'Rep', 310, N'APMST field 30. AR7 also reads field 30 as the surcharge rate (tenths of a percent); confirm which this holds.', 0),
 ('R_CSZ',       N'Rep city, state, ZIP',          N'Rep', 320, NULL, 0),
 ('R_PHONE',     N'Rep phone',                     N'Rep', 330, NULL, 0),
 ('PCT',         N'Cash discount %',               N'Terms', 410, N'Vendor''s discount to PRO (APMST field 9). Defaults the AP discount (AR7.11) and the PO terms (IV46.12).', 0),
 ('DUE_DAYS',    N'Due days (as typed)',           N'Terms', 420, N'Free text: "30DAYS" = net 30, "10TH" = 10th of the next month, "nnCM" = day nn of the current month (AR7.09).', 0),
 ('SUR_CHG_PCT', N'PRO surcharge %',               N'Terms', 430, N'Surcharge PRO bills members on direct-billed invoices (stored in tenths of a percent; AR7.14). Confirm this column is that field.', 0),
 ('CODE',        N'Add surcharge to member bill',  N'Terms', 440, N'APMST field 29: 2 = surcharge added to the member''s bill; anything else = recorded only (AR7.15).', 0),
 ('SPLIT',       N'Split',                         N'Terms', 450, N'APMST field 11. Meaning not documented; confirm.', 0),
 ('PREP_ORD',    N'Prepaid freight order minimum', N'Terms', 460, N'APMST field 34 (PREP.ORD).', 0),
 ('DEALER',      N'PRO''s dealer number at this vendor', N'Terms', 470, N'Printed on POs (IV45.05).', 0),
 ('WH_REC',      N'WH-Rec / fax',                  N'Terms', 480, N'Dictionary says WH.REC; IV45 prints it as the vendor fax (IV45.08).', 0),
 ('LEDGER',      N'G/L account',                   N'Accounting', 510, NULL, 0),
 ('EXPENSE',     N'Expense account',               N'Accounting', 520, NULL, 0),
 ('PREV_YR',     N'Prior-year purchases',          N'Accounting', 530, NULL, 0),
 ('YTD_GROSS',   N'Year-to-date gross',            N'Accounting', 540, NULL, 0),
 ('OPEN_GROSS',  N'Open gross',                    N'Accounting', 550, NULL, 0),
 ('YTD_DISC',    N'Year-to-date discount',         N'Accounting', 560, NULL, 0),
 ('LAST_PAID',   N'Last paid',                     N'Accounting', 570, N'Computyme date (days since 1967-12-31).', 0),
 ('NEXT_INV',    N'Next invoice number',           N'Accounting', 580, NULL, 0),
 ('ORDERS',      N'Orders',                        N'Accounting', 590, NULL, 0),
 ('PAID_IN',     N'Paid in',                       N'Accounting', 600, NULL, 0),
 ('MISC',        N'Misc. information',             N'Notes', 710, NULL, 0),
 ('NONCONFORMING_FLAG', N'Mirror: nonconforming',  N'Mirror', 900, N'Set by the EDA replication when the record didn''t fit the mapping.', 1),
 ('UNMAPPED_U2FIELD',   N'Mirror: unmapped fields', N'Mirror', 910, N'Fields the replication didn''t map (emails and others).', 1)
) AS s (ColumnName, Label, GroupName, SortOrder, Note, Hidden)
ON t.ColumnName = s.ColumnName
WHEN NOT MATCHED BY TARGET THEN
    INSERT (ColumnName, Label, GroupName, SortOrder, Note, Hidden)
    VALUES (s.ColumnName, s.Label, s.GroupName, s.SortOrder, s.Note, s.Hidden);
GO

/* Computyme due-days text into structured terms. */
CREATE OR ALTER FUNCTION piv2.ParseDueDays (@Text nvarchar(60))
RETURNS TABLE
AS
RETURN
    WITH t AS (SELECT UPPER(REPLACE(LTRIM(RTRIM(ISNULL(@Text, N''))), N' ', N'')) AS v),
         p AS (SELECT v,
                      LEFT(v, PATINDEX(N'%[^0-9]%', v + N'x') - 1)                 AS digits,
                      SUBSTRING(v, PATINDEX(N'%[^0-9]%', v + N'x'), 60)          AS rest
               FROM t)
    SELECT
        CASE
            WHEN v = N''                                       THEN 'NONE'
            WHEN digits <> N'' AND rest LIKE N'DAY%'           THEN 'NET'
            WHEN digits <> N'' AND rest IN (N'ST',N'ND',N'RD',N'TH') THEN 'DAY_NEXT_MONTH'
            WHEN digits <> N'' AND rest = N'CM'                THEN 'DAY_THIS_MONTH'
            WHEN digits <> N'' AND rest = N''                  THEN 'NET'
            ELSE 'UNPARSED'
        END AS TermsType,
        CASE WHEN digits <> N'' AND (rest LIKE N'DAY%' OR rest = N'') THEN TRY_CAST(digits AS int) END AS NetDays,
        CASE WHEN digits <> N'' AND rest IN (N'ST',N'ND',N'RD',N'TH',N'CM') THEN TRY_CAST(digits AS int) END AS DayOfMonth,
        CASE
            WHEN v = N'' THEN N'No terms on file'
            WHEN digits <> N'' AND (rest LIKE N'DAY%' OR rest = N'') THEN CONCAT(N'Net ', TRY_CAST(digits AS int), N' days')
            WHEN digits <> N'' AND rest IN (N'ST',N'ND',N'RD',N'TH') THEN CONCAT(N'Due the ', TRY_CAST(digits AS int), LOWER(rest), N' of the following month')
            WHEN digits <> N'' AND rest = N'CM' THEN CONCAT(N'Due day ', TRY_CAST(digits AS int), N' of the current month')
            ELSE CONCAT(N'Not understood: "', v, N'"')
        END AS Description
    FROM p;
GO

CREATE OR ALTER PROCEDURE piv2.Vendor_ComputymeRecord
    @VendorId int
AS
BEGIN
    SET NOCOUNT ON;

    /* 1. every APMST column for this vendor, as label / value rows (columns found from the mirror itself) */
    DECLARE @cols nvarchar(max), @sql nvarchar(max);
    SELECT @cols = STRING_AGG(CAST(N'(' + QUOTENAME(c.name, '''') + N', CAST(a.' + QUOTENAME(c.name) + N' AS nvarchar(400)))' AS nvarchar(max)), N',')
                   WITHIN GROUP (ORDER BY c.column_id)
    FROM EDA.sys.columns c
    JOIN EDA.sys.tables t ON t.object_id = c.object_id
    JOIN EDA.sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'APMST' AND t.name = 'APMST'
      AND c.system_type_id NOT IN (34, 35, 99, 165, 173, 189, 240, 241);  -- image, text, ntext, varbinary, binary, timestamp, CLR, xml

    IF OBJECT_ID('tempdb..#v') IS NOT NULL DROP TABLE #v;
    CREATE TABLE #v (ColumnName sysname COLLATE DATABASE_DEFAULT, Value nvarchar(400), Ord int IDENTITY(1,1));

    IF @cols IS NOT NULL
    BEGIN
        SET @sql = N'INSERT #v (ColumnName, Value)
            SELECT x.ColumnName, x.Value
            FROM (SELECT TOP (1) * FROM EDA.APMST.APMST WHERE TRY_CAST(ID AS int) = @id) a
            CROSS APPLY (VALUES ' + @cols + N') x (ColumnName, Value);';
        EXEC sp_executesql @sql, N'@id int', @id = @VendorId;
    END

    SELECT v.ColumnName,
           ISNULL(f.Label, v.ColumnName)        AS Label,
           ISNULL(f.GroupName, N'Other fields') AS GroupName,
           ISNULL(f.SortOrder, 800 + v.Ord)     AS SortOrder,
           v.Value,
           CASE WHEN v.ColumnName = 'LAST_PAID' AND TRY_CAST(v.Value AS int) IS NOT NULL
                THEN CONVERT(nvarchar(10), DATEADD(day, TRY_CAST(v.Value AS int), '1967-12-31'), 23) END AS DisplayValue,
           f.Note,
           ISNULL(f.Hidden, 0)                  AS Hidden
    FROM #v v
    LEFT JOIN piv2.VendorComputymeField f ON f.ColumnName = v.ColumnName
    ORDER BY ISNULL(f.SortOrder, 800 + v.Ord);

    /* 2. terms, parsed */
    DECLARE @due nvarchar(60) = (SELECT TOP (1) Value FROM #v WHERE ColumnName = 'DUE_DAYS'),
            @pct nvarchar(60) = (SELECT TOP (1) Value FROM #v WHERE ColumnName = 'PCT');
    SELECT @due AS DueDaysText, @pct AS CashDiscountText, TRY_CAST(@pct AS decimal(9,3)) AS CashDiscountPct,
           p.TermsType, p.NetDays, p.DayOfMonth, p.Description
    FROM piv2.ParseDueDays(@due) p;

    /* 3. where this vendor is used */
    SELECT
        (SELECT COUNT(*) FROM dbo.IVMSTData i WHERE TRY_CAST(CAST(i.A_VENDOR AS varchar(30)) AS int) = @VendorId) AS ProductsAsVendor,
        (SELECT COUNT(*) FROM dbo.IVMSTData i WHERE TRY_CAST(CAST(i.A_VENDOR AS varchar(30)) AS int) = @VendorId
                                               AND ISNULL(CAST(i.status AS varchar(10)), '') <> '3')           AS LiveProductsAsVendor,
        (SELECT COUNT(*) FROM dbo.Brand b WHERE TRY_CAST(b.VendorID AS int) = @VendorId)                         AS Brands,
        (SELECT COUNT(*) FROM EDA.VNMST.VNMST n WHERE TRY_CAST(n.APID AS int) = @VendorId)                       AS DirectBillingPrograms,
        (SELECT COUNT(*) FROM EDA.IVPO.IVPO o WHERE TRY_CAST(o.VEND AS int) = @VendorId)                         AS PurchaseOrders,
        (SELECT COUNT(*) FROM EDA.IVPO.IVPO o WHERE TRY_CAST(o.VEND AS int) = @VendorId
                                               AND ISNULL(CAST(o.RECD AS varchar(10)), '') <> '1')               AS OpenPurchaseOrders,
        CAST(CASE WHEN EXISTS (SELECT 1 FROM #v) THEN 1 ELSE 0 END AS bit)                                       AS InComputyme;
END
GO

/* =============================================================== Direct billing */

IF OBJECT_ID('piv2.VendorBillingSplit', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.VendorBillingSplit
    (
        VendorId                 int            NOT NULL CONSTRAINT PK_VendorBillingSplit PRIMARY KEY,   -- AP vendor
        CashDiscountPct          decimal(7,3)   NULL,   -- what the vendor gives PRO for paying on time
        ProSharePct              decimal(7,3)   NULL,   -- what PRO keeps (surcharge to the member)
        SpecialDeductionPct      decimal(7,3)   NULL,
        PassToMemberPct          decimal(7,3)   NULL,   -- NULL = cash discount − PRO share − special deduction
        AddSurchargeToMemberBill bit            NULL,
        EffectiveFrom            date           NULL,
        Notes                    nvarchar(1000) NULL,
        UpdatedAt                datetime2(0)   NOT NULL CONSTRAINT DF_VendorBillingSplit_At DEFAULT (SYSUTCDATETIME()),
        UpdatedBy                nvarchar(150)  NULL
    );
END
GO
IF OBJECT_ID('piv2.VendorBillingSplitLog', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.VendorBillingSplitLog
    (
        Id         int IDENTITY(1,1) NOT NULL CONSTRAINT PK_VendorBillingSplitLog PRIMARY KEY,
        VendorId   int            NOT NULL,
        OldJson    nvarchar(max)  NULL,
        NewJson    nvarchar(max)  NULL,
        ChangedBy  nvarchar(150)  NULL,
        ChangedAt  datetime2(0)   NOT NULL CONSTRAINT DF_VendorBillingSplitLog_At DEFAULT (SYSUTCDATETIME())
    );
END
GO

CREATE OR ALTER PROCEDURE piv2.VendorBilling_Get
    @VendorId int
AS
BEGIN
    SET NOCOUNT ON;

    /* 1. Computyme's values on the AP vendor, as stored */
    SELECT TOP (1)
           CAST(a.PCT AS nvarchar(30))         AS CashDiscountStored,
           CAST(a.SUR_CHG_PCT AS nvarchar(30)) AS SurchargeStored,
           CAST(a.CODE AS nvarchar(30))        AS SurchargeCodeStored,
           CAST(CASE WHEN LTRIM(RTRIM(CAST(a.CODE AS nvarchar(30)))) = '2' THEN 1 ELSE 0 END AS bit) AS AddsSurchargeToMemberBill,
           CAST(a.DUE_DAYS AS nvarchar(60))    AS DueDaysText
    FROM EDA.APMST.APMST a
    WHERE TRY_CAST(a.ID AS int) = @VendorId;

    /* 2. the direct-billing program records (VNMST) that bill through this AP vendor */
    SELECT TRY_CAST(n.ID AS int)                 AS ProgramNo,
           CAST(n.NAME AS nvarchar(200))         AS Name,
           CAST(n.PCT AS nvarchar(30))           AS SurchargeStored,
           CAST(n.SPCDED AS nvarchar(60))        AS SpecialDeductionStored,
           CAST(n.SPC_PCT AS nvarchar(60))       AS SpecialPctStored,
           CAST(n.ADMDAYS AS nvarchar(60))       AS AdminDaysStored,
           CAST(n.FTR AS nvarchar(60))           AS FtrStored,
           CAST(n.CODE AS nvarchar(30))          AS SurchargeTypeStored,
           CAST(n.YTD_SALES AS nvarchar(30))     AS YtdSalesStored,
           CAST(n.PREV_YR AS nvarchar(30))       AS PriorYearStored,
           CAST(n.SURCHARGES AS nvarchar(30))    AS SurchargesStored
    FROM EDA.VNMST.VNMST n
    WHERE TRY_CAST(n.APID AS int) = @VendorId
    ORDER BY TRY_CAST(n.ID AS int);

    /* 3. the PIV2 split, with what passes to the member worked out */
    SELECT s.VendorId, s.CashDiscountPct, s.ProSharePct, s.SpecialDeductionPct, s.PassToMemberPct,
           COALESCE(s.PassToMemberPct,
                    ISNULL(s.CashDiscountPct, 0) - ISNULL(s.ProSharePct, 0) - ISNULL(s.SpecialDeductionPct, 0)) AS PassToMemberEffectivePct,
           CAST(CASE WHEN s.PassToMemberPct IS NULL THEN 1 ELSE 0 END AS bit) AS PassToMemberIsCalculated,
           s.AddSurchargeToMemberBill, s.EffectiveFrom, s.Notes, s.UpdatedAt, s.UpdatedBy
    FROM piv2.VendorBillingSplit s
    WHERE s.VendorId = @VendorId;

    SELECT TOP (50) Id, OldJson, NewJson, ChangedBy, ChangedAt
    FROM piv2.VendorBillingSplitLog WHERE VendorId = @VendorId ORDER BY Id DESC;
END
GO

CREATE OR ALTER PROCEDURE piv2.VendorBilling_Save
    @VendorId                 int,
    @CashDiscountPct          decimal(7,3) = NULL,
    @ProSharePct              decimal(7,3) = NULL,
    @SpecialDeductionPct      decimal(7,3) = NULL,
    @PassToMemberPct          decimal(7,3) = NULL,
    @AddSurchargeToMemberBill bit = NULL,
    @EffectiveFrom            date = NULL,
    @Notes                    nvarchar(1000) = NULL,
    @User                     nvarchar(150)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Vendor WHERE VendorId = @VendorId)
        THROW 50527, 'That vendor isn''t in the vendor list.', 1;
    IF (@CashDiscountPct < 0 OR @CashDiscountPct > 100) OR (@ProSharePct < 0 OR @ProSharePct > 100)
       OR (@SpecialDeductionPct < 0 OR @SpecialDeductionPct > 100) OR (@PassToMemberPct < 0 OR @PassToMemberPct > 100)
        THROW 50528, 'Percentages must be between 0 and 100.', 1;
    IF @PassToMemberPct IS NULL
       AND ISNULL(@CashDiscountPct, 0) - ISNULL(@ProSharePct, 0) - ISNULL(@SpecialDeductionPct, 0) < 0
        THROW 50529, 'PRO''s share and the special deduction are more than the cash discount, so the member would pay more than terms. Lower them or set what passes to the member.', 1;

    DECLARE @old nvarchar(max) = (SELECT * FROM piv2.VendorBillingSplit WHERE VendorId = @VendorId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

    BEGIN TRAN;
        MERGE piv2.VendorBillingSplit WITH (HOLDLOCK) AS t
        USING (SELECT @VendorId AS VendorId) s ON t.VendorId = s.VendorId
        WHEN MATCHED THEN UPDATE SET
            CashDiscountPct = @CashDiscountPct, ProSharePct = @ProSharePct, SpecialDeductionPct = @SpecialDeductionPct,
            PassToMemberPct = @PassToMemberPct, AddSurchargeToMemberBill = @AddSurchargeToMemberBill,
            EffectiveFrom = @EffectiveFrom, Notes = @Notes, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @User
        WHEN NOT MATCHED THEN INSERT
            (VendorId, CashDiscountPct, ProSharePct, SpecialDeductionPct, PassToMemberPct, AddSurchargeToMemberBill, EffectiveFrom, Notes, UpdatedBy)
            VALUES (@VendorId, @CashDiscountPct, @ProSharePct, @SpecialDeductionPct, @PassToMemberPct, @AddSurchargeToMemberBill, @EffectiveFrom, @Notes, @User);

        INSERT piv2.VendorBillingSplitLog (VendorId, OldJson, NewJson, ChangedBy)
        VALUES (@VendorId, @old,
                (SELECT * FROM piv2.VendorBillingSplit WHERE VendorId = @VendorId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), @User);
    COMMIT;
END
GO

/* =============================================================== Product classes */

IF OBJECT_ID('piv2.ProductClass', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.ProductClass
    (
        ClassNo          int            NOT NULL CONSTRAINT PK_ProductClass PRIMARY KEY,
        Name             nvarchar(120)  NOT NULL,
        ShortCode        nvarchar(20)   NULL,
        Source           varchar(10)    NOT NULL CONSTRAINT CK_ProductClass_Source CHECK (Source IN ('COMPUTYME','PIV2')),
        Description      nvarchar(800)  NULL,
        TermsPct         decimal(7,3)   NULL,   -- TERMS2
        PromptPayPct     decimal(7,3)   NULL,   -- PTERMS
        NetNetFactor     decimal(9,5)   NULL,   -- NETNET
        NetNet6Factor    decimal(9,5)   NULL,   -- DNETNET
        RalNetFactor     decimal(9,5)   NULL,   -- RALNET
        HasDating        bit            NULL,   -- DATING
        FastShipping     bit            NULL,   -- dbo.Product FastShippingAvailable
        IsOrderBucket    bit            NULL,   -- VNORD vendor-order bucket
        RuleRefs         nvarchar(300)  NULL,
        IsActive         bit            NOT NULL CONSTRAINT DF_ProductClass_Active DEFAULT (1),
        UpdatedAt        datetime2(0)   NOT NULL CONSTRAINT DF_ProductClass_At DEFAULT (SYSUTCDATETIME()),
        UpdatedBy        nvarchar(150)  NULL
    );
END
GO
IF OBJECT_ID('piv2.ProductClassLog', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.ProductClassLog
    (
        Id         int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProductClassLog PRIMARY KEY,
        ClassNo    int            NOT NULL,
        OldJson    nvarchar(max)  NULL,
        NewJson    nvarchar(max)  NULL,
        ChangedBy  nvarchar(150)  NULL,
        ChangedAt  datetime2(0)   NOT NULL CONSTRAINT DF_ProductClassLog_At DEFAULT (SYSUTCDATETIME())
    );
END
GO

/* What Computyme hard-codes today (D_IVMST.20-.31, dbo.Product FastShippingAvailable). Insert-only. */
MERGE piv2.ProductClass AS t
USING (VALUES
 (479, N'Bags, tripods, lighting', N'BT', N'Computyme vendor group 479.', 6, 2, 0.92, 0.88, 0.90, 1, 0, 1, N'D_IVMST.20-.27; dbo.Product FastShippingAvailable = 0 for VEND 479'),
 (497, N'PRO general merchandise', N'MM', N'Computyme vendor group 497. Also credited with all member returns (IV.UPD.RETURNS).', 6, 2, 0.92, 0.88, 0.90, 1, 1, 1, N'D_IVMST.20-.27'),
 (500, N'PRO - 5% terms merchandise', NULL, N'Computyme vendor group 500. No hard-coded rules found; confirm.', NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, NULL),
 (600, N'PRO - dues and capital', NULL, N'Computyme vendor group 600 (dues lines).', NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, NULL),
 (700, N'Fuji professional film', N'PF', N'Computyme vendor group 700.', 0, 0, 0.99, 0.99, 0.97, 0, 1, 1, N'D_IVMST.24-.25, .28'),
 (900, N'Must ship LTL merchandise', N'LT', N'Computyme vendor group 900. Some dictionaries call it "DR" (drop/drone ship); confirm.', 0, 0, 0.99, 0.99, 0.97, 0, 1, 1, N'D_IVMST.24-.25, .29'),
 (992, N'Camera memory / private label', N'CM', N'Computyme vendor group 992. No VNMST name. Special handling of dated orders (IV3, UPD.WEBORDERS).', 0, 0, 0.99, 0.99, 0.97, 0, 1, 1, N'D_IVMST.24-.25, .30'),
 (999, N'Price protection', NULL, N'Computyme vendor group 999. Terms 0 but prompt-pay 2 (not excluded in PTERMS); confirm.', 0, 2, 0.99, 0.99, 0.97, 0, 1, 0, N'D_IVMST.24-.25, .31')
) AS s (ClassNo, Name, ShortCode, Description, TermsPct, PromptPayPct, NetNetFactor, NetNet6Factor, RalNetFactor, HasDating, FastShipping, IsOrderBucket, RuleRefs)
ON t.ClassNo = s.ClassNo
WHEN NOT MATCHED BY TARGET THEN
    INSERT (ClassNo, Name, ShortCode, Source, Description, TermsPct, PromptPayPct, NetNetFactor, NetNet6Factor, RalNetFactor,
            HasDating, FastShipping, IsOrderBucket, RuleRefs, UpdatedBy)
    VALUES (s.ClassNo, s.Name, s.ShortCode, 'COMPUTYME', s.Description, s.TermsPct, s.PromptPayPct, s.NetNetFactor, s.NetNet6Factor,
            s.RalNetFactor, s.HasDating, s.FastShipping, s.IsOrderBucket, s.RuleRefs, N'seed');
GO

CREATE OR ALTER PROCEDURE piv2.ProductClass_List
AS
BEGIN
    SET NOCOUNT ON;

    IF OBJECT_ID('tempdb..#use') IS NOT NULL DROP TABLE #use;
    SELECT p.ClassNo,
           COUNT(*) AS Products,
           SUM(CASE WHEN p.IsDiscontinued = 0 THEN 1 ELSE 0 END) AS LiveProducts,
           COUNT(DISTINCT p.ActualVendorId) AS Vendors
    INTO #use
    FROM piv2.vBrandProductVendor p
    WHERE p.ClassNo IS NOT NULL
    GROUP BY p.ClassNo;

    /* every class: PIV2's table plus any Computyme vendor group in use that isn't in it yet */
    SELECT COALESCE(c.ClassNo, u.ClassNo)                         AS ClassNo,
           COALESCE(c.Name, CAST(n.NAME AS nvarchar(120)), N'(no name)') AS Name,
           CAST(n.NAME AS nvarchar(120))                           AS ComputymeName,
           c.ShortCode,
           ISNULL(c.Source, 'COMPUTYME')                           AS Source,
           c.Description, c.TermsPct, c.PromptPayPct, c.NetNetFactor, c.NetNet6Factor, c.RalNetFactor,
           c.HasDating, c.FastShipping, c.IsOrderBucket, c.RuleRefs, ISNULL(c.IsActive, 1) AS IsActive,
           ISNULL(u.Products, 0) AS Products, ISNULL(u.LiveProducts, 0) AS LiveProducts, ISNULL(u.Vendors, 0) AS Vendors,
           CAST(CASE WHEN c.ClassNo IS NULL THEN 1 ELSE 0 END AS bit) AS NotDescribed,
           c.UpdatedAt, c.UpdatedBy
    FROM piv2.ProductClass c
    FULL JOIN #use u ON u.ClassNo = c.ClassNo
    LEFT JOIN EDA.VNMST.VNMST n ON TRY_CAST(n.ID AS int) = COALESCE(c.ClassNo, u.ClassNo)
    ORDER BY CASE WHEN ISNULL(c.Source, 'COMPUTYME') = 'COMPUTYME' THEN 0 ELSE 1 END, COALESCE(c.ClassNo, u.ClassNo);
END
GO

/* Computyme classes describe rules Computyme applies: only Name, Description and RuleRefs can change.
   PIV2 classes are fully editable; a new one gets the next number from 10001. */
CREATE OR ALTER PROCEDURE piv2.ProductClass_Save
    @ClassNo        int = NULL,          -- NULL = new PIV2 class
    @Name           nvarchar(120),
    @ShortCode      nvarchar(20) = NULL,
    @Description    nvarchar(800) = NULL,
    @TermsPct       decimal(7,3) = NULL,
    @PromptPayPct   decimal(7,3) = NULL,
    @NetNetFactor   decimal(9,5) = NULL,
    @NetNet6Factor  decimal(9,5) = NULL,
    @RalNetFactor   decimal(9,5) = NULL,
    @HasDating      bit = NULL,
    @FastShipping   bit = NULL,
    @IsActive       bit = 1,
    @RuleRefs       nvarchar(300) = NULL,
    @User           nvarchar(150)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF NULLIF(LTRIM(RTRIM(@Name)), '') IS NULL THROW 50530, 'A class needs a name.', 1;

    DECLARE @src varchar(10), @old nvarchar(max);
    BEGIN TRAN;
        IF @ClassNo IS NULL
        BEGIN
            SELECT @ClassNo = ISNULL(MAX(ClassNo), 10000) + 1
            FROM piv2.ProductClass WITH (UPDLOCK, HOLDLOCK) WHERE ClassNo > 10000;

            INSERT piv2.ProductClass (ClassNo, Name, ShortCode, Source, Description, TermsPct, PromptPayPct, NetNetFactor,
                                      NetNet6Factor, RalNetFactor, HasDating, FastShipping, IsOrderBucket, RuleRefs, IsActive, UpdatedBy)
            VALUES (@ClassNo, @Name, @ShortCode, 'PIV2', @Description, @TermsPct, @PromptPayPct, @NetNetFactor,
                    @NetNet6Factor, @RalNetFactor, @HasDating, @FastShipping, 0, @RuleRefs, ISNULL(@IsActive, 1), @User);
        END
        ELSE
        BEGIN
            SELECT @src = Source, @old = (SELECT * FROM piv2.ProductClass x WHERE x.ClassNo = @ClassNo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
            FROM piv2.ProductClass WITH (UPDLOCK, HOLDLOCK) WHERE ClassNo = @ClassNo;

            IF @src IS NULL
            BEGIN
                /* a Computyme vendor group in use but not described yet: describe it (rules stay as Computyme applies them) */
                IF @ClassNo >= 10000 THROW 50531, 'That class doesn''t exist.', 1;
                INSERT piv2.ProductClass (ClassNo, Name, ShortCode, Source, Description, RuleRefs, UpdatedBy)
                VALUES (@ClassNo, @Name, @ShortCode, 'COMPUTYME', @Description, @RuleRefs, @User);
            END
            ELSE IF @src = 'COMPUTYME'
                UPDATE piv2.ProductClass
                   SET Name = @Name, ShortCode = @ShortCode, Description = @Description, RuleRefs = @RuleRefs,
                       UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @User
                 WHERE ClassNo = @ClassNo;
            ELSE
                UPDATE piv2.ProductClass
                   SET Name = @Name, ShortCode = @ShortCode, Description = @Description, TermsPct = @TermsPct,
                       PromptPayPct = @PromptPayPct, NetNetFactor = @NetNetFactor, NetNet6Factor = @NetNet6Factor,
                       RalNetFactor = @RalNetFactor, HasDating = @HasDating, FastShipping = @FastShipping,
                       RuleRefs = @RuleRefs, IsActive = ISNULL(@IsActive, 1), UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @User
                 WHERE ClassNo = @ClassNo;
        END

        INSERT piv2.ProductClassLog (ClassNo, OldJson, NewJson, ChangedBy)
        VALUES (@ClassNo, @old, (SELECT * FROM piv2.ProductClass x WHERE x.ClassNo = @ClassNo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), @User);
    COMMIT;

    SELECT @ClassNo AS ClassNo;
END
GO

PRINT 'Vendor Desk 01 ready: cutover map, brand-vendor, vendor record, direct billing, product classes.';
GO
