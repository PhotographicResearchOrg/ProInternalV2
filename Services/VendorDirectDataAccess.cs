using Dapper;
using Microsoft.Extensions.Configuration;
using ProInternal.Helpers;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace ProInternal.Services.OrderIntegration.Adapters.Outbound.VendorDirect;

/* ------------------------------------------------------------------
 * Everything direct vendor ship reads and saves on its own: vendor
 * and brand settings, the Direct Vendor Ship tab, and which side each
 * order line is on.
 *
 * It is its own class, created where it is used, so nothing has to be
 * added to an existing interface or to the service registrations.
 * ------------------------------------------------------------------ */
public interface IVendorDirectDataAccess
{
    VendorDirectSettings? GetVendorDirectSettings(int vendorId);
    Task<List<VendorDirectOrderRow>> GetVendorDirectOrdersAsync(int days, CancellationToken cancellationToken);
    Task<List<OrderLineSide>> GetOrderLineSidesAsync(int orderId, CancellationToken cancellationToken);
    Task<List<VendorDirectVendor>> GetVendorDirectVendorsAsync(CancellationToken cancellationToken);
    Task<VendorDirectVendor?> GetVendorDirectVendorAsync(int vendorId, CancellationToken cancellationToken);
    Task<bool> SaveVendorDirectVendorAsync(VendorDirectVendor vendor, CancellationToken cancellationToken);
    Task<List<VendorDirectBrand>> GetVendorDirectBrandsAsync(CancellationToken cancellationToken);
    Task<bool> SaveVendorDirectBrandAsync(VendorDirectBrand brand, CancellationToken cancellationToken);
    Task<List<VendorDirectName>> GetVendorNamesAsync(CancellationToken cancellationToken);
}

public class VendorDirectDataAccess : BaseDataAccess, IVendorDirectDataAccess
{
    public VendorDirectDataAccess(IConfiguration config, AwsSecretHelper helper)
        : base(config, helper, "ProConnectionString")
    {
    }

    /* One vendor's direct ship settings. Null when the vendor does not exist. */
    public VendorDirectSettings? GetVendorDirectSettings(int vendorId)
    {
        using var conn = GetConnection();

        return conn.QueryFirstOrDefault<VendorDirectSettings>(
            @"SELECT VendorId,
                     Name,
                     CAST(ISNULL(DvsEnabled, 0) AS bit) AS Enabled,
                     DvsMethod      AS Method,
                     DvsEmailTo     AS EmailTo,
                     DvsEmailCc     AS EmailCc,
                     DvsDestination AS Destination,
                     DvsPassword    AS Password,
                     DvsCostBase    AS CostBase,
                     DvsCostPercent AS CostPercent
              FROM dbo.Vendor
              WHERE VendorId = @VendorId",
            new { VendorId = vendorId });
    }

        /* Each open order's vendor sides, with how far each side has got. */
    public async Task<List<VendorDirectOrderRow>> GetVendorDirectOrdersAsync(
        int days, CancellationToken cancellationToken)
    {
        using var conn = GetConnection();

        var rows = await conn.QueryAsync<VendorDirectOrderRow>(new CommandDefinition(
            "dbo.PIV2_Orders_GetVendorDirect",
            new { Days = days },
            commandType: CommandType.StoredProcedure,
            cancellationToken: cancellationToken));

        return rows.ToList();
    }

    /* Which side each line of one order belongs to. */
    public async Task<List<OrderLineSide>> GetOrderLineSidesAsync(
        int orderId, CancellationToken cancellationToken)
    {
        using var conn = GetConnection();

        var rows = await conn.QueryAsync<OrderLineSide>(new CommandDefinition(
            @"SELECT d.OrderItemId,
                     d.Destination,
                     d.IsDirectVendorShip,
                     d.OrderItemStatusId,
                     d.VendorId,
                     v.Name AS VendorName
              FROM dbo.PIV2_OrderLineDestination(@OrderId) d
              LEFT JOIN dbo.Vendor v
                     ON v.VendorId = d.VendorId
                    AND d.IsDirectVendorShip = 1",
            new { OrderId = orderId },
            cancellationToken: cancellationToken));

        return rows.ToList();
    }

    /* Every vendor, with its direct ship settings. The password is never read out. */
    public async Task<List<VendorDirectVendor>> GetVendorDirectVendorsAsync(
        CancellationToken cancellationToken)
    {
        using var conn = GetConnection();

        var rows = await conn.QueryAsync<VendorDirectVendor>(new CommandDefinition(
            @"SELECT v.VendorId,
                     v.Name,
                     CAST(ISNULL(v.DvsEnabled, 0) AS bit) AS Enabled,
                     v.DvsMethod      AS Method,
                     v.DvsEmailTo     AS EmailTo,
                     v.DvsEmailCc     AS EmailCc,
                     v.DvsDestination AS Destination,
                     CAST(CASE WHEN NULLIF(v.DvsPassword, '') IS NULL THEN 0 ELSE 1 END AS bit) AS HasPassword,
                     v.DvsCostBase    AS CostBase,
                     v.DvsCostPercent AS CostPercent,
                     (SELECT STRING_AGG(CAST(b.BrandName AS varchar(max)), ', ')
                        FROM dbo.Brand b
                       WHERE b.VendorID = v.VendorId) AS Brands
              FROM dbo.Vendor v
              ORDER BY v.Name, v.VendorId",
            cancellationToken: cancellationToken));

        return rows.ToList();
    }

