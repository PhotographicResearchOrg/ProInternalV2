#nullable disable
using System;
using System.Collections.Generic;
using System.Linq;

namespace ProInternal.Services.Ai
{
    /*
     * Monthly unit forecast for one product, built into the API (no service to run, no cost per forecast).
     *
     * How it chooses: every candidate method forecasts the last few months of history it has not
     * seen (a backtest), and the one with the smallest error wins. The winner is then fitted on all
     * the history and projected forward. The low-high range comes from how wrong the winner was in
     * the backtest, widening the further ahead it looks.
     *
     * Candidates
     *   Seasonal naive        same month last year                       (needs 24 months)
     *   Holt-Winters          level + damped trend + yearly season       (needs 24 months)
     *   Damped trend          level + damped trend                       (needs 9 months)
     *   Smoothed level        exponential smoothing                      (needs 4 months)
     *   Croston (SBA)         for products that sell in some months only (needs 6 months)
     *   6-month average
     * A product with under 4 months of history gets the average and a wide range.
     */
    public static class ForecastEngine
    {
        public sealed class Point
        {
            public double Likely { get; set; }
            public double Low { get; set; }
            public double High { get; set; }
        }

        public sealed class Result
        {
            public string Method { get; set; }
            public double BacktestErrorPct { get; set; }     // mean absolute error / mean actual, in %
            public int HistoryMonths { get; set; }
            public List<Point> Points { get; set; } = new();
        }

        private delegate double[] Method(double[] history, int horizon);

        /* Simplest first: a more complex method has to beat the current best by 5% to win, so noise
           doesn't pick a fancy method that only fits the past. */
        private static readonly (string Name, int MinMonths, bool ForIntermittent, Method Run)[] Methods =
        {
            ("6-month average", 1, true, Average6),
            ("Smoothed level", 4, true, SmoothedLevel),
            ("Croston (SBA)", 6, true, Croston),
            ("Damped trend", 9, false, DampedTrend),
            ("Seasonal naive", 24, false, SeasonalNaive),
            ("Holt-Winters", 24, false, HoltWinters)
        };

        /// <param name="history">Units per month, oldest first, every month present (0 when nothing sold).</param>
        public static Result Forecast(IReadOnlyList<double> history, int horizon)
        {
            var y = TrimLeadingZeros(history).Select(v => Math.Max(0, v)).ToArray();
            horizon = Math.Clamp(horizon, 1, 24);

            if (y.Length < 4)
            {
                var avg = y.Length == 0 ? 0 : y.Average();
                return new Result
                {
                    Method = y.Length == 0 ? "No sales history" : "Average (little history)",
                    BacktestErrorPct = 0,
                    HistoryMonths = y.Length,
                    Points = Enumerable.Range(1, horizon).Select(_ => new Point { Likely = avg, Low = 0, High = avg * 2 + 1 }).ToList()
                };
            }

            var intermittent = y.Count(v => v == 0) >= y.Length * 0.4;
            var test = Math.Min(6, Math.Max(2, y.Length / 4));
            var train = y.Take(y.Length - test).ToArray();
            var actual = y.Skip(y.Length - test).ToArray();

            string best = null;
            double bestMae = double.MaxValue;
            Method bestRun = Average6;
            double[] bestErrors = null;

            foreach (var (name, minMonths, forIntermittent, run) in Methods)
            {
                if (train.Length < minMonths) continue;
                if (name == "Croston (SBA)" && !intermittent) continue;
                if (intermittent && !forIntermittent) continue;    /* trend and season models chase noise on lumpy sales */
                double[] f;
                try { f = run(train, test); } catch { continue; }
                if (f == null || f.Any(double.IsNaN)) continue;
                var errors = actual.Select((a, i) => a - f[i]).ToArray();
                var mae = errors.Average(Math.Abs);
                if (best == null || mae < bestMae * 0.95) { bestMae = mae; best = name; bestRun = run; bestErrors = errors; }
            }

            best ??= "6-month average";
            var forecast = bestRun(y, horizon);
            var meanActual = Math.Max(actual.Average(), 1e-9);

            /* Range: the backtest's typical miss, growing with the square root of how far ahead. */
            var sigma = Math.Sqrt(bestErrors.Select(e => e * e).Average());
            if (sigma < 0.5) sigma = Math.Max(0.5, y.Average() * 0.2);

            var points = new List<Point>();
            for (var h = 0; h < horizon; h++)
            {
                var likely = Math.Max(0, forecast[h]);
                var spread = 1.28 * sigma * Math.Sqrt(1 + h / 3.0);    // about an 80% range
                points.Add(new Point
                {
                    Likely = Math.Round(likely, 1),
                    Low = Math.Round(Math.Max(0, likely - spread), 1),
                    High = Math.Round(likely + spread, 1)
                });
            }

            return new Result
            {
                Method = best,
                BacktestErrorPct = Math.Round(bestMae / meanActual * 100, 1),
                HistoryMonths = y.Length,
                Points = points
            };
        }

