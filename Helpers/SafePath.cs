using System;
using System.IO;

namespace ProInternal.Helpers
{
    public static class SafePath
    {
        public static string Resolve(string root, string? relativePath)
        {
            var fullRoot = Path.GetFullPath(root);
            if (!fullRoot.EndsWith(Path.DirectorySeparatorChar))
                fullRoot += Path.DirectorySeparatorChar;

            relativePath = (relativePath ?? string.Empty)
                .Replace('/', Path.DirectorySeparatorChar)
                .TrimStart(Path.DirectorySeparatorChar);

            var combined = Path.GetFullPath(Path.Combine(fullRoot, relativePath));

            var rootNoSep = fullRoot.TrimEnd(Path.DirectorySeparatorChar);
            var isRootItself = string.Equals(combined, rootNoSep, StringComparison.OrdinalIgnoreCase);
            var isInside = combined.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase);

            if (!isRootItself && !isInside)
                throw new UnauthorizedAccessException("Path escapes the configured root.");

            return combined;
        }
    }
}