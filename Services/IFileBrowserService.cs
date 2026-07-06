using System.Collections.Generic;
using ProInternal.Models.Files;

namespace ProInternal.Services
{
    public interface IFileBrowserService
    {
        IReadOnlyList<FileSystemEntry> ListFolder(string relativePath);

        // returns safe absolute path for PhysicalFile(..), + metadata.
        (string FullPath, string ContentType, string FileName) ResolveForDownload(string relativePath);

        //returns safe absolute destination path for upload.
        string ResolveForUpload(string relativeFolder, string fileName);

        (long totalBytes, long FileCount) GetFolderSize(string relativePath);
    }
}