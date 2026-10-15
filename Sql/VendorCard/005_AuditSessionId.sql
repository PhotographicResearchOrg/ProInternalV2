-- Audit log session tracking.
--
-- Adds dbo.EntityAuditLog.SessionId: the JWT "sessionId" claim (one GUID
-- per login, see Models/Auth/JwtToken.cs) of the user who made the change.
-- VendorCardController compares it to the caller's own claim so the audit
-- log can mark changes made in the current session. NULL for rows logged
-- before this script, and for tokens issued before the claim existed.
--
-- Replaces PIV2InsertEntityAuditLog / PIV2GetEntityAuditLog from
-- 002_StoredProcedures.sql. Safe to re-run.
--
-- Run after 001-004.

IF COL_LENGTH('dbo.EntityAuditLog', 'SessionId') IS NULL
    ALTER TABLE dbo.EntityAuditLog ADD SessionId UNIQUEIDENTIFIER NULL;
GO

CREATE OR ALTER PROCEDURE dbo.PIV2GetEntityAuditLog
    @EntityType NVARCHAR(50),
    @EntityId INT,
    @Take INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (@Take) EntityAuditLogId, EntityType, EntityId, Section, FieldName, OldValue, NewValue, ChangedBy, ChangedAt, SessionId
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
    @ChangedBy NVARCHAR(150) = NULL,
    @SessionId UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.EntityAuditLog (EntityType, EntityId, Section, FieldName, OldValue, NewValue, ChangedBy, SessionId)
    VALUES (@EntityType, @EntityId, @Section, @FieldName, @OldValue, @NewValue, @ChangedBy, @SessionId);
END
GO
