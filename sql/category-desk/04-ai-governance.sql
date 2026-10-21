/*
    Product AI · 04  Usage log and procedures
    Database: PRO      Safe to run twice.      Run after 01 and 02 (it reads the Category Desk's product view).

    One table every AI feature writes to: who, which feature, which model, how many items,
    what it cost, and (for market research) the saved snapshot in the File Library.
    The API reads it before each call to enforce the monthly budget and per-user daily limits.

      piv2.AiUsageLog
      piv2.Ai_Usage_Check          month spend (all AI), this user's calls today for one feature
      piv2.Ai_Usage_Log            records one call
      piv2.Ai_Usage_Report         usage between two dates, for the report and Excel
      piv2.Ai_Research_List        a product's saved market research (or lookups, or competitor prices), newest first
      piv2.Ai_ProductContext       what research needs to know about a product
*/

USE PRO;
GO
SET NOCOUNT ON;
GO

IF OBJECT_ID(N'piv2.AiUsageLog', N'U') IS NULL
BEGIN
    CREATE TABLE piv2.AiUsageLog
    (
        UsageId     bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_AiUsageLog PRIMARY KEY,
        CalledAt    datetime2(0)   NOT NULL CONSTRAINT DF_AiUsageLog_At DEFAULT SYSUTCDATETIME(),
        UserName    nvarchar(128)  NOT NULL,
        Feature     varchar(30)    NOT NULL,     -- MARKET_RESEARCH | TRANSLATE | FORECAST | PRODUCT_LOOKUP | COMPETITOR_PRICING
        Provider    varchar(30)    NOT NULL,     -- Perplexity | Bedrock | PIV2
        Model       nvarchar(120)  NOT NULL,     -- exactly what answered, shown on every result
        ProductId   int            NULL,
        Items       int            NOT NULL CONSTRAINT DF_AiUsageLog_Items DEFAULT 1,
        CostUsd     decimal(10,4)  NOT NULL CONSTRAINT DF_AiUsageLog_Cost DEFAULT 0,
        CostIsEstimate bit         NOT NULL CONSTRAINT DF_AiUsageLog_Est DEFAULT 1,   -- 0 when the provider reported the cost
        Status      varchar(10)    NOT NULL,     -- OK | FAILED
        Question    nvarchar(1000) NULL,
        Detail      nvarchar(1000) NULL,
        FileId      bigint         NULL,         -- piv2.FileLibrary row of the saved snapshot
        CONSTRAINT CK_AiUsageLog_Status CHECK (Status IN ('OK', 'FAILED'))
    );

    CREATE INDEX IX_AiUsageLog_Month   ON piv2.AiUsageLog (CalledAt) INCLUDE (CostUsd, Feature);
    CREATE INDEX IX_AiUsageLog_User    ON piv2.AiUsageLog (UserName, Feature, CalledAt);
    CREATE INDEX IX_AiUsageLog_Product ON piv2.AiUsageLog (ProductId, Feature, CalledAt) WHERE ProductId IS NOT NULL;
END
GO

CREATE OR ALTER PROCEDURE piv2.Ai_Usage_Check
    @Feature  varchar(30),
    @UserName nvarchar(128)
AS
BEGIN
    SET NOCOUNT ON;

    /* Month and day follow US Eastern, where the buyers are. */
    DECLARE @now datetime2(0) = CAST(SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'Eastern Standard Time' AS datetime2(0));
    DECLARE @monthStart datetime2(0) = CAST(DATEFROMPARTS(YEAR(@now), MONTH(@now), 1) AS datetime2(0));
    DECLARE @dayStart   datetime2(0) = CAST(CAST(@now AS date) AS datetime2(0));
    DECLARE @monthStartUtc datetime2(0) = CAST(@monthStart AT TIME ZONE 'Eastern Standard Time' AT TIME ZONE 'UTC' AS datetime2(0));
    DECLARE @dayStartUtc   datetime2(0) = CAST(@dayStart   AT TIME ZONE 'Eastern Standard Time' AT TIME ZONE 'UTC' AS datetime2(0));

    SELECT
        ISNULL((SELECT SUM(CostUsd) FROM piv2.AiUsageLog WHERE CalledAt >= @monthStartUtc), 0)                         AS MonthCostUsd,
        ISNULL((SELECT SUM(CostUsd) FROM piv2.AiUsageLog WHERE CalledAt >= @monthStartUtc AND Feature = @Feature), 0)  AS FeatureMonthCostUsd,
        (SELECT COUNT(*) FROM piv2.AiUsageLog
          WHERE CalledAt >= @dayStartUtc AND Feature = @Feature AND UserName = @UserName AND Status = 'OK')              AS UserTodayCalls;
