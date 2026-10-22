/* ---------------------------------------------------------------
    Home · 01  Per-person settings (home page tiles)

    Database: PRO      Safe to run twice. Adds one table and two procedures; changes nothing existing.

    piv2.UserSetting        one JSON value per person per key (the home page uses key 'home.tiles':
                            which tiles they show, in what order)
    piv2.UserSetting_Get    @UserName, @SettingKey
    piv2.UserSetting_Set    @UserName, @SettingKey, @Json (NULL removes it: back to the default)
   --------------------------------------------------------------- */

USE PRO;
GO
SET NOCOUNT ON;
GO
IF SCHEMA_ID('piv2') IS NULL EXEC('CREATE SCHEMA piv2');
GO

IF OBJECT_ID('piv2.UserSetting', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.UserSetting
    (
        UserName    nvarchar(150)  NOT NULL,
        SettingKey  varchar(60)    NOT NULL,
        Json        nvarchar(max)  NOT NULL,
        UpdatedAt   datetime2(0)   NOT NULL CONSTRAINT DF_UserSetting_At DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_UserSetting PRIMARY KEY (UserName, SettingKey)
    );
END
GO

CREATE OR ALTER PROCEDURE piv2.UserSetting_Get
    @UserName   nvarchar(150),
    @SettingKey varchar(60)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Json FROM piv2.UserSetting WHERE UserName = @UserName AND SettingKey = @SettingKey;
END
GO

CREATE OR ALTER PROCEDURE piv2.UserSetting_Set
    @UserName   nvarchar(150),
    @SettingKey varchar(60),
    @Json       nvarchar(max) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @Json IS NULL
    BEGIN
        DELETE piv2.UserSetting WHERE UserName = @UserName AND SettingKey = @SettingKey;
        RETURN;
    END
    IF ISJSON(@Json) <> 1 THROW 50540, 'That setting isn''t valid JSON.', 1;

    MERGE piv2.UserSetting WITH (HOLDLOCK) AS t
    USING (SELECT @UserName AS UserName, @SettingKey AS SettingKey) s
       ON t.UserName = s.UserName AND t.SettingKey = s.SettingKey
    WHEN MATCHED THEN UPDATE SET Json = @Json, UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (UserName, SettingKey, Json) VALUES (@UserName, @SettingKey, @Json);
END
GO

PRINT 'Home 01 ready: piv2.UserSetting.';
GO
