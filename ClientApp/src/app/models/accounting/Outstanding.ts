export class OutstandingAccount {

  accountNumber: string;
  accountName: string;
  customerName: string;
  grossOutstanding: number;
  days30: number
  days60: number
  days90: number
  invoiceDateDue: number
}

export class OutstandingInvoice {

  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  balance: number;
  status: string;
  term: string;
  daysuntilDue: number;
}