END
GO

CREATE OR ALTER PROCEDURE piv2.Ai_Usage_Log
    @UserName       nvarchar(128),
    @Feature        varchar(30),
    @Provider       varchar(30),
    @Model          nvarchar(120),
    @ProductId      int = NULL,
    @Items          int = 1,
    @CostUsd        decimal(10,4) = 0,
    @CostIsEstimate bit = 1,
    @Status         varchar(10),
    @Question       nvarchar(1000) = NULL,
    @Detail         nvarchar(1000) = NULL,
    @FileId         bigint = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT piv2.AiUsageLog (UserName, Feature, Provider, Model, ProductId, Items, CostUsd, CostIsEstimate, Status, Question, Detail, FileId)
    VALUES (@UserName, @Feature, @Provider, LEFT(ISNULL(@Model, N'unknown'), 120), @ProductId, @Items, ISNULL(@CostUsd, 0), @CostIsEstimate,
            @Status, LEFT(@Question, 1000), LEFT(@Detail, 1000), @FileId);

    SELECT CAST(SCOPE_IDENTITY() AS bigint) AS UsageId;
END
GO

CREATE OR ALTER PROCEDURE piv2.Ai_Usage_Report
    @From date,
    @To   date
AS
BEGIN
    SET NOCOUNT ON;

    SELECT u.UsageId, u.CalledAt, u.UserName, u.Feature, u.Provider, u.Model, u.ProductId,
           d.ProductCode, d.ModelName, u.Items, u.CostUsd, u.CostIsEstimate, u.Status, u.Question, u.Detail
    FROM piv2.AiUsageLog u
    LEFT JOIN dbo.ProductData d ON d.Id = u.ProductId
    /* @From and @To are Eastern dates; CalledAt is UTC */
    WHERE u.CalledAt >= CAST(CAST(@From AS datetime2(0)) AT TIME ZONE 'Eastern Standard Time' AT TIME ZONE 'UTC' AS datetime2(0))
      AND u.CalledAt <  CAST(CAST(DATEADD(DAY, 1, @To) AS datetime2(0)) AT TIME ZONE 'Eastern Standard Time' AT TIME ZONE 'UTC' AS datetime2(0))
    ORDER BY u.CalledAt DESC;
END
GO

CREATE OR ALTER PROCEDURE piv2.Ai_Research_List
    @ProductId int,
    @Feature   varchar(30) = 'MARKET_RESEARCH'      -- or PRODUCT_LOOKUP | COMPETITOR_PRICING
AS
BEGIN
    SET NOCOUNT ON;

    SELECT u.UsageId, u.CalledAt, u.UserName, u.Provider, u.Model, u.CostUsd, u.CostIsEstimate, u.Question, u.Detail, u.FileId
    FROM piv2.AiUsageLog u
    WHERE u.ProductId = @ProductId AND u.Feature = @Feature AND u.Status = 'OK' AND u.FileId IS NOT NULL
    ORDER BY u.CalledAt DESC;
END
GO

/* What research needs to know about the product (from the Category Desk's product view, so brand,
   vendor and EGRP come from the same place everywhere). */
CREATE OR ALTER PROCEDURE piv2.Ai_ProductContext
    @ProductId int
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (1)
        p.ProductId, p.ProductCode, p.ModelName, p.BrandName, p.UPC, p.VendorName,
        t.PathNames AS CategoryPath,
        p.IsDiscontinued
    FROM piv2.vCategoryProduct p
    LEFT JOIN piv2.vCategoryTree t ON t.CatId = p.NodeId
    WHERE p.ProductId = @ProductId;
END
GO

PRINT N'Product AI usage log and procedures ready.';
