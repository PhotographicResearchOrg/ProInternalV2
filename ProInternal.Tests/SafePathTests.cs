using System;
using System.Collections.Generic;
using System.Text;
using ProInternal.Helpers;

namespace ProInternal.Tests
{
    public class SafePathTests
    {
        private readonly string _root = Path.Combine(Path.GetTempPath(), "ProInternalTests");

        [Fact]
        public void JoinsRootAndRelativePath()
        {
            var full = SafePath.Resolve(_root, @"hold\images");

            Assert.Equal(Path.Combine(_root, "hold", "images"), full);
        }

        [Fact]

        public void SlashesWork()
        {
            Assert.Equal(SafePath.Resolve(_root, @"hold\images"), SafePath.Resolve(_root, "hold/images"));
        }

        [Fact]
        public void RootClimbRefuse()
        {
            Assert.Throws<UnauthorizedAccessException>(() => SafePath.Resolve(_root, @"..\..\Windows"));
        }

        [Fact]
        public void PathRefusalAbsolute()
        {
            Assert.Throws<UnauthorizedAccessException>(() => SafePath.Resolve(_root, @"C:\Windows"));
        }
    }
}
