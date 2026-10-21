/* ---------------------------------------------------------------
    Category Desk · 03  Permissions (Security Administration)

    Database: PRO      Safe to run twice: a permission that already exists is left alone.
    Adds two permissions through dbo.CreatePermission, the procedure the Security Admin
    screen uses. Both carry the route /categories, so either one opens the desk (menu and page).

      Categories.View   see the tree, products, queues, history, preview; export to Excel
      Categories.Edit   everything in View, plus draft, publish and revert
                        (also needed to change a product's category on the Product Desk)

    Put them on roles in Security Administration. PIV2_ADMIN passes every check.
   --------------------------------------------------------------- */

USE PRO;
GO
SET NOCOUNT ON;

DECLARE @want TABLE (Name nvarchar(200) NOT NULL PRIMARY KEY, Description nvarchar(400) NOT NULL);
INSERT @want (Name, Description) VALUES
    (N'Categories.View', N'Category Desk: tree, products, queues, history and preview; export to Excel (see)'),
    (N'Categories.Edit', N'Category Desk: change categories and product placement, publish and revert (see and change)');

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
            EXEC dbo.CreatePermission @permissionName = @name, @description = @desc, @routePath = N'/categories';
            SET @made += 1;
        END TRY
        BEGIN CATCH
            PRINT N'Could not add ' + @name + N': ' + ERROR_MESSAGE();
        END CATCH
    END
    FETCH NEXT FROM c INTO @name, @desc;
END
CLOSE c; DEALLOCATE c;

PRINT CONCAT(N'Category Desk permissions: ', @made, N' added, ', @skipped, N' already there.');
GO
