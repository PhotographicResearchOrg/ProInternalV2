/* ---------------------------------------------------------------
    Phase 2 · 16  Rebate Desk security by drawer (Security Administration)

    Database: PRO (where Security Administration keeps permissions).
    Safe to run twice: a permission that already exists is left alone.
    Adds 35 permissions through dbo.CreatePermission, the same procedure the
    Security Admin screen uses. Each carries the route /rebatedesk, so holding
    any one of them opens the desk (menu and page).

      RebateDesk.<Drawer>.View   see the drawer
      RebateDesk.<Drawer>.Edit   see it and use its buttons

    How it works
      - Someone with ANY RebateDesk.* permission sees only those drawers.
      - Someone with none keeps today's access (Rebates.View / Upload / Manage /
        Accounting, or the /rebatedesk screen): nobody loses anything on day one.
      - BRMs keep their claims actions on the BRM dashboard through /BRMdash.
      - Overview is always shown to anyone who can open the desk.
    Put the permissions on roles in Security Administration. Nothing else to set.
   --------------------------------------------------------------- */

USE PRO;
GO
SET NOCOUNT ON;

DECLARE @want TABLE (Name nvarchar(200) NOT NULL PRIMARY KEY, Description nvarchar(400) NOT NULL);
INSERT @want (Name, Description) VALUES
    (N'RebateDesk.Uploads.View', N'Rebate Desk · New upload and Uploads: vendor files, mapping, loading (see)'),
    (N'RebateDesk.Uploads.Edit', N'Rebate Desk · New upload and Uploads: vendor files, mapping, loading (see and change)'),
    (N'RebateDesk.Purgatory.View', N'Rebate Desk · Purgatory: rows from vendor files that failed a check (see)'),
    (N'RebateDesk.Purgatory.Edit', N'Rebate Desk · Purgatory: rows from vendor files that failed a check (see and change)'),
    (N'RebateDesk.Batches.View', N'Rebate Desk · Batches: turn on/off, change dates (see)'),
    (N'RebateDesk.Batches.Edit', N'Rebate Desk · Batches: turn on/off, change dates (see and change)'),
    (N'RebateDesk.Programs.View', N'Rebate Desk · Instant-rebate programs: manual entry, amounts, dates, on/off (see)'),
    (N'RebateDesk.Programs.Edit', N'Rebate Desk · Instant-rebate programs: manual entry, amounts, dates, on/off (see and change)'),
    (N'RebateDesk.Products.View', N'Rebate Desk · Instant-rebate products and stacks (see)'),
    (N'RebateDesk.Products.Edit', N'Rebate Desk · Instant-rebate products and stacks (see and change)'),
    (N'RebateDesk.Vendors.View', N'Rebate Desk · Vendors and liability; vendor terms (see)'),
    (N'RebateDesk.Vendors.Edit', N'Rebate Desk · Vendors and liability; vendor terms (see and change)'),
    (N'RebateDesk.Templates.View', N'Rebate Desk · Saved vendor file layouts (see)'),
    (N'RebateDesk.Templates.Edit', N'Rebate Desk · Saved vendor file layouts (see and change)'),
    (N'RebateDesk.Claims.View', N'Rebate Desk · Instant-rebate claims: re-post credit, invoices, back to queue (see)'),
    (N'RebateDesk.Claims.Edit', N'Rebate Desk · Instant-rebate claims: re-post credit, invoices, back to queue (see and change)'),
    (N'RebateDesk.DebitMemos.View', N'Rebate Desk · Instant-rebate debit memos to vendors (see)'),
    (N'RebateDesk.DebitMemos.Edit', N'Rebate Desk · Instant-rebate debit memos to vendors (see and change)'),
    (N'RebateDesk.Declines.View', N'Rebate Desk · Needs support / declined: files, back to queue, confirm decline (see)'),
    (N'RebateDesk.Declines.Edit', N'Rebate Desk · Needs support / declined: files, back to queue, confirm decline (see and change)'),
    (N'RebateDesk.Investigate.View', N'Rebate Desk · Investigate: purchases against claims (see)'),
    (N'RebateDesk.StockPad.View', N'Rebate Desk · Stock padding: add and remove (see)'),
    (N'RebateDesk.StockPad.Edit', N'Rebate Desk · Stock padding: add and remove (see and change)'),
    (N'RebateDesk.History.View', N'Rebate Desk · Instant-rebate history (see)'),
    (N'RebateDesk.PP.Programs.View', N'Rebate Desk · Price protection: programs (see)'),
    (N'RebateDesk.PP.Programs.Edit', N'Rebate Desk · Price protection: programs (see and change)'),
    (N'RebateDesk.PP.Products.View', N'Rebate Desk · Price protection: products (see)'),
    (N'RebateDesk.PP.Products.Edit', N'Rebate Desk · Price protection: products (see and change)'),
    (N'RebateDesk.PP.Vendors.View', N'Rebate Desk · Price protection: vendors and liability (see)'),
    (N'RebateDesk.PP.Vendors.Edit', N'Rebate Desk · Price protection: vendors and liability (see and change)'),
    (N'RebateDesk.PP.Claims.View', N'Rebate Desk · Price protection: claims (see)'),
    (N'RebateDesk.PP.Claims.Edit', N'Rebate Desk · Price protection: claims (see and change)'),
    (N'RebateDesk.PP.DebitMemos.View', N'Rebate Desk · Price protection: debit memos (see)'),
    (N'RebateDesk.PP.DebitMemos.Edit', N'Rebate Desk · Price protection: debit memos (see and change)'),
    (N'RebateDesk.PP.History.View', N'Rebate Desk · Price protection: history (see)');

/* Where Security Administration keeps permissions (the table with PermissionName and RoutePath). */
DECLARE @tbl nvarchar(300) =
    (SELECT TOP (1) QUOTENAME(s.name) + N'.' + QUOTENAME(t.name)
       FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
      WHERE EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = t.object_id AND c.name = N'PermissionName')
        AND EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = t.object_id AND c.name = N'RoutePath')
      ORDER BY CASE WHEN t.name LIKE N'%Permission%' THEN 0 ELSE 1 END, t.name);
IF @tbl IS NULL
    PRINT N'Could not find the permissions table; each permission is created without a duplicate check.';

DECLARE @name nvarchar(200), @desc nvarchar(400), @have int, @made int = 0, @skipped int = 0;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT Name, Description FROM @want ORDER BY Name;
OPEN c;
FETCH NEXT FROM c INTO @name, @desc;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @have = 0;
    IF @tbl IS NOT NULL
    BEGIN
        DECLARE @q nvarchar(max) = N'SELECT @n = COUNT(*) FROM ' + @tbl + N' WHERE PermissionName = @p';
        EXEC sp_executesql @q, N'@p nvarchar(200), @n int OUTPUT', @p = @name, @n = @have OUTPUT;
    END
    IF @have > 0
        SET @skipped += 1;
    ELSE
    BEGIN
        BEGIN TRY
            EXEC dbo.CreatePermission @permissionName = @name, @description = @desc, @routePath = N'/rebatedesk';
            SET @made += 1;
        END TRY
        BEGIN CATCH
            PRINT N'Could not add ' + @name + N': ' + ERROR_MESSAGE();
        END CATCH
    END
    FETCH NEXT FROM c INTO @name, @desc;
END
CLOSE c; DEALLOCATE c;

PRINT CONCAT(N'Rebate Desk drawer permissions: ', @made, N' added, ', @skipped, N' already there.');
GO
