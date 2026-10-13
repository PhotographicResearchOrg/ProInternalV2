using System.Net;
using System.Net.Mail;

namespace ProInternal.Services.OrderIntegration.Adapters.Outbound.Delivery;

/*
 * How a finished file leaves PRO. One place for every outbound adapter:
 *
 *   EMAIL   the file as an attachment, using the app's Email settings
 *   FOLDER  written to a folder or share (the EDI pickup folder)
 *   FTP     uploaded to ftp://user@host/path
 *   SFTP    not installed yet (needs the SSH.NET package)
 *
 * Every method throws on failure. Nothing here records anything;
 * the caller owns the outbox.
 */
public static class FileDelivery
{
    public static async Task SendEmailAsync(
        IConfiguration config,
        string? to,
        string? cc,
        string subject,
        string body,
        string fileName,
        byte[] content,
        CancellationToken cancellationToken)
    {
        var from =
            config["OrderIntegration:VendorDirect:EmailFrom"]
            ?? config["Email:GmailUser"]
            ?? "noreply@promaster.com";

        using var message = new MailMessage
        {
            From = new MailAddress(from, "PRO Orders"),
            Subject = subject,
            Body = body,
            IsBodyHtml = false
        };

        foreach (var address in SplitAddresses(to))
            message.To.Add(address);

        foreach (var address in SplitAddresses(cc))
            message.CC.Add(address);

        if (message.To.Count == 0 && message.CC.Count == 0)
            throw new InvalidOperationException("No email address is set up to receive this file.");

        /* A copy-only send still needs someone on the To line. */
        if (message.To.Count == 0)
        {
            foreach (var address in message.CC.ToList())
                message.To.Add(address);

            message.CC.Clear();
        }

        using var stream = new MemoryStream(content);
        message.Attachments.Add(new Attachment(stream, fileName, "text/csv"));

        using var smtp = new SmtpClient(
            config["Email:SmtpHost"],
            config.GetValue<int>("Email:SmtpPort"))
        {
            EnableSsl = config.GetValue<bool>("Email:UseSsl"),
            Credentials = new NetworkCredential(
                config["Email:GmailUser"],
                config["Email:GmailAppPassword"])
        };

        await smtp.SendMailAsync(message, cancellationToken);
    }

    /* Written under a temporary name first, so a reader never sees half a file. */
    public static async Task WriteToFolderAsync(
        string? folder,
        string fileName,
        byte[] content,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(folder))
            throw new InvalidOperationException("No folder is set up to receive this file.");

        var target = Path.Combine(folder.Trim(), fileName);
        var temporary = target + "." + Guid.NewGuid().ToString("N") + ".tmp";

        try
        {
            await File.WriteAllBytesAsync(temporary, content, cancellationToken);
            File.Move(temporary, target, overwrite: true);
        }
        finally
        {
            if (File.Exists(temporary))
            {
                try { File.Delete(temporary); }
                catch { /* Leave failed temporary cleanup to maintenance. */ }
            }
        }
    }

    /* destination: ftp://user@host/path  (the password is kept separately). */
    public static async Task UploadFtpAsync(
        string? destination,
        string? password,
        string fileName,
        byte[] content,
        CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(destination?.Trim(), UriKind.Absolute, out var uri) ||
            !string.Equals(uri.Scheme, "ftp", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "The FTP destination must look like ftp://user@host/path.");
        }

        var user = Uri.UnescapeDataString(uri.UserInfo.Split(':')[0]);

        var target = new UriBuilder(uri)
        {
            UserName = string.Empty,
            Password = string.Empty,
            Path = uri.AbsolutePath.TrimEnd('/') + "/" + Uri.EscapeDataString(fileName)
        }.Uri;

#pragma warning disable SYSLIB0014 // FtpWebRequest: no built-in replacement.
        var request = (FtpWebRequest)WebRequest.Create(target);
#pragma warning restore SYSLIB0014

        request.Method = WebRequestMethods.Ftp.UploadFile;
        request.Credentials = new NetworkCredential(user, password ?? string.Empty);
        request.UseBinary = true;
        request.KeepAlive = false;

        using (cancellationToken.Register(request.Abort))
        {
            await using (var upload = await request.GetRequestStreamAsync())
            {
                await upload.WriteAsync(content, cancellationToken);
            }

            using var response = (FtpWebResponse)await request.GetResponseAsync();
        }
    }

    public static Task UploadSftpAsync(
        string? destination,
        string? password,
        string fileName,
        byte[] content,
        CancellationToken cancellationToken)
    {
        throw new InvalidOperationException(
            "SFTP delivery is not installed yet. It needs the SSH.NET package.");
    }

    private static IEnumerable<string> SplitAddresses(string? addresses)
    {
        return (addresses ?? string.Empty)
            .Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(address => address.Trim())
            .Where(address => address.Length > 0);
    }
}
