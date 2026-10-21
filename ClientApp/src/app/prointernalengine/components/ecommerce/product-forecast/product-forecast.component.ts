import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { DataService } from 'src/app/services/data.service';
import { AiGate, AiStatus, ForecastPoint, ForecastRun, ForecastView } from 'src/app/models/ai/ai.models';

interface RunScore { monthsEnded: number; forecast: number; actual: number; errorPct: number | null; inRange: number; }

/** Product Desk · Forecast: monthly units for buyers, every run saved and scored against what actually sold. */
@Component({
  selector: 'app-product-forecast',
  templateUrl: './product-forecast.component.html',
  styleUrls: ['./product-forecast.component.scss']
})
export class ProductForecastComponent implements OnChanges {
  @Input() productId: number | string = 0;

  readonly horizons = [3, 6, 12];
  horizon = 6;

  status: AiStatus | null = null;
  view: ForecastView | null = null;
  selected: ForecastRun | null = null;
  country = 'ALL';
  running = false;
  loading = false;
  error: string | null = null;

  chartData: any = null;
  chartOptions: any = {
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { filter: (item: any) => item.text !== '_low' } },
      tooltip: { filter: (item: any) => item.dataset.label !== '_low' }
    },
    scales: { y: { beginAtZero: true, title: { display: true, text: 'Units' } } }
  };

  accFrom = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  accTo = new Date().toISOString().slice(0, 10);
  exportingAcc = false;

  constructor(private data: DataService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId']) { this.load(); }
  }

  get gate(): AiGate | undefined { return this.status?.features.find(f => f.feature === 'FORECAST'); }
  get canRun(): boolean { return !!this.gate?.allowed && !this.running; }
  get canView(): boolean { return !!this.gate?.allowed || !!this.status?.canSeeUsage; }

  get countries(): string[] {
    const set = new Set<string>((this.selected?.points ?? []).map(p => p.country).filter(c => c !== 'ALL'));
    return ['ALL', ...[...set].sort()];
  }

  /** The selected run's months for the chosen country. */
  get months(): ForecastPoint[] {
    return (this.selected?.points ?? []).filter(p => p.country === this.country);
  }

  get totals(): { likely: number; low: number; high: number } {
    const m = this.months;
    return { likely: this.sum(m, 'likely'), low: this.sum(m, 'low'), high: this.sum(m, 'high') };
  }

  load(): void {
    const id = Number(this.productId);
    this.error = null;
    this.data.aiStatus().subscribe({
      next: s => {
        this.status = s;
        if (id && this.canView) { this.loadView(id); }
      },
      error: () => this.error = 'Couldn\'t check AI access.'
    });
  }

  private loadView(id: number, selectId?: number): void {
    this.loading = true;
    this.data.aiForecast(id).subscribe({
      next: v => {
        this.view = v;
        this.loading = false;
        this.selected = v.runs.find(r => r.usageId === selectId) ?? v.runs[0] ?? null;
        this.country = 'ALL';
        this.buildChart();
      },
      error: (e: HttpErrorResponse) => { this.loading = false; this.error = e?.error?.message || 'Couldn\'t load the forecast.'; }
    });
  }

  run(): void {
    const id = Number(this.productId);
    if (!id) { return; }
    this.running = true;
    this.error = null;
    this.data.aiForecastRun(id, this.horizon).subscribe({
      next: r => { this.running = false; this.load(); this.loadView(id, r.usageId); },
      error: (e: HttpErrorResponse) => { this.running = false; this.error = e?.error?.message || 'The forecast didn\'t run. Try again in a moment.'; }
    });
  }

  pick(r: ForecastRun): void {
    this.selected = r;
    if (!this.countries.includes(this.country)) { this.country = 'ALL'; }
    this.buildChart();
  }

  setCountry(c: string): void {
    this.country = c;
    this.buildChart();
  }

  /** How a past run did, over the months that have ended (total across countries). */
  score(r: ForecastRun): RunScore {
    const ended = r.points.filter(p => p.country === 'ALL' && p.actual !== null);
    const actual = this.sum(ended, 'actual');
    const err = ended.reduce((a, p) => a + Math.abs((p.actual ?? 0) - p.likely), 0);
    return {
      monthsEnded: ended.length,
      forecast: this.sum(ended, 'likely'),
      actual,
      errorPct: actual > 0 ? Math.round(err / actual * 1000) / 10 : null,
      inRange: ended.filter(p => (p.actual ?? 0) >= p.low && (p.actual ?? 0) <= p.high).length
    };
  }

  /* History for the last 24 months, then the selected run: likely line, low-high band, and actuals where known. */
  private buildChart(): void {
    const v = this.view;
    if (!v) { this.chartData = null; return; }
    const country = this.country;
    const hist = new Map<string, number>();
    v.history.filter(h => country === 'ALL' || h.country === country).forEach(h => {
      const k = h.monthStart.slice(0, 7);
      hist.set(k, (hist.get(k) ?? 0) + h.units);
    });
    const runMonths = this.months;
    const now = new Date();
    const labels: string[] = [];
    for (let i = 24; i >= 1; i--) { labels.push(this.key(new Date(now.getFullYear(), now.getMonth() - i, 1))); }
    runMonths.forEach(p => { const k = p.monthStart.slice(0, 7); if (!labels.includes(k)) { labels.push(k); } });
    labels.sort();

    const byKey = new Map(runMonths.map(p => [p.monthStart.slice(0, 7), p]));
    const sold = labels.map(k => byKey.get(k)?.actual ?? (hist.has(k) ? hist.get(k)! : (k < this.key(now) ? 0 : null)));
    this.chartData = {
      labels: labels.map(k => this.label(k)),
      datasets: [
        { label: 'Sold', data: sold, borderColor: '#141c2b', backgroundColor: '#141c2b', tension: 0.25, pointRadius: 2, spanGaps: false },
        { label: '_low', data: labels.map(k => byKey.get(k)?.low ?? null), borderColor: 'transparent', pointRadius: 0, fill: false },
        { label: 'Likely range', data: labels.map(k => byKey.get(k)?.high ?? null), borderColor: 'transparent', backgroundColor: 'rgba(91,75,181,0.15)', pointRadius: 0, fill: '-1' },
        { label: 'Forecast', data: labels.map(k => byKey.get(k)?.likely ?? null), borderColor: '#5b4bb5', backgroundColor: '#5b4bb5', borderDash: [6, 4], pointRadius: 3, tension: 0.25 }
      ]
    };
  }

  exportRun(): void {
    const r = this.selected;
    if (!r) { return; }
    const rows = r.points.map(p => ({
      Country: p.country, Month: p.monthStart.slice(0, 7), Likely: p.likely, Low: p.low, High: p.high,
      Actual: p.actual ?? '', Method: p.method
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const info = XLSX.utils.json_to_sheet([
      { Field: 'Run', Value: r.usageId }, { Field: 'When', Value: this.when(r.calledAt) }, { Field: 'By', Value: r.userName },
      { Field: 'Model', Value: r.model }, { Field: 'Summary', Value: r.summary ?? '' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Forecast');
    XLSX.utils.book_append_sheet(wb, info, 'About');
    XLSX.writeFile(wb, `Forecast_${this.productId}_${r.usageId}.xlsx`);
  }

  exportAccuracy(): void {
    this.exportingAcc = true;
    this.data.aiForecastAccuracy(this.accFrom, this.accTo).subscribe({
      next: rows => {
        this.exportingAcc = false;
        const ws = XLSX.utils.json_to_sheet(rows.map(a => ({
          Run: a.usageId, When: this.when(a.calledAt), By: a.userName, Product: a.productCode, Name: a.modelName, Brand: a.brandName,
          'Months scored': a.monthsScored, Forecast: a.forecast, Actual: a.actual, 'Error %': a.errorPct ?? '',
          'Months in range': a.monthsInRange, Model: a.model
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Forecast accuracy');
        XLSX.writeFile(wb, `ForecastAccuracy_${this.accFrom}_${this.accTo}.xlsx`);
      },
      error: () => { this.exportingAcc = false; this.error = 'Couldn\'t load the accuracy report.'; }
    });
  }

  when(iso: string): string {
    return new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).toLocaleString();
  }

  monthLabel(iso: string): string { return this.label(iso.slice(0, 7)); }

  private key(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  private label(k: string): string {
    const [y, m] = k.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  private sum(rows: ForecastPoint[], f: 'likely' | 'low' | 'high' | 'actual'): number {
    return Math.round(rows.reduce((a, p) => a + (p[f] ?? 0), 0) * 10) / 10;
  }
}
