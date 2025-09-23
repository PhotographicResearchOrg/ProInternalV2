import {Component,Input,ViewChild,Output,EventEmitter,OnChanges,SimpleChanges} from '@angular/core';
import { Table } from 'primeng/table';
import { ChangeDetectorRef } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { MessageService } from 'primeng/api';
import { ConfirmationService } from 'primeng/api';
import { forkJoin, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AfterViewInit } from '@angular/core';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-ir-declines-table',
  templateUrl: './ir-declines-table.component.html'
})

export class IrDeclinesTableComponent implements OnChanges, AfterViewInit {

  @Input() declines: any[] = [];
  @Input() columns: any[] = [];
  @Input() globalFilterFields: string[] = [];
  @Output() actionCompleted = new EventEmitter<void>();
  @Output() downloadRequested = new EventEmitter<any>();
  @Output() filteredCountChanged = new EventEmitter<number>();
  @ViewChild('dtDeclines') table!: Table;

  private pendingAccountFilter: string[] | null = null;
  groupedDeclines: any[] = [];
  expandedRowKeys: { [key: string]: boolean } = {};
  uploadedFiles: { [orderId: number]: { file: File; name: string; progress: number }[] } = {};
  expandedOrderId: string | null = null;
  vendorOptions = [];

  constructor(private cdr: ChangeDetectorRef, private dataService: DataService, private messageService: MessageService, private confirmationService: ConfirmationService) { }


