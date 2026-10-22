/* ---------------------------------------------------------------
    Member ship-tos · 01  Compare SQL ship-tos with Computyme (read only)

    Database: PRO      Safe to run twice. Creates views, functions and procedures only.
    Changes no data in PRO, EDA or Computyme.

    Run again after the SHIPTO mirror changes shape: the view over it is built from the
    columns the mirror actually has.

    SQL side        dbo.Address (the member's addresses) + dbo.AddressShipToMap
                    (which address is Computyme ship-to 00, 01, 02 ...)
    Computyme side  00   = ARMST ship-to (SHIP_STREET / SHIP_CSZ, else the main address)
                    01+  = SHIPTO file, key member*code   (EDA.SHIPTO.SHIPTO)

    piv2.vComputymeShipToAll          Computyme's ship-tos, 00 from ARMST and 01+ from SHIPTO
    piv2.vComputymeShipToMirror       is the SHIPTO mirror there, how many rows
    piv2.fnAddrKey                    street/city key for comparing (case, punctuation, ST/STREET ...)
    piv2.fnMemberShipToCompare(@acct) one row per ship-to, SQL vs Computyme, with a status
    piv2.MemberShipTo_Compare         @AccountNumber: the Member Desk Locations tab
    piv2.MemberShipTo_Issues          every member: everything that isn't a clean match

    Status
      MATCH              same address both sides
      DIFFERENT          both sides have the code, the address differs (Differences says where)
      NOT_IN_COMPUTYME   mapped in SQL, Computyme has no record for that code
      ONLY_IN_COMPUTYME  Computyme has the code, nothing in SQL maps to it
      NO_SQL_DEFAULT     Computyme has a default ship-to, SQL has no default (00) mapping
      NOT_MAPPED         active shipping address in SQL with no ship-to number
      BAD_CODE           mapping's code isn't 1-2 digits (e.g. the old screen's 99999999 placeholder)
      DUPLICATE_CODE     two mappings share one code for the member
      ADDRESS_MISSING    mapping points at an address that isn't this member's (or doesn't exist)
      ADDRESS_INACTIVE   mapping points at a switched-off address
      NO_MIRROR          SHIPTO isn't mirrored, so 01+ can't be checked
    FitIssues: what Computyme can't hold (no line 2, street 25, city 15, "City, ST ZIP" 25, US/CA only).
   --------------------------------------------------------------- */

USE PRO;
GO
SET NOCOUNT ON;
GO
IF SCHEMA_ID('piv2') IS NULL EXEC('CREATE SCHEMA piv2');
GO

/* ------------------------------------------------ comparison key */
CREATE OR ALTER FUNCTION piv2.fnAddrKey (@s nvarchar(400))
RETURNS nvarchar(400)
WITH SCHEMABINDING
AS
BEGIN
    IF @s IS NULL RETURN NULL;
    DECLARE @x nvarchar(400) = N' ' + UPPER(LTRIM(RTRIM(TRANSLATE(@s, N'.,#-/''', N'      ')))) + N' ';
    WHILE CHARINDEX(N'  ', @x) > 0 SET @x = REPLACE(@x, N'  ', N' ');
    SET @x = REPLACE(@x, N' STREET ',    N' ST ');
    SET @x = REPLACE(@x, N' AVENUE ',    N' AVE ');
    SET @x = REPLACE(@x, N' ROAD ',      N' RD ');
    SET @x = REPLACE(@x, N' DRIVE ',     N' DR ');
    SET @x = REPLACE(@x, N' BOULEVARD ', N' BLVD ');
    SET @x = REPLACE(@x, N' LANE ',      N' LN ');
    SET @x = REPLACE(@x, N' COURT ',     N' CT ');
    SET @x = REPLACE(@x, N' PLACE ',     N' PL ');
    SET @x = REPLACE(@x, N' HIGHWAY ',   N' HWY ');
    SET @x = REPLACE(@x, N' PARKWAY ',   N' PKWY ');
    SET @x = REPLACE(@x, N' SUITE ',     N' STE ');
    SET @x = REPLACE(@x, N' FLOOR ',     N' FL ');
    SET @x = REPLACE(@x, N' NORTH ',     N' N ');
    SET @x = REPLACE(@x, N' SOUTH ',     N' S ');
    SET @x = REPLACE(@x, N' EAST ',      N' E ');
    SET @x = REPLACE(@x, N' WEST ',      N' W ');
    SET @x = REPLACE(@x, N' SAINT ',     N' ST ');
    SET @x = REPLACE(@x, N' MOUNT ',     N' MT ');
    RETURN REPLACE(@x, N' ', N'');
