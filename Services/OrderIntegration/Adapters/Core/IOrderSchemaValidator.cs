using ProInternal.Models.OrderIntegration;
using System.Collections.Generic;


namespace ProInternal.Services.OrderIntegration.Adapters.Core
{
    public interface IOrderSchemaValidator
    {
     OrderSchemaValidationResult Validate(CanonicalOrder order);
    }

    public sealed record OrderSchemaValidationResult(bool IsValid,IReadOnlyList<string> Errors);

}
