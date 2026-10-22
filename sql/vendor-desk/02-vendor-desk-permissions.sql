/* ---------------------------------------------------------------
    Vendor Desk · 02  Permissions (Security Administration)

    Database: PRO      Safe to run twice: a permission that already exists is left alone.

      Cutover.Admin          Change who is master of a section on the Cutover map (every change is logged)
      Brands.Edit            Move a brand to another vendor (writes dbo.Brand.VendorID, which the B2B vendor filter reads)
      Vendors.Edit           Save the direct-billing split on a vendor (and the other Vendor Desk edits)
      ProductClasses.Edit    Add and edit product classes

    Viewing needs only the screen's route in Security Admin:
      /cutover        Cutover map
      /brandvendors   Brands & vendors (brand links, product classes)
      /vendor-card    Vendor Desk (vendor record, direct billing, brands tabs)
    Add those routes as menu items for the roles that should see them.
   --------------------------------------------------------------- */

USE PRO;
GO
SET NOCOUNT ON;

DECLARE @want TABLE (Name nvarchar(200) NOT NULL PRIMARY KEY, Description nvarchar(400) NOT NULL, RoutePath nvarchar(200) NOT NULL);
INSERT @want (Name, Description, RoutePath) VALUES
    (N'Cutover.Admin',       N'Cutover map · change who is master of a section', N'/cutover'),
    (N'Brands.Edit',         N'Brands & vendors · move a brand to another vendor (shows on the B2B vendor filter)', N'/brandvendors'),
    (N'Vendors.Edit',        N'Vendor Desk · edit vendor setup, including the direct-billing split', N'/vendor-card'),
    (N'ProductClasses.Edit', N'Brands & vendors · add and edit product classes', N'/brandvendors');

/* Where Security Administration keeps permissions (the table with PermissionName and RoutePath). */
DECLARE @tbl nvarchar(300) =
    (SELECT TOP (1) QUOTENAME(s.name) + N'.' + QUOTENAME(t.name)
       FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
      WHERE EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = t.object_id AND c.name = N'PermissionName')
        AND EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = t.object_id AND c.name = N'RoutePath')
      ORDER BY CASE WHEN t.name LIKE N'%Permission%' THEN 0 ELSE 1 END, t.name);
IF @tbl IS NULL
    PRINT N'Could not find the permissions table; each permission is created without a duplicate check.';

DECLARE @name nvarchar(200), @desc nvarchar(400), @route nvarchar(200), @have int, @made int = 0, @skipped int = 0;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT Name, Description, RoutePath FROM @want ORDER BY Name;
OPEN c;
FETCH NEXT FROM c INTO @name, @desc, @route;
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
            EXEC dbo.CreatePermission @permissionName = @name, @description = @desc, @routePath = @route;
            SET @made += 1;
        END TRY
        BEGIN CATCH
            PRINT N'Could not add ' + @name + N': ' + ERROR_MESSAGE();
        END CATCH
    END
    FETCH NEXT FROM c INTO @name, @desc, @route;
END
CLOSE c; DEALLOCATE c;

PRINT CONCAT(N'Vendor Desk permissions: ', @made, N' added, ', @skipped, N' already there.');
GO
