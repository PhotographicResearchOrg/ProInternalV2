/* ---------------------------------------------------------------
    Member ship-tos · 00  Mirror Computyme's SHIPTO file into EDA

    Part 1 is read only: run it in EDA first. The SHIPTO schema already exists in EDA,
    so the table may already be there (it just isn't in the EDADB project).

    Part 2 is the table shape to map in the EDA replication, in the same style as
    ARMST.ARMST. Only create it by hand if your replication doesn't create its own
    tables. It is CREATE-if-missing: it never drops or changes anything.

    Computyme's SHIPTO dictionary (D_SHIPTO):
      @ID   "member*code"  e.g. 2377*01   (code is 2 digits, zero-padded)
      1     CODE           2R
      2     NAME           25L   ship-to name
      3     ADDR1          25T   address line 1
      4     ADDR2          30L   address line 2 (the maintenance screen never fills it; SEL.SHIPTO never reads it)
      5     CITY           25L
      6     STATE          2L
      7     ZIP            10R   5, 5-4, or Canadian A1A-1A1
      8     ZONE           4R    UPS zone (from ZIPREF by ZIP prefix)
    The default ship-to is NOT in SHIPTO: it is ARMST attrs 31-32 (SHIP_STREET, SHIP_CSZ),
    already mirrored in ARMST.ARMST.
   --------------------------------------------------------------- */

USE EDA;
GO

/* ---- Part 1: is it already mirrored? (read only) */
SELECT s.name AS SchemaName, t.name AS TableName, t.create_date, p.rows
FROM sys.schemas s
LEFT JOIN sys.tables t ON t.schema_id = s.schema_id
LEFT JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
WHERE s.name = 'SHIPTO';

IF OBJECT_ID('SHIPTO.SHIPTO', 'U') IS NOT NULL
    EXEC('SELECT TOP (20) * FROM SHIPTO.SHIPTO ORDER BY ID;');
GO

/* ---- Part 2: the shape to mirror (created only if missing) */
IF SCHEMA_ID('SHIPTO') IS NULL EXEC('CREATE SCHEMA [SHIPTO] AUTHORIZATION [dbo]');
GO
IF OBJECT_ID('SHIPTO.SHIPTO', 'U') IS NULL
BEGIN
    CREATE TABLE [SHIPTO].[SHIPTO] (
        [ID]                 VARCHAR (20)  NOT NULL,   -- member*code, e.g. 2377*01
        [CODE]               VARCHAR (150) NULL,       -- attr 1
        [NAME]               VARCHAR (150) NULL,       -- attr 2
        [ADDR1]              VARCHAR (150) NULL,       -- attr 3
        [ADDR2]              VARCHAR (150) NULL,       -- attr 4
        [CITY]               VARCHAR (150) NULL,       -- attr 5
        [STATE]              VARCHAR (150) NULL,       -- attr 6
        [ZIP]                VARCHAR (150) NULL,       -- attr 7
        [ZONE]               VARCHAR (150) NULL,       -- attr 8
        [NONCONFORMING_FLAG] SMALLINT      NULL,
        [UNMAPPED_U2FIELD]   VARCHAR (MAX) NULL,
        PRIMARY KEY CLUSTERED ([ID] ASC)
    );
    PRINT 'SHIPTO.SHIPTO created (empty). Point the EDA replication of the SHIPTO file at it.';
END
ELSE
    PRINT 'SHIPTO.SHIPTO already exists: nothing changed.';
GO

/* ---- Once it has rows: quick sanity check (read only) */
IF OBJECT_ID('SHIPTO.SHIPTO', 'U') IS NOT NULL
    EXEC('
    SELECT COUNT(*)                                             AS ShipTos,
           COUNT(DISTINCT LEFT(ID, CHARINDEX(''*'', ID + ''*'') - 1)) AS Members,
           SUM(CASE WHEN ID NOT LIKE ''%*%'' THEN 1 ELSE 0 END)   AS BadKeys,
           SUM(CASE WHEN NULLIF(LTRIM(ADDR2), '''') IS NOT NULL THEN 1 ELSE 0 END) AS WithLine2
    FROM SHIPTO.SHIPTO;');
GO
