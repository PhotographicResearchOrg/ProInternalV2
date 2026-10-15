/*
    Phase 2 · 00  The piv2 schema in PRO_NUKE
    Database: PRO_NUKE (all rebate data lives here)      Safe to run twice.

    The Rebate Desk's own tables (uploads, rows, templates, history) go in
    piv2 next to the rebate tables they load into. Existing dbo objects
    are not moved or changed; the desk writes programs into
    dbo.RebateProgramDetail exactly as the B2B site reads them.

    Set @AppUser to the database user the PIV2 API connects as on
    PRO_NUKE (NukeConnectionString). It needs EXECUTE on piv2.
*/

USE PRO_NUKE;
GO

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
    RAISERROR(N'Database user %s does not exist in PRO_NUKE.', 16, 1, @AppUser);
    RETURN;
END

DECLARE @grant nvarchar(400) = N'GRANT EXECUTE ON SCHEMA::piv2 TO ' + QUOTENAME(@AppUser) + N';';
EXEC (@grant);

SELECT N'schema ready' AS Result, @AppUser AS GrantedTo;
