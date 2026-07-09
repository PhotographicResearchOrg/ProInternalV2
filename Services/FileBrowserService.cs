using Amazon.Runtime.Internal.Util;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ProInternal.Helpers;
using ProInternal.Models.Files;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Services
{
    public class FileBrowserService : IFileBrowserService
    {
        private readonly string _root;
        private readonly ILogger<FileBrowserService> _logger;
        private readonly IMemoryCache _cache;

        public FileBrowserService(IOptions<FileStorageOptions> options, ILogger<FileBrowserService> logger, IMemoryCache cache)
        {
            _root = options.Value.RootPath;
            _logger = logger;
            _cache = cache;
        }

        public IReadOnlyList<FileSystemEntry> ListFolder(string relativePath)
        {
            var full = SafePath.Resolve(_root, relativePath);
            var sw = Stopwatch.StartNew();

            var dir = new DirectoryInfo(full);
            if (!dir.Exists) throw new DirectoryNotFoundException(relativePath ?? "");

            var entries = dir.EnumerateFileSystemInfos()
                .Select(fsi => new FileSystemEntry
                {
                    Name = fsi.Name,
                    RelativePath = Path.Combine(relativePath ?? "", fsi.Name),
                    IsFolder = (fsi.Attributes & FileAttributes.Directory) == FileAttributes.Directory,
                    SizeBytes = fsi is FileInfo fi ? fi.Length : 0,
                    ModifiedUtc = fsi.LastWriteTimeUtc
                })
                .OrderByDescending(e => e.IsFolder)
                .ThenBy(e => e.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            sw.Stop();
            _logger.LogInformation("Browse {Path} -> {Count} items, share-read {Elapsed:0.000}s",
                relativePath, entries.Count, sw.Elapsed.TotalSeconds);

            return entries;
        }

        public (string FullPath, string ContentType, string FileName) ResolveForDownload(string relativePath)
        {
            var full = SafePath.Resolve(_root, relativePath);
            if (!File.Exists(full)) throw new FileNotFoundException(relativePath);
            var name = Path.GetFileName(full);
            return (full, MimeTypes.GetMimeType(full), name);
        }

        public string ResolveForUpload(string relativeFolder, string fileName)
        {
            var safeName = Path.GetFileName(fileName);
            var folderFull = SafePath.Resolve(_root, relativeFolder);
            Directory.CreateDirectory(folderFull);
            return SafePath.Resolve(_root, Path.Combine(relativeFolder ?? "", safeName));
        }

        public (long TotalBytes, long FileCount) GetFolderSize(string relativePath)
        {
            relativePath ??= "";
            var cacheKey = $"foldersize::{relativePath.ToLowerInvariant()}";
            if (_cache.TryGetValue(cacheKey, out (long TotalBytes, long FileCount) hit))
                return hit;

            var full = SafePath.Resolve(_root, relativePath);
            if (!Directory.Exists(full)) throw new DirectoryNotFoundException(relativePath);

            var sw = Stopwatch.StartNew();
            long total = 0, count = 0;

            foreach (var fi in new DirectoryInfo(full).EnumerateFiles())
            {
                total += fi.Length;
                count++;
            }

            Parallel.ForEach(
                Directory.EnumerateDirectories(full),
                new ParallelOptions { MaxDegreeOfParallelism = 8 },
                dir =>
                {
                    long lt = 0, lc = 0;
                    try
                    {
                        foreach (var fi in new DirectoryInfo(dir).EnumerateFiles("*", SearchOption.AllDirectories))
                        {
                            lt += fi.Length;
                            lc++;
                        }
                    }
                    catch (UnauthorizedAccessException) { /* skip protected subtrees */ }
                    catch (DirectoryNotFoundException) { /* skip vanished dirs      */ }

                    Interlocked.Add(ref total, lt);
                    Interlocked.Add(ref count, lc);
                });

            sw.Stop();
            _logger.LogInformation("Size {Path} -> {Bytes} bytes, {Count} files, share-read {Elapsed:0.000}s",
                relativePath, total, count, sw.Elapsed.TotalSeconds);

            var result = (total, count);
            _cache.Set(cacheKey, result, TimeSpan.FromMinutes(10));
            return result;
        }
    }
}