    /* Saves one vendor's settings. An empty password keeps the stored one. */
    public async Task<bool> SaveVendorDirectVendorAsync(
        VendorDirectVendor vendor, CancellationToken cancellationToken)
    {
        using var conn = GetConnection();

        var changed = await conn.ExecuteAsync(new CommandDefinition(
            @"UPDATE dbo.Vendor
              SET DvsEnabled     = @Enabled,
                  DvsMethod      = NULLIF(UPPER(LTRIM(RTRIM(@Method))), ''),
                  DvsEmailTo     = NULLIF(LTRIM(RTRIM(@EmailTo)), ''),
                  DvsEmailCc     = NULLIF(LTRIM(RTRIM(@EmailCc)), ''),
                  DvsDestination = NULLIF(LTRIM(RTRIM(@Destination)), ''),
                  DvsPassword    = CASE WHEN NULLIF(@Password, '') IS NULL
                                        THEN DvsPassword ELSE @Password END,
                  DvsCostBase    = NULLIF(UPPER(LTRIM(RTRIM(@CostBase))), ''),
                  DvsCostPercent = @CostPercent
              WHERE VendorId = @VendorId",
            new
            {
                vendor.VendorId,
                vendor.Enabled,
                vendor.Method,
                vendor.EmailTo,
                vendor.EmailCc,
                vendor.Destination,
                vendor.Password,
                vendor.CostBase,
                vendor.CostPercent
            },
            cancellationToken: cancellationToken));

        return changed > 0;
    }

    public async Task<List<VendorDirectBrand>> GetVendorDirectBrandsAsync(
        CancellationToken cancellationToken)
    {
        using var conn = GetConnection();

        var rows = await conn.QueryAsync<VendorDirectBrand>(new CommandDefinition(
            @"SELECT b.BrandId,
                     b.BrandName,
                     b.VendorID AS VendorId,
                     v.Name     AS VendorName,
                     CAST(ISNULL(b.DvsAllItems, 0) AS bit) AS AllItems,
                     CONVERT(varchar(10), b.WH) AS Wh
              FROM dbo.Brand b
              LEFT JOIN dbo.Vendor v
                     ON v.VendorId = b.VendorID
              ORDER BY b.BrandName, b.BrandId",
            cancellationToken: cancellationToken));

        return rows.ToList();
    }

    /* Saves which vendor a brand belongs to, and whether all of it ships direct. */
    public async Task<bool> SaveVendorDirectBrandAsync(
        VendorDirectBrand brand, CancellationToken cancellationToken)
    {
        using var conn = GetConnection();

        var changed = await conn.ExecuteAsync(new CommandDefinition(
            @"UPDATE dbo.Brand
              SET VendorID    = @VendorId,
                  DvsAllItems = @AllItems
              WHERE BrandId = @BrandId
                AND (@VendorId IS NULL
                     OR EXISTS (SELECT 1 FROM dbo.Vendor v WHERE v.VendorId = @VendorId))",
            new { brand.BrandId, brand.VendorId, brand.AllItems },
            cancellationToken: cancellationToken));

        return changed > 0;
    }

    /* One vendor's settings, for the vendor's own screen. */
    public async Task<VendorDirectVendor?> GetVendorDirectVendorAsync(
        int vendorId, CancellationToken cancellationToken)
    {
        var all = await GetVendorDirectVendorsAsync(cancellationToken);

        return all.FirstOrDefault(vendor => vendor.VendorId == vendorId);
    }

    /* Names of the vendors that are set up, so "VENDOR-8009" can be shown as a name. */
    public async Task<List<VendorDirectName>> GetVendorNamesAsync(CancellationToken cancellationToken)
    {
        using var conn = GetConnection();

        var rows = await conn.QueryAsync<VendorDirectName>(new CommandDefinition(
            @"SELECT CONCAT('VENDOR-', v.VendorId) AS Destination,
                     v.Name
              FROM dbo.Vendor v
              WHERE v.DvsMethod IS NOT NULL
                 OR EXISTS (SELECT 1 FROM dbo.Brand b WHERE b.VendorID = v.VendorId)",
            cancellationToken: cancellationToken));

        return rows.ToList();
    }
}

public sealed class VendorDirectName
{
    public string Destination { get; set; } = string.Empty;
    public string? Name { get; set; }
}
