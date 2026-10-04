-- Rollback for 004_CustomFieldProcedures.sql
-- Drops the definition/value procs and restores the legacy per-vendor
-- PIV2GetVendorCustomFields / PIV2AddVendorCustomField. Run this before
-- 003_CustomFieldDefinitions_Rollback.sql (which recreates the legacy
-- dbo.VendorCustomField table these procs read; deferred name resolution
-- lets them be created first).

DROP PROCEDURE IF EXISTS dbo.PIV2UpsertVendorCustomFieldValue;
DROP PROCEDURE IF EXISTS dbo.PIV2DeleteVendorCustomFieldDefinition;
DROP PROCEDURE IF EXISTS dbo.PIV2UpdateVendorCustomFieldDefinition;
DROP PROCEDURE IF EXISTS dbo.PIV2AddVendorCustomFieldDefinition;
DROP PROCEDURE IF EXISTS dbo.PIV2GetVendorCustomFieldDefinitions;
GO

CREATE OR ALTER PROCEDURE dbo.PIV2GetVendorCustomFields
    @VendorId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT VendorCustomFieldId, VendorId, Section, Label, DataType, Value, IsPublishable
    FROM dbo.VendorCustomField
    WHERE VendorId = @VendorId
    ORDER BY Section, Label;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2AddVendorCustomField
    @VendorId INT,
    @Section NVARCHAR(50),
    @Label NVARCHAR(150),
    @DataType NVARCHAR(30) = 'Text',
    @Value NVARCHAR(500) = NULL,
    @IsPublishable BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.VendorCustomField (VendorId, Section, Label, DataType, Value, IsPublishable)
    VALUES (@VendorId, @Section, @Label, @DataType, @Value, @IsPublishable);

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS VendorCustomFieldId;
END
GO
