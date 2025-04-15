// In forecast.component.ts

import { Component, OnInit } from '@angular/core';
import { InvoiceRecord } from 'src/app/models/accounting/InvoiceRecord';
import { DataService } from 'src/app/services/data.service';
import * as XLSX from 'xlsx';

interface AggregatedForecast {
  memberId: number;
  memberName: string;
  totalOutstanding: number;
  paymentProbability: number;
  forecastedAmount: number;
  actualAmount: number;
  variance: number;
  accuracyPercent: number | null;
  historicalWeeksIncluded?: number;
  totalCycles?: number;
  paidCycles?: number;
}

@Component({
  selector: 'app-forecast-visual',
  templateUrl: './forecast.component.html',
  styleUrls: ['./forecast.component.scss']
})
export class ForecastComponent implements OnInit {
  invoiceData: InvoiceRecord[] = [];
  filteredForecastData: AggregatedForecast[] = [];
  threshold = 70;
  grossForecast = 0;
  lastWeekGrossForecast = 0;
  changeFromLastWeek: number | null = null;
  accuracyChange: number | null = null;
  selectedWeekEnding: Date | null = null;
  availableWeekEndings: { label: string, value: Date }[] = [];
  selectedWeekRange = '';
  selectedPresetWeights: number[] = [];
  useWeightedProbability = false;
  recencyWeights = [5, 4, 3, 2, 1];


  presetWeightOptions = [
    { label: 'Favor Recent Weeks (5 → 1)', value: [5, 4, 3, 2, 1] },
    { label: 'Even Weighting (1 → 1)', value: [1, 1, 1, 1, 1] },
    { label: 'Favor Older Weeks (1 → 5)', value: [1, 2, 3, 4, 5] },
    { label: 'Sharp Decline (10 → 2)', value: [10, 6, 4, 3, 2] }
  ];

  selectedPreset: { label: string; value: number[] } | null = null;
  constructor(private dataService: DataService) { }

  ngOnInit(): void {
    this.availableWeekEndings = this.getRecentFridays(8).map(billFriday => {
      const validationFriday = new Date(billFriday);
      validationFriday.setDate(billFriday.getDate() + 7);
      return {
        label: validationFriday.toLocaleDateString(),
        value: billFriday
      };
    });

    this.selectedWeekEnding = this.availableWeekEndings[0]?.value || null;

    this.dataService.getForecastInvoices().subscribe(data => {
      this.invoiceData = data.map(d => ({
        ...d,
        billDate: new Date(d.billDate),
        paidDate: d.paidDate ? new Date(d.paidDate) : undefined
      }));
      this.updateForecasts();
    });
  }

  updateForecasts(): void {
    if (!this.selectedWeekEnding) return;

    const thresholdDecimal = this.threshold / 100;
    const billFriday = new Date(this.selectedWeekEnding);
    billFriday.setHours(0, 0, 0, 0);

    const validationFriday = new Date(billFriday);
    validationFriday.setDate(billFriday.getDate() + 7);

    const collectionStart = new Date(billFriday);
    collectionStart.setDate(billFriday.getDate() - 4);
    const collectionEnd = new Date(billFriday);

    this.selectedWeekRange = `${collectionStart.toLocaleDateString()} - ${collectionEnd.toLocaleDateString()}`;

    const history = this.calculateHistoricalProbabilities(billFriday);
    const invoices = this.invoiceData.filter(inv => inv.billDate >= collectionStart && inv.billDate <= collectionEnd);

    const map: { [key: number]: AggregatedForecast } = {};
    for (const inv of invoices) {
      const p = history[inv.account]?.probability || 0;
      if (p < thresholdDecimal) continue;
      if (!map[inv.account]) {
        map[inv.account] = {
          memberId: inv.account,
          memberName: `#${inv.AccountName} (#${inv.account})`,
          totalOutstanding: 0,
          paymentProbability: p,
          forecastedAmount: 0,
          actualAmount: 0,
          variance: 0,
          accuracyPercent: null,
          historicalWeeksIncluded: history[inv.account]?.weeks,
          paidCycles: history[inv.account]?.paidCycles,
          totalCycles: history[inv.account]?.totalCycles
        };
      }
      map[inv.account].totalOutstanding += inv.amount;
      map[inv.account].forecastedAmount += inv.amount * p;

      const expectedPaymentDate = new Date(billFriday);
      expectedPaymentDate.setDate(billFriday.getDate() + 7);

      if (inv.paidDate?.toDateString() === expectedPaymentDate.toDateString()) {
        map[inv.account].actualAmount += inv.amount;
      }
    }

    const list = Object.values(map);
    for (const f of list) {
      f.variance = f.actualAmount - f.forecastedAmount;
      f.accuracyPercent = f.actualAmount !== 0 ? Math.max(0, 100 - Math.abs(f.variance / f.actualAmount) * 100) : null;
    }

    const total = list.reduce((sum, f) => sum + f.forecastedAmount, 0);
    const prev = this.grossForecast;
    this.grossForecast = total;
    this.filteredForecastData = list;
    if (prev !== 0) {
      this.changeFromLastWeek = ((total - prev) / prev) * 100;
    }
    const prevAcc = this.getAverageAccuracyRaw(this.filteredForecastData);
    setTimeout(() => {
      this.accuracyChange = this.getAverageAccuracyRaw(this.filteredForecastData) - prevAcc;
    });
  }

