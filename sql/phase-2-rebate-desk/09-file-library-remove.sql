/*
    Phase 2 · 09  File library: remove (archive) a file
    Database: PRO      Safe to run twice.      Run after phase 1.

    Vendor contracts and price lists now live in the shared S3 file
    library (piv2.FileLibrary) instead of a folder on a server. Removing
    one from the vendor card hides it; the object stays in S3 and the row
    keeps who removed it and when. Uploading the same file again brings
    it back.
*/
SET NOCOUNT ON;
GO

IF COL_LENGTH('piv2.FileLibrary', 'RemovedAt') IS NULL
    ALTER TABLE piv2.FileLibrary ADD RemovedAt datetime2(0) NULL;
GO
IF COL_LENGTH('piv2.FileLibrary', 'RemovedBy') IS NULL
    ALTER TABLE piv2.FileLibrary ADD RemovedBy nvarchar(100) NULL;
GO

/* Lists files still in use (removed ones only when asked). */
CREATE OR ALTER PROCEDURE piv2.FileLibrary_List
    @Category       varchar(40),
    @OwnerKey       nvarchar(100) = NULL,
    @Take           int = 100,
    @IncludeRemoved bit = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (CASE WHEN @Take BETWEEN 1 AND 500 THEN @Take ELSE 100 END)
           FileId, Category, OwnerKey, FileName, ContentType, SizeBytes, Sha256, Bucket, S3Key,
           UploadedBy, UploadedAt, Notes, RemovedAt, RemovedBy
      FROM piv2.FileLibrary
     WHERE Category = @Category AND (@OwnerKey IS NULL OR OwnerKey = @OwnerKey)
       AND (@IncludeRemoved = 1 OR RemovedAt IS NULL)
     ORDER BY UploadedAt DESC, FileId DESC;
END
GO

CREATE OR ALTER PROCEDURE piv2.FileLibrary_Remove
    @FileId    bigint,
    @RemovedBy nvarchar(100)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE piv2.FileLibrary SET RemovedAt = SYSUTCDATETIME(), RemovedBy = @RemovedBy
     WHERE FileId = @FileId AND RemovedAt IS NULL;
    SELECT @@ROWCOUNT AS Removed;
END
GO

CREATE OR ALTER PROCEDURE piv2.FileLibrary_Restore
    @FileId bigint
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE piv2.FileLibrary SET RemovedAt = NULL, RemovedBy = NULL
     WHERE FileId = @FileId AND RemovedAt IS NOT NULL;
END
GO

SELECT 'file library remove ready' AS Result;
