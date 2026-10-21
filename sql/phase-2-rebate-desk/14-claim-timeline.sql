/* ---------------------------------------------------------------
    Phase 2 · 14  Claim timeline (the back-and-forth on one claim) and
                  the IR Maintenance actions folded into the desk

    Database: PRO_NUKE      Safe to run twice.      Run after 07 and 10.
    Nothing existing changes. New: piv2.ClaimLog (+ its sequence) and
    four procedures. The triggers that fill piv2.ClaimLog are in 15 and
    are optional: without them the timeline shows what can be rebuilt.

    Where each step comes from
      Submitted .............. RebateRedeem.Date
      Opened / decided ........ RebateProcess (only its latest state survives:
                                the legacy screens overwrite the row, and
                                ResubmitRebateOrder deletes the status-3 row)
                                + piv2.ClaimLog once the triggers in 15 run
      BRM review asked/closed . [PRO].dbo.usernotifications (CreatedOn / ArchivedOn;
                                ResubmitRebateOrder and ConfirmDecline archive it)
      Files added / removed ... piv2.ClaimLog (triggers) and desk actions
      Desk actions ............ piv2.RebateEvent
      Credit posted ........... AR (piv2.Rebate_ArCredit)
      Billed to the vendor .... RebateProcess.DM + piv2.RebateDebitMemo
   --------------------------------------------------------------- */

USE PRO_NUKE;
GO
SET XACT_ABORT ON;
GO

IF OBJECT_ID('piv2.ClaimLogSeq', 'SO') IS NULL
    CREATE SEQUENCE piv2.ClaimLogSeq AS bigint START WITH 1 INCREMENT BY 1;
GO

/* One row per change to a claim's decision row or files. Keyed by a sequence, not IDENTITY,
   so the triggers never change @@IDENTITY for the legacy code that inserts into those tables. */
IF OBJECT_ID('piv2.ClaimLog') IS NULL
CREATE TABLE piv2.ClaimLog
(
    LogId      bigint          NOT NULL CONSTRAINT DF_piv2_ClaimLog_Id DEFAULT (NEXT VALUE FOR piv2.ClaimLogSeq),
    OrderId    int             NULL,
    Source     varchar(10)     NOT NULL,     -- PROCESS (RebateProcess) or FILE (RebateRedeemAdditionalFiles)
    Action     char(1)         NOT NULL,     -- I insert, U update, D delete
    ProcessId  int             NULL,
    StatusWas  int             NULL,
    StatusNow  int             NULL,
    LockedNow  int             NULL,
    UserNow    nvarchar(100)   NULL,
    ReasonNow  nvarchar(1000)  NULL,
    PostedWas  int             NULL,
    PostedNow  int             NULL,
    DmWas      nvarchar(100)   NULL,
    DmNow      nvarchar(100)   NULL,
    FileName   nvarchar(500)   NULL,
    At         datetime        NOT NULL CONSTRAINT DF_piv2_ClaimLog_At DEFAULT (GETDATE()),     -- local, like the legacy tables
    LoginName  nvarchar(128)   NULL CONSTRAINT DF_piv2_ClaimLog_Login DEFAULT (SUSER_SNAME()),
    HostName   nvarchar(128)   NULL CONSTRAINT DF_piv2_ClaimLog_Host DEFAULT (HOST_NAME()),
    AppName    nvarchar(128)   NULL CONSTRAINT DF_piv2_ClaimLog_App DEFAULT (APP_NAME()),
    CONSTRAINT PK_piv2_ClaimLog PRIMARY KEY (LogId)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_piv2_ClaimLog_Order' AND object_id = OBJECT_ID('piv2.ClaimLog'))
    CREATE INDEX IX_piv2_ClaimLog_Order ON piv2.ClaimLog (OrderId, At);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_piv2_ClaimLog_Process' AND object_id = OBJECT_ID('piv2.ClaimLog'))
    CREATE INDEX IX_piv2_ClaimLog_Process ON piv2.ClaimLog (ProcessId, Action) WHERE ProcessId IS NOT NULL;
GO

/* Second strike from the desk: a claim that needed support is declined for good. Same as the
   IR Maintenance "Confirm decline" (dbo.ConfirmDecline), plus who and why. No email is sent. */
CREATE OR ALTER PROCEDURE piv2.Claim_ConfirmDecline
    @OrderId int,
    @Actor   nvarchar(100),
    @Reason  nvarchar(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@Reason)), N'') IS NULL
        THROW 50702, 'A reason is required.', 1;
    IF NULLIF(LTRIM(RTRIM(@Actor)), N'') IS NULL
        THROW 50703, 'Who is doing this? (no signed-in user)', 1;
    IF OBJECT_ID(N'dbo.ConfirmDecline', N'P') IS NULL
        THROW 50768, 'dbo.ConfirmDecline is not on this database.', 1;

    DECLARE @status int = (SELECT TOP (1) Status FROM dbo.RebateProcess WHERE OrderID = @OrderId ORDER BY ID DESC);
    IF @status IS NULL OR @status <> 3
        THROW 50769, 'Only claims that need support (status 3) can have the decline confirmed.', 1;

    BEGIN TRAN;
        EXEC dbo.ConfirmDecline @OrderId = @OrderId;

        INSERT piv2.RebateEvent (Rail, EventType, ClaimId, Actor, Reason, Detail)
        VALUES ('IR', 'CLAIM_DECLINE_CONFIRMED', @OrderId, @Actor, @Reason,
                (SELECT @status AS statusWas, 2 AS statusNow FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));
    COMMIT;
