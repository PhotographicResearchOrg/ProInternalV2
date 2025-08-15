namespace ProInternal.Models.Shared
{
    public class Result
    {
        public bool Success { get; set; }
        public string Message { get; set; } = "";
        // Keep as string to match the frontend exactly: "SUCCESS" | "WARNING" | "ERROR"
        public string ResultType { get; set; } = "SUCCESS";

        public static Result Ok(string? message = null)
            => new() { Success = true, Message = message ?? "" };

        public static Result Warn(string message)
            => new() { Success = true, ResultType = "WARNING", Message = message };

        public static Result Fail(string message)
            => new() { Success = false, ResultType = "ERROR", Message = message };
    }

    public class Result<T> : Result
    {
        public T? Data { get; set; }

        public static Result<T> Ok(T data, string? message = null)
            => new() { Success = true, Data = data, Message = message ?? "" };

        public static Result<T> Warn(T data, string message)
            => new() { Success = true, ResultType = "WARNING", Data = data, Message = message };

        public static new Result<T> Fail(string message)
            => new() { Success = false, ResultType = "ERROR", Message = message };
    }

}
