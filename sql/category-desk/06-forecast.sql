/*
    Product AI · 06  Sales forecast: history, saved runs, accuracy
    Database: PRO      Safe to run twice.      Run after 04 (piv2.AiUsageLog).

    Sales history is the nightly copy the Rebate Desk already builds from Computyme AR
    (PRO_NUKE.piv2.MemberSalesMonth: units by member, PRO code and month, net of returns;
    consumer/Shopify sales are under the house account). Nothing new is copied.

      piv2.SalesMonthly            monthly units by member and PRO code (nightly copy, or ARHistorical directly)
      piv2.vMemberCountry          each member's country (Roster.Country when the Member Desk
                                   columns exist, otherwise US)
      piv2.ProductForecast         one row per forecast run, country and month
                                   (the run itself is its piv2.AiUsageLog row: who, when, model, summary)
      piv2.Forecast_History        a product's monthly units by country
      piv2.Forecast_Save           stores a run's months
      piv2.Forecast_Runs           a product's runs with forecast vs actual
      piv2.Forecast_Accuracy       accuracy of every run in a date range, for the report
*/

USE PRO;
GO
SET NOCOUNT ON;
GO

/* Monthly units by member and PRO code. Uses the Rebate Desk's nightly copy when it is installed
   (PRO_NUKE.piv2.MemberSalesMonth, built from EDA.dbo.ARHistorical); otherwise sums ARHistorical directly,
   the same way that job does (HPROD = PRO code, QUAN = units net of returns, rebate credits 1320 left out).
   Run 06 again after the Rebate Desk's sales job is installed, to switch to the faster copy. */
IF OBJECT_ID(N'piv2.SalesMonthly', N'SN') IS NOT NULL
    DROP SYNONYM piv2.SalesMonthly;
GO
DECLARE @sql nvarchar(max) =
    CASE WHEN OBJECT_ID(N'PRO_NUKE.piv2.MemberSalesMonth', N'U') IS NOT NULL
         THEN N'CREATE OR ALTER VIEW piv2.SalesMonthly AS
               SELECT MemberId, ProCode, MonthStart, Units, Amount FROM PRO_NUKE.piv2.MemberSalesMonth;'
         ELSE N'CREATE OR ALTER VIEW piv2.SalesMonthly AS
               SELECT x.MemberId, x.ProCode, x.MonthStart, SUM(x.Units) AS Units, SUM(x.Amount) AS Amount
               FROM (SELECT TRY_CAST(a.Account AS int) AS MemberId, TRY_CAST(a.HPROD AS int) AS ProCode,
                            DATEFROMPARTS(YEAR(a.DT_POSTED), MONTH(a.DT_POSTED), 1) AS MonthStart,
                            CAST(COALESCE(TRY_CAST(a.QUAN AS decimal(19,2)), 0) AS decimal(19,2)) AS Units,
                            CAST(COALESCE(TRY_CAST(a.AMOUNT AS decimal(19,2)), 0) AS decimal(19,2)) AS Amount
                     FROM EDA.dbo.ARHistorical a
                     WHERE a.DT_POSTED IS NOT NULL) x
               WHERE x.MemberId IS NOT NULL AND x.ProCode IS NOT NULL AND x.ProCode <> 1320
               GROUP BY x.MemberId, x.ProCode, x.MonthStart;' END;
EXEC (@sql);
GO