END
GO

/* A support file added to or removed from a claim on the desk (the file itself is handled by the API). */
CREATE OR ALTER PROCEDURE piv2.Claim_FileEvent
    @OrderId  int,
    @Added    bit,
    @FileName nvarchar(300),
    @Actor    nvarchar(100),
    @Reason   nvarchar(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF NULLIF(LTRIM(RTRIM(@Actor)), N'') IS NULL
        THROW 50703, 'Who is doing this? (no signed-in user)', 1;
    INSERT piv2.RebateEvent (Rail, EventType, ClaimId, Actor, Reason, Detail)
    VALUES ('IR', CASE WHEN @Added = 1 THEN 'CLAIM_FILE_ADDED' ELSE 'CLAIM_FILE_REMOVED' END, @OrderId, @Actor,
            NULLIF(LTRIM(RTRIM(@Reason)), N''), (SELECT @FileName AS fileName FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));
END
GO

/* A note on a claim from the desk or the BRM dashboard. Kept in piv2.RebateEvent like every other
   desk action (no new table); it shows in the claim's timeline. */
CREATE OR ALTER PROCEDURE piv2.Claim_Note
    @OrderId int,
    @Note    nvarchar(500),
    @Actor   nvarchar(100)
AS
BEGIN
    SET NOCOUNT ON;
    IF NULLIF(LTRIM(RTRIM(@Note)), N'') IS NULL
        THROW 50704, 'Write the note first.', 1;
    IF NULLIF(LTRIM(RTRIM(@Actor)), N'') IS NULL
        THROW 50703, 'Who is doing this? (no signed-in user)', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.RebateRedeem WHERE ORDERID = @OrderId)
        THROW 50705, 'There is no claim with that number.', 1;
    INSERT piv2.RebateEvent (Rail, EventType, ClaimId, Actor, Reason)
    VALUES ('IR', 'CLAIM_NOTE', @OrderId, @Actor, LTRIM(RTRIM(@Note)));
END
GO

