/* ---------------------------------------------------------------
    Vendor Desk · 05  Vendor contacts and logins (what old ProInternal's Administration/VendorContacts edits)

    Database: PRO      Safe to run twice. Adds one log table and procedures; changes no data when run.

    The contacts live in dbo.VendorUsers (SQL master): name, email, phones, fax, contact type (dbo.VendorContact)
    and the login the vendor uses on the credit site (Username / Password). The legacy screen and the
    notifications read them, so the Vendor Desk edits the same rows.

    piv2.VendorLogin_List        @VendorId: every contact, its type, active, last login, whether a password is set
                                 (passwords are never returned)
    piv2.VendorContactType_List  the contact types (dbo.VendorContact)
    piv2.VendorLogin_Save        add or change a contact; @Password NULL keeps the current password
    piv2.VendorLogin_SetActive   switch a contact on or off (nothing is deleted; old screen deleted rows)
    piv2.VendorAddress_List      @VendorId: dbo.VendorAddress rows (read only here)
    piv2.VendorLoginLog          every change: who, when, which fields (never the password itself)
    Refusals come back as THROW 50560-50569.
   --------------------------------------------------------------- */

USE PRO;
GO
SET NOCOUNT ON;
GO
IF SCHEMA_ID('piv2') IS NULL EXEC('CREATE SCHEMA piv2');
GO

