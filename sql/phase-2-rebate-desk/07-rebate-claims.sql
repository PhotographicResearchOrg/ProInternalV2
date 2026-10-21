/*
    Phase 2 · 07  Rebate Desk: claims (accounting), both rails
    Database: PRO_NUKE      Safe to run twice (CREATE OR ALTER).      Run after 06 (05 for PRO_NUKE).

    A claim is a member's submission:
        instant rebates   dbo.RebateRedeem lines + dbo.RebateProcess (decision)
        price protection  dbo.PriceProtectionRedeem + dbo.PriceProtectionProcess
    and the claim number is ORDERID.

    The nightly RebateCredits program (unchanged) sends approved claims to
    Computyme (UPD.VENDCREDIT) and sets ComputymeProcessed = 1. The credit
    posts in AR history as an HPROD 1320 line; dbo.Rebate_EDA_ARHist shows
    it, with VINVNO ending in the claim number (vendor prefix + ORDERID).

    From the desk:
      Resend credit     clears ComputymeProcessed so the next nightly run
                        sends it again. Refused when AR already shows the
                        credit, so a claim is never credited twice.
      Recreate invoice  the API builds the credit invoice PDF from AR and
                        records it here (Invoiced / InvoiceGenerated = 1).
      Debit memo        approved claims with no DM are billed back to the
                        vendor: DM stamped on the process rows, memo kept.
*/

USE PRO_NUKE;
GO
SET XACT_ABORT ON;
GO

/* The AR credit for a claim: member is the first 4 characters of the AR id; VINVNO ends with the claim number. */
CREATE OR ALTER FUNCTION piv2.Rebate_ArCredit (@MemberId int, @OrderId int)
RETURNS TABLE
AS
RETURN
    SELECT a.ID AS ArId, SUBSTRING(a.ID, 5, 50) AS InvoiceNumber, RTRIM(a.VINVNO) AS Vinvno,
           a.AMOUNT AS Amount, a.DT_POSTED AS PostedAt, a.TERMS AS Terms, a.P_O_ AS PoNumber
      FROM dbo.Rebate_EDA_ARHist a
     WHERE LEFT(a.ID, 4) = RIGHT('0000' + CAST(@MemberId AS varchar(10)), 4)
       AND RTRIM(a.VINVNO) LIKE '%' + CAST(@OrderId AS varchar(20))
       AND (LEN(RTRIM(a.VINVNO)) = LEN(CAST(@OrderId AS varchar(20)))
            OR SUBSTRING(RTRIM(a.VINVNO), LEN(RTRIM(a.VINVNO)) - LEN(CAST(@OrderId AS varchar(20))), 1) NOT LIKE '[0-9]');
GO

