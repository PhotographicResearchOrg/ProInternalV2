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

namespace ProInternal.Controllers
{
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
                await using (var stream = new FileStream(dest, FileMode.Create, FileAccess.Write,
                    FileShare.None, bufferSize: 1 << 16, FileOptions.Asynchronous))
                {
                    await file.CopyToAsync(stream, ct);
                }
                sw.Stop();

                _logger.LogInformation("Upload {Dest} ({Bytes} bytes) in {Elapsed:0.000}s",
                    dest, file.Length, sw.Elapsed.TotalSeconds);

                saved.Add(Path.GetFileName(dest));
            }

            return Ok(new { uploaded = saved });
        }
    }
}