  ngOnInit(): void {}
  ngAfterViewInit(): void {
    this.tryApplyAccountFilter();
    console.log('[IR Table] Table initialized:', !!this.table);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['declines']) {
      console.log(' declines changed:', this.declines);  // ← Add this line
      this.groupedDeclines = this.groupDeclines(this.declines || []);

      setTimeout(() => {
        this.expandedRowKeys = {};
        for (const item of this.groupedDeclines) {
          this.expandedRowKeys[item.orderID] = true;
        }
        if (this.pendingAccountFilter && this.table) {
          this.table.filter(this.pendingAccountFilter, 'memberID', 'in');
        }
        this.cdr.detectChanges();
      });
    }
  }





  private groupDeclines(declines: any[]): any[] {
    const map = new Map<string, any>();

    for (const item of declines) {
      const key = item.orderID?.toString();
      if (!key) {
        continue;
      }

      if (!map.has(key)) {
        map.set(key, {
          stringprogramweek: item.stringprogramweek,
          orderID: item.orderID,
          processDate: item.processDate,
          total: item.total,
          rejectReason: item.rejectReason,
          memberID: item.memberID,
          eMail: item.eMail,
          masterFileLoc: item.masterFileLoc || '',
          additionalFiles: item.additionalFiles || '',
          status: item.status,
          vendorID: item.vendorID,
          vendorName: item.vendorName,
          vendorImage: item.vendorImage,
          children: []
        });
      } else {
        // Optional: ensure consistent memberID and email
        const existing = map.get(key);
        if (!existing.memberID && item.memberID) {
          existing.memberID = item.memberID;
        }
        if (!existing.eMail && item.eMail) {
          existing.eMail = item.eMail;
        }
      }


      const child = {
        model: item.model || '[missing]',
        quantity: item.quantity ?? 0,
        unitCost: item.unitCost || 0 // Set from source or fallback
      };

      map.get(key)!.children.push(child);
    }

    const result = Array.from(map.values());

    for (const group of result) {
      console.log(`Order ${group.orderID} has ${group.children?.length ?? 0} children`);
    }
    return result;
  }


  private tryApplyAccountFilter(): void {
    if (this.pendingAccountFilter?.length && this.table) {
      console.log('Applying memberID filter:', this.pendingAccountFilter);
      this.table.filter(this.pendingAccountFilter, 'memberID', 'in');
      this.cdr.detectChanges();
    }
  }



  trackByOrderId(index: number, item: any): number {
    return item.orderID;
  }

  toggleRow(orderId: string) {
    this.expandedOrderId = this.expandedOrderId === orderId ? null : orderId;
  }

  exportCSV()
  {
    this.table.exportCSV();
  }

  filterGlobal(event: Event) {
    this.table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.add('drag-over');
  }



  onDragLeave(event: DragEvent) {
    (event.currentTarget as HTMLElement).classList.remove('drag-over');
  }
  onDrop(event: DragEvent, orderId: number) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length) return;

    if (!this.uploadedFiles[orderId]) this.uploadedFiles[orderId] = [];

    files.forEach(file => {
      const stagedFile = {
        file,
        name: file.name,
        progress: 0
      };

      this.uploadedFiles[orderId].push(stagedFile);

      // Simulated progress bar
      let p = 0;
      const interval = setInterval(() => {
        p += 10;
        stagedFile.progress = p;
        if (p >= 100) clearInterval(interval);
      }, 50);
    });
  }


  onFilterChange() {
    const count = this.table?.filteredValue?.length ?? this.groupedDeclines.length;
    this.filteredCountChanged.emit(count);
  }


  onUploadFile(event: Event, orderId: number) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const files = Array.from(input.files);

    if (!this.uploadedFiles[orderId]) this.uploadedFiles[orderId] = [];

    files.forEach(file => {
      const stagedFile = {
        file,
        name: file.name,
        progress: 0
      };

      this.uploadedFiles[orderId].push(stagedFile);

      // Simulate progress to 100% over 1 second
      let p = 0;
      const interval = setInterval(() => {
        p += 10;
        stagedFile.progress = p;
        if (p >= 100) clearInterval(interval);
      }, 50);
    });

    input.value = ''; // reset file input so same file can be reselected
  }



  processFiles(files: File[], orderId: number): void {
    if (!this.uploadedFiles[orderId]) {
      this.uploadedFiles[orderId] = [];
    }

    for (const file of files) {
      const fileEntry = {
        file: file, // store actual File object
        name: file.name,
        progress: 0
      };

      this.uploadedFiles[orderId].push(fileEntry);
    }
  }



  exportToExcel(): void {
    if (!this.columns?.length || !this.declines?.length) return;

    const exportData = this.declines.map(row => {
      const flat: any = {};
      this.columns.forEach(col => {
        flat[col.header] = row[col.field];
      });
      return flat;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Declines');

    XLSX.writeFile(workbook, 'InstantRebateDeclines.xlsx');
  }




  onDeleteFile(orderId: number, filename: string) {
    this.dataService.deleteIRFile(orderId, filename).subscribe({
      next: () => {
 
        const row = this.groupedDeclines.find(x => x.orderID === orderId);
        if (row) {
          if (row.masterFileLoc === filename) {
            row.masterFileLoc = '';
          } else if (row.additionalFiles?.includes(filename)) {
            const files = row.additionalFiles.split('|').filter((f: string) => f.trim() !== filename);
            row.additionalFiles = files.join('|');
          }
        }

        this.messageService.add({
          severity: 'success',
          summary: 'File Deleted',
          detail: `${filename} was successfully removed.`,
          life: 3000
        });
      },
      error: (err) => {
        console.error(`Failed to delete file ${filename} from order ${orderId}`, err);

        this.messageService.add({
          severity: 'error',
          summary: 'Delete Failed',
          detail: `Could not delete ${filename}. Please try again.`,
          life: 5000
        });
      }
    });
  }

  confirmDelete(orderId: number, filename: string) {
    this.confirmationService.confirm({
      key: 'ir-delete-confirm',  // Match the HTML
      message: `Are you sure you want to delete "${filename}"?`,
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.dataService.deleteIRFile(orderId, filename).subscribe({
          next: () => {
            const row = this.groupedDeclines.find(x => x.orderID === orderId);
            if (row) {
              if (row.masterFileLoc === filename) {
                row.masterFileLoc = '';
              } else if (row.additionalFiles?.includes(filename)) {
                const files = row.additionalFiles
                  .split('|')
                  .filter((f: string) => f.trim() !== filename);
                row.additionalFiles = files.join('|');
              }
            }

            this.messageService.add({
              severity: 'success',
              summary: 'File Deleted',
              detail: `${filename} was successfully removed.`,
              life: 3000
            });
          },
          error: (err) => {
            console.error(`Delete failed for ${filename}`, err);
            this.messageService.add({
              severity: 'error',
              summary: 'Delete Failed',
              detail: `Could not delete ${filename}.`,
              life: 5000
            });
          }
        });
      }
    });
  }

  onFinalizeUploads(orderId: number): void {
    const pending = this.uploadedFiles[orderId];
    if (!pending || !pending.length) return;

    const uploadTasks = pending.map(fileEntry => {
      const formData = new FormData();
      formData.append('file', fileEntry.file);
      formData.append('orderId', orderId.toString());

      return this.dataService.uploadRebateFile(formData).pipe(
        tap(() => {
          fileEntry.progress = 100;


          const row = this.groupedDeclines.find(x => x.orderID === orderId);
          if (row) {
            // Determine if it should be masterFileLoc or additionalFiles
            if (!row.masterFileLoc || row.masterFileLoc === 'Additional Files') {
              row.masterFileLoc = fileEntry.name;
            } else {
              row.additionalFiles = row.additionalFiles
                ? row.additionalFiles + '|' + fileEntry.name
                : fileEntry.name;
            }
          }

          this.messageService.add({
            severity: 'success',
            summary: 'Upload Complete',
            detail: fileEntry.name,
            life: 2000
          });
        }),
        catchError(err => {
          this.messageService.add({
            severity: 'error',
            summary: 'Upload Failed',
            detail: fileEntry.name,
            life: 5000
          });
          return of(null);
        })
      );
    });

    forkJoin(uploadTasks).subscribe(() => {
      this.uploadedFiles[orderId] = [];
    });
  }


  get filteredDeclineCount(): number {
    return this.table?.filteredValue ? this.table.filteredValue.length : this.groupedDeclines.length;
  }


  onResubmitOrder(orderId: number): void {
    this.dataService.resubmitRebateOrder(orderId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Resubmitted',
          detail: `Order ${orderId} has been re-queued.`,
          life: 3000
        });
        this.actionCompleted.emit(); 
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Resubmit Failed',
          detail: `Could not re-queue order ${orderId}.`,
          life: 5000
        });
      }
    });
  }




  confirmDecline(orderId: number) {
    this.confirmationService.confirm({
      key: 'ir-decline-confirm',
      message: `Are you sure you want to confirm the decline of Order #${orderId}?`,
      header: 'Confirm Decline',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.onConfirmDecline(orderId);
      }
    });

  }



  onConfirmDecline(orderId: number): void {
    this.dataService.confirmDecline(orderId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Decline Confirmed',
          detail: `Order ${orderId} has been marked as declined.`,
          life: 3000
        });
        this.actionCompleted.emit(); //  trigger parent refresh
      },
      error: (err) => {
        console.error('Error confirming decline:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Decline Failed',
          detail: `Could not confirm decline for order ${orderId}.`,
          life: 5000
        });
      }
    });
  }




  refreshOrder(orderId: number): void {
    this.dataService.getDeclinedRebateOrder(orderId).subscribe({
      next: (updated) => {
        const index = this.groupedDeclines.findIndex(x => x.orderID === orderId);

        if (index !== -1 && updated) {
          this.groupedDeclines[index] = {
            ...this.groupedDeclines[index],
            masterFileLoc: updated.masterFileLoc || '',
            additionalFiles: updated.additionalFiles || '',
            // Preserve existing children if not provided
            children: this.groupedDeclines[index].children
          };
        }
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Refresh Failed',
          detail: `Could not refresh order ${orderId}`,
          life: 3000
        });
      }
    });
  }


  removePendingFile(orderId: number, index: number): void {
    if (this.uploadedFiles[orderId]) {
      this.uploadedFiles[orderId].splice(index, 1);
    }
  }

  get activeFilters() {
    return this.table?.filters;
  }
  @Input() set accountNumberFilter(accountNumbers: string[] | null) {
    console.log('[IR Table] Received account filter:', accountNumbers);
    this.pendingAccountFilter = accountNumbers || null;

    if (accountNumbers?.length && this.table) {
      console.log('[IR Table] Table exists. Applying filter now.');
      this.table.filter(accountNumbers, 'memberID', 'in');
    }
  }


}
