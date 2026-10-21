/* ---------------------------------------------------------------
    Phase 2 · 15  Claim log triggers (OPTIONAL: run only once approved)

    Database: PRO_NUKE      Safe to run twice.      Run after 14.

    Two AFTER triggers copy each change into piv2.ClaimLog so the claim
    timeline can show every step from now on, including the ones the
    legacy code overwrites or deletes (the first strike, a resubmit).

      dbo.trg_piv2_RebateProcess_Log            on dbo.RebateProcess
      dbo.trg_piv2_RebateAdditionalFiles_Log    on dbo.RebateRedeemAdditionalFiles

    They only add a row to piv2.ClaimLog: NOCOUNT is on (no extra "rows
    affected"), and the log key is a sequence (no change to @@IDENTITY /
    SCOPE_IDENTITY for the caller). The insert is kept simple so it has
    almost nothing that can fail (values are cut to size; no keys or checks).
    The CATCH is a last resort only: SQL Server can still roll back the
    caller's statement after an error inside a trigger.

    CHECK BEFORE RUNNING: with any trigger on a table, a statement on it
    that uses OUTPUT without INTO fails (Msg 334). Entity Framework Core 7+
    writes that way by default, as does hand-written "OUTPUT inserted.ID".
    Make sure nothing writes to dbo.RebateProcess or
    dbo.RebateRedeemAdditionalFiles like that (member site, BRM dashboard,
    any EF Core app). The ProcessClaim page and the legacy procedures don't.

    A trigger has to live in its table's schema, so these two are in dbo.
    To take them out:
      DROP TRIGGER dbo.trg_piv2_RebateProcess_Log;
      DROP TRIGGER dbo.trg_piv2_RebateAdditionalFiles_Log;
   --------------------------------------------------------------- */

USE PRO_NUKE;
GO

IF OBJECT_ID('piv2.ClaimLog') IS NULL
    THROW 50790, 'Run 14-claim-timeline.sql first (it creates piv2.ClaimLog).', 1;
GO

CREATE OR ALTER TRIGGER dbo.trg_piv2_RebateProcess_Log
ON dbo.RebateProcess
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT OFF;   -- for this trigger only: a failed log insert must not doom the caller's transaction
    IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    BEGIN TRY
        INSERT piv2.ClaimLog (OrderId, Source, Action, ProcessId, StatusWas, StatusNow, LockedNow, UserNow, ReasonNow,
                              PostedWas, PostedNow, DmWas, DmNow)
        SELECT COALESCE(i.OrderID, d.OrderID), 'PROCESS',
               CASE WHEN d.ID IS NULL THEN 'I' WHEN i.ID IS NULL THEN 'D' ELSE 'U' END,
               COALESCE(i.ID, d.ID), d.Status, i.Status, i.Locked,
               LEFT(CAST(COALESCE(i.[User], d.[User]) AS nvarchar(200)), 100),
               LEFT(CAST(i.RejectReason AS nvarchar(max)), 1000),
               d.ComputymeProcessed, i.ComputymeProcessed,
               LEFT(CAST(d.DM AS nvarchar(200)), 100), LEFT(CAST(i.DM AS nvarchar(200)), 100)
          FROM inserted i
          FULL JOIN deleted d ON d.ID = i.ID
         WHERE d.ID IS NULL OR i.ID IS NULL
            OR ISNULL(i.Status, -1) <> ISNULL(d.Status, -1)
            OR ISNULL(i.Locked, -1) <> ISNULL(d.Locked, -1)
            OR ISNULL(i.ComputymeProcessed, -1) <> ISNULL(d.ComputymeProcessed, -1)
            OR ISNULL(CAST(i.DM AS nvarchar(200)), N'') <> ISNULL(CAST(d.DM AS nvarchar(200)), N'')
            OR ISNULL(LEFT(CAST(i.RejectReason AS nvarchar(max)), 1000), N'') <> ISNULL(LEFT(CAST(d.RejectReason AS nvarchar(max)), 1000), N'');
    END TRY
    BEGIN CATCH
        /* Never let the log get in the way of the claim. */
    END CATCH
END
GO

CREATE OR ALTER TRIGGER dbo.trg_piv2_RebateAdditionalFiles_Log
ON dbo.RebateRedeemAdditionalFiles
AFTER INSERT, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT OFF;   -- for this trigger only: a failed log insert must not doom the caller's transaction
    IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    BEGIN TRY
        INSERT piv2.ClaimLog (OrderId, Source, Action, FileName)
        SELECT i.OrderID, 'FILE', 'I', LEFT(CAST(i.FileName AS nvarchar(max)), 500) FROM inserted i
        UNION ALL
        SELECT d.OrderID, 'FILE', 'D', LEFT(CAST(d.FileName AS nvarchar(max)), 500) FROM deleted d;
    END TRY
    BEGIN CATCH
    END CATCH
END
GO