IF OBJECT_ID('piv2.VendorLoginLog', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.VendorLoginLog
    (
        Id         int IDENTITY(1,1) NOT NULL CONSTRAINT PK_VendorLoginLog PRIMARY KEY,
        VendorId   int            NOT NULL,
        UserId     int            NOT NULL,
        Action     varchar(20)    NOT NULL,   -- ADD / CHANGE / PASSWORD / ON / OFF
        OldJson    nvarchar(max)  NULL,
        NewJson    nvarchar(max)  NULL,
        ChangedBy  nvarchar(150)  NULL,
        ChangedAt  datetime2(0)   NOT NULL CONSTRAINT DF_VendorLoginLog_At DEFAULT (SYSUTCDATETIME())
    );
    CREATE INDEX IX_VendorLoginLog_Vendor ON piv2.VendorLoginLog (VendorId, Id DESC);
END
GO

CREATE OR ALTER PROCEDURE piv2.VendorContactType_List
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ContactType, CAST(ContactDescription AS nvarchar(200)) AS ContactDescription
    FROM dbo.VendorContact ORDER BY ContactType;
END
GO

CREATE OR ALTER PROCEDURE piv2.VendorLogin_List
    @VendorId int
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserId, u.VendorId, u.FirstName, u.LastName, u.Username, u.Email, u.Phone, u.Phone_Alt AS PhoneAlt, u.Fax,
           CAST(CASE WHEN ISNULL(u.IsActive, 0) = 1 THEN 1 ELSE 0 END AS bit) AS IsActive,
           u.ContactType, CAST(t.ContactDescription AS nvarchar(200)) AS ContactTypeName,
           CAST(CASE WHEN NULLIF(LTRIM(RTRIM(u.Password)), N'') IS NULL THEN 0 ELSE 1 END AS bit) AS HasPassword,
           u.LastLogin, u.EnterDate, u.UpdateDate
    FROM dbo.VendorUsers u
    LEFT JOIN dbo.VendorContact t ON t.ContactType = u.ContactType
    WHERE u.VendorId = @VendorId
    ORDER BY CASE WHEN ISNULL(u.IsActive, 0) = 1 THEN 0 ELSE 1 END, u.LastName, u.FirstName;

    SELECT TOP (50) l.Id, l.UserId, l.Action, l.NewJson, l.ChangedBy, l.ChangedAt
    FROM piv2.VendorLoginLog l WHERE l.VendorId = @VendorId ORDER BY l.Id DESC;
END
GO

CREATE OR ALTER PROCEDURE piv2.VendorLogin_Save
    @UserId       int = NULL,          -- NULL = new contact
    @VendorId     int,
    @FirstName    varchar(50),
    @LastName     varchar(50),
    @Email        varchar(150) = NULL,
    @Phone        varchar(50) = NULL,
    @PhoneAlt     nvarchar(50) = NULL,
    @Fax          varchar(50) = NULL,
    @ContactType  int,
    @IsActive     bit = 1,
    @Username     varchar(50) = NULL,   -- NULL on a new contact = the vendor number (what the old screen did)
    @Password     nvarchar(100) = NULL, -- NULL = keep the current one
    @User         nvarchar(150)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Vendor WHERE VendorId = @VendorId)
        THROW 50560, 'That vendor isn''t in the vendor list.', 1;
    IF NULLIF(LTRIM(RTRIM(@FirstName)), '') IS NULL AND NULLIF(LTRIM(RTRIM(@LastName)), '') IS NULL
        THROW 50561, 'A contact needs a name.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.VendorContact WHERE ContactType = @ContactType)
        THROW 50562, 'Pick a contact type.', 1;
    IF @Email IS NOT NULL AND LTRIM(RTRIM(@Email)) <> '' AND @Email NOT LIKE '%_@_%._%'
        THROW 50563, 'That email address doesn''t look right.', 1;
    IF @Password IS NOT NULL AND LEN(@Password) < 6
        THROW 50564, 'Passwords need at least 6 characters.', 1;

    DECLARE @old nvarchar(max), @now datetime = GETDATE();

    BEGIN TRAN;
    IF @UserId IS NULL
    BEGIN
        INSERT dbo.VendorUsers (FirstName, LastName, Username, Password, VendorId, AddressId, Phone, Email,
                                SecretQuestion, SecretAnswer, IsActive, LastLogin, EnterDate, UpdateDate, ContactType, Fax, Phone_Alt)
        VALUES (@FirstName, @LastName, ISNULL(NULLIF(@Username, ''), CAST(@VendorId AS varchar(50))), @Password, @VendorId, 1,
                @Phone, @Email, '', '', CASE WHEN ISNULL(@IsActive, 1) = 1 THEN 1 ELSE 0 END, NULL, @now, @now, @ContactType, @Fax, @PhoneAlt);
        SET @UserId = SCOPE_IDENTITY();

        INSERT piv2.VendorLoginLog (VendorId, UserId, Action, NewJson, ChangedBy)
        VALUES (@VendorId, @UserId, 'ADD',
                (SELECT @FirstName AS firstName, @LastName AS lastName, @Email AS email, @ContactType AS contactType,
                        CASE WHEN @Password IS NULL THEN 0 ELSE 1 END AS passwordSet FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), @User);
    END
    ELSE
    BEGIN
        SELECT @old = (SELECT u.FirstName AS firstName, u.LastName AS lastName, u.Email AS email, u.Phone AS phone,
                              u.Phone_Alt AS phoneAlt, u.Fax AS fax, u.ContactType AS contactType, u.IsActive AS isActive, u.Username AS username
                       FROM dbo.VendorUsers u WITH (UPDLOCK, HOLDLOCK) WHERE u.UserId = @UserId AND u.VendorId = @VendorId
                       FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        IF @old IS NULL THROW 50565, 'That contact doesn''t belong to this vendor.', 1;

        UPDATE dbo.VendorUsers
           SET FirstName = @FirstName, LastName = @LastName, Email = @Email, Phone = @Phone, Phone_Alt = @PhoneAlt, Fax = @Fax,
               ContactType = @ContactType, IsActive = CASE WHEN ISNULL(@IsActive, 1) = 1 THEN 1 ELSE 0 END,
               Username = ISNULL(NULLIF(@Username, ''), Username),
               Password = ISNULL(@Password, Password),
               UpdateDate = @now
         WHERE UserId = @UserId AND VendorId = @VendorId;

        INSERT piv2.VendorLoginLog (VendorId, UserId, Action, OldJson, NewJson, ChangedBy)
        VALUES (@VendorId, @UserId, CASE WHEN @Password IS NOT NULL THEN 'PASSWORD' ELSE 'CHANGE' END, @old,
                (SELECT u.FirstName AS firstName, u.LastName AS lastName, u.Email AS email, u.Phone AS phone,
                        u.Phone_Alt AS phoneAlt, u.Fax AS fax, u.ContactType AS contactType, u.IsActive AS isActive, u.Username AS username
                 FROM dbo.VendorUsers u WHERE u.UserId = @UserId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), @User);
    END
    COMMIT;

    SELECT @UserId AS UserId;
END
GO

CREATE OR ALTER PROCEDURE piv2.VendorLogin_SetActive
    @UserId   int,
    @VendorId int,
    @IsActive bit,
    @User     nvarchar(150)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRAN;
        UPDATE dbo.VendorUsers SET IsActive = CASE WHEN @IsActive = 1 THEN 1 ELSE 0 END, UpdateDate = GETDATE()
        WHERE UserId = @UserId AND VendorId = @VendorId;
        IF @@ROWCOUNT = 0 THROW 50565, 'That contact doesn''t belong to this vendor.', 1;
        INSERT piv2.VendorLoginLog (VendorId, UserId, Action, ChangedBy)
        VALUES (@VendorId, @UserId, CASE WHEN @IsActive = 1 THEN 'ON' ELSE 'OFF' END, @User);
    COMMIT;
END
GO

CREATE OR ALTER PROCEDURE piv2.VendorAddress_List
    @VendorId int
AS
BEGIN
    SET NOCOUNT ON;
    SELECT a.AddressId, a.Address1, a.Address2, a.City, a.State, a.Zip, a.Country, a.AddressTypeId,
           CAST(ISNULL(a.IsPrimary, 0) AS bit) AS IsPrimary, a.EnterDate, a.UpdateDate
    FROM dbo.VendorAddress a
    WHERE a.VendorId = @VendorId
    ORDER BY CASE WHEN ISNULL(a.IsPrimary, 0) = 1 THEN 0 ELSE 1 END, a.AddressId;
END
GO

PRINT 'Vendor Desk 05 ready: vendor contacts and logins.';
GO
