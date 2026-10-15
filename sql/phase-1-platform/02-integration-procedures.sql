/*
    Phase 1 · 02  Integration outbox and file library: procedures
    Database: PRO      Safe to run twice (CREATE OR ALTER).
    Run after 01-integration-tables.sql.

    Business-rule errors are THROWn in the 50600 range; the API turns
    them into 400 answers with the message text.
*/

SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------
   Queue a message. Call inside the desk's save transaction.
   An older message for the same record and destination that has
   not been sent yet is marked SUPERSEDED: only the latest state goes.
   --------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.PIV2_Integration_Enqueue
    @Domain          varchar(40),
    @EntityId        nvarchar(100),
    @EntityLabel     nvarchar(200) = NULL,
    @Destination     varchar(40),
    @Operation       varchar(20)   = 'UPSERT',
    @ContractVersion varchar(20),
    @Payload         nvarchar(max),
    @PayloadSha256   char(64),
    @CreatedBy       nvarchar(100)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.PIV2_IntegrationDestination
                   WHERE Destination = @Destination AND Domain = @Domain AND IsActive = 1)
        THROW 50601, 'That destination is not set up for this domain, or is switched off.', 1;

    IF ISJSON(@Payload) <> 1
        THROW 50602, 'The payload is not valid JSON.', 1;

    DECLARE @superseded TABLE (MessageId bigint);

    UPDATE dbo.PIV2_IntegrationMessage
       SET Status = 'SUPERSEDED'
    OUTPUT inserted.MessageId INTO @superseded
     WHERE Domain = @Domain AND EntityId = @EntityId AND Destination = @Destination
       AND Status IN ('QUEUED', 'FAILED');

    INSERT dbo.PIV2_IntegrationEvent (MessageId, EventType, Actor, Reason)
    SELECT MessageId, 'SUPERSEDED', @CreatedBy, 'A newer change replaced this one before it was sent.'
      FROM @superseded;

    INSERT dbo.PIV2_IntegrationMessage
        (Domain, EntityId, EntityLabel, Destination, Operation, ContractVersion,
         Payload, PayloadSha256, CreatedBy, NextAttemptAt)
    VALUES
        (@Domain, @EntityId, @EntityLabel, @Destination, @Operation, @ContractVersion,
         @Payload, @PayloadSha256, @CreatedBy, SYSUTCDATETIME());

    DECLARE @id bigint = SCOPE_IDENTITY();

    INSERT dbo.PIV2_IntegrationEvent (MessageId, EventType, Actor) VALUES (@id, 'QUEUED', @CreatedBy);

    SELECT MessageId, CorrelationId FROM dbo.PIV2_IntegrationMessage WHERE MessageId = @id;
END
GO

