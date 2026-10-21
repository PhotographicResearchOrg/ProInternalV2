-- Stored procedures for vendor custom fields (definition / value split).
-- Requires 003_CustomFieldDefinitions.sql. Replaces the legacy
-- PIV2GetVendorCustomFields (same name, new shape) and drops
-- PIV2AddVendorCustomField, which no longer applies.

DROP PROCEDURE IF EXISTS dbo.PIV2AddVendorCustomField;
GO

-- ===================== Definitions (global) =====================

CREATE OR ALTER PROCEDURE dbo.PIV2GetVendorCustomFieldDefinitions
AS
BEGIN
    SET NOCOUNT ON;

    SELECT d.VendorCustomFieldDefinitionId, d.Section, d.Label, d.DataType, d.IsPublishable, d.SortOrder,
           d.CreatedAt, d.CreatedBy,
           (SELECT COUNT(*) FROM dbo.VendorCustomFieldValue v
             WHERE v.VendorCustomFieldDefinitionId = d.VendorCustomFieldDefinitionId) AS UsageCount
    FROM dbo.VendorCustomFieldDefinition d
    ORDER BY d.Section, d.SortOrder, d.Label;
END
GO

-- Returns the new id, or -1 if the label is already used in that section.
CREATE OR ALTER PROCEDURE dbo.PIV2AddVendorCustomFieldDefinition
    @Section NVARCHAR(50),
    @Label NVARCHAR(150),
    @DataType NVARCHAR(30) = 'Text',
    @IsPublishable BIT = 0,
    @SortOrder INT = 0,
    @CreatedBy NVARCHAR(150) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.VendorCustomFieldDefinition WHERE Section = @Section AND Label = @Label)
    BEGIN
        SELECT -1 AS VendorCustomFieldDefinitionId;
        RETURN;
    END

    INSERT INTO dbo.VendorCustomFieldDefinition (Section, Label, DataType, IsPublishable, SortOrder, CreatedBy)
    VALUES (@Section, @Label, @DataType, @IsPublishable, @SortOrder, @CreatedBy);

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS VendorCustomFieldDefinitionId;
END
GO

-- Returns 1 on success, 0 if not found, -1 if the label is already used
-- in that section by a different field.
CREATE OR ALTER PROCEDURE dbo.PIV2UpdateVendorCustomFieldDefinition
    @VendorCustomFieldDefinitionId INT,
    @Section NVARCHAR(50),
    @Label NVARCHAR(150),
    @DataType NVARCHAR(30) = 'Text',
    @IsPublishable BIT = 0,
    @SortOrder INT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.VendorCustomFieldDefinition
               WHERE Section = @Section AND Label = @Label
                 AND VendorCustomFieldDefinitionId <> @VendorCustomFieldDefinitionId)
    BEGIN
        SELECT -1 AS Result;
        RETURN;
    END

    UPDATE dbo.VendorCustomFieldDefinition SET
        Section = @Section, Label = @Label, DataType = @DataType,
        IsPublishable = @IsPublishable, SortOrder = @SortOrder
    WHERE VendorCustomFieldDefinitionId = @VendorCustomFieldDefinitionId;

    SELECT CASE WHEN @@ROWCOUNT > 0 THEN 1 ELSE 0 END AS Result;
END
GO

-- Values for this field on every vendor go with it (ON DELETE CASCADE).
CREATE OR ALTER PROCEDURE dbo.PIV2DeleteVendorCustomFieldDefinition
    @VendorCustomFieldDefinitionId INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.VendorCustomFieldDefinition WHERE VendorCustomFieldDefinitionId = @VendorCustomFieldDefinitionId;
END
GO

-- ===================== Values (per vendor) =====================

-- Every defined field, with this vendor's value (NULL when unset).
CREATE OR ALTER PROCEDURE dbo.PIV2GetVendorCustomFields
    @VendorId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT d.VendorCustomFieldDefinitionId, @VendorId AS VendorId, d.Section, d.Label, d.DataType,
           d.IsPublishable, d.SortOrder, v.Value, v.UpdatedAt, v.UpdatedBy
    FROM dbo.VendorCustomFieldDefinition d
    LEFT JOIN dbo.VendorCustomFieldValue v
           ON v.VendorCustomFieldDefinitionId = d.VendorCustomFieldDefinitionId
          AND v.VendorId = @VendorId
    ORDER BY d.Section, d.SortOrder, d.Label;
END
GO

-- A NULL/blank value clears the field (deletes the row).
CREATE OR ALTER PROCEDURE dbo.PIV2UpsertVendorCustomFieldValue
    @VendorId INT,
    @VendorCustomFieldDefinitionId INT,
    @Value NVARCHAR(500) = NULL,
    @UpdatedBy NVARCHAR(150) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NULLIF(LTRIM(RTRIM(@Value)), '') IS NULL
    BEGIN
        DELETE FROM dbo.VendorCustomFieldValue
        WHERE VendorId = @VendorId AND VendorCustomFieldDefinitionId = @VendorCustomFieldDefinitionId;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.VendorCustomFieldValue
               WHERE VendorId = @VendorId AND VendorCustomFieldDefinitionId = @VendorCustomFieldDefinitionId)
        UPDATE dbo.VendorCustomFieldValue
        SET Value = @Value, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @UpdatedBy
        WHERE VendorId = @VendorId AND VendorCustomFieldDefinitionId = @VendorCustomFieldDefinitionId;
    ELSE
        INSERT INTO dbo.VendorCustomFieldValue (VendorId, VendorCustomFieldDefinitionId, Value, UpdatedBy)
        VALUES (@VendorId, @VendorCustomFieldDefinitionId, @Value, @UpdatedBy);
END
GO
