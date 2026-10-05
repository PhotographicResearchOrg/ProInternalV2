namespace ProInternal.Models.OrderIntegration
{
    /* The result of saving one inbound document to the order inbox. */
    public sealed class OrderInboxReceipt
    {
        public long InboxId { get; init; }

        /* True when this delivery, or this order, was already in the inbox. */
        public bool IsDuplicate { get; init; }

        public string State { get; init; } = OrderInboxState.Received;

        /* The OrderConsumer / Orders id, once the order was imported. */
        public int? TargetOrderId { get; init; }
    }

    public static class OrderInboxState
    {
        /* Saved, not yet processed (or processing was interrupted). */
        public const string Received = "RECEIVED";

        /* Passed every check and was imported. */
        public const string Ready = "READY";

        /* Has problems a person can fix. Lives only in the inbox until fixed. */
        public const string NeedsReview = "NEEDS_REVIEW";

        /* Will not be processed. Kept on record with the reason. */
        public const string Rejected = "REJECTED";
    }
}