/* ---------------------------------------------------------------
   Dispatcher: take up to @Take messages due for sending and lease
   them for @LeaseSeconds so a second dispatcher skips them.
   --------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.PIV2_Integration_Claim
    @Take         int = 25,
    @LeaseSeconds int = 120
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @now datetime2(0) = SYSUTCDATETIME();

    WITH due AS
    (
        SELECT TOP (@Take) m.*
          FROM dbo.PIV2_IntegrationMessage m WITH (UPDLOCK, READPAST, ROWLOCK)
          JOIN dbo.PIV2_IntegrationDestination d
            ON d.Destination = m.Destination AND d.Domain = m.Domain AND d.IsActive = 1
         WHERE m.Status IN ('QUEUED', 'FAILED')
           AND m.Attempts < d.MaxAttempts
           AND (m.NextAttemptAt IS NULL OR m.NextAttemptAt <= @now)
           AND (m.ClaimedUntil IS NULL OR m.ClaimedUntil < @now)
         ORDER BY m.MessageId
    )
    UPDATE due
       SET ClaimedUntil = DATEADD(second, @LeaseSeconds, @now)
    OUTPUT inserted.MessageId, inserted.CorrelationId, inserted.Domain, inserted.EntityId,
           inserted.Destination, inserted.Operation, inserted.ContractVersion,
           inserted.Payload, inserted.Attempts;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2_Integration_MarkSent
    @MessageId bigint
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE m
       SET Status       = 'SENT',
           Attempts     = m.Attempts + 1,
           SentAt       = SYSUTCDATETIME(),
           DueBy        = DATEADD(hour, d.ResponseHours, SYSUTCDATETIME()),
           ClaimedUntil = NULL,
           LastError    = NULL
      FROM dbo.PIV2_IntegrationMessage m
      JOIN dbo.PIV2_IntegrationDestination d ON d.Destination = m.Destination AND d.Domain = m.Domain
     WHERE m.MessageId = @MessageId
       AND m.Status IN ('QUEUED', 'FAILED');

    IF @@ROWCOUNT = 1
        INSERT dbo.PIV2_IntegrationEvent (MessageId, EventType, Actor) VALUES (@MessageId, 'SENT', 'dispatcher');
END
GO

/* A failed send waits longer each time: 1, 4, 9, 16 ... minutes. */
CREATE OR ALTER PROCEDURE dbo.PIV2_Integration_MarkFailed
    @MessageId bigint,
    @Error     nvarchar(4000)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.PIV2_IntegrationMessage
       SET Status        = 'FAILED',
           Attempts      = Attempts + 1,
           NextAttemptAt = DATEADD(minute, (Attempts + 1) * (Attempts + 1), SYSUTCDATETIME()),
           ClaimedUntil  = NULL,
           LastError     = LEFT(@Error, 4000)
     WHERE MessageId = @MessageId
       AND Status IN ('QUEUED', 'FAILED');

    IF @@ROWCOUNT = 1
        INSERT dbo.PIV2_IntegrationEvent (MessageId, EventType, Actor, Reason)
        VALUES (@MessageId, 'SEND_FAILED', 'dispatcher', LEFT(@Error, 1000));
END
GO

