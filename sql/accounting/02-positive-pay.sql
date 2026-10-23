/* ---------------------------------------------------------------
    Accounting · 02  Positive pay for the Accounting desk (read only)

    Database: PRO      Safe to run twice. One procedure; changes no data.

    Positive pay: what members invoiced last week (Monday-Sunday) owe by this week's Friday.
      Invoices      Computyme ARHIST (EDA), posted last week; amount = sum of the invoice's lines
      Paid          DT_PAID set
      Still owed    DT_PAID empty
    piv2.Accounting_PositivePay  @AsOf (default today):
      1. totals: week start/end, due Friday, invoices, members, invoiced, paid, still owed
      2. per member: account, name, invoices, invoiced, paid, still owed
   --------------------------------------------------------------- */

USE PRO;
GO
SET NOCOUNT ON;
GO
IF SCHEMA_ID('piv2') IS NULL EXEC('CREATE SCHEMA piv2');
GO

CREATE OR ALTER PROCEDURE piv2.Accounting_PositivePay
    @AsOf date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @today date = ISNULL(@AsOf, CAST(GETDATE() AS date));
    /* Monday of this week, whatever DATEFIRST is (1900-01-01 was a Monday) */
    DECLARE @thisMonday date = DATEADD(day, -(DATEDIFF(day, '19000101', @today) % 7), @today);
    DECLARE @weekStart date = DATEADD(day, -7, @thisMonday), @weekEnd date = DATEADD(day, -1, @thisMonday),
            @dueFriday date = DATEADD(day, 4, @thisMonday);

    SELECT LEFT(h.ID, 4) COLLATE DATABASE_DEFAULT AS AccountNumber, h.ID, MAX(h.DT_PAID) AS DtPaid, SUM(ISNULL(d.AMOUNT, 0)) AS Amount
    INTO #inv
    FROM EDA.ARHIST.ARHIST h
    JOIN EDA.ARHIST.PDQAE_MV d ON d.ID = h.ID
    WHERE h.DT_POSTED >= @weekStart AND h.DT_POSTED < @thisMonday
    GROUP BY h.ID;

    SELECT @weekStart AS WeekStart, @weekEnd AS WeekEnd, @dueFriday AS DueFriday,
           COUNT(*) AS Invoices, COUNT(DISTINCT AccountNumber) AS Members,
           ISNULL(SUM(Amount), 0) AS Invoiced,
           ISNULL(SUM(CASE WHEN DtPaid IS NOT NULL THEN Amount END), 0) AS Paid,
           ISNULL(SUM(CASE WHEN DtPaid IS NULL THEN Amount END), 0) AS StillOwed,
           COUNT(DISTINCT CASE WHEN DtPaid IS NULL THEN AccountNumber END) AS MembersOwing
    FROM #inv;

    SELECT i.AccountNumber,
           COALESCE(NULLIF(LTRIM(r.DBA), ''), r.Company) AS Name,
           COUNT(*) AS Invoices, SUM(i.Amount) AS Invoiced,
           SUM(CASE WHEN i.DtPaid IS NOT NULL THEN i.Amount ELSE 0 END) AS Paid,
           SUM(CASE WHEN i.DtPaid IS NULL THEN i.Amount ELSE 0 END) AS StillOwed
    FROM #inv i
    LEFT JOIN dbo.Roster r ON LTRIM(RTRIM(r.AccountNumber)) = i.AccountNumber
    GROUP BY i.AccountNumber, r.DBA, r.Company
    ORDER BY StillOwed DESC, i.AccountNumber;
END
GO

PRINT 'Accounting 02 ready: positive pay.';
GO
