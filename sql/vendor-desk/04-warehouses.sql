/* ---------------------------------------------------------------
    Vendor Desk · 04  Warehouse setup: address, contacts, hours, receiving

    Database: PRO      Safe to run twice. Run after 03. Adds columns to piv2.Warehouse (created by 03),
    one contacts table, one log table and procedures. Changes nothing outside piv2.

    piv2.Warehouse            + address, phone, email, website, time zone, hours, order cut-off,
                                receiving notes, shipping account notes, 3PL account / customer number
    piv2.WarehouseContact     people at the warehouse: name, role, email, phone, primary, notes
    piv2.WarehouseLog         every change (warehouse or contact), before and after as JSON
    piv2.Warehouse_List       every warehouse with its primary contact and contact count
    piv2.Warehouse_Get        @WarehouseCode: the warehouse, its contacts, its last 100 changes
    piv2.Warehouse_Save       add or change a warehouse (@Json = the warehouse as JSON)
    piv2.WarehouseContact_Save / _Delete
    Refusals come back as THROW 50550-50559.
   --------------------------------------------------------------- */

USE PRO;
GO
SET NOCOUNT ON;
GO
IF OBJECT_ID('piv2.Warehouse', 'U') IS NULL
BEGIN
    PRINT 'Run sql/vendor-desk/03-product-supply.sql first (it creates piv2.Warehouse). Nothing was changed.';
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('piv2.Warehouse', 'Address1') IS NULL       ALTER TABLE piv2.Warehouse ADD Address1 nvarchar(120) NULL;
IF COL_LENGTH('piv2.Warehouse', 'Address2') IS NULL       ALTER TABLE piv2.Warehouse ADD Address2 nvarchar(120) NULL;
IF COL_LENGTH('piv2.Warehouse', 'PostalCode') IS NULL     ALTER TABLE piv2.Warehouse ADD PostalCode nvarchar(20) NULL;
IF COL_LENGTH('piv2.Warehouse', 'Phone') IS NULL          ALTER TABLE piv2.Warehouse ADD Phone nvarchar(40) NULL;
IF COL_LENGTH('piv2.Warehouse', 'Email') IS NULL          ALTER TABLE piv2.Warehouse ADD Email nvarchar(200) NULL;
IF COL_LENGTH('piv2.Warehouse', 'Website') IS NULL        ALTER TABLE piv2.Warehouse ADD Website nvarchar(200) NULL;
IF COL_LENGTH('piv2.Warehouse', 'TimeZone') IS NULL       ALTER TABLE piv2.Warehouse ADD TimeZone varchar(40) NULL;
IF COL_LENGTH('piv2.Warehouse', 'Hours') IS NULL          ALTER TABLE piv2.Warehouse ADD Hours nvarchar(200) NULL;
IF COL_LENGTH('piv2.Warehouse', 'OrderCutoff') IS NULL    ALTER TABLE piv2.Warehouse ADD OrderCutoff nvarchar(60) NULL;
IF COL_LENGTH('piv2.Warehouse', 'ReceivingNotes') IS NULL ALTER TABLE piv2.Warehouse ADD ReceivingNotes nvarchar(1000) NULL;
IF COL_LENGTH('piv2.Warehouse', 'ShippingNotes') IS NULL  ALTER TABLE piv2.Warehouse ADD ShippingNotes nvarchar(1000) NULL;
IF COL_LENGTH('piv2.Warehouse', 'AccountNumber') IS NULL  ALTER TABLE piv2.Warehouse ADD AccountNumber nvarchar(60) NULL;
IF COL_LENGTH('piv2.Warehouse', 'UpdatedAt') IS NULL      ALTER TABLE piv2.Warehouse ADD UpdatedAt datetime2(0) NULL;
IF COL_LENGTH('piv2.Warehouse', 'UpdatedBy') IS NULL      ALTER TABLE piv2.Warehouse ADD UpdatedBy nvarchar(150) NULL;
GO