/* The claims needing support or declined, one row per claim, with their files (the desk's Declines view). */
CREATE OR ALTER PROCEDURE piv2.Claim_Declines
    @Months int = 12
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @since date = CASE WHEN @Months > 0 THEN DATEADD(month, -@Months, CAST(GETDATE() AS date)) ELSE '19000101' END;

    CREATE TABLE #p (OrderId int NOT NULL PRIMARY KEY, Status int NULL, DecidedAt datetime NULL, OpenedAt datetime NULL,
                     DecidedBy nvarchar(100) NULL, Reason nvarchar(max) NULL, Total decimal(19,2) NULL);
    INSERT #p
    SELECT x.OrderID, x.Status, x.timeEnd, x.timestart, CAST(x.[User] AS nvarchar(100)), CAST(x.RejectReason AS nvarchar(max)), CAST(x.Total AS decimal(19,2))
      FROM (SELECT p.*, ROW_NUMBER() OVER (PARTITION BY p.OrderID ORDER BY p.ID DESC) AS rn
              FROM dbo.RebateProcess p
             WHERE p.OrderID IN (SELECT q.OrderID FROM dbo.RebateProcess q
                                  WHERE q.Status IN (2, 3) AND COALESCE(q.timeEnd, q.timestart) >= @since)) x
     WHERE x.rn = 1 AND x.OrderID IS NOT NULL AND x.Status IN (2, 3);   -- the claim's latest decision

    SELECT p.OrderId AS orderID, p.Status AS status, COALESCE(p.DecidedAt, p.OpenedAt) AS processDate, p.DecidedBy AS decidedBy,
           p.Reason AS rejectReason, COALESCE(p.Total, r.Amount) AS total,
           r.MemberID AS memberID, r.MemberName AS memberName, r.Email AS email, r.Units AS quantity, r.Lines AS lines,
           r.Model AS model, r.VendorId AS vendorID, r.VendorName AS vendorName, r.ProgramWeek AS stringProgramWeek,
           r.MasterFileLoc AS masterFileLoc,
           (SELECT STRING_AGG(CAST(f.FileName AS nvarchar(max)), N'|') FROM dbo.RebateRedeemAdditionalFiles f WHERE f.OrderID = p.OrderId) AS additionalFiles
      FROM #p p
     CROSS APPLY (SELECT MAX(rr.MemberID) AS MemberID,
                         MAX(LTRIM(RTRIM(CONCAT(rr.FName, N' ', rr.LName)))) AS MemberName,
                         MAX(CAST(rr.Email AS nvarchar(200))) AS Email,
                         SUM(rr.Quantity) AS Units, COUNT(*) AS Lines,
                         CASE WHEN COUNT(*) > 1 THEN CONCAT(MIN(CAST(rr.Model AS nvarchar(300))), N' +', COUNT(*) - 1, N' more')
                              ELSE MIN(CAST(rr.Model AS nvarchar(300))) END AS Model,
                         MIN(m.VendorID) AS VendorId, MIN(v.VendorName) AS VendorName,
                         MIN(CAST(rr.StringProgramWeek AS nvarchar(100))) AS ProgramWeek,
                         MAX(CAST(rr.MasterFileLoc AS nvarchar(500))) AS MasterFileLoc,
                         SUM(CAST(COALESCE(rr.Net, 0) AS decimal(19,2))) AS Amount
                    FROM dbo.RebateRedeem rr
                    LEFT JOIN dbo.RebateCameraModels m ON m.ModelID = rr.ModelID
                    LEFT JOIN dbo.RebateVendors v ON v.VendorID = m.VendorID
                   WHERE rr.ORDERID = p.OrderId) r
     ORDER BY COALESCE(p.DecidedAt, p.OpenedAt) DESC;
END
GO

/* Every step on one instant-rebate claim, oldest first, and who has it now.
   Result 1: At, Kind, Actor, Text, Ball (who has it after this step), Source, Exact (0 = date not recorded)
   Result 2: Holder, Note, Since, Status */
CREATE OR ALTER PROCEDURE piv2.Claim_Timeline
    @OrderId int
