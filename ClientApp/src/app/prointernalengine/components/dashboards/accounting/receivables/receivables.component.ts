import { Component, OnInit } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { MessageService } from 'primeng/api';
import * as XLSX from 'xlsx';
import { SendInvoicesRequest } from 'src/app/models/accounting/SendInvoicesRequest';

@Component({
  selector: 'app-receivables',
  templateUrl: './receivables.component.html',
  providers: [MessageService],
})
export class ReceivablesComponent implements OnInit {
  accounts: any[] = [];
  invoiceCache: { [accountNumber: string]: any[] } = {};
  expandedRows: { [accountNumber: string]: boolean } = {};
  loading = false;
  exporting = false;
  filterStatus: 'ALL' | 'OPEN' | 'OVERDUE' = 'ALL'; // default show all
  showOnlyOverdue = false;
  selectedAccount: { accountNumber: string } | null = null;
  filteredInvoices: any[] = [];
  filteredAccounts: any[] = []; // filtered for the table display
  displayEmailDialog: boolean = false;
  sendEmailAddress = '';
  selectedAccountToSend: any = null;



  // Add these properties to your component
  totalNetCredits: number = 0;
  totalOpen: number = 0;
  totalOutstanding: number = 0;


  agingBuckets = [
    { label: 'Due Date', amount: 0 },
    { label: '30 Days', amount: 0 },
    { label: '60 Days', amount: 0 },
    { label: '90+ Days', amount: 0 }
  ];




  constructor(
    private dataService: DataService,
    private messageService: MessageService
  ) { }

  ngOnInit() {
    this.loadAccounts();
  }

  // Update your loadAccounts to set filteredAccounts initially
  loadAccounts() {
    this.loading = true;
    this.dataService.getAccountsWithOutstanding().subscribe({
      next: async (data) => {
        this.accounts = data;

        this.loadSummary(); // update summary cards based on accounts

        await this.loadAllInvoices(); // if you need to load invoices

        // IMPORTANT: update filteredAccounts *after* everything else
        this.filteredAccounts = [...this.accounts];

        this.loading = false;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load accounts' });
        this.loading = false;
      }
    });
  }

  openEmailDialog(account: any) {
    this.selectedAccountToSend = account;
    this.sendEmailAddress = '';  // reset
    this.displayEmailDialog = true;
  }