  calculateHistoricalProbabilities(validationFriday: Date): {
    [account: number]: { probability: number, weeks: number, paidCycles: number, totalCycles: number }
  } {
    const result: { [account: number]: { probability: number, weeks: number, paidCycles: number, totalCycles: number } } = {};
    const forecastWindow = new Date(validationFriday);
    forecastWindow.setDate(forecastWindow.getDate() - 14); // 2 weeks before forecast

    for (const inv of this.invoiceData) {
      const billDate = new Date(inv.billDate);
      const paidDate = inv.paidDate ? new Date(inv.paidDate) : undefined;
      const acc = inv.account;

      if (billDate > forecastWindow) continue;

      if (!result[acc]) {
        result[acc] = { probability: 0, weeks: 0, paidCycles: 0, totalCycles: 0 };
      }

      // Always count invoice
      result[acc].totalCycles++; // Not weighted
      result[acc].weeks++;

      // Compute expected payment Friday
      const billFriday = new Date(billDate);
      billFriday.setDate(billFriday.getDate() + (5 - billFriday.getDay() + 7) % 7);
      billFriday.setHours(0, 0, 0, 0);

      const expectedPaidDate = new Date(billFriday);
      expectedPaidDate.setDate(billFriday.getDate() + 7);

      const isPaid = paidDate?.toDateString() === expectedPaidDate.toDateString();

      if (isPaid) {
        if (this.useWeightedProbability) {
          const diffWeeks = Math.floor((validationFriday.getTime() - expectedPaidDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
          const weekIndex = Math.abs(diffWeeks);
          const weight = this.recencyWeights[weekIndex] ?? 1;
          result[acc].paidCycles += weight;
        } else {
          result[acc].paidCycles += 1;
        }
      }
    }

    for (const acc in result) {
      const { paidCycles, totalCycles } = result[+acc];
      result[+acc].probability = totalCycles > 0 ? paidCycles / totalCycles : 0;
    }

    return result;
  }

  getTotalActual(): number {
    return this.filteredForecastData.reduce((sum, f) => sum + f.actualAmount, 0);
  }

  getTotalInvoiced(): number {
    return this.filteredForecastData.reduce((sum, f) => sum + f.totalOutstanding, 0);
  }


  getExpectedPaymentDate(): Date {
    const expectedPaymentDate = new Date(this.selectedWeekEnding!);
    expectedPaymentDate.setDate(expectedPaymentDate.getDate() + 7);
    return expectedPaymentDate;
  }

  get totalVariance(): number {
    return this.filteredForecastData.reduce((sum, f) => sum + f.actualAmount - f.forecastedAmount, 0);
  }


  Download(item: any) {
    const filteredData = item.filteredValue || item.value;
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(filteredData);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Forecast_Export');
    XLSX.writeFile(wb, 'Forecast_Export.xlsx');
  }

  getAverageAccuracy(): string {
    const avg = this.getAverageAccuracyRaw(this.filteredForecastData);
    return avg > 0 ? avg.toFixed(1) + '%' : 'N/A';
  }

  getAverageAccuracyRaw(data: AggregatedForecast[]): number {
    const valid = data.filter(f => f.accuracyPercent !== null);
    const sum = valid.reduce((acc, f) => acc + (f.accuracyPercent ?? 0), 0);
    return valid.length > 0 ? sum / valid.length : 0;
  }

  getRecentFridays(n: number): Date[] {
    const fridays: Date[] = [];
    const today = new Date();
    const day = today.getDay();
    const diff = day >= 5 ? day - 5 : day + 2;
    let lastFriday = new Date(today);
    lastFriday.setDate(today.getDate() - diff);
    lastFriday.setHours(0, 0, 0, 0);

    for (let i = 0; i < n; i++) {
      const f = new Date(lastFriday);
      f.setDate(lastFriday.getDate() - (i * 7));
      fridays.push(f);
    }
    return fridays;
  }
  applyPresetWeights(): void {
    if (this.selectedPresetWeights) {
      this.recencyWeights = [...this.selectedPresetWeights];
      this.updateForecasts();
    }
  }


  applyWeightPreset(presetObj: { label: string; value: number[] }) {
    if (!presetObj || !presetObj.value) return;

    this.recencyWeights = [...presetObj.value];
    this.selectedPreset = presetObj;
    this.useWeightedProbability = true;
    this.updateForecasts();
  }



onManualWeightChange(): void {
  this.selectedPreset = null;
  this.updateForecasts();
}

  getCycleTooltip(index: number): string {
    const cycleDates: string[] = [];
    const base = new Date(this.selectedWeekEnding!);
    for (let i = 1; i <= 5; i++) {
      const start = new Date(base);
      start.setDate(base.getDate() - 7 * i - 4);
      const end = new Date(base);
      end.setDate(base.getDate() - 7 * i);
      cycleDates.push(`${start.toLocaleDateString()} to ${end.toLocaleDateString()}`);
    }
    return cycleDates[index] || '';
  }

  isPendingForecast(): boolean {
    if (!this.selectedWeekEnding) return false;
    const expectedPaymentDate = new Date(this.selectedWeekEnding);
    expectedPaymentDate.setDate(expectedPaymentDate.getDate() + 7);
    return expectedPaymentDate >= this.today;
  }

  getProbabilityColor(p: number): string {
    if (p >= 0.75) return 'bg-green-500';
    if (p >= 0.5) return 'bg-yellow-500';
    return 'bg-orange-500';
  }

  get today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  getVarianceClass(variance: number | undefined): string {
    if (variance === undefined) return '';
    return variance >= 0 ? 'text-green-500' : 'text-red-500';
  }
}
