-- Rollback for 003_CustomFieldDefinitions.sql
-- Recreates the legacy per-vendor dbo.VendorCustomField table, flattens
-- definitions + values back into it (only vendors that actually have a
-- value get a row -- the legacy design had no concept of an empty field
-- shared across vendors), then drops the two new tables.
--
-- Run 004_CustomFieldProcedures_Rollback.sql first (it restores the
-- legacy PIV2GetVendorCustomFields / PIV2AddVendorCustomField procs).

IF OBJECT_ID('dbo.VendorCustomField', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VendorCustomField (
        VendorCustomFieldId INT IDENTITY(1,1) PRIMARY KEY,
        VendorId            INT           NOT NULL,
        Section             NVARCHAR(50)  NOT NULL,
        Label               NVARCHAR(150) NOT NULL,
        DataType            NVARCHAR(30)  NOT NULL CONSTRAINT DF_VendorCustomField_DataType DEFAULT ('Text'),
        Value               NVARCHAR(500) NULL,
        IsPublishable       BIT           NOT NULL CONSTRAINT DF_VendorCustomField_Publishable DEFAULT (0),
        CONSTRAINT FK_VendorCustomField_Vendor FOREIGN KEY (VendorId) REFERENCES dbo.Vendor (VendorId)
    );
    CREATE INDEX IX_VendorCustomField_VendorId ON dbo.VendorCustomField (VendorId);
END
GO

IF OBJECT_ID('dbo.VendorCustomFieldValue', 'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.VendorCustomField (VendorId, Section, Label, DataType, Value, IsPublishable)
    SELECT v.VendorId, d.Section, d.Label, d.DataType, v.Value, d.IsPublishable
    FROM dbo.VendorCustomFieldValue v
    JOIN dbo.VendorCustomFieldDefinition d ON d.VendorCustomFieldDefinitionId = v.VendorCustomFieldDefinitionId;
END
GO

DROP TABLE IF EXISTS dbo.VendorCustomFieldValue;      -- FK -> VendorCustomFieldDefinition, must drop first
DROP TABLE IF EXISTS dbo.VendorCustomFieldDefinition;
GO