/* ---------------------------------------------------------------
   Record an answer. @Destination must match the message's, so one
   system cannot answer for a message sent to another. The same body
   twice is recorded once and reported as already applied.
   Returns Outcome: APPLIED, DUPLICATE, NOT_FOUND
   --------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.PIV2_Integration_ApplyResponse
    @Destination   varchar(40),
    @CorrelationId uniqueidentifier,
    @ResponseType  varchar(30),
    @Result        varchar(30)    = NULL,
    @ReasonCode    varchar(60)    = NULL,
    @Message       nvarchar(2000) = NULL,
    @ExternalId    nvarchar(100)  = NULL,
    @RespondedAt   datetime2(0),
    @Body          nvarchar(max),
    @BodySha256    char(64)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @id bigint, @status varchar(20);

    BEGIN TRAN;

    /* The lock is held to COMMIT, so two copies of one answer arriving
       together are serialised and the second is seen as a duplicate. */
    SELECT @id = MessageId, @status = Status
      FROM dbo.PIV2_IntegrationMessage WITH (UPDLOCK, HOLDLOCK)
     WHERE CorrelationId = @CorrelationId AND Destination = @Destination;

    IF @id IS NULL
    BEGIN
        COMMIT;
        SELECT 'NOT_FOUND' AS Outcome, CAST(NULL AS bigint) AS MessageId, CAST(NULL AS varchar(20)) AS Status;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.PIV2_IntegrationResponse WHERE MessageId = @id AND BodySha256 = @BodySha256)
    BEGIN
        COMMIT;
        SELECT 'DUPLICATE' AS Outcome, @id AS MessageId, @status AS Status;
        RETURN;
    END

    INSERT dbo.PIV2_IntegrationResponse
        (MessageId, ResponseType, Result, ReasonCode, Message, ExternalId, RespondedAt, Body, BodySha256)
    VALUES
        (@id, @ResponseType, @Result, @ReasonCode, @Message, @ExternalId, @RespondedAt, @Body, @BodySha256);

    /* Only an acknowledgement, or an error exception, changes the status. */
    DECLARE @newStatus varchar(20) =
        CASE
            WHEN @ResponseType = 'ACKNOWLEDGEMENT' AND @Result IN ('ACCEPTED', 'ACCEPTED_WITH_CHANGES') THEN 'ACKNOWLEDGED'
            WHEN @ResponseType = 'ACKNOWLEDGEMENT' AND @Result = 'REJECTED' THEN 'REJECTED'
            WHEN @ResponseType = 'EXCEPTION' AND @Result = 'REJECTED' THEN 'REJECTED'
            ELSE @status
        END;

    /* A late answer still counts: OVERDUE and SENT both move on. */
    IF @status IN ('SENT', 'OVERDUE', 'ACKNOWLEDGED', 'REJECTED')
        UPDATE dbo.PIV2_IntegrationMessage
           SET Status      = @newStatus,
               RespondedAt = CASE WHEN @ResponseType = 'ACKNOWLEDGEMENT' THEN SYSUTCDATETIME() ELSE RespondedAt END,
               ExternalId  = COALESCE(@ExternalId, ExternalId)
         WHERE MessageId = @id;

    INSERT dbo.PIV2_IntegrationEvent (MessageId, EventType, Actor, Reason)
    VALUES (@id, 'RESPONSE', @Destination,
            CONCAT(@ResponseType, COALESCE(' ' + @Result, ''), COALESCE(' · ' + @ReasonCode, ''),
                   COALESCE(' · ' + LEFT(@Message, 800), '')));

    COMMIT;

    SELECT 'APPLIED' AS Outcome, @id AS MessageId,
           (SELECT Status FROM dbo.PIV2_IntegrationMessage WHERE MessageId = @id) AS Status;
END
GO

/* Sent and unanswered past DueBy. Run by the dispatcher every cycle. */
CREATE OR ALTER PROCEDURE dbo.PIV2_Integration_MarkOverdue
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @overdue TABLE (MessageId bigint);

    UPDATE dbo.PIV2_IntegrationMessage
       SET Status = 'OVERDUE'
    OUTPUT inserted.MessageId INTO @overdue
     WHERE Status = 'SENT' AND DueBy < SYSUTCDATETIME();

    INSERT dbo.PIV2_IntegrationEvent (MessageId, EventType, Actor, Reason)
    SELECT MessageId, 'OVERDUE', 'system', 'No answer within the destination''s response time.'
      FROM @overdue;

    SELECT COUNT(*) AS MarkedOverdue FROM @overdue;
END
GO

