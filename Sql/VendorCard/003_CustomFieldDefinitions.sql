-- Vendor custom fields: definition / value split.
--
-- The original dbo.VendorCustomField (001_CreateTables.sql) stored the
-- label, type and value together on one per-vendor row, so every vendor
-- defined its own fields. Custom fields are now defined once, globally,
-- and assigned to a vendor-card section:
--
--   dbo.VendorCustomFieldDefinition  -- one row per field (all vendors)
--   dbo.VendorCustomFieldValue       -- one row per vendor per field
--
-- Section holds the vendor-card nav id the field appears under
-- ('terms', 'contacts', 'contracts', 'pricelists', 'policies', 'rebates').
-- The allowed list is enforced in VendorCardController, not here, so a new
-- section doesn't need a schema change.
--
-- Deleting a definition cascades to its values.
--
-- Existing dbo.VendorCustomField rows are migrated (one definition per
-- distinct Section + Label, values carried over) and the old table is
-- then dropped. Safe to re-run: each step is guarded.
--
-- Run after 001/002, then run 004_CustomFieldProcedures.sql.

IF OBJECT_ID('dbo.VendorCustomFieldDefinition', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VendorCustomFieldDefinition (
        VendorCustomFieldDefinitionId INT IDENTITY(1,1) PRIMARY KEY,
        Section         NVARCHAR(50)    NOT NULL,
        Label           NVARCHAR(150)   NOT NULL,
        DataType        NVARCHAR(30)    NOT NULL CONSTRAINT DF_VendorCustomFieldDefinition_DataType DEFAULT ('Text'),
        IsPublishable   BIT             NOT NULL CONSTRAINT DF_VendorCustomFieldDefinition_Publishable DEFAULT (0),
        SortOrder       INT             NOT NULL CONSTRAINT DF_VendorCustomFieldDefinition_SortOrder DEFAULT (0),
        CreatedAt       DATETIME2       NOT NULL CONSTRAINT DF_VendorCustomFieldDefinition_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy       NVARCHAR(150)   NULL,
        CONSTRAINT UQ_VendorCustomFieldDefinition_SectionLabel UNIQUE (Section, Label)
    );
END
GO

IF OBJECT_ID('dbo.VendorCustomFieldValue', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.VendorCustomFieldValue (
        VendorId                      INT             NOT NULL,
        VendorCustomFieldDefinitionId INT             NOT NULL,
        Value                         NVARCHAR(500)   NULL,
        UpdatedAt                     DATETIME2       NOT NULL CONSTRAINT DF_VendorCustomFieldValue_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedBy                     NVARCHAR(150)   NULL,
        CONSTRAINT PK_VendorCustomFieldValue PRIMARY KEY (VendorId, VendorCustomFieldDefinitionId),
        CONSTRAINT FK_VendorCustomFieldValue_Vendor FOREIGN KEY (VendorId) REFERENCES dbo.Vendor (VendorId),
        CONSTRAINT FK_VendorCustomFieldValue_Definition FOREIGN KEY (VendorCustomFieldDefinitionId)
            REFERENCES dbo.VendorCustomFieldDefinition (VendorCustomFieldDefinitionId) ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VendorCustomFieldValue_DefinitionId' AND object_id = OBJECT_ID('dbo.VendorCustomFieldValue'))
    CREATE INDEX IX_VendorCustomFieldValue_DefinitionId ON dbo.VendorCustomFieldValue (VendorCustomFieldDefinitionId);
GO

-- ===================== Migrate legacy per-vendor fields =====================

IF OBJECT_ID('dbo.VendorCustomField', 'U') IS NOT NULL
BEGIN
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    -- One definition per distinct Section + Label. If vendors disagreed on
    -- the type, the most common one wins; publishable if any row was.
    ;WITH ranked AS (
        SELECT Section, LTRIM(RTRIM(Label)) AS Label, DataType,
               ROW_NUMBER() OVER (PARTITION BY Section, LTRIM(RTRIM(Label)) ORDER BY COUNT(*) DESC, DataType) AS rn
        FROM dbo.VendorCustomField
        GROUP BY Section, LTRIM(RTRIM(Label)), DataType
    )
    INSERT INTO dbo.VendorCustomFieldDefinition (Section, Label, DataType, IsPublishable, CreatedBy)
    SELECT r.Section, r.Label, r.DataType,
           (SELECT CAST(MAX(CAST(cf.IsPublishable AS INT)) AS BIT) FROM dbo.VendorCustomField cf
             WHERE cf.Section = r.Section AND LTRIM(RTRIM(cf.Label)) = r.Label),
           'Migration'
    FROM ranked r
    WHERE r.rn = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.VendorCustomFieldDefinition d
                      WHERE d.Section = r.Section AND d.Label = r.Label);

    -- If a vendor had the same label twice in one section, keep the newest.
    ;WITH latest AS (
        SELECT cf.VendorId, d.VendorCustomFieldDefinitionId, cf.Value,
               ROW_NUMBER() OVER (PARTITION BY cf.VendorId, d.VendorCustomFieldDefinitionId ORDER BY cf.VendorCustomFieldId DESC) AS rn
        FROM dbo.VendorCustomField cf
        JOIN dbo.VendorCustomFieldDefinition d
          ON d.Section = cf.Section AND d.Label = LTRIM(RTRIM(cf.Label))
        WHERE NULLIF(LTRIM(RTRIM(cf.Value)), '') IS NOT NULL
    )
    INSERT INTO dbo.VendorCustomFieldValue (VendorId, VendorCustomFieldDefinitionId, Value, UpdatedBy)
    SELECT l.VendorId, l.VendorCustomFieldDefinitionId, l.Value, 'Migration'
    FROM latest l
    WHERE l.rn = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.VendorCustomFieldValue v
                      WHERE v.VendorId = l.VendorId AND v.VendorCustomFieldDefinitionId = l.VendorCustomFieldDefinitionId);

    DROP TABLE dbo.VendorCustomField;

    COMMIT TRANSACTION;
END
GO
