/*
    Phase 2 · 01  Rebate Desk: tables
    Database: PRO_NUKE      Safe to run twice.      Run after 00.

    piv2.RebateUpload         one vendor file and what was decided about it
    piv2.RebateUploadRow      each row of that file, mapped to the canonical
                              fields, with its status:
                                READY      passes every check, will load
                                PURGATORY  failed a check; held, never dropped
                                LOADED     written to dbo.RebateProgramDetail
                                SKIPPED    a person decided not to load it, with a reason
    piv2.RebateTemplate       a vendor's saved column mapping for one sheet
                              layout (the fingerprint), reused automatically
    piv2.RebateEvent          everything that happened on either rail (instant
                              rebates or price protection), with who, why,
                              before and after
    piv2.RebateBatchSeq       batch numbers for new loads, continuing above
                              the highest BatchID already in RebateProgramDetail
*/

USE PRO_NUKE;
GO
SET XACT_ABORT ON;
GO

IF OBJECT_ID('piv2.RebateTemplate', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.RebateTemplate
    (
        TemplateId    int IDENTITY(1,1) NOT NULL,
        VendorId      int            NOT NULL,     -- dbo.RebateVendors.VendorID
        Fingerprint   char(64)       NOT NULL,     -- SHA-256 of the sheet name and normalised header row
        SheetName     nvarchar(128)  NOT NULL,
        HeaderRow     int            NOT NULL,
        Headers       nvarchar(max)  NOT NULL,     -- JSON array of the header texts, for showing on the desk
        Mapping       nvarchar(max)  NOT NULL,     -- JSON: canonical field -> column number, plus formats
        Source        varchar(20)    NOT NULL,     -- AI, ALIAS, MANUAL (a person changed the proposal)
        IsActive      bit            NOT NULL CONSTRAINT DF_piv2_RebTpl_IsActive DEFAULT (1),
        TimesUsed     int            NOT NULL CONSTRAINT DF_piv2_RebTpl_TimesUsed DEFAULT (0),
        LastUsedAt    datetime2(0)   NULL,
        CreatedBy     nvarchar(100)  NOT NULL,
        CreatedAt     datetime2(0)   NOT NULL CONSTRAINT DF_piv2_RebTpl_CreatedAt DEFAULT (SYSUTCDATETIME()),
        RetiredBy     nvarchar(100)  NULL,
        RetiredAt     datetime2(0)   NULL,
        CONSTRAINT PK_piv2_RebateTemplate PRIMARY KEY (TemplateId),
        CONSTRAINT CK_piv2_RebTpl_Source CHECK (Source IN ('AI', 'ALIAS', 'MANUAL')),
        CONSTRAINT CK_piv2_RebTpl_Mapping CHECK (ISJSON(Mapping) = 1),
        CONSTRAINT CK_piv2_RebTpl_Headers CHECK (ISJSON(Headers) = 1)
    );

    /* One live template per vendor and layout. */
    CREATE UNIQUE INDEX UX_piv2_RebTpl_Active ON piv2.RebateTemplate (VendorId, Fingerprint) WHERE IsActive = 1;
END
GO

IF OBJECT_ID('piv2.RebateUpload', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.RebateUpload
    (
        UploadId           int IDENTITY(1,1) NOT NULL,
        VendorId           int             NOT NULL,
        FileId             bigint          NOT NULL,   -- PRO.piv2.FileLibrary.FileId (the original on S3)
        FileName           nvarchar(260)   NOT NULL,
        FileSha256         char(64)        NOT NULL,
        SheetName          nvarchar(128)   NULL,
        HeaderRow          int             NULL,
        Fingerprint        char(64)        NULL,
        TemplateId         int             NULL,
        MappingSource      varchar(20)     NULL,       -- TEMPLATE, AI, ALIAS, MANUAL
        DefaultRebateType  int             NULL,       -- dbo.RebateType.ID, for rows that do not say
        ExpireOn           date            NULL,       -- written to RebateProgramDetail.ExpireOn
        StartActive        bit             NOT NULL CONSTRAINT DF_piv2_RebUp_StartActive DEFAULT (1),
        Status             varchar(20)     NOT NULL CONSTRAINT DF_piv2_RebUp_Status DEFAULT ('MAPPING'),
        BatchId            int             NULL,       -- set at first load; purgatory rows loaded later join it
        CreatedBy          nvarchar(100)   NOT NULL,
        CreatedAt          datetime2(0)    NOT NULL CONSTRAINT DF_piv2_RebUp_CreatedAt DEFAULT (SYSUTCDATETIME()),
        LoadedBy           nvarchar(100)   NULL,
        LoadedAt           datetime2(0)    NULL,
        CancelledBy        nvarchar(100)   NULL,
        CancelReason       nvarchar(500)   NULL,
        CONSTRAINT PK_piv2_RebateUpload PRIMARY KEY (UploadId),
        CONSTRAINT CK_piv2_RebUp_Status CHECK (Status IN ('MAPPING', 'REVIEW', 'PARTIAL', 'LOADED', 'CANCELLED')),
        CONSTRAINT CK_piv2_RebUp_Source CHECK (MappingSource IS NULL OR MappingSource IN ('TEMPLATE', 'AI', 'ALIAS', 'MANUAL'))
    );

    /* The same file is never loaded twice for a vendor (cancelled uploads do not count). */
    CREATE UNIQUE INDEX UX_piv2_RebUp_File ON piv2.RebateUpload (VendorId, FileSha256) WHERE Status <> 'CANCELLED';
    CREATE INDEX IX_piv2_RebUp_Status ON piv2.RebateUpload (Status, CreatedAt DESC);
END
GO

IF OBJECT_ID('piv2.RebateUploadRow', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.RebateUploadRow
    (
        RowId           bigint IDENTITY(1,1) NOT NULL,
        UploadId        int             NOT NULL,
        SourceRow       int             NOT NULL,     -- the spreadsheet row number, as the vendor sees it
        Raw             nvarchar(max)   NOT NULL,     -- the row's cells as read, JSON
        ProCode         nvarchar(50)    NULL,
        Description     nvarchar(400)   NULL,
        InstantRebate   decimal(19,2)   NULL,
        Reimbursement   decimal(19,2)   NULL,
        MapPrice        decimal(19,2)   NULL,
        StartDate       date            NULL,
        EndDate         date            NULL,
        StackProduct    nvarchar(400)   NULL,
        RebateType      int             NULL,
        Notes           nvarchar(1000)  NULL,
        ModelId         int             NULL,         -- dbo.RebateCameraModels.ModelID: the row's disposition
        ModelChosenBy   nvarchar(100)   NULL,         -- set when a person picked the disposition; the checks then keep it
        StackModelId    int             NULL,         -- the stack product's rebate model, linked in RebateQualifiers at load
        Status         varchar(20)     NOT NULL CONSTRAINT DF_piv2_RebRow_Status DEFAULT ('PURGATORY'),
        Problems        nvarchar(max)   NULL,         -- JSON array of {code, message}
        ProgramId       int             NULL,         -- dbo.RebateProgramDetail.ProgramID once loaded
        SkipReason      nvarchar(500)   NULL,
        UpdatedBy       nvarchar(100)   NULL,
        UpdatedAt       datetime2(0)    NULL,
        CONSTRAINT PK_piv2_RebateUploadRow PRIMARY KEY (RowId),
        CONSTRAINT FK_piv2_RebRow_Upload FOREIGN KEY (UploadId) REFERENCES piv2.RebateUpload (UploadId),
        CONSTRAINT CK_piv2_RebRow_Status CHECK (Status IN ('READY', 'PURGATORY', 'LOADED', 'SKIPPED')),
        CONSTRAINT CK_piv2_RebRow_Raw CHECK (ISJSON(Raw) = 1)
    );

    CREATE INDEX IX_piv2_RebRow_Upload ON piv2.RebateUploadRow (UploadId, Status);
    CREATE INDEX IX_piv2_RebRow_Purgatory ON piv2.RebateUploadRow (Status) INCLUDE (UploadId) WHERE Status = 'PURGATORY';
END
GO

IF OBJECT_ID('piv2.RebateEvent', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.RebateEvent
    (
        EventId     bigint IDENTITY(1,1) NOT NULL,
        Rail        char(2)         NOT NULL CONSTRAINT DF_piv2_RebEvt_Rail DEFAULT ('IR'),  -- IR instant rebates, PP price protection
        EventType   varchar(30)     NOT NULL,
        ModelId     int             NULL,
        ClaimId     int             NULL,     -- member claim (RebateRedeem / PriceProtectionRedeem ORDERID)
        BatchId     int             NULL,
        ProgramId   int             NULL,
        UploadId    int             NULL,
        RowId       bigint          NULL,
        TemplateId  int             NULL,
        Actor       nvarchar(100)   NOT NULL,
        Reason      nvarchar(500)   NULL,
        Detail      nvarchar(max)   NULL,     -- JSON: counts, or before and after values
        At          datetime2(0)    NOT NULL CONSTRAINT DF_piv2_RebEvt_At DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_piv2_RebateEvent PRIMARY KEY (EventId),
        CONSTRAINT CK_piv2_RebEvt_Rail CHECK (Rail IN ('IR', 'PP'))
    );

    CREATE INDEX IX_piv2_RebEvt_Model   ON piv2.RebateEvent (ModelId, EventId DESC) WHERE ModelId IS NOT NULL;
    CREATE INDEX IX_piv2_RebEvt_Claim   ON piv2.RebateEvent (Rail, ClaimId, EventId DESC) WHERE ClaimId IS NOT NULL;

    CREATE INDEX IX_piv2_RebEvt_Batch   ON piv2.RebateEvent (BatchId, EventId DESC) WHERE BatchId IS NOT NULL;
    CREATE INDEX IX_piv2_RebEvt_Program ON piv2.RebateEvent (ProgramId, EventId DESC) WHERE ProgramId IS NOT NULL;
    CREATE INDEX IX_piv2_RebEvt_Upload  ON piv2.RebateEvent (UploadId, EventId DESC) WHERE UploadId IS NOT NULL;
END
GO

/* Debit memos: approved claims billed back to the vendor, one row per memo. */
IF OBJECT_ID('piv2.RebateDebitMemo', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.RebateDebitMemo
    (
        DebitMemoId  int IDENTITY(1,1) NOT NULL,
        Rail         char(2)         NOT NULL,
        DM           varchar(50)     NOT NULL,     -- written to RebateProcess.DM / PriceProtectionProcess.DM
        VendorIds    varchar(500)    NOT NULL,
        VendorName   nvarchar(200)   NOT NULL,
        Claims       int             NOT NULL,
        Total        decimal(19,2)   NOT NULL,
        EmailTo      nvarchar(500)   NULL,
        Ref1         nvarchar(200)   NULL,
        Ref2         nvarchar(200)   NULL,
        FileId       bigint          NULL,         -- the CSV in PRO.piv2.FileLibrary
        EmailedAt    datetime2(0)    NULL,
        EmailError   nvarchar(500)   NULL,
        CreatedBy    nvarchar(100)   NOT NULL,
        CreatedAt    datetime2(0)    NOT NULL CONSTRAINT DF_piv2_RebDM_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_piv2_RebateDebitMemo PRIMARY KEY (DebitMemoId),
        CONSTRAINT CK_piv2_RebDM_Rail CHECK (Rail IN ('IR', 'PP'))
    );
    CREATE UNIQUE INDEX UX_piv2_RebDM_DM ON piv2.RebateDebitMemo (Rail, DM);
END
GO

/* Who receives a vendor's debit memos, remembered from the last one sent. */
IF OBJECT_ID('piv2.RebateVendorBilling', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.RebateVendorBilling
    (
        VendorId   int            NOT NULL,
        EmailTo    nvarchar(500)  NULL,
        UpdatedBy  nvarchar(100)  NOT NULL,
        UpdatedAt  datetime2(0)   NOT NULL CONSTRAINT DF_piv2_RebVB_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_piv2_RebateVendorBilling PRIMARY KEY (VendorId)
    );
END
GO

/* Batch numbers continue above today's highest BatchID, so new batches never collide with legacy ones. */
IF OBJECT_ID('piv2.RebateBatchSeq', 'SO') IS NULL
BEGIN
    DECLARE @start int = COALESCE((SELECT MAX(BatchID) FROM dbo.RebateProgramDetail), 0) + 1;
    DECLARE @sql nvarchar(300) = N'CREATE SEQUENCE piv2.RebateBatchSeq AS int START WITH '
        + CAST(@start AS nvarchar(20)) + N' INCREMENT BY 1 NO CYCLE;';
    EXEC (@sql);
END
GO

/* Helpful for the overlap check the desk runs on every load. Read-only addition to a legacy table. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_piv2_RebProg_ModelActive' AND object_id = OBJECT_ID('dbo.RebateProgramDetail'))
    CREATE INDEX IX_piv2_RebProg_ModelActive
        ON dbo.RebateProgramDetail (ModelID, IRType, ProgramStartWeek, ProgramEndWeek)
        INCLUDE (Expired, BatchID, Reimbursement);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_piv2_RebProg_Batch' AND object_id = OBJECT_ID('dbo.RebateProgramDetail'))
    CREATE INDEX IX_piv2_RebProg_Batch ON dbo.RebateProgramDetail (BatchID) INCLUDE (Expired, ModelID);
GO

SELECT N'tables ready' AS Result,
       (SELECT CAST(current_value AS int) FROM sys.sequences WHERE object_id = OBJECT_ID('piv2.RebateBatchSeq')) AS NextBatchStartsNear;
