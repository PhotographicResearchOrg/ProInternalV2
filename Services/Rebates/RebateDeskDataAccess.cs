using Dapper;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace ProInternal.Services.Rebates
{
    /* A result row with camelCase keys; JSON columns arrive as JSON, not as strings. */
    public sealed class RebateRow : Dictionary<string, object?>
    {
        public T? Get<T>(string key)
        {
            if (!TryGetValue(key, out var v) || v == null) return default;
            if (v is T t) return t;
            if (v is JsonElement e) return e.Deserialize<T>();
            return (T)Convert.ChangeType(v, Nullable.GetUnderlyingType(typeof(T)) ?? typeof(T));
        }
    }

    public interface IRebateDeskDataAccess
    {
        Task<List<RebateRow>> QueryAsync(string procedure, object? args = null);
        Task<List<List<RebateRow>>> QuerySetsAsync(string procedure, object? args = null);
        Task ExecuteAsync(string procedure, object? args = null);
    }

    /*
     * The Rebate Desk reads and writes PRO_NUKE (NukeConnectionString) only
     * through the piv2.Rebate_* and piv2.PP_* procedures; every business
     * rule lives there, so this class only passes values through.
     */
    public sealed class RebateDeskDataAccess : BaseDataAccess, IRebateDeskDataAccess
    {
        private static readonly HashSet<string> JsonColumns = new(StringComparer.OrdinalIgnoreCase)
        {
            "Problems", "Detail", "Raw", "Mapping", "Headers"
        };

        public RebateDeskDataAccess(IConfiguration config, AwsSecretHelper helper)
            : base(config, helper, "NukeConnectionString")
        {
        }

        public async Task<List<RebateRow>> QueryAsync(string procedure, object? args = null)
        {
            using var conn = GetConnection();
            var rows = await conn.QueryAsync(procedure, args, commandType: CommandType.StoredProcedure, commandTimeout: 120);
            return rows.Select(Shape).ToList();
        }

        public async Task<List<List<RebateRow>>> QuerySetsAsync(string procedure, object? args = null)
        {
            using var conn = GetConnection();
            using var grid = await conn.QueryMultipleAsync(procedure, args, commandType: CommandType.StoredProcedure, commandTimeout: 120);
            var sets = new List<List<RebateRow>>();
            while (!grid.IsConsumed)
                sets.Add((await grid.ReadAsync()).Select(Shape).ToList());
            return sets;
        }

        public async Task ExecuteAsync(string procedure, object? args = null)
        {
            using var conn = GetConnection();
            await conn.ExecuteAsync(procedure, args, commandType: CommandType.StoredProcedure, commandTimeout: 120);
        }

        private static RebateRow Shape(dynamic row)
        {
            var shaped = new RebateRow();
            foreach (var pair in (IDictionary<string, object?>)row)
            {
                var key = pair.Key.Length == 0 ? pair.Key : char.ToLowerInvariant(pair.Key[0]) + pair.Key[1..];
                var value = pair.Value is DBNull ? null : pair.Value;
                if (value is string s && JsonColumns.Contains(pair.Key) && s.Length > 0)
                {
                    try { value = JsonDocument.Parse(s).RootElement.Clone(); }
                    catch (JsonException) { /* left as text */ }
                }
                shaped[key] = value;
            }
            return shaped;
        }
    }
}