/* ---------------------------------------------------------------
   Claims for a rail, newest first.
   @State: SUBMITTED, APPROVED (not sent), SENT, DECLINED,
           NO_DM (approved, not billed to the vendor), NOT_INVOICED (sent, no invoice)
   --------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE piv2.Claim_Search
    @Rail     char(2) = 'IR',
    @Q        nvarchar(50) = NULL,       -- claim number, member, DM
    @VendorId int = NULL,
    @State    varchar(20) = NULL,
    @From     date = NULL,               -- claim date
    @To       date = NULL,
    @Page     int = 1,
    @PageSize int = 50
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Page = CASE WHEN @Page < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN @PageSize NOT BETWEEN 1 AND 200 THEN 50 ELSE @PageSize END;
    SET @Q = NULLIF(LTRIM(RTRIM(@Q)), N'');
    DECLARE @qInt int = TRY_CAST(@Q AS int);
    DECLARE @toEx datetime = DATEADD(day, 1, CAST(@To AS datetime));

    /* A debit memo number searches the decisions first; anything else is a claim or member number. */
    CREATE TABLE #dm (OrderId int NOT NULL PRIMARY KEY);
    IF @Q IS NOT NULL AND @qInt IS NULL
    BEGIN
        IF @Rail = 'PP'
            INSERT #dm SELECT DISTINCT OrderID FROM dbo.PriceProtectionProcess WHERE DM = @Q AND OrderID IS NOT NULL;
        ELSE
            INSERT #dm SELECT DISTINCT OrderID FROM dbo.RebateProcess WHERE DM = @Q AND OrderID IS NOT NULL;
    END

    /* Claims first (one pass over the redeem lines), then the latest decision for just those claims. */
    CREATE TABLE #r
    (
        OrderId int NOT NULL PRIMARY KEY, MemberId int NULL, VendorId int NULL, VendorName nvarchar(200) NULL,
        ClaimDate datetime NULL, Lines int NOT NULL, Units int NULL, Amount decimal(19,2) NOT NULL, Memo nvarchar(100) NULL
    );

    IF @Rail = 'PP'
        INSERT #r
        SELECT r.ORDERID, MAX(r.MemberID), MIN(m.VendorID), MIN(v.VendorName), MIN(r.Date), COUNT(*), SUM(r.Quantity),
               SUM(CAST(COALESCE(r.Net, 0) AS decimal(19,2))), MAX(r.debit)
          FROM dbo.PriceProtectionRedeem r
          LEFT JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelID
          LEFT JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID
         WHERE COALESCE(r.Saved, 0) = 0 AND r.ORDERID IS NOT NULL
           AND (@VendorId IS NULL OR m.VendorID = @VendorId)
           AND (@From IS NULL OR r.Date >= @From)
           AND (@To IS NULL OR r.Date < @toEx)
           AND (@Q IS NULL OR r.ORDERID = @qInt OR r.MemberID = @qInt OR r.ORDERID IN (SELECT OrderId FROM #dm))
         GROUP BY r.ORDERID
        OPTION (RECOMPILE);
    ELSE
        INSERT #r
        SELECT r.ORDERID, MAX(r.MemberID), MIN(m.VendorID), MIN(v.VendorName), MIN(r.Date), COUNT(*), SUM(r.Quantity),
               SUM(CAST(COALESCE(r.Net, 0) AS decimal(19,2))), MAX(r.debit)
          FROM dbo.RebateRedeem r
          LEFT JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelID
          LEFT JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID
         WHERE COALESCE(r.Saved, 0) = 0 AND r.ORDERID IS NOT NULL
           AND (@VendorId IS NULL OR m.VendorID = @VendorId)
           AND (@From IS NULL OR r.Date >= @From)
           AND (@To IS NULL OR r.Date < @toEx)
           AND (@Q IS NULL OR r.ORDERID = @qInt OR r.MemberID = @qInt OR r.ORDERID IN (SELECT OrderId FROM #dm))
         GROUP BY r.ORDERID
        OPTION (RECOMPILE);

    /* Claims the nightly program built an invoice for (IR): read RebateProcessBatch once, not per claim. */
    CREATE TABLE #inv (OrderId int NOT NULL PRIMARY KEY);
    IF @Rail <> 'PP'
        INSERT #inv
        SELECT DISTINCT o.OrderId
          FROM (SELECT TRY_CAST(LTRIM(RTRIM(CAST(b.OrderID AS varchar(50)))) AS int) AS OrderId
                  FROM dbo.RebateProcessBatch b WHERE b.Invoiced = 1) o
          JOIN #r r ON r.OrderId = o.OrderId;

    CREATE TABLE #c
    (
        OrderId int NOT NULL PRIMARY KEY, MemberId int NULL, VendorId int NULL, VendorName nvarchar(200) NULL,
        ClaimDate datetime NULL, Lines int NOT NULL, Units int NULL, Amount decimal(19,2) NOT NULL,
        Status int NULL, DecidedAt datetime NULL, DecidedBy nvarchar(100) NULL, Locked int NULL,
        DebitMemo varchar(100) NULL, ComputymeProcessed int NULL, Invoiced bit NOT NULL, Memo nvarchar(100) NULL
    );

    IF @Rail = 'PP'
        INSERT #c
        SELECT r.OrderId, r.MemberId, r.VendorId, r.VendorName, r.ClaimDate, r.Lines, r.Units, r.Amount,
               p.Status, p.timeEnd, p.[User], p.Locked, NULLIF(LTRIM(RTRIM(p.DM)), ''), p.ComputymeProcessed,
               CAST(CASE WHEN p.InvoiceGenerated = 1 THEN 1 ELSE 0 END AS bit), r.Memo
          FROM #r r
          OUTER APPLY (SELECT TOP (1) x.Status, x.timeEnd, x.[User], x.Locked, x.DM, x.ComputymeProcessed, x.InvoiceGenerated
                         FROM dbo.PriceProtectionProcess x WHERE x.OrderID = r.OrderId ORDER BY x.ID DESC) p;
    ELSE
        INSERT #c
        SELECT r.OrderId, r.MemberId, r.VendorId, r.VendorName, r.ClaimDate, r.Lines, r.Units, r.Amount,
               p.Status, p.timeEnd, p.[User], p.Locked, NULLIF(LTRIM(RTRIM(p.DM)), ''), p.ComputymeProcessed,
               CAST(CASE WHEN i.OrderId IS NULL THEN 0 ELSE 1 END AS bit), r.Memo
          FROM #r r
          OUTER APPLY (SELECT TOP (1) x.Status, x.timeEnd, x.[User], x.Locked, x.DM, x.ComputymeProcessed
                         FROM dbo.RebateProcess x WHERE x.OrderID = r.OrderId ORDER BY x.ID DESC) p
          LEFT JOIN #inv i ON i.OrderId = r.OrderId;

    SELECT c.*,
           CASE WHEN c.Status = 2 THEN 'DECLINED'
                WHEN c.Status = 1 AND c.ComputymeProcessed = 1 THEN 'SENT'
                WHEN c.Status = 1 AND c.ComputymeProcessed IS NULL THEN 'APPROVED'
                WHEN c.Status = 1 THEN 'HELD'
                ELSE 'SUBMITTED' END AS Bucket,
           COUNT(*) OVER () AS TotalRows
      FROM #c c
     WHERE @State IS NULL
        OR (@State = 'SUBMITTED' AND COALESCE(c.Status, 0) NOT IN (1, 2))
        OR (@State = 'APPROVED' AND c.Status = 1 AND COALESCE(c.ComputymeProcessed, 0) <> 1)
        OR (@State = 'SENT' AND c.Status = 1 AND c.ComputymeProcessed = 1)
        OR (@State = 'DECLINED' AND c.Status = 2)
        OR (@State = 'NO_DM' AND c.Status = 1 AND c.DebitMemo IS NULL)
        OR (@State = 'NOT_INVOICED' AND c.Status = 1 AND c.ComputymeProcessed = 1 AND c.Invoiced = 0)
     ORDER BY c.ClaimDate DESC, c.OrderId DESC
     OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY
    OPTION (RECOMPILE);
END
GO

/* One claim: decision rows, lines, the AR credit, and its desk history. */
CREATE OR ALTER PROCEDURE piv2.Claim_Get
    @Rail    char(2) = 'IR',
    @OrderId int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @member int;

    IF @Rail = 'PP'
    BEGIN
        SELECT @member = MAX(MemberID) FROM dbo.PriceProtectionRedeem WHERE ORDERID = @OrderId;

        SELECT p.ID AS ProcessId, p.OrderID AS OrderId, p.Status, p.[User] AS DecidedBy, p.timestart AS StartedAt, p.timeEnd AS DecidedAt,
               p.Total, p.RejectReason, p.PriorOrderID AS PriorOrderId, NULLIF(LTRIM(RTRIM(p.DM)), '') AS DebitMemo, p.Locked,
               p.ComputymeProcessed, CAST(CASE WHEN p.InvoiceGenerated = 1 THEN 1 ELSE 0 END AS bit) AS Invoiced
          FROM dbo.PriceProtectionProcess p WHERE p.OrderID = @OrderId ORDER BY p.ID DESC;

        SELECT r.[KEY] AS LineId, r.ModelID AS ModelId, r.Model AS Description, m.ModelName AS ProCode, v.VendorName,
               r.Quantity, r.ReimbursementAmount, r.Net, r.SerialNumber, r.StringProgramWeek AS ProgramWeek, r.Date AS ClaimDate,
               r.MemberID AS MemberId, r.Fname, r.Lname, r.phone AS Phone, r.email AS Email, r.debit AS Memo
          FROM dbo.PriceProtectionRedeem r
          LEFT JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelID
          LEFT JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID
         WHERE r.ORDERID = @OrderId ORDER BY r.[KEY];
    END
    ELSE
    BEGIN
        SELECT @member = MAX(MemberID) FROM dbo.RebateRedeem WHERE ORDERID = @OrderId;

        SELECT p.ID AS ProcessId, p.OrderID AS OrderId, p.Status, p.[User] AS DecidedBy, p.timestart AS StartedAt, p.timeEnd AS DecidedAt,
               p.Total, p.RejectReason, p.PriorOrderID AS PriorOrderId, NULLIF(LTRIM(RTRIM(p.DM)), '') AS DebitMemo, p.Locked,
               p.ComputymeProcessed,
               CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.RebateProcessBatch b WHERE b.OrderID = CAST(@OrderId AS varchar(25)) AND b.Invoiced = 1)
                         THEN 1 ELSE 0 END AS bit) AS Invoiced
          FROM dbo.RebateProcess p WHERE p.OrderID = @OrderId ORDER BY p.ID DESC;

        SELECT r.[KEY] AS LineId, r.ModelID AS ModelId, r.Model AS Description, m.ModelName AS ProCode, v.VendorName,
               r.Quantity, r.ReimbursementAmount, r.Net, r.SerialNumber, r.StringProgramWeek AS ProgramWeek, r.Date AS ClaimDate,
               r.MemberID AS MemberId, r.Fname, r.Lname, r.phone AS Phone, r.email AS Email, r.debit AS Memo
          FROM dbo.RebateRedeem r
          LEFT JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelID
          LEFT JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID
         WHERE r.ORDERID = @OrderId ORDER BY r.[KEY];
    END

    SELECT * FROM piv2.Rebate_ArCredit(@member, @OrderId) ORDER BY PostedAt DESC;

    SELECT EventId, EventType, Actor, Reason, Detail, At
      FROM piv2.RebateEvent WHERE Rail = @Rail AND ClaimId = @OrderId ORDER BY EventId DESC;
END
GO

/* Send an approved claim's credit to Computyme again on the next nightly run. */
CREATE OR ALTER PROCEDURE piv2.Claim_ResendCredit
    @Rail    char(2) = 'IR',
    @OrderId int,
    @Actor   nvarchar(100),
    @Reason  nvarchar(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@Reason)), N'') IS NULL
        THROW 50702, 'A reason is required.', 1;

    DECLARE @processId int, @status int, @sent int, @member int, @sentAt datetime;

    IF @Rail = 'PP'
    BEGIN
        SELECT TOP (1) @processId = ID, @status = Status, @sent = ComputymeProcessed
          FROM dbo.PriceProtectionProcess WHERE OrderID = @OrderId ORDER BY ID DESC;
        SELECT @member = MAX(MemberID) FROM dbo.PriceProtectionRedeem WHERE ORDERID = @OrderId;
    END
    ELSE
    BEGIN
        SELECT TOP (1) @processId = ID, @status = Status, @sent = ComputymeProcessed
          FROM dbo.RebateProcess WHERE OrderID = @OrderId ORDER BY ID DESC;
        SELECT @member = MAX(MemberID) FROM dbo.RebateRedeem WHERE ORDERID = @OrderId;
        /* The nightly run records when it sent the claim. */
        SELECT @sentAt = MAX(DateRun) FROM dbo.RebateProcessBatch WHERE OrderID = CAST(@OrderId AS varchar(25));
    END

    IF @status IS NULL
        THROW 50760, 'That claim has no decision yet.', 1;
    IF @status <> 1
        THROW 50761, 'Only approved claims are credited.', 1;
    IF @sent IS NULL
        THROW 50762, 'This claim is already waiting for the nightly run to send it.', 1;

    DECLARE @posted nvarchar(300) =
        (SELECT TOP (1) CONCAT(N'AR already shows this credit: invoice ', InvoiceNumber, N' (', RTRIM(Vinvno), N') posted ',
                               CONVERT(nvarchar(10), PostedAt, 101), N' for ', FORMAT(Amount, 'C', 'en-US'),
                               N'. Resending would credit the member twice. Use Recreate invoice if the PDF is missing.')
           FROM piv2.Rebate_ArCredit(@member, @OrderId) ORDER BY PostedAt DESC);
    IF @posted IS NOT NULL
        THROW 50763, @posted, 1;

    /* AR shows a credit a day or so after it is sent; until then a resend could be a second credit. */
    IF @sent = 1 AND @sentAt IS NOT NULL AND @sentAt > DATEADD(hour, -48, GETDATE())
    BEGIN
        DECLARE @recent nvarchar(300) = CONCAT(N'The nightly run sent this credit on ', CONVERT(nvarchar(16), @sentAt, 120),
                                               N'. AR usually shows it within two days; check again after ',
                                               CONVERT(nvarchar(16), DATEADD(hour, 48, @sentAt), 120), N'.');
        THROW 50764, @recent, 1;
    END

    IF EXISTS (SELECT 1 FROM piv2.RebateEvent
                WHERE Rail = @Rail AND ClaimId = @OrderId AND EventType = 'CREDIT_RESEND' AND At > DATEADD(hour, -72, SYSUTCDATETIME()))
        THROW 50765, 'This credit was resent in the last three days and AR does not show it yet. Check with Computyme before resending again.', 1;

    BEGIN TRAN;

    /* Only the latest decision: earlier approved rows must not be sent again too. */
    IF @Rail = 'PP'
        UPDATE dbo.PriceProtectionProcess SET ComputymeProcessed = NULL WHERE ID = @processId;
    ELSE
        UPDATE dbo.RebateProcess SET ComputymeProcessed = NULL WHERE ID = @processId;

    INSERT piv2.RebateEvent (Rail, EventType, ClaimId, Actor, Reason, Detail)
    VALUES (@Rail, 'CREDIT_RESEND', @OrderId, @Actor, @Reason,
            (SELECT @processId AS processId, @sent AS computymeProcessedWas FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));

    COMMIT;
