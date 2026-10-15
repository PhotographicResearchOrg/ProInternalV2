# Phase 1: shared platform

One outbox and acknowledgement loop for every domain, an Integration desk to watch it, and an S3 file library. Nothing here sends anything yet; each desk that follows adds its own sender.

## What is in it

| Piece | Where |
| --- | --- |
| Tables: destinations, messages, answers, history, file library | `sql/phase-1-platform/01-integration-tables.sql` |
| Procedures: enqueue, claim, mark sent / failed / overdue, apply answer, resend, cancel, desk reads, file library | `sql/phase-1-platform/02-integration-procedures.sql` |
| Answer contract, 3 examples, 14 rejected cases | `Schemas/Integration/v1.0/` (run `python validate.py`) |
| Outbox data access and the in-transaction enqueue helper | `Services/Integration/IntegrationDataAccess.cs` |
| Dispatcher (background, every 30 s) and the `IIntegrationSender` each desk implements | `Services/Integration/IntegrationDispatcher.cs` |
| Answer endpoint `POST api/integration/responses/{destination}` | `Controllers/IntegrationResponseController.cs` |
| Desk API `api/integration/...` | `Controllers/IntegrationController.cs` |
| S3 file library with duplicate detection | `Services/Files/FileLibrary.cs` |
| Integration desk screen, route `/integration` | `ClientApp/src/app/prointernalengine/components/integration/` |
| Import fix: `models/orders` → `models/Orders` (fails on a case-sensitive build server) | `orders.component.ts`, `orders.service.ts` |

## How a desk uses it

```csharp
// inside the desk's save transaction
await IntegrationOutbox.EnqueueAsync(conn, tx, new IntegrationEnqueueRequest
{
    Domain = IntegrationDomains.Vendor,
    EntityId = vendor.VendorId,
    EntityLabel = vendor.Name,
    Destination = "COMPUTYME",
    ContractVersion = "1.1",
    Payload = canonicalJson,           // already validated against the contract
    CreatedBy = Permissions.UserName(User)
});
```

Then one `IIntegrationSender` per domain and destination, registered in `Program.cs`. The sender includes the message's `CorrelationId` in what it sends; the other system echoes it back in its answer.

## Message life

QUEUED → SENT → ACKNOWLEDGED, or REJECTED. A failed send retries after 1, 4, 9, 16… minutes, up to the destination's `MaxAttempts`. A sent message with no answer by `DueBy` becomes OVERDUE. A newer change to the same record replaces an unsent one (SUPERSEDED). People can resend or cancel with a reason; every step is in the message history.

## Deploy

1. Run `01-integration-tables.sql`, then `02-integration-procedures.sql`, in the PRO database. Both end with a one-line result; both are safe to run twice.
2. Create an S3 bucket for the file library (private, versioning on, default encryption on) and set `FileLibrary:Bucket`. Give the app server `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on it.
3. For each destination that will answer, add a key to the `prod/piv2/app` secret, e.g. `"Integration:ResponseKeys:COMPUTYME": "<random 48+ characters>"`, and give that key to the system that answers.
4. Deploy the API and the Angular app.
5. In Security Admin, create permissions `Integration.View` (route `/integration`) and `Integration.Resend`, and grant them.
6. Open Integration Desk: seven destinations, all zero.

## Settings

```json
"Integration": { "Enabled": true, "DispatchSeconds": 30, "BatchSize": 25 },
"FileLibrary": { "Bucket": "" }
```

`Integration:Enabled = false` stops the dispatcher without stopping the app; messages wait as QUEUED.

## Verified here

- Answer contract: 17 of 17 cases (`validate.py`).
- Angular builds with the new desk (development configuration).
- The new C# compiles against .NET 10 with stand-ins for Dapper, JsonSchema.Net, the S3 client and the SQL client. The full project was not compiled: NuGet is blocked in this workspace.
- The SQL was reviewed, not run: no SQL Server was available.