        private static double[] TrimLeadingZeros(IReadOnlyList<double> h)
        {
            var i = 0;
            while (i < h.Count && h[i] <= 0) i++;
            return h.Skip(i).ToArray();
        }

        // ------------------------------------------------------------ methods

        private static double[] Average6(double[] y, int h)
        {
            var avg = y.Skip(Math.Max(0, y.Length - 6)).Average();
            return Enumerable.Repeat(avg, h).ToArray();
        }

        private static double[] SeasonalNaive(double[] y, int h)
        {
            var f = new double[h];
            for (var i = 0; i < h; i++) f[i] = y[y.Length - 12 + (i % 12)];
            return f;
        }

        private static double[] SmoothedLevel(double[] y, int h)
        {
            double bestSse = double.MaxValue, bestLevel = y[0];
            foreach (var a in Grid(0.05, 0.95, 0.05))
            {
                double level = y[0], sse = 0;
                for (var t = 1; t < y.Length; t++) { var e = y[t] - level; sse += e * e; level += a * e; }
                if (sse < bestSse) { bestSse = sse; bestLevel = level; }
            }
            return Enumerable.Repeat(bestLevel, h).ToArray();
        }

        private static double[] DampedTrend(double[] y, int h)
        {
            double bestSse = double.MaxValue, bl = 0, bt = 0, bphi = 0.9;
            foreach (var a in Grid(0.1, 0.9, 0.1))
            foreach (var b in Grid(0.05, 0.5, 0.05))
            foreach (var phi in new[] { 0.8, 0.9, 0.98 })
            {
                double level = y[0], trend = y[1] - y[0], sse = 0;
                for (var t = 1; t < y.Length; t++)
                {
                    var fc = level + phi * trend;
                    var e = y[t] - fc; sse += e * e;
                    var newLevel = fc + a * e;
                    trend = phi * trend + b * (newLevel - level - phi * trend);
                    level = newLevel;
                }
                if (sse < bestSse) { bestSse = sse; bl = level; bt = trend; bphi = phi; }
            }
            var f = new double[h];
            double damp = 0;
            for (var i = 0; i < h; i++) { damp += Math.Pow(bphi, i + 1); f[i] = bl + damp * bt; }
            return f;
        }

        /* Additive Holt-Winters with damped trend, yearly season (12). */
        private static double[] HoltWinters(double[] y, int h)
        {
            const int m = 12;
            var firstYear = y.Take(m).Average();
            var secondYear = y.Skip(m).Take(m).Average();
            var initTrend = (secondYear - firstYear) / m;
            var initSeason = Enumerable.Range(0, m).Select(i => y[i] - firstYear).ToArray();

            double bestSse = double.MaxValue;
            double[] bestF = null;
            foreach (var a in new[] { 0.1, 0.3, 0.5, 0.7 })
            foreach (var b in new[] { 0.01, 0.05, 0.1, 0.2 })
            foreach (var g in new[] { 0.05, 0.1, 0.3, 0.5 })
            {
                const double phi = 0.95;
                double level = firstYear, trend = initTrend, sse = 0;
                var season = (double[])initSeason.Clone();
                for (var t = m; t < y.Length; t++)
                {
                    var s = season[t % m];
                    var fc = level + phi * trend + s;
                    var e = y[t] - fc; sse += e * e;
                    var newLevel = a * (y[t] - s) + (1 - a) * (level + phi * trend);
                    trend = b * (newLevel - level) + (1 - b) * phi * trend;
                    season[t % m] = g * (y[t] - newLevel) + (1 - g) * s;
                    level = newLevel;
                }
                if (sse < bestSse)
                {
                    bestSse = sse;
                    var f = new double[h];
                    double damp = 0;
                    for (var i = 0; i < h; i++)
                    {
                        damp += Math.Pow(phi, i + 1);
                        f[i] = level + damp * trend + season[(y.Length + i) % m];
                    }
                    bestF = f;
                }
            }
            return bestF;
        }

        /* Croston with the Syntetos-Boylan correction: for products that sell in some months only. */
        private static double[] Croston(double[] y, int h)
        {
            const double a = 0.1;
            double? size = null, interval = null;
            var gap = 1;
            foreach (var v in y)
            {
                if (v > 0)
                {
                    size = size == null ? v : size + a * (v - size);
                    interval = interval == null ? gap : interval + a * (gap - interval);
                    gap = 1;
                }
                else gap++;
            }
            var rate = size == null ? 0 : (1 - a / 2) * size.Value / Math.Max(interval.Value, 1);
            return Enumerable.Repeat(rate, h).ToArray();
        }

        private static IEnumerable<double> Grid(double from, double to, double step)
        {
            for (var v = from; v <= to + 1e-9; v += step) yield return Math.Round(v, 3);
        }
    }
}