/* ---------------------------------------------------------------
   Desk actions. Both need a reason and are written to the events.
   --------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.PIV2_Integration_Resend
    @MessageId bigint,
    @Actor     nvarchar(100),
    @Reason    nvarchar(1000)
AS
BEGIN
    SET NOCOUNT ON;

    IF NULLIF(LTRIM(RTRIM(@Reason)), N'') IS NULL
        THROW 50603, 'A reason is required to resend.', 1;

    UPDATE dbo.PIV2_IntegrationMessage
       SET Status = 'QUEUED', Attempts = 0, NextAttemptAt = SYSUTCDATETIME(),
           ClaimedUntil = NULL, LastError = NULL, DueBy = NULL
     WHERE MessageId = @MessageId
       AND Status IN ('FAILED', 'REJECTED', 'OVERDUE');

    IF @@ROWCOUNT = 0
        THROW 50604, 'Only failed, rejected or overdue messages can be resent.', 1;

    INSERT dbo.PIV2_IntegrationEvent (MessageId, EventType, Actor, Reason)
    VALUES (@MessageId, 'RESENT', @Actor, @Reason);
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2_Integration_Cancel
    @MessageId bigint,
    @Actor     nvarchar(100),
    @Reason    nvarchar(1000)
AS
BEGIN
    SET NOCOUNT ON;

    IF NULLIF(LTRIM(RTRIM(@Reason)), N'') IS NULL
        THROW 50605, 'A reason is required to cancel.', 1;

    UPDATE dbo.PIV2_IntegrationMessage
       SET Status = 'CANCELLED', ClaimedUntil = NULL
     WHERE MessageId = @MessageId
       AND Status IN ('QUEUED', 'FAILED', 'REJECTED', 'OVERDUE');

    IF @@ROWCOUNT = 0
        THROW 50606, 'Only queued, failed, rejected or overdue messages can be cancelled.', 1;

    INSERT dbo.PIV2_IntegrationEvent (MessageId, EventType, Actor, Reason)
    VALUES (@MessageId, 'CANCELLED', @Actor, @Reason);
END
GO

/* ---------------------------------------------------------------
   Desk reads.
   --------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.PIV2_Integration_Summary
AS
BEGIN
    SET NOCOUNT ON;

    SELECT d.Domain, d.Destination, d.DisplayName, d.IsActive,
           SUM(CASE WHEN m.Status = 'QUEUED'       THEN 1 ELSE 0 END) AS Queued,
           SUM(CASE WHEN m.Status = 'SENT'         THEN 1 ELSE 0 END) AS AwaitingAnswer,
           SUM(CASE WHEN m.Status = 'OVERDUE'      THEN 1 ELSE 0 END) AS Overdue,
           SUM(CASE WHEN m.Status = 'REJECTED'     THEN 1 ELSE 0 END) AS Rejected,
           SUM(CASE WHEN m.Status = 'FAILED'       THEN 1 ELSE 0 END) AS Failed,
           SUM(CASE WHEN m.Status = 'ACKNOWLEDGED'
                     AND m.RespondedAt >= DATEADD(day, -1, SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS AcknowledgedToday
      FROM dbo.PIV2_IntegrationDestination d
      LEFT JOIN dbo.PIV2_IntegrationMessage m
        ON m.Destination = d.Destination AND m.Domain = d.Domain
       AND m.Status NOT IN ('SUPERSEDED', 'CANCELLED')
     GROUP BY d.Domain, d.Destination, d.DisplayName, d.IsActive
     ORDER BY d.Domain, d.Destination;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2_Integration_Search
    @Domain      varchar(40)   = NULL,
    @Destination varchar(40)   = NULL,
    @Status      varchar(20)   = NULL,   -- NULL = everything that needs a person: REJECTED, FAILED, OVERDUE
    @Text        nvarchar(100) = NULL,   -- entity id or label
    @Page        int = 1,
    @PageSize    int = 50
AS
BEGIN
    SET NOCOUNT ON;

    SET @Page = CASE WHEN @Page < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN @PageSize NOT BETWEEN 1 AND 200 THEN 50 ELSE @PageSize END;

    SELECT m.MessageId, m.CorrelationId, m.Domain, m.EntityId, m.EntityLabel, m.Destination,
           m.Operation, m.Status, m.Attempts, m.CreatedAt, m.CreatedBy, m.SentAt, m.DueBy,
           m.RespondedAt, m.ExternalId, m.LastError,
           COUNT(*) OVER () AS TotalRows
      FROM dbo.PIV2_IntegrationMessage m
     WHERE (@Domain IS NULL OR m.Domain = @Domain)
       AND (@Destination IS NULL OR m.Destination = @Destination)
       AND ((@Status IS NULL AND m.Status IN ('REJECTED', 'FAILED', 'OVERDUE')) OR m.Status = @Status)
       AND (@Text IS NULL OR m.EntityId LIKE @Text + '%' OR m.EntityLabel LIKE '%' + @Text + '%')
     ORDER BY m.MessageId DESC
     OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* One message: the message, its answers, its events. */