END
GO

/* ------------------------------------------------ Computyme ship-tos 01+ (SHIPTO mirror), built from its real columns */
DECLARE @schema sysname, @table sysname;
SELECT TOP (1) @schema = s.name, @table = t.name
FROM EDA.sys.tables t JOIN EDA.sys.schemas s ON s.schema_id = t.schema_id
WHERE s.name = 'SHIPTO' AND t.name = 'SHIPTO';

DECLARE @cols TABLE (name sysname);
IF @table IS NOT NULL
    INSERT @cols (name)
    SELECT c.name FROM EDA.sys.columns c
    JOIN EDA.sys.tables t ON t.object_id = c.object_id
    JOIN EDA.sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = @schema AND t.name = @table;

DECLARE @id sysname = (SELECT TOP (1) name FROM @cols WHERE name IN ('ID', '@ID', 'SHIPTO_ID', 'KEY') ORDER BY CASE name WHEN 'ID' THEN 0 ELSE 1 END);

/* picks the first candidate column the mirror has, else NULL */
DECLARE @pick TABLE (field sysname, expr nvarchar(400));
INSERT @pick (field, expr)
SELECT f.field,
       ISNULL((SELECT TOP (1) N'LTRIM(RTRIM(CAST(x.' + QUOTENAME(c.name) + N' AS nvarchar(200)))) COLLATE DATABASE_DEFAULT'
               FROM @cols c JOIN STRING_SPLIT(f.candidates, ',') v ON c.name = v.value
               ORDER BY CHARINDEX(',' + c.name + ',', ',' + f.candidates + ',')),
              N'CAST(NULL AS nvarchar(200))')
FROM (VALUES ('Name',    'NAME,SHIP_NAME,SHIPTO_NAME'),
             ('Street',  'ADDR1,ADDR_1,ADDRESS1,ADDRESS_LINE_1,ADDR'),
             ('Street2', 'ADDR2,ADDR_2,ADDRESS2,ADDRESS_LINE_2'),
             ('City',    'CITY'),
             ('State',   'STATE,ST'),
             ('Zip',     'ZIP,ZIPCODE,ZIP_CODE'),
             ('Zone',    'ZONE,UPS_ZONE,UPS')) f (field, candidates);

DECLARE @sql nvarchar(max);
IF @table IS NOT NULL AND @id IS NOT NULL
    SET @sql = N'CREATE OR ALTER VIEW piv2.vComputymeShipTo
