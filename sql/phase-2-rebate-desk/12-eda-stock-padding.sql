/* ---------------------------------------------------------------
    Phase 2 · 12  Stock padding: extend EDA.dbo.RebateOverride

    Database: EDA      Safe to run twice.      Run BEFORE 10 (PRO_NUKE).

    RebateOverride is the old "Purchase Inventory Transfers" table
    (Rebate/IRManagement): units a member bought somewhere else (often
    direct from the vendor) before stocking through PRO, added to what
    they bought from PRO when claims are checked.

    This only ADDS nullable columns, so the old screen keeps working and
    existing rows stay as they are (their reason shows as "no reason
    recorded"). The desk writes a reason, who and when on every new
    entry, and removes entries by stamping RemovedAt / RemovedBy /
    RemovedReason instead of deleting them.
   --------------------------------------------------------------- */
USE EDA;
GO
SET XACT_ABORT ON;
GO

IF COL_LENGTH('dbo.RebateOverride', 'Reason') IS NULL
    ALTER TABLE dbo.RebateOverride ADD Reason nvarchar(500) NULL;
IF COL_LENGTH('dbo.RebateOverride', 'CreatedBy') IS NULL
    ALTER TABLE dbo.RebateOverride ADD CreatedBy nvarchar(100) NULL;
IF COL_LENGTH('dbo.RebateOverride', 'CreatedAt') IS NULL
    ALTER TABLE dbo.RebateOverride ADD CreatedAt datetime2(0) NULL;
IF COL_LENGTH('dbo.RebateOverride', 'RemovedBy') IS NULL
    ALTER TABLE dbo.RebateOverride ADD RemovedBy nvarchar(100) NULL;
IF COL_LENGTH('dbo.RebateOverride', 'RemovedAt') IS NULL
    ALTER TABLE dbo.RebateOverride ADD RemovedAt datetime2(0) NULL;
IF COL_LENGTH('dbo.RebateOverride', 'RemovedReason') IS NULL
    ALTER TABLE dbo.RebateOverride ADD RemovedReason nvarchar(500) NULL;
GO

/* Look-ups are by member and PRO code. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.RebateOverride') AND name = 'IX_piv2_RebateOverride_Member')
    CREATE INDEX IX_piv2_RebateOverride_Member ON dbo.RebateOverride (Member, ModelNumber) INCLUDE (Quantity, RemovedAt);
GO

SELECT N'RebateOverride ready' AS Result, COUNT(*) AS ExistingRows FROM dbo.RebateOverride;
