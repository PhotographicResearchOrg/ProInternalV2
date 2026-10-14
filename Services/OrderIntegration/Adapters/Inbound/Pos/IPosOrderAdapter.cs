namespace ProInternal.Services.OrderIntegration.Adapters.Inbound.Pos
{
    public interface IPosOrderAdapter
    {
        /*
         * fileName: the POS file name, kept for traceability.
         * xml:      the full text of one POS ORDER file.
         */
        PosOrderMappingResult Map(string fileName, string xml);
    }
}