AS
/* Computyme SHIPTO (member*code), from EDA.' + QUOTENAME(@schema) + N'.' + QUOTENAME(@table) + N'. Built by sql/member-desk/01. */
SELECT TRY_CAST(LEFT(k.id, CHARINDEX(''*'', k.id) - 1) AS int)                    AS AccountNo,
       CASE WHEN SUBSTRING(k.id, CHARINDEX(''*'', k.id) + 1, 10) NOT LIKE ''%[^0-9]%''
                 AND LEN(SUBSTRING(k.id, CHARINDEX(''*'', k.id) + 1, 10)) BETWEEN 1 AND 2
            THEN RIGHT(''00'' + SUBSTRING(k.id, CHARINDEX(''*'', k.id) + 1, 10), 2)
            ELSE SUBSTRING(k.id, CHARINDEX(''*'', k.id) + 1, 10) END              AS Code,
       k.id                                                                       AS ComputymeKey,
       ' + (SELECT expr FROM @pick WHERE field = 'Name')    + N' AS Name,
       ' + (SELECT expr FROM @pick WHERE field = 'Street')  + N' AS Street,
       ' + (SELECT expr FROM @pick WHERE field = 'Street2') + N' AS Street2,
       ' + (SELECT expr FROM @pick WHERE field = 'City')    + N' AS City,
       ' + (SELECT expr FROM @pick WHERE field = 'State')   + N' AS State,
       ' + (SELECT expr FROM @pick WHERE field = 'Zip')     + N' AS Zip,
       ' + (SELECT expr FROM @pick WHERE field = 'Zone')    + N' AS Zone
FROM EDA.' + QUOTENAME(@schema) + N'.' + QUOTENAME(@table) + N' x
CROSS APPLY (SELECT LTRIM(RTRIM(CAST(x.' + QUOTENAME(@id) + N' AS nvarchar(60)))) COLLATE DATABASE_DEFAULT AS id) k
WHERE CHARINDEX(''*'', k.id) > 1;';
ELSE
    SET @sql = N'CREATE OR ALTER VIEW piv2.vComputymeShipTo
AS
/* SHIPTO is not mirrored in EDA yet: no rows. Run sql/member-desk/01 again once it is. */
SELECT CAST(NULL AS int) AS AccountNo, CAST(NULL AS nvarchar(10)) AS Code, CAST(NULL AS nvarchar(60)) AS ComputymeKey,
       CAST(NULL AS nvarchar(200)) AS Name, CAST(NULL AS nvarchar(200)) AS Street, CAST(NULL AS nvarchar(200)) AS Street2,
       CAST(NULL AS nvarchar(200)) AS City, CAST(NULL AS nvarchar(200)) AS State, CAST(NULL AS nvarchar(200)) AS Zip,
       CAST(NULL AS nvarchar(200)) AS Zone
WHERE 1 = 0;';
EXEC sys.sp_executesql @sql;