END
GO

/* What the credit invoice needs: the claim lines, and the AR credit (empty when not posted yet). */
CREATE OR ALTER PROCEDURE piv2.Claim_InvoiceSource
    @Rail    char(2) = 'IR',
    @OrderId int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @member int;

    IF @Rail = 'PP'
    BEGIN
        SELECT @member = MAX(MemberID) FROM dbo.PriceProtectionRedeem WHERE ORDERID = @OrderId;
        SELECT r.ORDERID AS OrderId, r.MemberID AS MemberId, r.Fname, r.Lname, r.phone AS Phone, r.email AS Email,
               r.debit AS Memo, r.StringProgramWeek AS ProgramWeek,
               COALESCE((SELECT TOP (1) timeEnd FROM dbo.PriceProtectionProcess p WHERE p.OrderID = r.ORDERID ORDER BY p.ID DESC), GETDATE()) AS ProcessedAt,
               v.VendorName, r.Quantity, r.ReimbursementAmount, r.Net, r.Model AS Description, m.ModelName AS ProCode
          FROM dbo.PriceProtectionRedeem r
          LEFT JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelID
          LEFT JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID
         WHERE r.ORDERID = @OrderId ORDER BY r.[KEY];
    END
    ELSE
    BEGIN
        SELECT @member = MAX(MemberID) FROM dbo.RebateRedeem WHERE ORDERID = @OrderId;
        SELECT r.ORDERID AS OrderId, r.MemberID AS MemberId, r.Fname, r.Lname, r.phone AS Phone, r.email AS Email,
               r.debit AS Memo, r.StringProgramWeek AS ProgramWeek,
               COALESCE((SELECT TOP (1) timeEnd FROM dbo.RebateProcess p WHERE p.OrderID = r.ORDERID ORDER BY p.ID DESC), GETDATE()) AS ProcessedAt,
               v.VendorName, r.Quantity, r.ReimbursementAmount, r.Net, r.Model AS Description, m.ModelName AS ProCode
          FROM dbo.RebateRedeem r
          LEFT JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelID
          LEFT JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID
         WHERE r.ORDERID = @OrderId ORDER BY r.[KEY];
    END

    SELECT TOP (1) * FROM piv2.Rebate_ArCredit(@member, @OrderId) ORDER BY PostedAt DESC;
