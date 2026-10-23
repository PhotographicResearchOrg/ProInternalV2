import { Component } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DataService } from 'src/app/services/data.service';
import { AuthService } from 'src/app/services/auth.service';
import { BatchRunResponse } from 'src/app/models/Uvicorn/PassThroughInvoice';
import { HomePin, stablePin } from 'src/app/services/home-pin.service';

interface AccountingLink { route: string; title: string; sub: string; icon: string; }

/** Accounting desk: the two pass-through invoice runs, and the way into every accounting screen.
 *  (The old page's balances, receivables, payables and payments were typed-in sample numbers; they're gone.) */
@Component({
  templateUrl: './dashboardaccounting.component.html',
  styleUrls: ['../../MemberManagement/member-desk/member-desk.component.scss', './dashboardaccounting.component.scss'],
  providers: [MessageService, ConfirmationService]
})
export class DashboardAccountingComponent {
  readonly homePin: HomePin = stablePin({ id: 'accounting', label: 'Accounting', sub: 'Dashboards', icon: 'pi pi-money-bill', route: '/dashboard-accounting' });

  private readonly allLinks: AccountingLink[] = [
    { route: '/credit', title: 'Credit Desk', sub: 'Member credit, held orders, invoices in flight', icon: 'pi pi-shield' },
    { route: '/receivables', title: 'Receivables', sub: 'Member open invoices and aging', icon: 'pi pi-inbox' },
    { route: '/payments', title: 'Payments', sub: 'Member payments received', icon: 'pi pi-wallet' },
    { route: '/payment-administration', title: 'Payment administration', sub: 'EZPay, ACH and card set-up', icon: 'pi pi-credit-card' },
    { route: '/credits', title: 'Credits', sub: 'Member credits and credit memos', icon: 'pi pi-dollar' },
    { route: '/vendor-billing', title: 'Vendor billing', sub: 'Direct-billed vendor invoices', icon: 'pi pi-briefcase' },
    { route: '/qtr-rebates', title: 'Quarterly rebates', sub: 'Member quarterly rebate runs', icon: 'pi pi-percentage' },
    { route: '/patronage', title: 'Patronage', sub: 'Patronage dividends', icon: 'pi pi-file' },
    { route: '/rebatedesk', title: 'Rebate Desk', sub: 'Instant rebates and price protection', icon: 'pi pi-ticket' },
    { route: '/forecast', title: 'Forecasting', sub: 'Cash and sales forecast', icon: 'pi pi-chart-line' }
  ];
  readonly links: AccountingLink[];

  // pass-through invoice batch
  isRunning = false;
  lastRunAt: Date | null = null;
  lastResult: BatchRunResponse | null = null;
  lastOk = false;
  summary = '';
  showRaw = false;

  // one invoice
  invoiceNumber = '';
  isRunningSingle = false;
  lastSingleRunAt: Date | null = null;
  singleResult: any = null;
  singleOk = false;
  singleSummary = '';
  showSingleRaw = false;

  constructor(private confirm: ConfirmationService, private toast: MessageService, private dataService: DataService, auth: AuthService) {
    const allowed = auth.getAllowedRoutes();
    this.links = this.allLinks.filter(l => allowed.includes(l.route.toLowerCase()));
  }

  confirmRun(event: Event): void {
    this.confirm.confirm({
      target: event.target as HTMLElement,
      message: 'Run the pass-through invoice batch now?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Run', rejectLabel: 'Cancel',
      accept: () => this.run()
    });
  }

  private static describe(res: any, fallback: string): string {
    const processed = res?.processed ?? res?.totalProcessed ?? res?.count ?? null;
    const errors = res?.errors ?? res?.errorCount ?? 0;
    const msg = res?.message ?? fallback;
    return processed !== null ? `${msg}. Processed: ${processed}${errors ? `, errors: ${errors}` : ''}` : msg;
  }

  run(): void {
    this.isRunning = true;
    this.summary = '';
    this.showRaw = false;
    this.dataService.getInvoiceBatch().subscribe({
      next: res => {
        this.isRunning = false; this.lastRunAt = new Date(); this.lastResult = res; this.lastOk = true;
        this.summary = DashboardAccountingComponent.describe(res, 'Batch completed');
        this.toast.add({ severity: 'success', summary: 'Batch complete', detail: this.summary, life: 6000 });
      },
      error: err => {
        this.isRunning = false; this.lastRunAt = new Date(); this.lastResult = (err && 'error' in err) ? err.error : err; this.lastOk = false;
        this.summary = err?.message || 'Batch failed';
        this.toast.add({ severity: 'error', summary: 'Batch failed', detail: this.summary, life: 8000 });
      }
    });
  }

  runSingle(): void {
    const inv = this.invoiceNumber?.trim();
    if (!inv) { this.toast.add({ severity: 'warn', summary: 'Invoice required', detail: 'Enter an invoice number.' }); return; }
    this.isRunningSingle = true;
    this.singleSummary = '';
    this.showSingleRaw = false;
    this.dataService.getInvoiceProcess(inv).subscribe({
      next: res => {
        this.isRunningSingle = false; this.lastSingleRunAt = new Date(); this.singleResult = res; this.singleOk = true;
        this.singleSummary = DashboardAccountingComponent.describe(res, `Invoice ${inv} processed`);
        this.toast.add({ severity: 'success', summary: 'Done', detail: this.singleSummary, life: 6000 });
      },
      error: err => {
        this.isRunningSingle = false; this.lastSingleRunAt = new Date(); this.singleResult = (err && 'error' in err) ? err.error : err; this.singleOk = false;
        this.singleSummary = err?.message || 'Request failed';
        this.toast.add({ severity: 'error', summary: 'Error', detail: this.singleSummary, life: 8000 });
      }
    });
  }
}
