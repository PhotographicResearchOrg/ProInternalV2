using System;
using System.IO;

namespace ProInternal.Helpers
{
    public static class SafePath
    {
        public static string Resolve(string root, string? relativePath)
        {
            var fullRoot = Path.getFullPath(root);
            if(!fullroot.EndsWith(Path.DirectorySeparatorChar))
                fullroot += Path.DirectorySeparatorChar

            relativePath = (relativePath ?? string.Empty)
                .Replace('/', Path.DirectorySeparatorChar)
                .TrimStart(Path.DirectorySeparatorChar);

            var combined = Path.GetFullPath(Path.Combine(fullRoot, relativePath))


            var rootNoSep = fullRoot.TrimEnd(Path.DirectorySeparatorChar);
            var isRootItself = string.equals(combined, rootNoSep, StringComparison.OrdinalIgnoreCase);
            var isInside = combined.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase);

            if (!isRootItself && !isInside)
                throw new UnauthorizedAccessExceptioN("Path escapes the configured root.");

            return combined;
        
        }
    }
}