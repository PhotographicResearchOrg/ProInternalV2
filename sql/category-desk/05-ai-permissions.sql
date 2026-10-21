/* ---------------------------------------------------------------
    Product AI · 05  Permissions (Security Administration)

    Database: PRO      Safe to run twice: a permission that already exists is left alone.
    One permission per AI feature, so you decide exactly who can spend on what.
    AI permissions are always enforced (whatever Security:Mode says), and every call also
    counts against the monthly budget and the per-user daily limit in appsettings (AI section).

      AI.MarketResearch     Market research on a product (Perplexity); every answer is saved to the product
      AI.Translate          The Translate buttons on the Product Desk (Bedrock)
      AI.CategorySuggest    AI category suggestions on the Category Desk queues      (next package)
      AI.ProductLookup      Description, images and UPC lookup on a product          (next package)
      AI.CompetitorPricing  Competitor prices on a product (DataForSEO)              (next package)
      AI.Forecast           Sales forecast on a product (Chronos)                    (next package)
      AI.Usage              See the AI usage and cost report, and export it

    IMPORTANT: grant AI.Translate to the roles that translate today BEFORE deploying the API,
    or their Translate buttons disappear.
    Set @ProductRoute to the Product Desk's route in Security Admin (/productedit today).
   --------------------------------------------------------------- */

USE PRO;
GO
SET NOCOUNT ON;

DECLARE @ProductRoute nvarchar(200) = N'/productedit';

DECLARE @want TABLE (Name nvarchar(200) NOT NULL PRIMARY KEY, Description nvarchar(400) NOT NULL, RoutePath nvarchar(200) NOT NULL);
INSERT @want (Name, Description, RoutePath) VALUES
    (N'AI.MarketResearch',    N'AI · Market research on a product (Perplexity); answers saved to the product', @ProductRoute),
    (N'AI.Translate',         N'AI · Translate product content (Bedrock)', @ProductRoute),
    (N'AI.CategorySuggest',   N'AI · Category suggestions on the Category Desk queues', N'/categories'),
    (N'AI.ProductLookup',     N'AI · Description, images and UPC lookup on a product', @ProductRoute),
    (N'AI.CompetitorPricing', N'AI · Competitor prices on a product (DataForSEO)', @ProductRoute),
    (N'AI.Forecast',          N'AI · Sales forecast on a product', @ProductRoute),
    (N'AI.Usage',             N'AI · Usage and cost report', @ProductRoute);

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

PRINT CONCAT(N'AI permissions: ', @made, N' added, ', @skipped, N' already there.');
GO
