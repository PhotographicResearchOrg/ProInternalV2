/*
    Phase 1 · 01  Integration outbox and file library: tables
    Database: PRO      Safe to run twice.

    One outbox for every domain. A desk save writes its record and a
    PIV2_IntegrationMessage row in the same transaction. The dispatcher
    sends it; the other system answers on api/integration/responses with
    the message's CorrelationId. Nothing is considered delivered until it
    is acknowledged.

    Message status
      QUEUED        waiting for the dispatcher
      SENT          delivered, waiting for the answer
      ACKNOWLEDGED  accepted (ACCEPTED or ACCEPTED_WITH_CHANGES)
      REJECTED      the other system refused it; needs a person
      FAILED        could not be delivered; retried up to MaxAttempts
      OVERDUE       sent, no answer within the destination's ResponseHours
      SUPERSEDED    a newer message for the same record replaced it before sending
      CANCELLED     withdrawn by a person, with a reason
*/

SET XACT_ABORT ON;
GO

IF OBJECT_ID('piv2.IntegrationDestination', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.IntegrationDestination
    (
        Destination     varchar(40)   NOT NULL,   -- COMPUTYME, SHOPIFY, SAGE, VENDOR_EDI, ...
        Domain          varchar(40)   NOT NULL,   -- PRODUCT, CATEGORY, MEMBER, VENDOR, REBATE, PURCHASE_ORDER, PAYMENT_RUN, GL
        DisplayName     nvarchar(100) NOT NULL,
        ResponseHours   int           NOT NULL CONSTRAINT DF_PIV2_IntDest_ResponseHours DEFAULT (24),
        MaxAttempts     int           NOT NULL CONSTRAINT DF_PIV2_IntDest_MaxAttempts DEFAULT (5),
        IsActive        bit           NOT NULL CONSTRAINT DF_PIV2_IntDest_IsActive DEFAULT (1),
        CONSTRAINT PK_PIV2_IntegrationDestination PRIMARY KEY (Destination, Domain),
        CONSTRAINT CK_PIV2_IntDest_ResponseHours CHECK (ResponseHours BETWEEN 1 AND 720),
        CONSTRAINT CK_PIV2_IntDest_MaxAttempts CHECK (MaxAttempts BETWEEN 1 AND 50)
    );
END
GO

IF OBJECT_ID('piv2.IntegrationMessage', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.IntegrationMessage
    (
        MessageId        bigint IDENTITY(1,1) NOT NULL,
        CorrelationId    uniqueidentifier NOT NULL CONSTRAINT DF_PIV2_IntMsg_Correlation DEFAULT (NEWID()),
        Domain           varchar(40)    NOT NULL,
        EntityId         nvarchar(100)  NOT NULL,   -- the record's id in PRO (product code, vendor id, PO number ...)
        EntityLabel      nvarchar(200)  NULL,       -- what a person sees on the desk
        Destination      varchar(40)    NOT NULL,
        Operation        varchar(20)    NOT NULL,   -- UPSERT, DELETE, SUBMIT, CANCEL
        ContractVersion  varchar(20)    NOT NULL,
        Payload          nvarchar(max)  NOT NULL,
        PayloadSha256    char(64)       NOT NULL,
        Status           varchar(20)    NOT NULL CONSTRAINT DF_PIV2_IntMsg_Status DEFAULT ('QUEUED'),
        Attempts         int            NOT NULL CONSTRAINT DF_PIV2_IntMsg_Attempts DEFAULT (0),
        NextAttemptAt    datetime2(0)   NULL,
        ClaimedUntil     datetime2(0)   NULL,       -- dispatcher lease, so two dispatchers never send one message
        CreatedAt        datetime2(0)   NOT NULL CONSTRAINT DF_PIV2_IntMsg_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy        nvarchar(100)  NOT NULL,
        SentAt           datetime2(0)   NULL,
        DueBy            datetime2(0)   NULL,       -- SentAt + ResponseHours
        RespondedAt      datetime2(0)   NULL,
        ExternalId       nvarchar(100)  NULL,       -- the other system's id, from its acknowledgement
        LastError        nvarchar(4000) NULL,
        CONSTRAINT PK_PIV2_IntegrationMessage PRIMARY KEY (MessageId),
        CONSTRAINT UQ_PIV2_IntMsg_Correlation UNIQUE (CorrelationId),
        CONSTRAINT CK_PIV2_IntMsg_Status CHECK (Status IN
            ('QUEUED','SENT','ACKNOWLEDGED','REJECTED','FAILED','OVERDUE','SUPERSEDED','CANCELLED')),
        CONSTRAINT CK_PIV2_IntMsg_Operation CHECK (Operation IN ('UPSERT','DELETE','SUBMIT','CANCEL')),
        CONSTRAINT CK_PIV2_IntMsg_Payload CHECK (ISJSON(Payload) = 1)
    );

    CREATE INDEX IX_PIV2_IntMsg_Queue  ON piv2.IntegrationMessage (Status, NextAttemptAt) INCLUDE (Destination, Domain);
    CREATE INDEX IX_PIV2_IntMsg_Entity ON piv2.IntegrationMessage (Domain, EntityId, Destination, MessageId DESC);
    CREATE INDEX IX_PIV2_IntMsg_Due    ON piv2.IntegrationMessage (Status, DueBy) WHERE Status = 'SENT';
END
GO

IF OBJECT_ID('piv2.IntegrationResponse', 'U') IS NULL
BEGIN
    CREATE TABLE piv2.IntegrationResponse
    (
        ResponseId     bigint IDENTITY(1,1) NOT NULL,
        MessageId      bigint          NOT NULL,
        ResponseType   varchar(30)     NOT NULL,   -- ACKNOWLEDGEMENT, STATUS_UPDATE, EXCEPTION
        Result         varchar(30)     NULL,       -- ACCEPTED, ACCEPTED_WITH_CHANGES, REJECTED
        ReasonCode     varchar(60)     NULL,
        Message        nvarchar(2000)  NULL,
        ExternalId     nvarchar(100)   NULL,
        RespondedAt    datetime2(0)    NOT NULL,   -- when the other system says it answered
        ReceivedAt     datetime2(0)    NOT NULL CONSTRAINT DF_PIV2_IntResp_ReceivedAt DEFAULT (SYSUTCDATETIME()),
        Body           nvarchar(max)   NOT NULL,
        BodySha256     char(64)        NOT NULL,
        CONSTRAINT PK_PIV2_IntegrationResponse PRIMARY KEY (ResponseId),
        CONSTRAINT FK_PIV2_IntResp_Message FOREIGN KEY (MessageId) REFERENCES piv2.IntegrationMessage (MessageId),
        CONSTRAINT UQ_PIV2_IntResp_Body UNIQUE (MessageId, BodySha256),   -- the same answer twice is recorded once
        CONSTRAINT CK_PIV2_IntResp_Type CHECK (ResponseType IN ('ACKNOWLEDGEMENT','STATUS_UPDATE','EXCEPTION')),
        CONSTRAINT CK_PIV2_IntResp_Result CHECK (Result IS NULL OR Result IN ('ACCEPTED','ACCEPTED_WITH_CHANGES','REJECTED'))
    );
END
GO

IF OBJECT_ID('piv2.IntegrationEvent', 'U') IS NULL
BEGIN
    /* Everything a person or the dispatcher did to a message, oldest first. */
    CREATE TABLE piv2.IntegrationEvent
    (
        EventId     bigint IDENTITY(1,1) NOT NULL,
        MessageId   bigint          NOT NULL,
        EventType   varchar(30)     NOT NULL,   -- QUEUED, SENT, SEND_FAILED, RESPONSE, OVERDUE, RESENT, CANCELLED, SUPERSEDED
        Actor       nvarchar(100)   NOT NULL,   -- a user name, or 'dispatcher' / 'system'
        Reason      nvarchar(1000)  NULL,
        At          datetime2(0)    NOT NULL CONSTRAINT DF_PIV2_IntEvt_At DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_PIV2_IntegrationEvent PRIMARY KEY (EventId),
        CONSTRAINT FK_PIV2_IntEvt_Message FOREIGN KEY (MessageId) REFERENCES piv2.IntegrationMessage (MessageId)
    );

    CREATE INDEX IX_PIV2_IntEvt_Message ON piv2.IntegrationEvent (MessageId, EventId);
END
GO

IF OBJECT_ID('piv2.FileLibrary', 'U') IS NULL
BEGIN
    /*
        Every file PRO keeps (vendor rebate sheets, PO documents, invoices)
        is stored on S3 unchanged; this row is how it is found again.
        The same content uploaded twice under one owner is stored once.
    */
    CREATE TABLE piv2.FileLibrary
    (
        FileId       bigint IDENTITY(1,1) NOT NULL,
        Category     varchar(40)     NOT NULL,   -- REBATE_SOURCE, PO_DOCUMENT, VENDOR_INVOICE, ...
        OwnerKey     nvarchar(100)   NOT NULL,   -- e.g. the vendor id the file belongs to
        FileName     nvarchar(260)   NOT NULL,
        ContentType  varchar(150)    NOT NULL,
        SizeBytes    bigint          NOT NULL,
        Sha256       char(64)        NOT NULL,
        Bucket       varchar(100)    NOT NULL,
        S3Key        nvarchar(700)   NOT NULL,
        UploadedBy   nvarchar(100)   NOT NULL,
        UploadedAt   datetime2(0)    NOT NULL CONSTRAINT DF_PIV2_FileLib_UploadedAt DEFAULT (SYSUTCDATETIME()),
        Notes        nvarchar(1000)  NULL,
        CONSTRAINT PK_PIV2_FileLibrary PRIMARY KEY (FileId),
        CONSTRAINT UQ_PIV2_FileLib_Content UNIQUE (Category, OwnerKey, Sha256),
        CONSTRAINT CK_PIV2_FileLib_Size CHECK (SizeBytes > 0)
    );

    CREATE INDEX IX_PIV2_FileLib_Owner ON piv2.FileLibrary (Category, OwnerKey, UploadedAt DESC);
END
GO

/* Destinations known today. Desks add their own rows when they start sending. */
MERGE piv2.IntegrationDestination AS t
USING (VALUES
    ('COMPUTYME', 'PRODUCT',        N'Computyme · products',    24, 5),
    ('COMPUTYME', 'MEMBER',         N'Computyme · members',     24, 5),
    ('COMPUTYME', 'VENDOR',         N'Computyme · vendors',     24, 5),
    ('COMPUTYME', 'PAYMENT_RUN',    N'Computyme · payment runs', 24, 5),
    ('SHOPIFY',   'PRODUCT',        N'Shopify · products',       1, 5),
    ('SHOPIFY',   'CATEGORY',       N'Shopify · categories',     1, 5),
    ('B2B',       'REBATE',         N'B2B site · rebate programs', 1, 5)
) AS s (Destination, Domain, DisplayName, ResponseHours, MaxAttempts)
ON t.Destination = s.Destination AND t.Domain = s.Domain
WHEN NOT MATCHED THEN
    INSERT (Destination, Domain, DisplayName, ResponseHours, MaxAttempts)
    VALUES (s.Destination, s.Domain, s.DisplayName, s.ResponseHours, s.MaxAttempts);
GO

SELECT 'tables ready' AS Result,
       (SELECT COUNT(*) FROM piv2.IntegrationDestination) AS Destinations;
