/* ---------------------------------------------------------------
    Phase 2 Rebate Desk: indexes for the desk's searches and claim views.

    Database: PRO_NUKE      Safe to run twice.      Run after 07.

    Adds nonclustered indexes to legacy rebate tables. Nothing about the
    tables changes (no columns, no data), and Connection is unaffected.
    Each index is skipped when the table already has an index that starts
    with the same column. Building one briefly locks its table: run this
    outside busy hours.
   --------------------------------------------------------------- */
SET NOCOUNT ON;

DECLARE @ix TABLE (Seq int IDENTITY, TableName sysname, LeadColumn sysname, IndexName sysname, Ddl nvarchar(1000));
INSERT @ix (TableName, LeadColumn, IndexName, Ddl) VALUES
  /* Latest decision per claim (claims, liability, debit memos). */
  (N'dbo.RebateProcess', N'OrderID', N'IX_piv2_RebProc_Order',
   N'CREATE INDEX IX_piv2_RebProc_Order ON dbo.RebateProcess (OrderID, ID);'),
  (N'dbo.PriceProtectionProcess', N'OrderID', N'IX_piv2_PPProc_Order',
   N'CREATE INDEX IX_piv2_PPProc_Order ON dbo.PriceProtectionProcess (OrderID, ID);'),
  /* Claim lines by claim, and by member for member-number searches. */
  (N'dbo.RebateRedeem', N'ORDERID', N'IX_piv2_RebRedeem_Order',
   N'CREATE INDEX IX_piv2_RebRedeem_Order ON dbo.RebateRedeem (ORDERID) INCLUDE (ModelID, MemberID, [Date], Quantity, Net, Saved);'),
  (N'dbo.RebateRedeem', N'MemberID', N'IX_piv2_RebRedeem_Member',
   N'CREATE INDEX IX_piv2_RebRedeem_Member ON dbo.RebateRedeem (MemberID) INCLUDE (ORDERID);'),
  (N'dbo.PriceProtectionRedeem', N'ORDERID', N'IX_piv2_PPRedeem_Order',
   N'CREATE INDEX IX_piv2_PPRedeem_Order ON dbo.PriceProtectionRedeem (ORDERID) INCLUDE (ModelID, MemberID, [Date], Quantity, Net, Saved);'),
  /* A rebate product's PRO codes and stacks (product list, matching). */
  (N'dbo.RebateCameraModelsDetails', N'ParentModelID', N'IX_piv2_RebDet_Parent',
   N'CREATE INDEX IX_piv2_RebDet_Parent ON dbo.RebateCameraModelsDetails (ParentModelID) INCLUDE (ProCode);'),
  (N'dbo.RebateCameraModelsDetails', N'ProCode', N'IX_piv2_RebDet_ProCode',
   N'CREATE INDEX IX_piv2_RebDet_ProCode ON dbo.RebateCameraModelsDetails (ProCode) INCLUDE (ParentModelID);'),
  (N'dbo.RebateQualifiers', N'PROQualifierID', N'IX_piv2_RebQual_Model',
   N'CREATE INDEX IX_piv2_RebQual_Model ON dbo.RebateQualifiers (PROQualifierID);'),
  /* Price-protection programs per product. */
  (N'dbo.PriceProtectionDetail', N'ModelID', N'IX_piv2_PPDet_Model',
   N'CREATE INDEX IX_piv2_PPDet_Model ON dbo.PriceProtectionDetail (ModelID, ProgramDate) INCLUDE (Expired, Amount);');

DECLARE @i int = 1, @n int = (SELECT COUNT(*) FROM @ix);
DECLARE @t sysname, @c sysname, @name sysname, @ddl nvarchar(1000);
WHILE @i <= @n
BEGIN
    SELECT @t = TableName, @c = LeadColumn, @name = IndexName, @ddl = Ddl FROM @ix WHERE Seq = @i;

    IF OBJECT_ID(@t) IS NULL
        PRINT CONCAT(N'skip ', @name, N': ', @t, N' not found');
    ELSE IF EXISTS (SELECT 1
                      FROM sys.indexes i
                      JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.key_ordinal = 1
                      JOIN sys.columns col ON col.object_id = ic.object_id AND col.column_id = ic.column_id
                     WHERE i.object_id = OBJECT_ID(@t) AND col.name = @c)
        PRINT CONCAT(N'skip ', @name, N': ', @t, N' already has an index on ', @c);
    ELSE
    BEGIN
        EXEC (@ddl);
        PRINT CONCAT(N'added ', @name);
    END

    SET @i += 1;
END
GO
