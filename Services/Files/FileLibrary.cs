using Amazon.S3;
using Amazon.S3.Model;
using Dapper;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers;
using ProInternal.Models.Integration;
using System;
using System.Data;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace ProInternal.Services.Files
{
    public interface IFileLibrary
    {
        /* Stores the file unchanged, or returns the existing entry when this owner already has the same content. */
        Task<FileLibraryEntry> StoreAsync(
            Stream content, string category, string ownerKey, string fileName,
            string contentType, string uploadedBy, string? notes = null);

        Task<FileLibraryEntry?> GetAsync(long fileId);

        Task<Stream> OpenAsync(long fileId);

        /* A link valid for a few minutes, for the browser to download from S3 directly. */
        Task<string?> DownloadUrlAsync(long fileId, TimeSpan validFor);

        Task<FileLibraryEntry[]> ListAsync(string category, string? ownerKey, int take = 100);
    }

    /*
     * Every file PRO keeps goes to S3 under
     *   {category}/{owner}/{yyyy}/{MM}/{guid}-{file name}
     * in the bucket named by FileLibrary:Bucket, with a row in
     * PIV2_FileLibrary. The SHA-256 of the content is the duplicate check:
     * the same vendor sheet uploaded twice is stored once.
     */
    public sealed class FileLibrary : BaseDataAccess, IFileLibrary
    {
        private static readonly Regex UnsafeCharacters = new(@"[^A-Za-z0-9._-]+", RegexOptions.Compiled);

        private readonly IAmazonS3 _s3;
        private readonly string? _bucket;

        public FileLibrary(IConfiguration config, AwsSecretHelper helper, IAmazonS3 s3)
            : base(config, helper, "ProConnectionString")
        {
            _s3 = s3;
            _bucket = config["FileLibrary:Bucket"];
        }

        public async Task<FileLibraryEntry> StoreAsync(
            Stream content, string category, string ownerKey, string fileName,
            string contentType, string uploadedBy, string? notes = null)
        {
            if (string.IsNullOrWhiteSpace(_bucket))
                throw new InvalidOperationException("FileLibrary:Bucket is not configured.");
            if (string.IsNullOrWhiteSpace(uploadedBy))
                throw new ArgumentException("uploadedBy is required: pass the signed-in user.", nameof(uploadedBy));

            /* Buffer once: the hash decides whether to upload at all. */
            await using var buffer = new MemoryStream();
            await content.CopyToAsync(buffer);
            if (buffer.Length == 0)
                throw new InvalidOperationException("The file is empty.");

            buffer.Position = 0;
            var sha256 = Convert.ToHexString(await SHA256.HashDataAsync(buffer)).ToLowerInvariant();

            using var conn = GetConnection();

            var existing = await conn.QuerySingleOrDefaultAsync<FileLibraryEntry>(
                "dbo.PIV2_FileLibrary_FindDuplicate",
                new { Category = category, OwnerKey = ownerKey, Sha256 = sha256 },
                commandType: CommandType.StoredProcedure);

            if (existing != null)
            {
                existing.IsDuplicate = true;
                return existing;
            }

            var now = DateTime.UtcNow;
            var key = string.Join("/",
                Segment(category), Segment(ownerKey), now.ToString("yyyy"), now.ToString("MM"),
                $"{Guid.NewGuid():N}-{Segment(Path.GetFileName(fileName))}");

            buffer.Position = 0;
            await _s3.PutObjectAsync(new PutObjectRequest
            {
                BucketName = _bucket,
                Key = key,
                InputStream = buffer,
                ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
                ServerSideEncryptionMethod = ServerSideEncryptionMethod.AES256,
                AutoCloseStream = false
            });

            try
            {
                return await conn.QuerySingleAsync<FileLibraryEntry>(
                    "dbo.PIV2_FileLibrary_Add",
                    new
                    {
                        Category = category,
                        OwnerKey = ownerKey,
                        FileName = Path.GetFileName(fileName),
                        ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
                        SizeBytes = buffer.Length,
                        Sha256 = sha256,
                        Bucket = _bucket,
                        S3Key = key,
                        UploadedBy = uploadedBy,
                        Notes = notes
                    },
                    commandType: CommandType.StoredProcedure);
            }
            catch
            {
                /* No orphan objects: the row failed, so the file goes too. */
                await _s3.DeleteObjectAsync(_bucket, key);
                throw;
            }
        }

        public async Task<FileLibraryEntry?> GetAsync(long fileId)
        {
            using var conn = GetConnection();
            return await conn.QuerySingleOrDefaultAsync<FileLibraryEntry>(
                "dbo.PIV2_FileLibrary_Get",
                new { FileId = fileId },
                commandType: CommandType.StoredProcedure);
        }

        public async Task<Stream> OpenAsync(long fileId)
        {
            var entry = await GetAsync(fileId)
                ?? throw new FileNotFoundException($"File {fileId} is not in the library.");

            var response = await _s3.GetObjectAsync(entry.Bucket, entry.S3Key);
            var copy = new MemoryStream();
            await response.ResponseStream.CopyToAsync(copy);
            copy.Position = 0;
            return copy;
        }

        public async Task<string?> DownloadUrlAsync(long fileId, TimeSpan validFor)
        {
            var entry = await GetAsync(fileId);
            if (entry == null)
                return null;

            return _s3.GetPreSignedURL(new GetPreSignedUrlRequest
            {
                BucketName = entry.Bucket,
                Key = entry.S3Key,
                Expires = DateTime.UtcNow.Add(validFor),
                ResponseHeaderOverrides = { ContentDisposition = $"attachment; filename=\"{Segment(entry.FileName)}\"" }
            });
        }

        public async Task<FileLibraryEntry[]> ListAsync(string category, string? ownerKey, int take = 100)
        {
            using var conn = GetConnection();
            var rows = await conn.QueryAsync<FileLibraryEntry>(
                "dbo.PIV2_FileLibrary_List",
                new { Category = category, OwnerKey = ownerKey, Take = take },
                commandType: CommandType.StoredProcedure);
            return rows.ToArray();
        }

        private static string Segment(string value)
        {
            var cleaned = UnsafeCharacters.Replace(value ?? "", "-").Trim('-');
            return string.IsNullOrEmpty(cleaned) ? "file" : cleaned[..Math.Min(cleaned.Length, 120)];
        }
    }
}