END
GO

/* Records a credit invoice the desk built, so the nightly run does not build it again. */
CREATE OR ALTER PROCEDURE piv2.Claim_MarkInvoiced
    @Rail          char(2) = 'IR',
    @OrderId       int,
    @InvoiceNumber varchar(50),
    @FileId        bigint = NULL,
    @SharePath     nvarchar(400) = NULL,
    @Actor         nvarchar(100),
    @Reason        nvarchar(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRAN;

    IF @Rail = 'PP'
        UPDATE dbo.PriceProtectionProcess SET InvoiceGenerated = 1 WHERE OrderID = @OrderId;
    ELSE
    BEGIN
        UPDATE dbo.RebateProcessBatch SET Invoiced = 1 WHERE OrderID = CAST(@OrderId AS varchar(25));
        IF @@ROWCOUNT = 0
            INSERT dbo.RebateProcessBatch (BatchID, DateRun, Invoiced, Misc, OrderID)
            VALUES ('PIV2-REBATEDESK', GETDATE(), 1, 'Invoice built by Rebate Desk', CAST(@OrderId AS varchar(25)));
    END

    INSERT piv2.RebateEvent (Rail, EventType, ClaimId, Actor, Reason, Detail)
    VALUES (@Rail, 'INVOICE_BUILT', @OrderId, @Actor, @Reason,
            (SELECT @InvoiceNumber AS invoiceNumber, @FileId AS fileId, @SharePath AS sharePath FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));

    COMMIT;
END
GO

/* ---------------------------------------------------------------
   Debit memos
   --------------------------------------------------------------- */

/* Approved, unlocked claims with no DM yet, decided within the dates, for the vendors. One row per claim and product. */
CREATE OR ALTER PROCEDURE piv2.Claim_DebitMemoCandidates
    @Rail      char(2) = 'IR',
    @VendorIds varchar(500),
    @From      date,
    @To        date
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @v TABLE (VendorId int PRIMARY KEY);
    INSERT @v SELECT DISTINCT TRY_CAST(value AS int) FROM STRING_SPLIT(@VendorIds, ',') WHERE TRY_CAST(value AS int) IS NOT NULL;
    DECLARE @toEx datetime = DATEADD(day, 1, CAST(@To AS datetime));

    /* Catalog numbers for the products involved, read from the product view once. */
    CREATE TABLE #cat (Code nvarchar(20) NOT NULL PRIMARY KEY, CatNo nvarchar(200) NULL);
    INSERT #cat (Code, CatNo)
    SELECT CAST(p.ProductCode AS nvarchar(20)), MAX(LEFT(p.CAT_NO, 200))
      FROM [PRO].dbo.Product p
     WHERE CAST(p.ProductCode AS nvarchar(20)) IN
           (SELECT LTRIM(RTRIM(LEFT(m.ModelName, CHARINDEX(',', m.ModelName + ',') - 1)))
              FROM dbo.RebateCameraModels m WHERE m.VendorID IN (SELECT VendorId FROM @v) AND m.ModelName IS NOT NULL)
     GROUP BY CAST(p.ProductCode AS nvarchar(20));

    IF @Rail = 'PP'
    BEGIN
        WITH p AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY OrderID ORDER BY ID DESC) AS rn FROM dbo.PriceProtectionProcess)
        SELECT r.ORDERID AS OrderId, r.MemberID AS MemberId, m.VendorID AS VendorId, v.VendorName, r.ModelID AS ModelId,
               m.ModelNumber AS Description, m.ModelName AS ProCode, iv.CatNo AS CatalogNumber, r.StringProgramWeek AS ProgramWeek,
               p.timeEnd AS ProcessedAt, SUM(r.Quantity) AS Quantity, r.ReimbursementAmount,
               SUM(CAST(COALESCE(r.ReimbursementAmount, 0) * COALESCE(r.Quantity, 0) AS decimal(19,2))) AS Extended
          FROM dbo.PriceProtectionRedeem r
          JOIN p ON p.OrderID = r.ORDERID AND p.rn = 1
          JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelID
          JOIN @v sel ON sel.VendorId = m.VendorID
          JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID
          LEFT JOIN #cat iv ON iv.Code = LTRIM(RTRIM(LEFT(m.ModelName, CHARINDEX(',', m.ModelName + ',') - 1)))
         WHERE p.Status = 1 AND COALESCE(p.Locked, 0) = 0 AND NULLIF(LTRIM(RTRIM(p.DM)), '') IS NULL AND COALESCE(r.Saved, 0) = 0
           AND p.timeEnd >= @From AND p.timeEnd < @toEx
         GROUP BY r.ORDERID, r.MemberID, m.VendorID, v.VendorName, r.ModelID, m.ModelNumber, m.ModelName, iv.CatNo,
                  r.StringProgramWeek, p.timeEnd, r.ReimbursementAmount
         ORDER BY r.MemberID, r.ORDERID, r.StringProgramWeek, r.ModelID;
    END
    ELSE
    BEGIN
        WITH p AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY OrderID ORDER BY ID DESC) AS rn FROM dbo.RebateProcess)
        SELECT r.ORDERID AS OrderId, r.MemberID AS MemberId, m.VendorID AS VendorId, v.VendorName, r.ModelID AS ModelId,
               m.ModelNumber AS Description, m.ModelName AS ProCode, iv.CatNo AS CatalogNumber, r.StringProgramWeek AS ProgramWeek,
               p.timeEnd AS ProcessedAt, SUM(r.Quantity) AS Quantity,
               COALESCE(vs.VendorShare, r.ReimbursementAmount) AS ReimbursementAmount,
               r.ReimbursementAmount AS MemberAmount,
               SUM(CAST(COALESCE(vs.VendorShare, r.ReimbursementAmount, 0) * COALESCE(r.Quantity, 0) AS decimal(19,2))) AS Extended
          FROM dbo.RebateRedeem r
          JOIN p ON p.OrderID = r.ORDERID AND p.rn = 1
          OUTER APPLY (SELECT TOP (1) t.VendorShare
                         FROM piv2.RebateProgramTerms t
                         JOIN dbo.RebateProgramDetail pd ON pd.ProgramID = t.ProgramId
                        WHERE t.ModelId = r.ModelID AND ABS(t.MemberAmount - r.ReimbursementAmount) < 0.005
                          AND pd.ModelID = r.ModelID
                          AND r.Date >= pd.ProgramStartWeek
                          AND r.Date < DATEADD(day, 1, COALESCE(pd.ExpireOn, DATEADD(day, 120, pd.ProgramEndWeek)))
                        ORDER BY pd.ProgramStartWeek DESC, t.UpdatedAt DESC) vs
          JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelID
          JOIN @v sel ON sel.VendorId = m.VendorID
          JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID
          LEFT JOIN #cat iv ON iv.Code = LTRIM(RTRIM(LEFT(m.ModelName, CHARINDEX(',', m.ModelName + ',') - 1)))
         WHERE p.Status = 1 AND COALESCE(p.Locked, 0) = 0 AND NULLIF(LTRIM(RTRIM(p.DM)), '') IS NULL AND COALESCE(r.Saved, 0) = 0
           AND p.timeEnd >= @From AND p.timeEnd < @toEx
         GROUP BY r.ORDERID, r.MemberID, m.VendorID, v.VendorName, r.ModelID, m.ModelNumber, m.ModelName, iv.CatNo,
                  r.StringProgramWeek, p.timeEnd, r.ReimbursementAmount, vs.VendorShare
         ORDER BY r.MemberID, r.ORDERID, r.StringProgramWeek, r.ModelID;
    END