  confirmSendInvoices() {
    if (!this.sendEmailAddress || !this.selectedAccountToSend) return;

    this.dataService.sendAllInvoicesToMemberEmail(


      {
        AccountNumber: this.selectedAccountToSend.accountNumber,
        Email: this.sendEmailAddress
      }


    ).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Invoices sent!' });
        this.displayEmailDialog = false;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to send invoices.' });
      }
    });
  }



  calculateSummary() {
    this.totalNetCredits = 0;
    this.totalOpen = 0;

    // Reset bucket amounts
    this.agingBuckets.forEach(bucket => bucket.amount = 0);

    for (const account of this.accounts) {
      // Sum net credits (negative GrossOutstanding)
      if (account.grossOutstanding < 0) {
        this.totalNetCredits += account.grossOutstanding;
      } else if (account.grossOutstanding > 0) {
        this.totalOpen += account.grossOutstanding;

        // Add to buckets
        this.agingBuckets[0].amount += account.invoiceDateDue || 0;  // Due Date bucket
        this.agingBuckets[1].amount += account.dayS30 || 0;          // 30 days
        this.agingBuckets[2].amount += account.dayS60 || 0;          // 60 days
        this.agingBuckets[3].amount += account.dayS90 || 0;          // 90+ days
      }
    }
  }





  loadSummary() {
    this.totalNetCredits = 0;
    this.totalOpen = 0;
    this.agingBuckets.forEach(b => b.amount = 0);

    const source = this.filteredAccounts.length ? this.filteredAccounts : this.accounts;

    for (const account of source) {
      console.log('Account:', account);

      if (account.grossOutstanding < 0) {
        this.totalNetCredits += account.grossOutstanding;
      } else {
        this.totalOpen += account.grossOutstanding;

        // Log bucket values to check if they exist and are numbers
        console.log('Buckets:', {
          invoiceDateDue: account.invoiceDateDue,
          dayS30: account.dayS30,
          dayS60: account.dayS60,
          dayS90: account.dayS90
        });

        this.agingBuckets[0].amount += account.invoiceDateDue || 0;
        this.agingBuckets[1].amount += account.dayS30 || 0;
        this.agingBuckets[2].amount += account.dayS60 || 0;
        this.agingBuckets[3].amount += account.dayS90 || 0;
      }
    }
  }

  getInvoiceLink(invoiceNumber: string): string {
    const basePath = 'Invoice\\'; // singular
    // Replace the path below with your actual UNC path root and structure
    return `file://///${basePath}${invoiceNumber}.pdf`;
  }

  filterByStatus(status: string) {
    // Implement filtering logic to update your grid based on status clicked
    console.log('Filter by status:', status);
    // e.g. update filterStatus, reload data or filter accounts array
  }


  sendInvoicesToMember(account: any) {
    // Optionally disable button during send (implement loading state)
    this.messageService.add({ severity: 'info', summary: 'Sending', detail: `Sending invoices for account ${account.accountNumber}...` });

    this.dataService.sendAllInvoicesToMemberEmail(
      {
      AccountNumber: this.selectedAccountToSend.accountNumber,
      Email: this.sendEmailAddress
      }

    ).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Invoices sent to ${account.accountName}` });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: `Failed to send invoices for ${account.accountNumber}` });
      }
    });
  }


  loadAllInvoices() {
    const loadPromises = this.accounts.map(account => {
      return new Promise<void>((resolve) => {
        if (this.invoiceCache[account.accountNumber]) {
          resolve();
        } else {
          this.dataService.getInvoicesByAccount(account.accountNumber).subscribe(invoices => {
            this.invoiceCache[account.accountNumber] = invoices;
            resolve();
          });
        }
      });
    });

    return Promise.all(loadPromises);
  }



  // Update setFilter to filter accounts as well when showing OVERDUE
  setFilter(status: 'ALL' | 'OPEN' | 'OVERDUE'): void {
    this.filterStatus = status;

    if (status === 'OVERDUE') {
      this.filteredAccounts = this.accounts.filter(account => {
        const invoices = this.invoiceCache[account.accountNumber] ?? [];
        return invoices.some(inv => inv.status === 'OVERDUE');
      });
    } else {
      this.filteredAccounts = [...this.accounts];
    }
    this.applyInvoiceFilter();
  }


  toggleOverdueFilter(): void {
    this.filterStatus = this.showOnlyOverdue ? 'OVERDUE' : 'ALL';
    this.applyInvoiceFilter();
  }

  applyInvoiceFilter(): void {
    if (!this.selectedAccount) return; // or handle no account selected

    const invoices = this.invoiceCache[this.selectedAccount.accountNumber] ?? [];

    if (this.filterStatus === 'ALL') {
      this.filteredInvoices = invoices;
    } else {
      this.filteredInvoices = invoices.filter(inv => inv.status === this.filterStatus);
    }
  }

  onRowExpand(account: any) {
    const accNum = account.accountNumber;
    this.selectedAccount = account;

    if (!this.invoiceCache[accNum]) {
      this.dataService.getInvoicesByAccount(accNum).subscribe((invoices) => {
        this.invoiceCache[accNum] = invoices;
        this.applyInvoiceFilter();
        this.expandedRows = { ...this.expandedRows, [accNum]: true };
      });
    } else {
      this.applyInvoiceFilter();
      this.expandedRows = { ...this.expandedRows, [accNum]: true };
    }
  }


  onRowCollapse(account: any) {
    const accNum = account.accountNumber;
    const { [accNum]: _, ...rest } = this.expandedRows;
    this.expandedRows = rest;
  }

  exportReceivables() {
    this.exporting = true;
    const exportData: any[] = [];

    // Loop over filteredAccounts instead of all accounts
    this.filteredAccounts.forEach((account) => {
      // Get invoices for this account, fallback empty array
      const invoices = this.invoiceCache[account.accountNumber] ?? [];

      // Filter invoices based on current filterStatus
      const filteredInvoices = this.filterStatus === 'ALL'
        ? invoices
        : invoices.filter(inv => inv.status === this.filterStatus);

      if (filteredInvoices.length === 0) {
        // No invoices to export, export account info only
        exportData.push({
          AccountNumber: account.accountNumber,
          AccountName:  account.accountName,
          Open: account.grossOutstanding,
          InvoiceDue: account.invoiceDateDue,
          Days30: account.dayS30,
          Days60: account.dayS60,
          Days90: account.dayS90,
          InvoiceNumber: '',
          InvoiceDate: '',
          DueDate: '',
          InvoiceAmount: '',
          InvoiceBalance: '',
          InvoiceStatus: '',
        });
      } else {
        // Export each invoice
        filteredInvoices.forEach((inv) => {
          exportData.push({
            AccountNumber: account.accountNumber,
            AccountName: account.accountName,
            Open: account.grossOutstanding,
            InvoiceDue: account.invoiceDateDue,
            Days30: account.dayS30,
            Days60: account.dayS60,
            Days90: account.dayS90,
            InvoiceNumber: inv.invoiceNumber,
            InvoiceDate: inv.invoiceDate,
            DueDate: inv.dueDate,
            InvoiceAmount: inv.amount,
            InvoiceBalance: inv.balance,
            InvoiceStatus: inv.status,
          });
        });
      }
    });

    this.exportToExcel(exportData, 'receivables_export');
    this.exporting = false;
  }

  exportToExcel(data: any[], filenamePrefix: string) {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
    const excelBuffer: any = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const fileName = `${filenamePrefix}_${timestamp}.xlsx`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  onGlobalFilter(table: any, event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    table.filterGlobal(input, 'contains');
  }
}
