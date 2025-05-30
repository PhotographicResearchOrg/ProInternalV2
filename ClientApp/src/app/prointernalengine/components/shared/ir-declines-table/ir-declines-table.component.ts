import {Component,Input,ViewChild,Output,EventEmitter,OnChanges,SimpleChanges} from '@angular/core';
import { Table } from 'primeng/table';
import { ChangeDetectorRef } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { MessageService } from 'primeng/api';
import { ConfirmationService } from 'primeng/api';
import { forkJoin, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';



@Component({
  selector: 'app-ir-declines-table',
  templateUrl: './ir-declines-table.component.html'
})

export class IrDeclinesTableComponent implements OnChanges {

  @Input() declines: any[] = [];
  @Input() columns: any[] = [];
  @Input() globalFilterFields: string[] = [];
  @Output() downloadRequested = new EventEmitter<any>();
  @ViewChild('dtDeclines') table!: Table;
  groupedDeclines: any[] = [];
  expandedRowKeys: { [key: string]: boolean } = {};
  uploadedFiles: { [orderId: number]: { file: File; name: string; progress: number }[] } = {};
  expandedOrderId: string | null = null;



  constructor(private cdr: ChangeDetectorRef, private dataService: DataService, private messageService: MessageService, private confirmationService: ConfirmationService) { }

  
  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {

    if (changes['declines'] && this.declines?.length) {
      this.groupedDeclines = this.groupDeclines(this.declines);
      console.log('Grouped Declines:', this.groupedDeclines);

      // Wait until next tick to set expanded keys
      setTimeout(() => {
        this.expandedRowKeys = {};
        for (const item of this.groupedDeclines) {
          this.expandedRowKeys[item.orderID] = true;
        }

        console.log('ExpandedRowKeys:', this.expandedRowKeys);


        this.cdr.detectChanges(); // Force refresh
      });
    }
  }

  private groupDeclines(declines: any[]): any[] {
    const map = new Map<string, any>();

    for (const item of declines) {
      const key = item.orderID.toString();

      if (!map.has(key)) {
        map.set(key, {
          orderID: item.orderID,
          processDate: item.processDate,
          total: item.total,
          rejectReason: item.rejectReason,
          memberID: item.memberID,
          eMail: item.eMail,
          masterFileLoc: item.masterFileLoc || '',
          additionalFiles: item.additionalFiles || '',
          children: []
        });
      }

      const child = {
        model: item.model,
        quantity: item.quantity,
        unitCost: item.unitCost || 0 // Set from source or fallback
      };
      map.get(key)!.children.push(child);
    }
    const result = Array.from(map.values());
    return result;
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
      console.log(fileEntry);
      this.uploadedFiles[orderId].push(fileEntry);
    }
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

          // ✅ Optimistically update local display
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


  onResubmitOrder(orderId: number): void {
    this.dataService.resubmitRebateOrder(orderId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Resubmitted',
          detail: `Order ${orderId} has been re-queued.`,
          life: 3000
        });
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
    if (accountNumbers?.length && this.table) {
      this.table.filter(accountNumbers, 'memberID', 'in');
    }
  }
}
