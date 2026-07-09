using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Net.Http.Headers;
using ProInternal.Services;
using Microsoft.AspNetCore.Authorization;

namespace ProInternal.Controllers
{
    [Authorize]
    [ApiController]
    [Route("/[Controller]")]
    public class FilesController : ControllerBase
    {
        private readonly IFileBrowserService _files;
        private readonly ILogger<FilesController> _logger;

        public FilesController(IFileBrowserService files, ILogger<FilesController> logger)
        {
            _files = files;
            _logger = logger; 
        }

        // BROWSE: GET /api/files/list?path=Templates
        [HttpGet("list")]
        public IActionResult List([FromQuery] string? path)
            => Ok(_files.ListFolder(path ?? ""));

        // VIEW In browser GET /api/files/view?path=docs/spec.pdf
        [HttpGet("view")]
        public IActionResult View([FromQuery] string path)
        {
            var (full, contentType, fileName) = _files.ResolveForDownload(path);
            Response.Headers[HeaderNames.ContentDisposition] =
                new ContentDispositionHeaderValue("inline") { FileName = fileName }.ToString();
            return PhysicalFile(full, contentType, enableRangeProcessing: true);
        }
        // DOWNLOAD: GET /api/files/download?path=renders/site-model.zip
        [HttpGet("download")]
        public IActionResult Download([FromQuery] string path)
        {
            var (full, contentType, fileName) = _files.ResolveForDownload(path);
            return PhysicalFile(full, contentType, fileName, enableRangeProcessing: true);
        }

        // UPLOAD: POST /api/files/upload?path=Templates   (multipart/form-data, field name "file")
        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(5_368_709_120)] // 5 GB;
        public async Task<IActionResult> Upload(
            [FromQuery] string? path,
            [FromForm] List<IFormFile> files,
            CancellationToken ct)
        {
            if (files == null || files.Count == 0)
                return BadRequest("No files uploaded.");

            var saved = new List<string>();
            foreach (var file in files)
            {
                var dest = _files.ResolveForUpload(path ?? "", file.FileName);

                var sw = Stopwatch.StartNew();
                var buffer = new byte[1 << 20]; // 1 MB
                await using (var target = new FileStream(dest, FileMode.Create, FileAccess.Write,
                    FileShare.None, bufferSize: 1 << 20, FileOptions.Asynchronous | FileOptions.SequentialScan))
                using (var source = file.OpenReadStream())
                {
                    int read;
                    while ((read = await source.ReadAsync(buffer, 0, buffer.Length, ct)) > 0)
                        await target.WriteAsync(buffer, 0, read, ct);
                }
                sw.Stop();

                _logger.LogInformation("Upload {Dest} ({Bytes} bytes) in {Elapsed:0.000}s",
                    dest, file.Length, sw.Elapsed.TotalSeconds);

                saved.Add(Path.GetFileName(dest));
            }

            return Ok(new { uploaded = saved });
        }
        // GET /api/files/size?path=FORMS
        [HttpGet("size")]
        public IActionResult Size([FromQuery] string? path)
        {
            var (bytes, count) = _files.GetFolderSize(path ?? "");
            return Ok(new { totalBytes = bytes, fileCount = count });
        }

    }
}