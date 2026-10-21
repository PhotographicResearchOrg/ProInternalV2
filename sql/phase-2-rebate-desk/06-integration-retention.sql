/*
    Phase 2 · 06  Integration outbox retention (deferred from Phase 1)
    Database: PRO      Safe to run twice (CREATE OR ALTER).

    Finished messages (ACKNOWLEDGED, SUPERSEDED, CANCELLED) older than
    @KeepDays are deleted with their answers and history, a few thousand
    at a time. Never deleted: anything still open (QUEUED, SENT, OVERDUE,
    FAILED, REJECTED), and the newest message for each record and
    destination, so the desk always shows the last thing sent.

    The dispatcher runs this once a day when Integration:RetentionDays is
    above zero (default 180).
*/

USE PRO;
GO
SET XACT_ABORT ON;
GO

CREATE OR ALTER PROCEDURE piv2.Integration_Purge
    @KeepDays int = 180,
    @MaxRows  int = 20000
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @KeepDays < 30
        THROW 50607, 'Keep at least 30 days of integration history.', 1;

    DECLARE @cutoff datetime2(0) = DATEADD(day, -@KeepDays, SYSUTCDATETIME());
    DECLARE @deleted int = 0, @n int = 1;
    DECLARE @ids TABLE (MessageId bigint PRIMARY KEY);

    WHILE @n > 0 AND @deleted < @MaxRows
    BEGIN
        DELETE FROM @ids;

        INSERT @ids (MessageId)
        SELECT TOP (2000) m.MessageId
          FROM piv2.IntegrationMessage m
         WHERE m.Status IN ('ACKNOWLEDGED', 'SUPERSEDED', 'CANCELLED')
           AND m.CreatedAt < @cutoff
           AND EXISTS (SELECT 1 FROM piv2.IntegrationMessage newer
                        WHERE newer.Domain = m.Domain AND newer.EntityId = m.EntityId
                          AND newer.Destination = m.Destination AND newer.MessageId > m.MessageId)
         ORDER BY m.MessageId;

        SET @n = @@ROWCOUNT;
        IF @n = 0 BREAK;

        BEGIN TRAN;
        DELETE e FROM piv2.IntegrationEvent e JOIN @ids i ON i.MessageId = e.MessageId;
        DELETE r FROM piv2.IntegrationResponse r JOIN @ids i ON i.MessageId = r.MessageId;
        DELETE m FROM piv2.IntegrationMessage m JOIN @ids i ON i.MessageId = m.MessageId;
        COMMIT;

        SET @deleted += @n;
    END

    SELECT @deleted AS Deleted;
END
GO

SELECT N'integration retention ready' AS Result;