IF OBJECT_ID('piv2.WarehouseContact', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.WarehouseContact
    (
        ContactId      int IDENTITY(1,1) NOT NULL CONSTRAINT PK_WarehouseContact PRIMARY KEY,
        WarehouseCode  varchar(10)    NOT NULL CONSTRAINT FK_WarehouseContact_Warehouse REFERENCES piv2.Warehouse (WarehouseCode),
        Name           nvarchar(150)  NOT NULL,
        Role           nvarchar(80)   NULL,
        Email          nvarchar(200)  NULL,
        Phone          nvarchar(40)   NULL,
        IsPrimary      bit            NOT NULL CONSTRAINT DF_WarehouseContact_Primary DEFAULT (0),
        Notes          nvarchar(400)  NULL,
        UpdatedAt      datetime2(0)   NOT NULL CONSTRAINT DF_WarehouseContact_At DEFAULT (SYSUTCDATETIME()),
        UpdatedBy      nvarchar(150)  NULL
    );
    CREATE INDEX IX_WarehouseContact_Warehouse ON piv2.WarehouseContact (WarehouseCode);
END
GO

IF OBJECT_ID('piv2.WarehouseLog', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.WarehouseLog
    (
        Id             int IDENTITY(1,1) NOT NULL CONSTRAINT PK_WarehouseLog PRIMARY KEY,
        WarehouseCode  varchar(10)    NOT NULL,
        What           varchar(20)    NOT NULL,   -- WAREHOUSE / CONTACT / CONTACT-DELETE
        OldJson        nvarchar(max)  NULL,
        NewJson        nvarchar(max)  NULL,
        ChangedBy      nvarchar(150)  NULL,
        ChangedAt      datetime2(0)   NOT NULL CONSTRAINT DF_WarehouseLog_At DEFAULT (SYSUTCDATETIME())
    );
    CREATE INDEX IX_WarehouseLog_Warehouse ON piv2.WarehouseLog (WarehouseCode, Id DESC);
END
GO

/* the PA warehouse: fill the address only where it's blank */
UPDATE piv2.Warehouse SET Country = ISNULL(Country, 'US'), TimeZone = ISNULL(TimeZone, 'America/New_York')
WHERE WarehouseCode = 'PA';
GO

CREATE OR ALTER PROCEDURE piv2.Warehouse_List
AS
BEGIN
    SET NOCOUNT ON;
    SELECT w.WarehouseCode, w.Name, w.WarehouseType, w.Address1, w.Address2, w.City, w.State, w.PostalCode, w.Country,
           w.Phone, w.Email, w.StockSource, w.IsActive, w.SortOrder,
           pc.Name AS PrimaryContact, pc.Email AS PrimaryEmail, pc.Phone AS PrimaryPhone,
           (SELECT COUNT(*) FROM piv2.WarehouseContact c WHERE c.WarehouseCode = w.WarehouseCode) AS Contacts,
           w.UpdatedAt, w.UpdatedBy
    FROM piv2.Warehouse w
    OUTER APPLY (SELECT TOP (1) c.Name, c.Email, c.Phone FROM piv2.WarehouseContact c
                 WHERE c.WarehouseCode = w.WarehouseCode ORDER BY c.IsPrimary DESC, c.ContactId) pc
    ORDER BY w.IsActive DESC, w.SortOrder, w.WarehouseCode;
END
GO

CREATE OR ALTER PROCEDURE piv2.Warehouse_Get
    @WarehouseCode varchar(10)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT WarehouseCode, Name, WarehouseType, Address1, Address2, City, State, PostalCode, Country, Phone, Email, Website,
           TimeZone, Hours, OrderCutoff, ReceivingNotes, ShippingNotes, AccountNumber, StockSource, Notes, IsActive, SortOrder,
           UpdatedAt, UpdatedBy
    FROM piv2.Warehouse WHERE WarehouseCode = @WarehouseCode;

    SELECT ContactId, WarehouseCode, Name, Role, Email, Phone, IsPrimary, Notes, UpdatedAt, UpdatedBy
    FROM piv2.WarehouseContact WHERE WarehouseCode = @WarehouseCode
    ORDER BY IsPrimary DESC, Name;

    SELECT TOP (100) Id, What, OldJson, NewJson, ChangedBy, ChangedAt
    FROM piv2.WarehouseLog WHERE WarehouseCode = @WarehouseCode ORDER BY Id DESC;
END
GO

/* @Json: {"warehouseCode":"UK1","name":"…","warehouseType":"3PL", …}. A new code adds the warehouse. */
CREATE OR ALTER PROCEDURE piv2.Warehouse_Save
    @Json nvarchar(max),
    @User nvarchar(150)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF ISJSON(@Json) <> 1 THROW 50551, 'Nothing to save.', 1;

    DECLARE @code varchar(10) = UPPER(LTRIM(RTRIM(JSON_VALUE(@Json, '$.warehouseCode')))),
            @name nvarchar(120) = LTRIM(RTRIM(JSON_VALUE(@Json, '$.name'))),
            @type varchar(10) = UPPER(JSON_VALUE(@Json, '$.warehouseType')),
            @src  varchar(12) = UPPER(ISNULL(JSON_VALUE(@Json, '$.stockSource'), 'PIV2'));

    IF @code IS NULL OR @code = '' OR @code LIKE '%[^A-Z0-9_-]%'
        THROW 50552, 'A warehouse needs a short code: letters, numbers, dash or underscore, up to 10.', 1;
    IF NULLIF(@name, '') IS NULL THROW 50553, 'A warehouse needs a name.', 1;
    IF @type NOT IN ('OWN', '3PL', 'VENDOR') THROW 50554, 'Type must be our own, 3PL or vendor.', 1;
    IF @src NOT IN ('COMPUTYME', 'PIV2', 'FEED') THROW 50555, 'Stock source must be Computyme, PIV2 or a feed.', 1;

    DECLARE @old nvarchar(max) = (SELECT * FROM piv2.Warehouse WHERE WarehouseCode = @code FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    IF @old IS NOT NULL AND (SELECT StockSource FROM piv2.Warehouse WHERE WarehouseCode = @code) = 'COMPUTYME' AND @src <> 'COMPUTYME'
        THROW 50556, 'This warehouse''s stock comes from Computyme. That changes when the warehouse cuts over, not here.', 1;

    BEGIN TRAN;
        MERGE piv2.Warehouse WITH (HOLDLOCK) AS t
        USING (SELECT @code AS WarehouseCode) s ON t.WarehouseCode = s.WarehouseCode
        WHEN MATCHED THEN UPDATE SET
            Name = @name, WarehouseType = @type,
            Address1 = JSON_VALUE(@Json, '$.address1'), Address2 = JSON_VALUE(@Json, '$.address2'),
            City = JSON_VALUE(@Json, '$.city'), State = JSON_VALUE(@Json, '$.state'),
            PostalCode = JSON_VALUE(@Json, '$.postalCode'), Country = UPPER(LEFT(JSON_VALUE(@Json, '$.country'), 2)),
            Phone = JSON_VALUE(@Json, '$.phone'), Email = JSON_VALUE(@Json, '$.email'), Website = JSON_VALUE(@Json, '$.website'),
            TimeZone = JSON_VALUE(@Json, '$.timeZone'), Hours = JSON_VALUE(@Json, '$.hours'),
            OrderCutoff = JSON_VALUE(@Json, '$.orderCutoff'),
            ReceivingNotes = JSON_VALUE(@Json, '$.receivingNotes'), ShippingNotes = JSON_VALUE(@Json, '$.shippingNotes'),
            AccountNumber = JSON_VALUE(@Json, '$.accountNumber'), StockSource = @src,
            Notes = JSON_VALUE(@Json, '$.notes'),
            IsActive = ISNULL(TRY_CAST(JSON_VALUE(@Json, '$.isActive') AS bit), 1),
            SortOrder = ISNULL(TRY_CAST(JSON_VALUE(@Json, '$.sortOrder') AS int), t.SortOrder),
            UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @User
        WHEN NOT MATCHED THEN INSERT
            (WarehouseCode, Name, WarehouseType, Address1, Address2, City, State, PostalCode, Country, Phone, Email, Website,
             TimeZone, Hours, OrderCutoff, ReceivingNotes, ShippingNotes, AccountNumber, StockSource, Notes, IsActive, SortOrder,
             UpdatedAt, UpdatedBy)
            VALUES (@code, @name, @type, JSON_VALUE(@Json, '$.address1'), JSON_VALUE(@Json, '$.address2'),
             JSON_VALUE(@Json, '$.city'), JSON_VALUE(@Json, '$.state'), JSON_VALUE(@Json, '$.postalCode'),
             UPPER(LEFT(JSON_VALUE(@Json, '$.country'), 2)), JSON_VALUE(@Json, '$.phone'), JSON_VALUE(@Json, '$.email'),
             JSON_VALUE(@Json, '$.website'), JSON_VALUE(@Json, '$.timeZone'), JSON_VALUE(@Json, '$.hours'),
             JSON_VALUE(@Json, '$.orderCutoff'), JSON_VALUE(@Json, '$.receivingNotes'), JSON_VALUE(@Json, '$.shippingNotes'),
             JSON_VALUE(@Json, '$.accountNumber'), @src, JSON_VALUE(@Json, '$.notes'),
             ISNULL(TRY_CAST(JSON_VALUE(@Json, '$.isActive') AS bit), 1),
             ISNULL(TRY_CAST(JSON_VALUE(@Json, '$.sortOrder') AS int), 100), SYSUTCDATETIME(), @User);

        INSERT piv2.WarehouseLog (WarehouseCode, What, OldJson, NewJson, ChangedBy)
        VALUES (@code, 'WAREHOUSE', @old, (SELECT * FROM piv2.Warehouse WHERE WarehouseCode = @code FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), @User);
    COMMIT;

    SELECT @code AS WarehouseCode;
END
GO

CREATE OR ALTER PROCEDURE piv2.WarehouseContact_Save
    @ContactId     int = NULL,
    @WarehouseCode varchar(10),
    @Name          nvarchar(150),
    @Role          nvarchar(80) = NULL,
    @Email         nvarchar(200) = NULL,
    @Phone         nvarchar(40) = NULL,
    @IsPrimary     bit = 0,
    @Notes         nvarchar(400) = NULL,
    @User          nvarchar(150)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF NOT EXISTS (SELECT 1 FROM piv2.Warehouse WHERE WarehouseCode = @WarehouseCode) THROW 50557, 'That warehouse doesn''t exist.', 1;
    IF NULLIF(LTRIM(RTRIM(@Name)), '') IS NULL THROW 50558, 'A contact needs a name.', 1;

    DECLARE @old nvarchar(max) = (SELECT * FROM piv2.WarehouseContact WHERE ContactId = @ContactId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    BEGIN TRAN;
        IF ISNULL(@IsPrimary, 0) = 1
            UPDATE piv2.WarehouseContact SET IsPrimary = 0 WHERE WarehouseCode = @WarehouseCode AND ContactId <> ISNULL(@ContactId, -1);

        IF @ContactId IS NULL
        BEGIN
            INSERT piv2.WarehouseContact (WarehouseCode, Name, Role, Email, Phone, IsPrimary, Notes, UpdatedBy)
            VALUES (@WarehouseCode, @Name, @Role, @Email, @Phone, ISNULL(@IsPrimary, 0), @Notes, @User);
            SET @ContactId = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            UPDATE piv2.WarehouseContact
               SET Name = @Name, Role = @Role, Email = @Email, Phone = @Phone, IsPrimary = ISNULL(@IsPrimary, 0), Notes = @Notes,
                   UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @User
             WHERE ContactId = @ContactId AND WarehouseCode = @WarehouseCode;
            IF @@ROWCOUNT = 0 THROW 50559, 'That contact doesn''t exist.', 1;
        END

        INSERT piv2.WarehouseLog (WarehouseCode, What, OldJson, NewJson, ChangedBy)
        VALUES (@WarehouseCode, 'CONTACT', @old, (SELECT * FROM piv2.WarehouseContact WHERE ContactId = @ContactId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), @User);
    COMMIT;
    SELECT @ContactId AS ContactId;
END
GO

CREATE OR ALTER PROCEDURE piv2.WarehouseContact_Delete
    @ContactId int,
    @User      nvarchar(150)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @code varchar(10), @old nvarchar(max);
    SELECT @code = WarehouseCode, @old = (SELECT * FROM piv2.WarehouseContact x WHERE x.ContactId = @ContactId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM piv2.WarehouseContact WHERE ContactId = @ContactId;
    IF @code IS NULL THROW 50559, 'That contact doesn''t exist.', 1;
    BEGIN TRAN;
        DELETE piv2.WarehouseContact WHERE ContactId = @ContactId;
        INSERT piv2.WarehouseLog (WarehouseCode, What, OldJson, NewJson, ChangedBy) VALUES (@code, 'CONTACT-DELETE', @old, NULL, @User);
    COMMIT;
END
GO

PRINT 'Vendor Desk 04 ready: warehouse setup and contacts.';
GO
SET NOEXEC OFF;
GO