END
GO

/* Stamps the DM on the chosen claims and keeps the memo. All or nothing. */
CREATE OR ALTER PROCEDURE piv2.Claim_CreateDebitMemo
    @Rail       char(2) = 'IR',
    @DM         varchar(50),
    @OrderIds   varchar(max),
    @VendorIds  varchar(500),
    @VendorName nvarchar(200),
    @EmailTo    nvarchar(500) = NULL,
    @Ref1       nvarchar(200) = NULL,
    @Ref2       nvarchar(200) = NULL,
    @Actor      nvarchar(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @DM = NULLIF(LTRIM(RTRIM(@DM)), '');
    IF @DM IS NULL
        THROW 50770, 'Enter the debit memo number.', 1;

    DECLARE @ids TABLE (OrderId int PRIMARY KEY);
    INSERT @ids SELECT DISTINCT TRY_CAST(value AS int) FROM STRING_SPLIT(@OrderIds, ',') WHERE TRY_CAST(value AS int) IS NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM @ids)
        THROW 50771, 'Choose at least one claim.', 1;

    BEGIN TRAN;

    IF EXISTS (SELECT 1 FROM piv2.RebateDebitMemo WITH (UPDLOCK, HOLDLOCK) WHERE Rail = @Rail AND DM = @DM)
       OR (@Rail = 'IR' AND EXISTS (SELECT 1 FROM dbo.RebateProcess WHERE DM = @DM))
       OR (@Rail = 'PP' AND EXISTS (SELECT 1 FROM dbo.PriceProtectionProcess WHERE DM = @DM))
        THROW 50772, 'That debit memo number is already used.', 1;

    DECLARE @bad nvarchar(400);
    IF @Rail = 'PP'
        SELECT @bad = STRING_AGG(CAST(i.OrderId AS nvarchar(20)), ', ')
          FROM @ids i
         OUTER APPLY (SELECT TOP (1) p.Status, p.Locked FROM dbo.PriceProtectionProcess p WITH (UPDLOCK) WHERE p.OrderID = i.OrderId ORDER BY p.ID DESC) latest
         WHERE COALESCE(latest.Status, 0) <> 1 OR COALESCE(latest.Locked, 0) <> 0
            OR EXISTS (SELECT 1 FROM dbo.PriceProtectionProcess p WHERE p.OrderID = i.OrderId AND NULLIF(LTRIM(RTRIM(p.DM)), '') IS NOT NULL);
    ELSE
        SELECT @bad = STRING_AGG(CAST(i.OrderId AS nvarchar(20)), ', ')
          FROM @ids i
         OUTER APPLY (SELECT TOP (1) p.Status, p.Locked FROM dbo.RebateProcess p WITH (UPDLOCK) WHERE p.OrderID = i.OrderId ORDER BY p.ID DESC) latest
         WHERE COALESCE(latest.Status, 0) <> 1 OR COALESCE(latest.Locked, 0) <> 0
            OR EXISTS (SELECT 1 FROM dbo.RebateProcess p WHERE p.OrderID = i.OrderId AND NULLIF(LTRIM(RTRIM(p.DM)), '') IS NOT NULL);

    IF @bad IS NOT NULL
    BEGIN
        DECLARE @msg nvarchar(500) = CONCAT(N'These claims are not approved, are locked, or already have a debit memo: ', @bad, N'. Refresh and try again.');
        THROW 50773, @msg, 1;
    END

    DECLARE @total decimal(19,2);

    IF @Rail = 'PP'
    BEGIN
        UPDATE p SET DM = @DM FROM dbo.PriceProtectionProcess p JOIN @ids i ON i.OrderId = p.OrderID;
        SELECT @total = SUM(CAST(COALESCE(r.ReimbursementAmount, 0) * COALESCE(r.Quantity, 0) AS decimal(19,2)))
          FROM dbo.PriceProtectionRedeem r JOIN @ids i ON i.OrderId = r.ORDERID WHERE COALESCE(r.Saved, 0) = 0;
    END
    ELSE
    BEGIN
        UPDATE p SET DM = @DM FROM dbo.RebateProcess p JOIN @ids i ON i.OrderId = p.OrderID;
        /* The vendor is billed its share only; PRO's pad is never on a debit memo. */
        SELECT @total = SUM(CAST(COALESCE(vs.VendorShare, r.ReimbursementAmount, 0) * COALESCE(r.Quantity, 0) AS decimal(19,2)))
          FROM dbo.RebateRedeem r JOIN @ids i ON i.OrderId = r.ORDERID
          OUTER APPLY (SELECT TOP (1) t.VendorShare
                         FROM piv2.RebateProgramTerms t
                         JOIN dbo.RebateProgramDetail pd ON pd.ProgramID = t.ProgramId
                        WHERE t.ModelId = r.ModelID AND ABS(t.MemberAmount - r.ReimbursementAmount) < 0.005
                          AND pd.ModelID = r.ModelID
                          AND r.Date >= pd.ProgramStartWeek
                          AND r.Date < DATEADD(day, 1, COALESCE(pd.ExpireOn, DATEADD(day, 120, pd.ProgramEndWeek)))
                        ORDER BY pd.ProgramStartWeek DESC, t.UpdatedAt DESC) vs
         WHERE COALESCE(r.Saved, 0) = 0;
    END

    DECLARE @claims int = (SELECT COUNT(*) FROM @ids);

    INSERT piv2.RebateDebitMemo (Rail, DM, VendorIds, VendorName, Claims, Total, EmailTo, Ref1, Ref2, CreatedBy)
    VALUES (@Rail, @DM, @VendorIds, @VendorName, @claims, COALESCE(@total, 0), @EmailTo, @Ref1, @Ref2, @Actor);
    DECLARE @id int = SCOPE_IDENTITY();

    INSERT piv2.RebateEvent (Rail, EventType, ClaimId, Actor, Detail)
    SELECT @Rail, 'DEBIT_MEMO', i.OrderId, @Actor, (SELECT @DM AS dm, @id AS debitMemoId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
      FROM @ids i;

    /* Remember who receives this vendor's memos. */
    IF NULLIF(LTRIM(RTRIM(@EmailTo)), N'') IS NOT NULL
        MERGE piv2.RebateVendorBilling AS t
        USING (SELECT DISTINCT TRY_CAST(value AS int) AS VendorId FROM STRING_SPLIT(@VendorIds, ',') WHERE TRY_CAST(value AS int) IS NOT NULL) AS s
        ON t.VendorId = s.VendorId
        WHEN MATCHED THEN UPDATE SET EmailTo = @EmailTo, UpdatedBy = @Actor, UpdatedAt = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (VendorId, EmailTo, UpdatedBy) VALUES (s.VendorId, @EmailTo, @Actor);

    COMMIT;

    SELECT @id AS DebitMemoId, @claims AS Claims, COALESCE(@total, 0) AS Total;
END
GO

CREATE OR ALTER PROCEDURE piv2.Claim_SetDebitMemoDelivery
    @DebitMemoId int,
    @FileId      bigint = NULL,
    @Emailed     bit = 0,
    @EmailError  nvarchar(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    UPDATE piv2.RebateDebitMemo
       SET FileId = COALESCE(@FileId, FileId),
           EmailedAt = CASE WHEN @Emailed = 1 THEN SYSUTCDATETIME() ELSE EmailedAt END,
           EmailError = @EmailError
     WHERE DebitMemoId = @DebitMemoId;
END
GO

CREATE OR ALTER PROCEDURE piv2.Claim_DebitMemos
    @Rail char(2) = 'IR',
    @Q    nvarchar(100) = NULL,
    @Take int = 100
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @Q = NULLIF(LTRIM(RTRIM(@Q)), N'');
    SELECT TOP (CASE WHEN @Take BETWEEN 1 AND 500 THEN @Take ELSE 100 END)
           DebitMemoId, Rail, DM AS DebitMemo, VendorIds, VendorName, Claims, Total, EmailTo, Ref1, Ref2, FileId, EmailedAt, EmailError, CreatedBy, CreatedAt
      FROM piv2.RebateDebitMemo
     WHERE Rail = @Rail AND (@Q IS NULL OR DM LIKE '%' + @Q + '%' OR VendorName LIKE N'%' + @Q + N'%')
     ORDER BY DebitMemoId DESC;
END
GO

/* The memo's claims, for downloading or re-sending its CSV. */
CREATE OR ALTER PROCEDURE piv2.Claim_DebitMemoLines
    @DebitMemoId int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @rail char(2), @dm varchar(50);
    SELECT @rail = Rail, @dm = DM FROM piv2.RebateDebitMemo WHERE DebitMemoId = @DebitMemoId;

    DECLARE @v TABLE (VendorId int PRIMARY KEY);
    INSERT @v SELECT DISTINCT TRY_CAST(value AS int) FROM STRING_SPLIT((SELECT VendorIds FROM piv2.RebateDebitMemo WHERE DebitMemoId = @DebitMemoId), ',')
     WHERE TRY_CAST(value AS int) IS NOT NULL;

    /* Catalog numbers for the products involved, read from the product view once. */
    CREATE TABLE #cat (Code nvarchar(20) NOT NULL PRIMARY KEY, CatNo nvarchar(200) NULL);
    INSERT #cat (Code, CatNo)
    SELECT CAST(p.ProductCode AS nvarchar(20)), MAX(LEFT(p.CAT_NO, 200))
      FROM [PRO].dbo.Product p
     WHERE CAST(p.ProductCode AS nvarchar(20)) IN
           (SELECT LTRIM(RTRIM(LEFT(m.ModelName, CHARINDEX(',', m.ModelName + ',') - 1)))
              FROM dbo.RebateCameraModels m WHERE m.VendorID IN (SELECT VendorId FROM @v) AND m.ModelName IS NOT NULL)
     GROUP BY CAST(p.ProductCode AS nvarchar(20));

    SELECT DebitMemoId, Rail, DM AS DebitMemo, VendorIds, VendorName, Claims, Total, EmailTo, Ref1, Ref2, FileId, EmailedAt, CreatedBy, CreatedAt
      FROM piv2.RebateDebitMemo WHERE DebitMemoId = @DebitMemoId;

    IF @rail = 'PP'
    BEGIN
        WITH p AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY OrderID ORDER BY ID DESC) AS rn FROM dbo.PriceProtectionProcess)
        SELECT r.ORDERID AS OrderId, r.MemberID AS MemberId, m.VendorID AS VendorId, v.VendorName, r.ModelID AS ModelId,
               m.ModelNumber AS Description, m.ModelName AS ProCode, iv.CatNo AS CatalogNumber, r.StringProgramWeek AS ProgramWeek,
               p.timeEnd AS ProcessedAt, SUM(r.Quantity) AS Quantity, r.ReimbursementAmount,
               SUM(CAST(COALESCE(r.ReimbursementAmount, 0) * COALESCE(r.Quantity, 0) AS decimal(19,2))) AS Extended
          FROM dbo.PriceProtectionRedeem r
          JOIN p ON p.OrderID = r.ORDERID AND p.rn = 1 AND p.DM = @dm
          JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelID
          JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID
          LEFT JOIN #cat iv ON iv.Code = LTRIM(RTRIM(LEFT(m.ModelName, CHARINDEX(',', m.ModelName + ',') - 1)))
         WHERE COALESCE(r.Saved, 0) = 0
         GROUP BY r.ORDERID, r.MemberID, m.VendorID, v.VendorName, r.ModelID, m.ModelNumber, m.ModelName, iv.CatNo,
                  r.StringProgramWeek, p.timeEnd, r.ReimbursementAmount
         ORDER BY r.MemberID, r.ORDERID;
    END
    ELSE
    BEGIN
        WITH p AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY OrderID ORDER BY ID DESC) AS rn FROM dbo.RebateProcess)
        SELECT r.ORDERID AS OrderId, r.MemberID AS MemberId, m.VendorID AS VendorId, v.VendorName, r.ModelID AS ModelId,
               m.ModelNumber AS Description, m.ModelName AS ProCode, iv.CatNo AS CatalogNumber, r.StringProgramWeek AS ProgramWeek,
               p.timeEnd AS ProcessedAt, SUM(r.Quantity) AS Quantity,
               COALESCE(vs.VendorShare, r.ReimbursementAmount) AS ReimbursementAmount,
               r.ReimbursementAmount AS MemberAmount,
               SUM(CAST(COALESCE(vs.VendorShare, r.ReimbursementAmount, 0) * COALESCE(r.Quantity, 0) AS decimal(19,2))) AS Extended
          FROM dbo.RebateRedeem r
          JOIN p ON p.OrderID = r.ORDERID AND p.rn = 1 AND p.DM = @dm
          OUTER APPLY (SELECT TOP (1) t.VendorShare
                         FROM piv2.RebateProgramTerms t
                         JOIN dbo.RebateProgramDetail pd ON pd.ProgramID = t.ProgramId
                        WHERE t.ModelId = r.ModelID AND ABS(t.MemberAmount - r.ReimbursementAmount) < 0.005
                          AND pd.ModelID = r.ModelID
                          AND r.Date >= pd.ProgramStartWeek
                          AND r.Date < DATEADD(day, 1, COALESCE(pd.ExpireOn, DATEADD(day, 120, pd.ProgramEndWeek)))
                        ORDER BY pd.ProgramStartWeek DESC, t.UpdatedAt DESC) vs
          JOIN dbo.RebateCameraModels m ON m.ModelID = r.ModelID
          JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID
          LEFT JOIN #cat iv ON iv.Code = LTRIM(RTRIM(LEFT(m.ModelName, CHARINDEX(',', m.ModelName + ',') - 1)))
         WHERE COALESCE(r.Saved, 0) = 0
         GROUP BY r.ORDERID, r.MemberID, m.VendorID, v.VendorName, r.ModelID, m.ModelNumber, m.ModelName, iv.CatNo,
                  r.StringProgramWeek, p.timeEnd, r.ReimbursementAmount, vs.VendorShare
         ORDER BY r.MemberID, r.ORDERID;
    END
END
GO

CREATE OR ALTER PROCEDURE piv2.Claim_VendorBilling
    @VendorId int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SELECT VendorId, EmailTo, UpdatedBy, UpdatedAt FROM piv2.RebateVendorBilling WHERE VendorId = @VendorId;
END
GO

SELECT N'claims ready' AS Result;
