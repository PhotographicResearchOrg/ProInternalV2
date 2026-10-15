/*
    Phase 1 · 00  The piv2 schema
    Database: PRO      Safe to run twice.      Run before 01 and 02.

    Everything the new platform adds (tables, views, procedures) lives in
    the piv2 schema, apart from the legacy objects in dbo. Existing dbo
    objects are not moved or changed.

    The schema is owned by dbo, so piv2 procedures can read and write
    dbo tables without extra grants (ownership chaining).

    Set @AppUser to the database user the PIV2 API connects as (the
    username in the prod/sql/app-user secret). It needs EXECUTE on the
    schema; it does not need direct access to piv2 tables.
*/

DECLARE @AppUser sysname = N'<app database user>';

IF SCHEMA_ID(N'piv2') IS NULL
    EXEC (N'CREATE SCHEMA piv2 AUTHORIZATION dbo;');

IF @AppUser = N'<app database user>'
BEGIN
    RAISERROR(N'The piv2 schema is ready, but the grant was skipped: set @AppUser at the top of this script to the API''s database user and run it again.', 16, 1);
    RETURN;
END

IF DATABASE_PRINCIPAL_ID(@AppUser) IS NULL
BEGIN
    RAISERROR(N'Database user %s does not exist in this database.', 16, 1, @AppUser);
    RETURN;
END

DECLARE @grant nvarchar(400) = N'GRANT EXECUTE ON SCHEMA::piv2 TO ' + QUOTENAME(@AppUser) + N';';
EXEC (@grant);

SELECT N'schema ready' AS Result, @AppUser AS GrantedTo;
