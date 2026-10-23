/* ---------------------------------------------------------------
    MAP violations · 02  Which tables do the two MAP screens use?  (READ ONLY)

    Database: PRO      Changes nothing.

    MAP violations desk (old dashboard API):  InsertAndGetMapViolations, PIV2MapViolations_GetAll
    Member Desk › MAP tab:                     PIV2_MapViolation_Add, PIV2_MapViolation_End, PIV2_Member_Get

    Paste back the three result sets.
   --------------------------------------------------------------- */

USE PRO;
GO
SET NOCOUNT ON;

DECLARE @procs TABLE (name sysname, screen varchar(20));
INSERT @procs VALUES
 ('InsertAndGetMapViolations', 'MAP desk'), ('PIV2MapViolations_GetAll', 'MAP desk'),
 ('PIV2_MapViolation_Add', 'Member Desk'), ('PIV2_MapViolation_End', 'Member Desk'), ('PIV2_Member_Get', 'Member Desk');

/* 1. every table each procedure reads or writes */
SELECT p.screen, p.name AS procedure_name,
       ISNULL(d.referenced_schema_name, 'dbo') + '.' + d.referenced_entity_name AS table_or_view,
       o.type_desc
FROM @procs p
LEFT JOIN sys.sql_expression_dependencies d ON d.referencing_id = OBJECT_ID('dbo.' + p.name)
LEFT JOIN sys.objects o ON o.object_id = d.referenced_id
WHERE d.referenced_entity_name LIKE '%MAP%' OR d.referenced_entity_name LIKE '%Violation%' OR d.referenced_entity_name IS NULL
ORDER BY p.screen, p.name, table_or_view;

/* 2. every table with MAP or Violation in its name, with row counts */
SELECT s.name + '.' + t.name AS table_name, SUM(pt.rows) AS rows_
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.partitions pt ON pt.object_id = t.object_id AND pt.index_id IN (0, 1)
WHERE t.name LIKE '%MapViolation%' OR t.name LIKE '%Map_Violation%' OR t.name LIKE '%Violation%'
GROUP BY s.name, t.name
ORDER BY table_name;

/* 3. the procedure definitions (first 4000 characters each) */
SELECT p.name AS procedure_name, LEFT(OBJECT_DEFINITION(OBJECT_ID('dbo.' + p.name)), 4000) AS definition
FROM @procs p
WHERE p.name <> 'PIV2_Member_Get';
GO