/* Members' country. The Member Desk package adds Roster.Country; until then everyone counts as US. */
DECLARE @sql nvarchar(max) =
    CASE WHEN COL_LENGTH(N'dbo.Roster', N'Country') IS NOT NULL
         THEN N'CREATE OR ALTER VIEW piv2.vMemberCountry AS
               SELECT TRY_CAST(r.AccountNumber AS int) AS MemberId,
                      UPPER(LEFT(ISNULL(NULLIF(LTRIM(RTRIM(r.Country)), N''''), N''US''), 2)) AS Country
               FROM dbo.Roster r
               WHERE TRY_CAST(r.AccountNumber AS int) IS NOT NULL;'
         ELSE N'CREATE OR ALTER VIEW piv2.vMemberCountry AS
               SELECT TRY_CAST(r.AccountNumber AS int) AS MemberId, CAST(N''US'' AS nvarchar(2)) AS Country
               FROM dbo.Roster r
               WHERE TRY_CAST(r.AccountNumber AS int) IS NOT NULL;' END;
EXEC (@sql);
GO

IF OBJECT_ID(N'piv2.ProductForecast', N'U') IS NULL
BEGIN
    CREATE TABLE piv2.ProductForecast
    (
        ForecastRowId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProductForecast PRIMARY KEY,
        UsageId       bigint        NOT NULL,          -- the run: piv2.AiUsageLog (who, when, model, summary)
        ProductId     int           NOT NULL,
        Country       varchar(3)    NOT NULL,          -- ISO country, or ALL
        MonthStart    date          NOT NULL,
        Likely        decimal(12,2) NOT NULL,
        Low           decimal(12,2) NOT NULL,
        High          decimal(12,2) NOT NULL,
        Method        nvarchar(80)  NOT NULL
    );
    CREATE INDEX IX_ProductForecast_Run     ON piv2.ProductForecast (UsageId);
    CREATE INDEX IX_ProductForecast_Product ON piv2.ProductForecast (ProductId, MonthStart);
END
GO

/* ---------------------------------------------------------------- history */

CREATE OR ALTER PROCEDURE piv2.Forecast_History
    @ProductId int,
    @Months    int = 36
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @code int = (SELECT TRY_CAST(ProductCode AS int) FROM dbo.ProductData WHERE Id = @ProductId);
    DECLARE @thisMonth date = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);
    DECLARE @from date = DATEADD(MONTH, -@Months, @thisMonth);

    /* Complete months only: the current month is still filling up. */
    SELECT ISNULL(c.Country, 'US') AS Country, s.MonthStart, SUM(s.Units) AS Units, SUM(s.Amount) AS Amount
    FROM piv2.SalesMonthly s
    LEFT JOIN piv2.vMemberCountry c ON c.MemberId = s.MemberId
    WHERE s.ProCode = @code AND s.MonthStart >= @from AND s.MonthStart < @thisMonth
    GROUP BY ISNULL(c.Country, 'US'), s.MonthStart
    ORDER BY s.MonthStart, Country;
END
GO

/* ---------------------------------------------------------------- save a run */

CREATE OR ALTER PROCEDURE piv2.Forecast_Save
    @UsageId   bigint,
    @ProductId int,
    @Rows      nvarchar(max)     -- [{"country":"US","month":"2026-11-01","likely":12,"low":8,"high":17,"method":"..."}]
AS
BEGIN
    SET NOCOUNT ON;

    INSERT piv2.ProductForecast (UsageId, ProductId, Country, MonthStart, Likely, Low, High, Method)
    SELECT @UsageId, @ProductId, LEFT(j.country, 3), j.[month],
           CAST(j.likely AS decimal(12,2)), CAST(j.low AS decimal(12,2)), CAST(j.high AS decimal(12,2)), LEFT(j.method, 80)
    FROM OPENJSON(@Rows)
         WITH (country varchar(3) '$.country', [month] date '$.month', likely float '$.likely',
               low float '$.low', high float '$.high', method nvarchar(80) '$.method') j
    WHERE j.country IS NOT NULL AND j.[month] IS NOT NULL;
END
GO

/* ---------------------------------------------------------------- a product's runs, with actuals where the month is over */

CREATE OR ALTER PROCEDURE piv2.Forecast_Runs
    @ProductId int
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @code int = (SELECT TRY_CAST(ProductCode AS int) FROM dbo.ProductData WHERE Id = @ProductId);
    DECLARE @thisMonth date = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);

    /* 1. runs */
    SELECT u.UsageId, u.CalledAt, u.UserName, u.Model, u.CostUsd, u.CostIsEstimate, u.Question, u.Detail AS Summary,
           (SELECT COUNT(DISTINCT f.MonthStart) FROM piv2.ProductForecast f WHERE f.UsageId = u.UsageId) AS Months
    FROM piv2.AiUsageLog u
    WHERE u.ProductId = @ProductId AND u.Feature = 'FORECAST' AND u.Status = 'OK'
      AND EXISTS (SELECT 1 FROM piv2.ProductForecast f WHERE f.UsageId = u.UsageId)
    ORDER BY u.CalledAt DESC;

    /* 2. every forecast month, with the actual once the month has ended */
    WITH actual AS
    (
        SELECT ISNULL(c.Country, 'US') AS Country, s.MonthStart, SUM(s.Units) AS Units
        FROM piv2.SalesMonthly s
        LEFT JOIN piv2.vMemberCountry c ON c.MemberId = s.MemberId
        WHERE s.ProCode = @code AND s.MonthStart < @thisMonth
        GROUP BY ISNULL(c.Country, 'US'), s.MonthStart
        UNION ALL
        SELECT 'ALL', s.MonthStart, SUM(s.Units)
        FROM piv2.SalesMonthly s
        WHERE s.ProCode = @code AND s.MonthStart < @thisMonth
        GROUP BY s.MonthStart
    )
    SELECT f.UsageId, f.Country, f.MonthStart, f.Likely, f.Low, f.High, f.Method,
           CASE WHEN f.MonthStart < @thisMonth THEN ISNULL(a.Units, 0) END AS Actual
    FROM piv2.ProductForecast f
    LEFT JOIN actual a ON a.Country = f.Country AND a.MonthStart = f.MonthStart
    WHERE f.ProductId = @ProductId
    ORDER BY f.UsageId DESC, f.Country, f.MonthStart;
END
GO

/* ---------------------------------------------------------------- accuracy report

   For every run made between @From and @To, over the months that have ended:
   error = sum of |actual - likely| / sum of actual (lower is better), and how many months
   landed inside the low-high range. Only the ALL rows are scored, so countries don't count twice. */

CREATE OR ALTER PROCEDURE piv2.Forecast_Accuracy
    @From date,
    @To   date
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @thisMonth date = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);

    WITH scored AS
    (
        SELECT f.UsageId, f.ProductId, f.MonthStart, f.Likely, f.Low, f.High,
               ISNULL((SELECT SUM(s.Units) FROM piv2.SalesMonthly s
                       WHERE s.ProCode = TRY_CAST(d.ProductCode AS int) AND s.MonthStart = f.MonthStart), 0) AS Actual
        FROM piv2.ProductForecast f
        JOIN dbo.ProductData d ON d.Id = f.ProductId
        WHERE f.Country = 'ALL' AND f.MonthStart < @thisMonth
    )
    SELECT u.UsageId, u.CalledAt, u.UserName, u.Model,
           p.ProductCode, p.ModelName, p.BrandName,
           COUNT(*)                                                             AS MonthsScored,
           SUM(sc.Likely)                                                       AS Forecast,
           SUM(sc.Actual)                                                       AS Actual,
           CAST(CASE WHEN SUM(sc.Actual) > 0 THEN SUM(ABS(sc.Actual - sc.Likely)) * 100.0 / SUM(sc.Actual) END AS decimal(9,1)) AS ErrorPct,
           SUM(CASE WHEN sc.Actual BETWEEN sc.Low AND sc.High THEN 1 ELSE 0 END) AS MonthsInRange
    FROM scored sc
    JOIN piv2.AiUsageLog u ON u.UsageId = sc.UsageId
    LEFT JOIN piv2.vCategoryProduct p ON p.ProductId = sc.ProductId
    WHERE u.CalledAt >= @From AND u.CalledAt < DATEADD(DAY, 1, @To)
    GROUP BY u.UsageId, u.CalledAt, u.UserName, u.Model, p.ProductCode, p.ModelName, p.BrandName
    ORDER BY u.CalledAt DESC;
END
GO

PRINT N'Forecast objects ready.';
GO

/* ---------------------------------------------------------------- read access to the sales copy

   The procedures above read sales in another database (PRO_NUKE's nightly copy, or EDA.dbo.ARHistorical).
   Ownership chaining doesn't cross databases, so the API's database user needs SELECT on that table.
   This block grants it on PRO_NUKE's copy; if the view reads ARHistorical instead, grant SELECT on
   EDA.dbo.ARHistorical to the same user (the Rebate Desk procedures already read it).
   Set @AppUser to the same user as in phase-1-platform/00 (the API's database user). */

USE PRO_NUKE;
GO
DECLARE @AppUser sysname = N'<app database user>';
IF OBJECT_ID(N'piv2.MemberSalesMonth', N'U') IS NULL
    PRINT N'No nightly sales copy in PRO_NUKE: grant SELECT on EDA.dbo.ARHistorical instead.';
ELSE IF @AppUser = N'<app database user>'
    RAISERROR(N'Forecast is installed, but the sales grant was skipped: set @AppUser and run this last block again.', 16, 1);
ELSE IF DATABASE_PRINCIPAL_ID(@AppUser) IS NULL
    RAISERROR(N'Database user %s does not exist in PRO_NUKE.', 16, 1, @AppUser);
ELSE
BEGIN
    DECLARE @grant nvarchar(400) = N'GRANT SELECT ON piv2.MemberSalesMonth TO ' + QUOTENAME(@AppUser) + N';';
    EXEC (@grant);
    PRINT N'Sales read access granted.';
END
GO
