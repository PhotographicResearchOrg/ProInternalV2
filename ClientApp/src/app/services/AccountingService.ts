import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs'
import { ApiService } from "./api.service";
import {  UploadedFile, CreditBatchRequestDto } from 'src/app/models/accounting/accounting-credit'



@Injectable({ providedIn: 'root' })
export class AccountingService {

  constructor(private http: HttpClient, private api: ApiService,) { }

  // --- Credits ---
  getCredits(): Observable<any[]> {
    return this.api.get<any[]>('API/Accounting/credits');
  }

  saveCredits(payload: CreditBatchRequestDto): Observable<any> {
    return this.api.post<any>('API/Accounting/credits', payload);
  }

  getFilePreview(fileId: string): Observable<Blob> {
    return this.api.getWithAuthBlob(
      `API/Accounting/files/preview/${fileId}`
    );
  }


  //invoice/preview/
  getInvoicePdf(invoiceNumber: string): Observable<Blob> {
    return this.api.getWithAuthBlob(
      `API/Accounting/invoice/preview/${invoiceNumber}.pdf`
    );
  }



  uploadFiles(files: FileList): Observable<UploadedFile[]> {
    const fd = new FormData();

    Array.from(files).forEach(file => {
      fd.append('files', file, file.name); // MUST MATCH [FromForm]
    });

    return this.api.postMultipartJson<UploadedFile[]>(
      'API/Accounting/upload',
      fd
    );
  }



  emailInvoice(req: {
    invoiceNumber: string;
    to: string;
    note?: string;
  }) {
    return this.api.postWithAuth('API/Accounting/InvoiceEmail', req);
  }



  // =========================
  // Vendor Billing
  // =========================

  getVendorBilling(): Observable<any[]> {
    return this.api.get<any[]>('API/Accounting/vendor-billing');
  }

  saveVendorBilling(payload: any): Observable<any> {
    return this.api.post<any>('API/Accounting/vendor-billing', payload);
  }



  // =========================
  // Lookups
  // =========================

  searchMember(term: string): Observable<any[]> {
    return this.api.get<any[]>(
      `API/Accounting/search/member?term=${encodeURIComponent(term)}`
    );
  }

  searchVendor(term: string, type: string): Observable<any[]> {
    return this.api.get<any[]>(
      `API/Accounting/search/vendor?term=${encodeURIComponent(term)}&type=${encodeURIComponent(type)}`
    );
  }
}