AS
BEGIN
    SET NOCOUNT ON;

    CREATE TABLE #t (At datetime NULL, Seq int NOT NULL, Kind varchar(30) NOT NULL, Actor nvarchar(400) NULL,
                     Text nvarchar(max) NOT NULL, Ball varchar(20) NULL, Source varchar(20) NOT NULL, Exact bit NOT NULL DEFAULT (1));

    /* Submitted by the dealer. */
    DECLARE @member int, @memberName nvarchar(200), @submitted datetime, @lines int, @amount decimal(19,2);
    SELECT @member = MAX(r.MemberID), @memberName = MAX(LTRIM(RTRIM(CONCAT(r.FName, N' ', r.LName)))),
           @submitted = MIN(r.Date), @lines = COUNT(*), @amount = SUM(CAST(COALESCE(r.Net, 0) AS decimal(19,2)))
      FROM dbo.RebateRedeem r WHERE r.ORDERID = @OrderId AND COALESCE(r.Saved, 0) = 0;

    IF @lines > 0
        INSERT #t (At, Seq, Kind, Actor, Text, Ball, Source)
        VALUES (@submitted, 10, 'SUBMITTED', CONCAT(N'Member ', @member, CASE WHEN @memberName <> N'' THEN N' · ' + @memberName ELSE N'' END),
                CONCAT(N'Dealer submitted the claim: ', @lines, CASE WHEN @lines = 1 THEN N' line, ' ELSE N' lines, ' END, FORMAT(@amount, 'C', 'en-US')),
                'PRO', 'Claim');

    /* The decision row as it stands now. */
    DECLARE @pid int, @status int, @locked int, @user nvarchar(100), @opened datetime, @decided datetime,
            @reason nvarchar(1000), @posted int, @dm nvarchar(100);
    SELECT TOP (1) @pid = p.ID, @status = p.Status, @locked = p.Locked, @user = CAST(p.[User] AS nvarchar(100)),
           @opened = p.timestart, @decided = p.timeEnd, @reason = LEFT(CAST(p.RejectReason AS nvarchar(max)), 1000),
           @posted = p.ComputymeProcessed, @dm = NULLIF(LTRIM(RTRIM(p.DM)), N'')
      FROM dbo.RebateProcess p WHERE p.OrderID = @OrderId ORDER BY p.ID DESC;
    SET @user = CASE WHEN @user IS NULL OR @user = N'Cant get user' THEN NULL ELSE @user END;

    /* Changes recorded by the triggers (15), when there are any. */
    DECLARE @logged bit = CASE WHEN EXISTS (SELECT 1 FROM piv2.ClaimLog WHERE OrderId = @OrderId AND Source = 'PROCESS') THEN 1 ELSE 0 END;

    INSERT #t (At, Seq, Kind, Actor, Text, Ball, Source)
    SELECT l.At, 20, k.Kind, NULLIF(NULLIF(l.UserNow, N'Cant get user'), N''), k.Text, k.Ball, 'Log'
      FROM piv2.ClaimLog l
     CROSS APPLY (SELECT
            CASE WHEN l.Action = 'D' AND l.StatusWas = 3 THEN 'RESUBMITTED'
                 WHEN l.Action = 'D' THEN 'DECISION_REMOVED'
                 WHEN l.Action = 'I' AND COALESCE(l.StatusNow, 0) = 0 THEN 'OPENED'
                 WHEN COALESCE(l.StatusWas, -1) <> COALESCE(l.StatusNow, -1) AND l.StatusNow = 1 THEN 'APPROVED'
                 WHEN COALESCE(l.StatusWas, -1) <> COALESCE(l.StatusNow, -1) AND l.StatusNow = 2 THEN 'DECLINED'
                 WHEN COALESCE(l.StatusWas, -1) <> COALESCE(l.StatusNow, -1) AND l.StatusNow = 3 THEN 'SUPPORT_ASKED'
                 WHEN COALESCE(l.PostedWas, 0) <> 1 AND l.PostedNow = 1 THEN 'POSTED'
                 WHEN l.PostedWas = 1 AND l.PostedNow IS NULL THEN 'REPOST'
                 WHEN COALESCE(l.DmWas, N'') <> COALESCE(l.DmNow, N'') AND l.DmNow IS NOT NULL THEN 'DEBIT_MEMO'
                 ELSE 'CHANGED' END AS Kind) k0
     CROSS APPLY (SELECT k0.Kind,
            CASE k0.Kind
                 WHEN 'RESUBMITTED'      THEN N'Support received: back in the approval queue'
                 WHEN 'DECISION_REMOVED' THEN N'Decision removed'
                 WHEN 'OPENED'           THEN N'Opened for review'
                 WHEN 'APPROVED'         THEN N'Approved'
                 WHEN 'DECLINED'         THEN N'Declined' + COALESCE(N': ' + l.ReasonNow, N'')
                 WHEN 'SUPPORT_ASKED'    THEN N'Needs support (BRM review)' + COALESCE(N': ' + l.ReasonNow, N'')
                 WHEN 'POSTED'           THEN N'Posted to GL'
                 WHEN 'REPOST'           THEN N'Marked to post again'
                 WHEN 'DEBIT_MEMO'       THEN N'Billed to the vendor on debit memo ' + l.DmNow
                 ELSE N'Decision row changed' END AS Text,
            CASE k0.Kind
                 WHEN 'RESUBMITTED' THEN 'PRO' WHEN 'OPENED' THEN 'PRO_REVIEW' WHEN 'APPROVED' THEN 'ACCOUNTING'
                 WHEN 'DECLINED' THEN 'CLOSED' WHEN 'SUPPORT_ASKED' THEN 'DEALER' WHEN 'POSTED' THEN 'ACCOUNTING'
                 WHEN 'REPOST' THEN 'ACCOUNTING' WHEN 'DEBIT_MEMO' THEN 'VENDOR' ELSE NULL END AS Ball) k
     WHERE l.OrderId = @OrderId AND l.Source = 'PROCESS' AND k0.Kind <> 'CHANGED';

    /* Before the log: rebuild what the decision row still shows. */
    IF @pid IS NOT NULL
    BEGIN
        /* Opened before the log started (no insert logged for this row). */
        IF NOT EXISTS (SELECT 1 FROM piv2.ClaimLog WHERE ProcessId = @pid AND Action = 'I')
            INSERT #t (At, Seq, Kind, Actor, Text, Ball, Source)
            VALUES (@opened, 20, 'OPENED', @user, N'Opened for review', 'PRO_REVIEW', 'Decision');
        /* Decided before the log started (the log has no move to this status). */
        IF @status IN (1, 2, 3)
           AND NOT EXISTS (SELECT 1 FROM piv2.ClaimLog WHERE ProcessId = @pid AND StatusNow = @status
                                                        AND COALESCE(StatusWas, -1) <> @status)
            INSERT #t (At, Seq, Kind, Actor, Text, Ball, Source)
            VALUES (@decided, 21,
                    CASE @status WHEN 1 THEN 'APPROVED' WHEN 2 THEN 'DECLINED' ELSE 'SUPPORT_ASKED' END, @user,
                    CASE @status WHEN 1 THEN N'Approved'
                                 WHEN 2 THEN N'Declined' + COALESCE(N': ' + @reason, N'')
                                 ELSE N'Needs support (BRM review)' + COALESCE(N': ' + @reason, N'') END,
                    CASE @status WHEN 1 THEN 'ACCOUNTING' WHEN 2 THEN 'CLOSED' ELSE 'DEALER' END, 'Decision');
    END

    /* BRM review notices: created when support is asked, archived when it is resubmitted or the decline confirmed. */
    IF OBJECT_ID(N'[PRO].dbo.usernotifications') IS NOT NULL
    BEGIN
        DECLARE @o nvarchar(20) = CAST(@OrderId AS nvarchar(20));
        INSERT #t (At, Seq, Kind, Actor, Text, Ball, Source)
        SELECT n.CreatedOn, 15, 'BRM_NOTIFIED', CONCAT(N'user ', n.UserId),
               N'BRM notified to review' + CASE WHEN n.IsRead = 1 THEN N' (read)' ELSE N' (not read yet)' END, NULL, 'Notification'
          FROM [PRO].dbo.usernotifications n
         WHERE (n.Message LIKE N'%order ' + @o + N'.%' OR n.Message LIKE N'%order ' + @o OR n.Message LIKE N'%order ' + @o + N' %')
        UNION ALL
        SELECT n.ArchivedOn, 30, 'BRM_CLOSED', CONCAT(N'user ', n.UserId), N'BRM review closed', NULL, 'Notification'
          FROM [PRO].dbo.usernotifications n
         WHERE n.ArchivedOn IS NOT NULL
           AND (n.Message LIKE N'%order ' + @o + N'.%' OR n.Message LIKE N'%order ' + @o OR n.Message LIKE N'%order ' + @o + N' %');
    END

    /* Files the dealer (or PRO) added or removed, as the triggers saw them. */
    INSERT #t (At, Seq, Kind, Actor, Text, Ball, Source)
    SELECT l.At, 25, CASE WHEN l.Action = 'D' THEN 'FILE_REMOVED' ELSE 'FILE_ADDED' END, NULL,
           CASE WHEN l.Action = 'D' THEN N'Support file removed: ' ELSE N'Support file added: ' END + COALESCE(l.FileName, N''),
           CASE WHEN l.Action = 'D' THEN NULL ELSE 'PRO' END, 'Log'
      FROM piv2.ClaimLog l
     WHERE l.OrderId = @OrderId AND l.Source = 'FILE'
       AND NOT EXISTS (SELECT 1 FROM piv2.RebateEvent e
                        WHERE e.ClaimId = @OrderId AND e.EventType IN ('CLAIM_FILE_ADDED', 'CLAIM_FILE_REMOVED')
                          AND ABS(DATEDIFF(second, CAST((e.At AT TIME ZONE 'UTC') AT TIME ZONE 'Eastern Standard Time' AS datetime), l.At)) < 120
                          AND JSON_VALUE(e.Detail, '$.fileName') = l.FileName);

    /* What was done on the desk. */
    INSERT #t (At, Seq, Kind, Actor, Text, Ball, Source)
    SELECT CAST((e.At AT TIME ZONE 'UTC') AT TIME ZONE 'Eastern Standard Time' AS datetime), 40, e.EventType, e.Actor,
           CASE e.EventType
                WHEN 'CLAIM_RESUBMITTED'       THEN N'Sent back to the queue on the desk'
                WHEN 'CLAIM_DECLINE_CONFIRMED' THEN N'Decline confirmed on the desk (second strike)'
                WHEN 'CLAIM_FILE_ADDED'        THEN N'Support file added on the desk: ' + COALESCE(JSON_VALUE(e.Detail, '$.fileName'), N'')
                WHEN 'CLAIM_FILE_REMOVED'      THEN N'Support file removed on the desk: ' + COALESCE(JSON_VALUE(e.Detail, '$.fileName'), N'')
                WHEN 'CLAIM_NOTE'              THEN N'Note: ' + COALESCE(e.Reason, N'')
                ELSE REPLACE(UPPER(LEFT(e.EventType, 1)) + LOWER(SUBSTRING(e.EventType, 2, 50)), N'_', N' ') END
             + CASE WHEN e.EventType = 'CLAIM_NOTE' THEN N'' ELSE COALESCE(N' · ' + e.Reason, N'') END,
           CASE e.EventType WHEN 'CLAIM_RESUBMITTED' THEN 'PRO' WHEN 'CLAIM_DECLINE_CONFIRMED' THEN 'CLOSED' ELSE NULL END, 'Desk'
      FROM piv2.RebateEvent e
     WHERE e.ClaimId = @OrderId AND e.Rail = 'IR';

    /* Credit posted to the member's account (AR). */
    IF @member IS NOT NULL
        INSERT #t (At, Seq, Kind, Actor, Text, Ball, Source)
        SELECT a.PostedAt, 50, 'CREDITED', NULL,
               CONCAT(N'Credit posted to the member''s account: invoice ', a.InvoiceNumber, N', ', FORMAT(a.Amount, 'C', 'en-US')),
               CASE WHEN @dm IS NULL THEN 'PRO_BILLING' ELSE NULL END, 'AR'
          FROM piv2.Rebate_ArCredit(@member, @OrderId) a;

    /* Billed to the vendor. */
    IF @dm IS NOT NULL AND NOT EXISTS (SELECT 1 FROM #t WHERE Kind = 'DEBIT_MEMO')
    BEGIN
        DECLARE @dmAt datetime, @dmBy nvarchar(100), @dmMailed datetime, @dmTo nvarchar(500);
        SELECT TOP (1) @dmAt = CAST((d.CreatedAt AT TIME ZONE 'UTC') AT TIME ZONE 'Eastern Standard Time' AS datetime), @dmBy = d.CreatedBy,
               @dmMailed = CAST((d.EmailedAt AT TIME ZONE 'UTC') AT TIME ZONE 'Eastern Standard Time' AS datetime), @dmTo = d.EmailTo
          FROM piv2.RebateDebitMemo d WHERE d.Rail = 'IR' AND d.DM = @dm ORDER BY d.DebitMemoId DESC;
        INSERT #t (At, Seq, Kind, Actor, Text, Ball, Source, Exact)
        VALUES (@dmAt, 60, 'DEBIT_MEMO', @dmBy, N'Billed to the vendor on debit memo ' + @dm, 'VENDOR', 'Debit memo', CASE WHEN @dmAt IS NULL THEN 0 ELSE 1 END);
        IF @dmMailed IS NOT NULL
            INSERT #t (At, Seq, Kind, Actor, Text, Ball, Source)
            VALUES (@dmMailed, 61, 'DM_EMAILED', @dmBy, N'Debit memo emailed' + COALESCE(N' to ' + @dmTo, N''), 'VENDOR', 'Debit memo');
    END

    /* Steps with no recorded time go where they happened: after the latest timed step that comes before them. */
    SELECT t.At, t.Kind, t.Actor, t.Text, t.Ball, t.Source, CAST(CASE WHEN t.At IS NULL THEN 0 ELSE t.Exact END AS bit) AS Exact
      FROM #t t
     OUTER APPLY (SELECT MAX(x.At) AS Before FROM #t x WHERE t.At IS NULL AND x.At IS NOT NULL AND x.Seq <= t.Seq) b
     ORDER BY COALESCE(t.At, b.Before, '99991231'), CASE WHEN t.At IS NULL THEN 1 ELSE 0 END, t.Seq;

    /* Who has the ball now. */
    DECLARE @hasAr bit = CASE WHEN EXISTS (SELECT 1 FROM #t WHERE Kind = 'CREDITED') THEN 1 ELSE 0 END;
    DECLARE @lastAt datetime = (SELECT MAX(At) FROM #t);
    SELECT
        CASE WHEN @lines IS NULL OR @lines = 0 THEN 'UNKNOWN'
             WHEN @pid IS NULL THEN 'PRO'
             WHEN COALESCE(@status, 0) = 0 THEN 'PRO_REVIEW'
             WHEN @status = 3 THEN 'DEALER'
             WHEN @status = 2 THEN 'CLOSED'
             WHEN @status = 1 AND COALESCE(@posted, 0) <> 1 THEN 'ACCOUNTING'
             WHEN @status = 1 AND @hasAr = 0 THEN 'ACCOUNTING'
             WHEN @status = 1 AND @dm IS NULL THEN 'PRO_BILLING'
             ELSE 'DONE' END AS Holder,
        CASE WHEN @lines IS NULL OR @lines = 0 THEN N'No claim with this number'
             WHEN @pid IS NULL AND EXISTS (SELECT 1 FROM #t WHERE Kind IN ('RESUBMITTED', 'CLAIM_RESUBMITTED', 'BRM_CLOSED'))
                  THEN N'Back in the approval queue after support was received'
             WHEN @pid IS NULL THEN N'Waiting in the approval queue'
             WHEN COALESCE(@status, 0) = 0 THEN N'Being reviewed' + COALESCE(N' by ' + @user, N'')
             WHEN @status = 3 THEN N'Waiting on the dealer for support (BRM review)'
             WHEN @status = 2 THEN N'Declined: closed'
             WHEN @status = 1 AND COALESCE(@posted, 0) <> 1 THEN N'Approved: waiting to post to GL'
             WHEN @status = 1 AND @hasAr = 0 THEN N'Posted to GL but not in AR yet'
             WHEN @status = 1 AND @dm IS NULL THEN N'Credited to the member: bill the vendor (no debit memo yet)'
             ELSE N'Billed to the vendor on debit memo ' + @dm END AS Note,
        CASE WHEN @status = 3 THEN COALESCE(@decided, @lastAt)
             WHEN @pid IS NULL THEN @lastAt
             ELSE @lastAt END AS Since,
        @status AS Status;
END
GO