CREATE OR ALTER PROCEDURE dbo.PIV2_Integration_Get
    @MessageId bigint
AS
BEGIN
    SET NOCOUNT ON;

    SELECT MessageId, CorrelationId, Domain, EntityId, EntityLabel, Destination, Operation,
           ContractVersion, Payload, PayloadSha256, Status, Attempts, NextAttemptAt,
           CreatedAt, CreatedBy, SentAt, DueBy, RespondedAt, ExternalId, LastError
      FROM dbo.PIV2_IntegrationMessage WHERE MessageId = @MessageId;

    SELECT ResponseId, ResponseType, Result, ReasonCode, Message, ExternalId, RespondedAt, ReceivedAt, Body
      FROM dbo.PIV2_IntegrationResponse WHERE MessageId = @MessageId ORDER BY ResponseId;

    SELECT EventId, EventType, Actor, Reason, At
      FROM dbo.PIV2_IntegrationEvent WHERE MessageId = @MessageId ORDER BY EventId;
END
GO

/* ---------------------------------------------------------------
   File library.
   Returns the existing row when the same content is already stored
   for this owner (IsDuplicate = 1); the caller then skips the upload.
   --------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.PIV2_FileLibrary_FindDuplicate
    @Category varchar(40),
    @OwnerKey nvarchar(100),
    @Sha256   char(64)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT FileId, Category, OwnerKey, FileName, ContentType, SizeBytes, Sha256, Bucket, S3Key,
           UploadedBy, UploadedAt, Notes
      FROM dbo.PIV2_FileLibrary
     WHERE Category = @Category AND OwnerKey = @OwnerKey AND Sha256 = @Sha256;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2_FileLibrary_Add
    @Category    varchar(40),
    @OwnerKey    nvarchar(100),
    @FileName    nvarchar(260),
    @ContentType varchar(150),
    @SizeBytes   bigint,
    @Sha256      char(64),
    @Bucket      varchar(100),
    @S3Key       nvarchar(700),
    @UploadedBy  nvarchar(100),
    @Notes       nvarchar(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT dbo.PIV2_FileLibrary
        (Category, OwnerKey, FileName, ContentType, SizeBytes, Sha256, Bucket, S3Key, UploadedBy, Notes)
    VALUES
        (@Category, @OwnerKey, @FileName, @ContentType, @SizeBytes, @Sha256, @Bucket, @S3Key, @UploadedBy, @Notes);

    SELECT FileId, Category, OwnerKey, FileName, ContentType, SizeBytes, Sha256, Bucket, S3Key,
           UploadedBy, UploadedAt, Notes
      FROM dbo.PIV2_FileLibrary WHERE FileId = SCOPE_IDENTITY();
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2_FileLibrary_Get
    @FileId bigint
AS
BEGIN
    SET NOCOUNT ON;

    SELECT FileId, Category, OwnerKey, FileName, ContentType, SizeBytes, Sha256, Bucket, S3Key,
           UploadedBy, UploadedAt, Notes
      FROM dbo.PIV2_FileLibrary WHERE FileId = @FileId;
END
GO

CREATE OR ALTER PROCEDURE dbo.PIV2_FileLibrary_List
    @Category varchar(40),
    @OwnerKey nvarchar(100) = NULL,
    @Take     int = 100
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (CASE WHEN @Take BETWEEN 1 AND 500 THEN @Take ELSE 100 END)
           FileId, Category, OwnerKey, FileName, ContentType, SizeBytes, Sha256, Bucket, S3Key,
           UploadedBy, UploadedAt, Notes
      FROM dbo.PIV2_FileLibrary
     WHERE Category = @Category AND (@OwnerKey IS NULL OR OwnerKey = @OwnerKey)
     ORDER BY UploadedAt DESC, FileId DESC;
END
GO

SELECT 'procedures ready' AS Result;