SET @sql = N'CREATE OR ALTER VIEW piv2.vComputymeShipToMirror
AS
SELECT CAST(' + CASE WHEN @table IS NOT NULL AND @id IS NOT NULL THEN N'1' ELSE N'0' END + N' AS bit) AS Available,
       N' + QUOTENAME(ISNULL(N'EDA.' + @schema + N'.' + @table, N'(not mirrored)'), '''') + N' AS Source,
       (SELECT COUNT(*) FROM piv2.vComputymeShipTo) AS ShipTos;';
EXEC sys.sp_executesql @sql;

IF @table IS NULL      PRINT 'SHIPTO is not mirrored in EDA yet: ship-tos 01+ will show NO_MIRROR. Run this again once it is.';
ELSE IF @id IS NULL    PRINT 'EDA.' + @schema + '.' + @table + ' has no ID column: ship-tos 01+ will show NO_MIRROR.';
ELSE                   PRINT 'Reading Computyme ship-tos from EDA.' + @schema + '.' + @table + '.';
GO

/* ------------------------------------------------ Computyme ship-to 00 (ARMST) plus 01+ (SHIPTO) */
CREATE OR ALTER VIEW piv2.vComputymeShipToAll
AS
/* 00: ARMST attrs 31-32 SHIP_STREET / SHIP_CSZ ("City ST 12345"); when blank Computyme ships to the main address. */
SELECT TRY_CAST(a.ID AS int) AS AccountNo, CAST(N'00' AS nvarchar(10)) AS Code,
       CAST(a.ID AS nvarchar(60)) COLLATE DATABASE_DEFAULT AS ComputymeKey,
       LTRIM(RTRIM(CAST(a.HNAME AS nvarchar(200)))) COLLATE DATABASE_DEFAULT AS Name,
       CASE WHEN sh.HasShip = 1 THEN sh.Street ELSE LTRIM(RTRIM(CAST(a.ADDR AS nvarchar(200)))) COLLATE DATABASE_DEFAULT END AS Street,
       CAST(NULL AS nvarchar(200)) AS Street2,
       CASE WHEN sh.HasShip = 1 THEN pc.City  ELSE LTRIM(RTRIM(CAST(a.CITY   AS nvarchar(200)))) COLLATE DATABASE_DEFAULT END AS City,
       CASE WHEN sh.HasShip = 1 THEN pc.State ELSE LTRIM(RTRIM(CAST(a.STATE  AS nvarchar(200)))) COLLATE DATABASE_DEFAULT END AS State,
       CASE WHEN sh.HasShip = 1 THEN pz.Zip   ELSE LTRIM(RTRIM(CAST(a.CA_ZIP AS nvarchar(200)))) COLLATE DATABASE_DEFAULT END AS Zip,
       LTRIM(RTRIM(CAST(a.UPS AS nvarchar(200)))) COLLATE DATABASE_DEFAULT AS Zone,
       CAST(CASE WHEN sh.HasShip = 1 THEN N'ARMST ship-to' ELSE N'ARMST main address' END AS nvarchar(40)) AS SourceName
FROM EDA.ARMST.ARMST a
CROSS APPLY (SELECT LTRIM(RTRIM(CAST(a.SHIP_STREET AS nvarchar(200)))) COLLATE DATABASE_DEFAULT AS Street,
                    LTRIM(RTRIM(CAST(a.SHIP_CSZ    AS nvarchar(200)))) COLLATE DATABASE_DEFAULT AS Csz,
                    CASE WHEN NULLIF(LTRIM(RTRIM(CAST(a.SHIP_STREET AS nvarchar(200)))), N'') IS NOT NULL THEN 1 ELSE 0 END AS HasShip) sh
CROSS APPLY (SELECT CASE WHEN CHARINDEX(N' ', sh.Csz) > 0 THEN RIGHT(sh.Csz, CHARINDEX(N' ', REVERSE(sh.Csz)) - 1) END AS Zip) pz
CROSS APPLY (SELECT CASE WHEN pz.Zip IS NULL THEN sh.Csz ELSE RTRIM(LEFT(sh.Csz, LEN(sh.Csz) - LEN(pz.Zip))) END AS Rest) pr
CROSS APPLY (SELECT CASE WHEN LEN(pr.Rest) >= 2 THEN RIGHT(pr.Rest, 2) END AS State,
                    CASE WHEN LEN(pr.Rest) > 2 THEN RTRIM(REPLACE(LEFT(pr.Rest, LEN(pr.Rest) - 2), N',', N'')) END AS City) pc
WHERE TRY_CAST(a.ID AS int) IS NOT NULL
UNION ALL
SELECT s.AccountNo, s.Code, s.ComputymeKey, s.Name, s.Street, s.Street2, s.City, s.State, s.Zip, s.Zone, CAST(N'SHIPTO' AS nvarchar(40))
FROM piv2.vComputymeShipTo s
WHERE s.AccountNo IS NOT NULL AND s.Code <> N'00';
GO

/* ------------------------------------------------ SQL vs Computyme, one row per ship-to */
CREATE OR ALTER FUNCTION piv2.fnMemberShipToCompare (@AccountNumber varchar(50))
RETURNS TABLE
AS
RETURN
WITH mem AS (
    SELECT r.RosterId, LTRIM(RTRIM(r.AccountNumber)) AS AccountNumber, TRY_CAST(r.AccountNumber AS int) AS AccountNo,
           r.Company, r.AddressId AS BillAddressId
    FROM dbo.Roster r
    WHERE TRY_CAST(r.AccountNumber AS int) IS NOT NULL
      AND (@AccountNumber IS NULL OR LTRIM(RTRIM(r.AccountNumber)) = LTRIM(RTRIM(@AccountNumber)))
),
addr AS (
    SELECT m.AccountNo, a.AddressId, a.Address1, a.Address2, a.City, a.State, a.Zip, a.Country,
           CAST(CASE WHEN a.IsActive = 1 THEN 1 ELSE 0 END AS bit)                        AS IsActive,
           CAST(CASE WHEN t.AddressTypeName LIKE '%ship%' THEN 1 ELSE 0 END AS bit)       AS IsShipping,
           CAST(CASE WHEN a.AddressId = m.BillAddressId THEN 1 ELSE 0 END AS bit)         AS IsBillTo,
           t.AddressTypeName
    FROM mem m
    JOIN dbo.Address a ON a.CompanyId = m.RosterId
    LEFT JOIN dbo.AddressType t ON t.AddressTypeId = a.AddressTypeId
),
map AS (
    SELECT mm.AccountNo, x.ID AS MapId, TRY_CAST(x.ProShipTO AS int) AS AddressId,
           NULLIF(LTRIM(RTRIM(x.ComputymeShipTo)), '') AS CodeRaw, x.IsDefaultShipTo,
           CASE WHEN x.IsDefaultShipTo = 1 THEN '00'
                WHEN LTRIM(RTRIM(x.ComputymeShipTo)) LIKE '[0-9]' OR LTRIM(RTRIM(x.ComputymeShipTo)) LIKE '[0-9][0-9]'
                     THEN RIGHT('00' + LTRIM(RTRIM(x.ComputymeShipTo)), 2) END AS Code
    FROM mem mm
    JOIN dbo.AddressShipToMap x ON LTRIM(RTRIM(x.AccountNumber)) = mm.AccountNumber
),
mapx AS (
    SELECT p.*, COUNT(*) OVER (PARTITION BY p.AccountNo, p.Code) AS CodeUses
    FROM map p
),
cty AS (
    SELECT c.* FROM piv2.vComputymeShipToAll c JOIN mem m ON m.AccountNo = c.AccountNo
)
/* 1. every mapping */
SELECT m.AccountNumber, m.Company AS MemberName, x.Code, x.MapId, x.CodeRaw, x.IsDefaultShipTo AS IsDefault,
       x.AddressId, a.IsActive AS AddressActive, a.AddressTypeName,
       a.Address1 AS SqlStreet, a.Address2 AS SqlStreet2, a.City AS SqlCity, a.State AS SqlState, a.Zip AS SqlZip, a.Country AS SqlCountry,
       ct.SourceName AS ComputymeSource, ct.ComputymeKey, ct.Name AS CtyName, ct.Street AS CtyStreet, ct.Street2 AS CtyStreet2,
       ct.City AS CtyCity, ct.State AS CtyState, ct.Zip AS CtyZip, ct.Zone AS CtyZone,
       CAST(CASE
            WHEN x.AddressId IS NULL OR a.AddressId IS NULL           THEN 'ADDRESS_MISSING'
            WHEN x.Code IS NULL                                       THEN 'BAD_CODE'
            WHEN x.CodeUses > 1                                       THEN 'DUPLICATE_CODE'
            WHEN a.IsActive = 0                                       THEN 'ADDRESS_INACTIVE'
            WHEN x.Code <> '00' AND mir.Available = 0                 THEN 'NO_MIRROR'
            WHEN ct.AccountNo IS NULL                                 THEN 'NOT_IN_COMPUTYME'
            WHEN cmp.Differences IS NOT NULL                          THEN 'DIFFERENT'
            ELSE 'MATCH' END AS varchar(20)) AS Status,
       cmp.Differences, fit.FitIssues
FROM mapx x
JOIN mem m ON m.AccountNo = x.AccountNo
CROSS JOIN piv2.vComputymeShipToMirror mir
LEFT JOIN addr a ON a.AddressId = x.AddressId AND a.AccountNo = x.AccountNo
OUTER APPLY (SELECT TOP (1) c.* FROM cty c WHERE c.AccountNo = x.AccountNo AND c.Code = x.Code
             ORDER BY CASE c.SourceName WHEN N'SHIPTO' THEN 1 ELSE 0 END) ct
CROSS APPLY (SELECT ISNULL(piv2.fnAddrKey(a.Address1), N'') AS S, ISNULL(piv2.fnAddrKey(ct.Street), N'') AS C) ks
CROSS APPLY (SELECT ISNULL(piv2.fnAddrKey(a.City), N'') AS S, ISNULL(piv2.fnAddrKey(ct.City), N'') AS C) kc
CROSS APPLY (SELECT CASE WHEN a.Zip  LIKE '[0-9][0-9][0-9][0-9][0-9]%' THEN LEFT(a.Zip, 5)
                         ELSE ISNULL(REPLACE(REPLACE(UPPER(a.Zip), N' ', N''), N'-', N''), N'') END AS S,
                    CASE WHEN ct.Zip LIKE '[0-9][0-9][0-9][0-9][0-9]%' THEN LEFT(ct.Zip, 5)
                         ELSE ISNULL(REPLACE(REPLACE(UPPER(ct.Zip), N' ', N''), N'-', N''), N'') END AS C) kz
CROSS APPLY (
    SELECT CASE WHEN a.AddressId IS NULL OR ct.AccountNo IS NULL THEN NULL ELSE
           NULLIF(CONCAT_WS(N', ',
             CASE WHEN NOT (ks.S = ks.C OR (LEN(ct.Street) >= 24 AND ks.S LIKE ks.C + N'%')) THEN N'street' END,
             CASE WHEN NOT (kc.S = kc.C OR (LEN(ct.City)   >= 14 AND kc.S LIKE kc.C + N'%')) THEN N'city' END,
             CASE WHEN ISNULL(UPPER(LTRIM(RTRIM(a.State))), N'') <> ISNULL(UPPER(ct.State), N'') THEN N'state' END,
             CASE WHEN kz.S <> kz.C THEN N'ZIP' END), N'') END AS Differences
) cmp
CROSS APPLY (
    SELECT CASE WHEN a.AddressId IS NULL THEN NULL ELSE NULLIF(CONCAT_WS(N' · ',
             CASE WHEN NULLIF(LTRIM(RTRIM(a.Address2)), '') IS NOT NULL THEN N'line 2 not kept' END,
             CASE WHEN LEN(a.Address1) > 25 THEN N'street over 25' END,
             CASE WHEN LEN(a.City) > 15 THEN N'city over 15' END,
             CASE WHEN LEN(a.City) + LEN(a.Zip) + 5 > 25 THEN N'"City, ST ZIP" over 25' END,
             CASE WHEN UPPER(ISNULL(LTRIM(RTRIM(a.Country)), '')) NOT IN ('', 'US', 'USA', 'UNITED STATES', 'CA', 'CAN', 'CANADA')
                  THEN N'country not supported' END,
             CASE WHEN a.Zip NOT LIKE '[0-9][0-9][0-9][0-9][0-9]'
                   AND a.Zip NOT LIKE '[0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]'
                   AND UPPER(a.Zip) NOT LIKE '[A-Z][0-9][A-Z]%[0-9][A-Z][0-9]' THEN N'ZIP format' END), N'') END AS FitIssues
) fit

UNION ALL
/* 2. active shipping addresses with no ship-to number */
SELECT m.AccountNumber, m.Company, NULL, NULL, NULL, CAST(0 AS bit),
       a.AddressId, a.IsActive, a.AddressTypeName,
       a.Address1, a.Address2, a.City, a.State, a.Zip, a.Country,
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
       'NOT_MAPPED', NULL, NULL
FROM addr a
JOIN mem m ON m.AccountNo = a.AccountNo
WHERE a.IsActive = 1 AND a.IsShipping = 1 AND a.IsBillTo = 0
  AND NOT EXISTS (SELECT 1 FROM map p WHERE p.AccountNo = a.AccountNo AND p.AddressId = a.AddressId)

UNION ALL
/* 3. Computyme ship-tos nothing in SQL maps to */
SELECT m.AccountNumber, m.Company, c.Code, NULL, NULL, CAST(CASE WHEN c.Code = N'00' THEN 1 ELSE 0 END AS bit),
       NULL, NULL, NULL,
       NULL, NULL, NULL, NULL, NULL, NULL,
       c.SourceName, c.ComputymeKey, c.Name, c.Street, c.Street2, c.City, c.State, c.Zip, c.Zone,
       CASE WHEN c.Code = N'00' THEN 'NO_SQL_DEFAULT' ELSE 'ONLY_IN_COMPUTYME' END, NULL, NULL
FROM cty c
JOIN mem m ON m.AccountNo = c.AccountNo
WHERE NOT EXISTS (SELECT 1 FROM map p WHERE p.AccountNo = c.AccountNo AND p.Code = c.Code)
  AND (c.Code <> N'00' OR NULLIF(c.Street, N'') IS NOT NULL);
GO

/* ------------------------------------------------ Member Desk › Locations */
CREATE OR ALTER PROCEDURE piv2.MemberShipTo_Compare
    @AccountNumber varchar(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT m.Available AS MirrorAvailable, m.Source AS MirrorSource, m.ShipTos AS MirrorShipTos FROM piv2.vComputymeShipToMirror m;

    SELECT * FROM piv2.fnMemberShipToCompare(@AccountNumber)
    ORDER BY CASE WHEN Code IS NULL THEN 1 ELSE 0 END, Code, AddressId;
END
GO

/* ------------------------------------------------ every member: what needs looking at */
CREATE OR ALTER PROCEDURE piv2.MemberShipTo_Issues
AS
BEGIN
    SET NOCOUNT ON;
    SELECT m.Available AS MirrorAvailable, m.Source AS MirrorSource, m.ShipTos AS MirrorShipTos FROM piv2.vComputymeShipToMirror m;

    SELECT * INTO #c FROM piv2.fnMemberShipToCompare(NULL);

    SELECT Status, COUNT(*) AS ShipTos, COUNT(DISTINCT AccountNumber) AS Members
    FROM #c GROUP BY Status
    UNION ALL
    SELECT 'WONT_FIT', COUNT(*), COUNT(DISTINCT AccountNumber) FROM #c WHERE FitIssues IS NOT NULL
    ORDER BY Status;

    SELECT * FROM #c
    WHERE Status <> 'MATCH' OR FitIssues IS NOT NULL
    ORDER BY TRY_CAST(AccountNumber AS int), CASE WHEN Code IS NULL THEN 1 ELSE 0 END, Code, AddressId;
END
GO

/* ------------------------------------------------ cutover map: ship-tos are their own section (insert-only) */
IF OBJECT_ID('piv2.CutoverSection', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM piv2.CutoverSection WHERE SectionKey = 'members.shipto')
    INSERT piv2.CutoverSection (SectionKey, Area, Name, Owner, Summary, ComputymeSource, SqlObjects, B2BReads, PivScreen, NextStep, SortOrder, UpdatedBy)
    VALUES ('members.shipto', N'Members', N'Member ship-to addresses', 'MIXED',
            N'Addresses are SQL''s; Computyme keeps its own copy and ships to that. The order file sends only account-code, so the two must match until Computyme ships to the address on the order.',
            N'ARMST attrs 31-32 (00), SHIPTO member*code (01+), AR.SHIP.MNT, AR20', N'dbo.Address, dbo.AddressShipToMap',
            N'Checkout ship-to list; order export (account-code)', N'Member Desk › Locations',
            N'Mirror SHIPTO, fix mismatches, then Computyme ships to the address on the order: SQL becomes master.', 195, N'seed');
GO

PRINT 'Member ship-tos 01 ready: compare SQL ship-tos with Computyme (read only).';
GO
