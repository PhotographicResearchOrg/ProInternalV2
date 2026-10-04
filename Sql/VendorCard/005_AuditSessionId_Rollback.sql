-- Rollback for 005_AuditSessionId.sql
-- Restores the 002_StoredProcedures.sql versions of the audit procs, then
-- drops dbo.EntityAuditLog.SessionId (session data is lost).

CREATE OR ALTER PROCEDURE dbo.PIV2GetEntityAuditLog
    @EntityType NVARCHAR(50),
    @EntityId INT,
    @Take INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (@Take) EntityAuditLogId, EntityType, EntityId, Section, FieldName, OldValue, NewValue, ChangedBy, ChangedAt
    FROM dbo.EntityAuditLog
    WHERE EntityType = @EntityType AND EntityId = @EntityId
    ORDER BY ChangedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2InsertEntityAuditLog
    @EntityType NVARCHAR(50),
    @EntityId INT,
    @Section NVARCHAR(50) = NULL,
    @FieldName NVARCHAR(150) = NULL,
    @OldValue NVARCHAR(500) = NULL,
    @NewValue NVARCHAR(500) = NULL,
    @ChangedBy NVARCHAR(150) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.EntityAuditLog (EntityType, EntityId, Section, FieldName, OldValue, NewValue, ChangedBy)
    VALUES (@EntityType, @EntityId, @Section, @FieldName, @OldValue, @NewValue, @ChangedBy);
END
GO

IF COL_LENGTH('dbo.EntityAuditLog', 'SessionId') IS NOT NULL
    ALTER TABLE dbo.EntityAuditLog DROP COLUMN SessionId;
GO
