using ProInternal.Models.OrderIntegration;

namespace ProInternal.Services.OrderIntegration.Adapters.Outbound.Computyme
{
    public interface IComputymeOrderAdapter
    {
        string Map(CanonicalOrder order);

    }
}
