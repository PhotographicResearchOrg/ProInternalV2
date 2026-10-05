using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using ProInternal.Services;

namespace ProInternal.Tests
{
    public class FileBrowserServiceTests : IDisposable
    {
        private readonly string _root = Path.Combine(Path.GetTempPath(), "ProInternalTests", Guid.NewGuid().ToString());
        private readonly MemoryCache _cache = new(new MemoryCacheOptions());
        private readonly FileBrowserService _service;

        public FileBrowserServiceTests()
        {
            Directory.CreateDirectory(_root);
            _service = new FileBrowserService(Options.Create(new FileStorageOptions { RootPath = _root }), NullLogger<FileBrowserService>.Instance, _cache);
        }

        public void Dispose() => Directory.Delete(_root, true);

        [Fact]
        public void ListFolder_hides_dot_files()
        {
            File.WriteAllText(Path.Combine(_root, "a.txt"), "x");
            File.WriteAllText(Path.Combine(_root, ".DS_Store"), "x");

            Assert.Single(_service.ListFolder(""));
        }

        [Fact]
        public void CreateProductFolder_makes_the_five_subfolders()
        {
            Assert.True(_service.CreateProductFolder("", "AB123"));
            Assert.Equal(5, Directory.GetDirectories(Path.Combine(_root, "AB123")).Length);
        }

        [Fact]
        public void CreateProductFolder_says_no_the_second_time()
        {
            _service.CreateProductFolder("", "AB123");

            Assert.False(_service.CreateProductFolder("", "AB123"));
        }

        [Fact]
        public void CreateProductFolder_rejects_bad_characters()
        {
            Assert.Throws<ArgumentException>(() => _service.CreateProductFolder("", "AB:123"));
        }

        [Fact]
        public void Search_matches_part_of_the_name_any_case()
        {
            _cache.Set("folderindex", new List<string> { "Pictures", @"sub\pi-hole", "docs" });

            Assert.Equal(2, _service.SearchFolders("PI").Count);
        }

        [Fact]
        public void Search_finds_nested_folders()
        {
            Directory.CreateDirectory(Path.Combine(_root, "brands", "nikon", "lenses"));

            Assert.Equal(@"brands\nikon\lenses", _service.SearchFolders("lens")[0].RelativePath);
        }
    }
}