import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { forkJoin } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { saveAs } from 'file-saver';

import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-shopify-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ProgressBarModule,
    ToggleButtonModule,
    TagModule,
    ToastModule,
    TableModule,
    InputTextModule
  ],
  templateUrl: './shopify-admin.component.html',
  styleUrls: ['./shopify-admin.component.scss']
})
export class ShopifyAdminComponent {



  constructor(
    private dataService: DataService,
    private toast: MessageService
  ) { }



  ngOnInit(): void {
    this.loadAudit();
    this.loadGovernance();
  }


  // OLD SYNC
  shopifyOldRunning = false;
  shopifyOldLastAt: Date | null = null;
  shopifyOldResult: any = null;
  shopifyOldOk = false;
  shopifyOldSummary = '';
  shopifyOldShowRaw = false;

  // NEW SYNC
  shopifyNewRunning = false;
  shopifyNewLastAt: Date | null = null;
  shopifyNewResult: any = null;
  shopifyNewOk = false;
  shopifyNewSummary = '';
  shopifyNewShowRaw = false;

  shopifyAllRunning = false;
  shopifyAllLastRun: Date | null = null;
  shopifyAllResult: any = null;
  shopifyAllOk = false;
  shopifyAllSummary = '';

  auditRows: any[] = [];
  loadingAudit = false;

  missingCategoriesCount = 0;
  appliedCount = 0;
  missingImagesCount = 0;

  governanceRows: any[] = [];
  allGovernanceRows: any[] = [];
  loadingGovernance = false;
  selectedGovernanceFilter = 'All';


  runShopifyAll() {
    this.shopifyAllRunning = true;
    this.shopifyAllLastRun = new Date();
    this.shopifyAllResult = null;
    this.shopifyAllOk = false;
    this.shopifyAllSummary = '';

    forkJoin([
      this.dataService.getShopifySync(),
      this.dataService.getShopifyNewProducts()
    ]).subscribe({
      next: ([syncRes, newRes]) => {
        this.shopifyAllRunning = false;
        this.shopifyAllOk = true;
        this.shopifyAllResult = { syncRes, newRes };

        const synced = syncRes?.count ?? 0;
        const newItems = newRes?.added ?? 0;
        const err1 = syncRes?.errors ?? 0;
        const err2 = newRes?.errors ?? 0;

        this.shopifyAllSummary = `Sync OK. Synced: ${synced}, New: ${newItems}${(err1 || err2) ? `, Errors: ${err1 + err2}` : ''}`;
        this.toast.add({ severity: 'success', summary: 'Shopify Sync', detail: this.shopifyAllSummary, life: 6000 });
      },
      error: (err) => {
        this.shopifyAllRunning = false;
        this.shopifyAllOk = false;
        this.shopifyAllResult = err;
        this.shopifyAllSummary = err?.message || 'Shopify full sync failed';
        this.toast.add({ severity: 'error', summary: 'Shopify Sync', detail: this.shopifyAllSummary, life: 8000 });
      }
    });
  }

  runShopifyOld() {
    this.shopifyOldRunning = true;
    this.shopifyOldResult = null;
    this.shopifyOldSummary = '';
    this.shopifyOldOk = false;

    this.dataService.getShopifySync().subscribe({
      next: (res) => {
        this.shopifyOldRunning = false;
        this.shopifyOldLastAt = new Date();
        this.shopifyOldResult = res;
        this.shopifyOldOk = true;
        this.shopifyOldSummary = res?.status ?? 'Legacy sync completed';
      },
      error: (err) => {
        this.shopifyOldRunning = false;
        this.shopifyOldLastAt = new Date();
        this.shopifyOldResult = err?.error ?? err;
        this.shopifyOldOk = false;
        this.shopifyOldSummary = err?.message || 'Legacy sync failed';
      }
    });
  }

  runShopifyNew() {
    this.shopifyNewRunning = true;
    this.shopifyNewResult = null;
    this.shopifyNewSummary = '';
    this.shopifyNewOk = false;

    this.dataService.getShopifyNewProducts().subscribe({
      next: (res) => {
        this.shopifyNewRunning = false;
        this.shopifyNewLastAt = new Date();
        this.shopifyNewResult = res;
        this.shopifyNewOk = true;
        this.shopifyNewSummary = res?.status ?? 'New product sync completed';
      },
      error: (err) => {
        this.shopifyNewRunning = false;
        this.shopifyNewLastAt = new Date();
        this.shopifyNewResult = err?.error ?? err;
        this.shopifyNewOk = false;
        this.shopifyNewSummary = err?.message || 'New sync failed';
      }
    });
  }


  loadAudit() {

    this.loadingAudit = true;

    this.dataService.getShopifyTaxonomyAudit()
      .subscribe({
        next: (res) => {
          this.auditRows = res;
          this.loadingAudit = false;
        },
        error: () => {
          this.loadingAudit = false;
        }
      });
  }

  reviewAudit(
    row: any,
    disposition: string
  ) {

    this.dataService
      .shopifyTaxonomyReview(
        row.id,
        disposition
      )
      .subscribe({

        next: () => {

          this.auditRows =
            this.auditRows.filter(
              x => x.id !== row.id
            );

          this.toast.add({
            severity: 'success',
            summary: 'Updated',
            detail: `Marked ${disposition}`,
            life: 3000
          });

        },

        error: () => {

          this.toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Unable to update review',
            life: 4000
          });

        }

      });

  }

  loadGovernance() {

    this.loadingGovernance = true;

    this.dataService
      .getShopifyGovernance()
      .subscribe({
        next: (res) => {

          this.allGovernanceRows = [...res];

          this.governanceRows = [...res];

          this.loadingGovernance = false;
        },
        error: () => {

          this.loadingGovernance = false;
        }
      });
  }
  reviewGovernance(
    row: any
  ) {

    this.dataService
      .resolveGovernanceIssue(
        row.id
      )
      .subscribe({

        next: () => {

          this.governanceRows =
            this.governanceRows.filter(
              x => x.id !== row.id
            );

          this.toast.add({
            severity: 'success',
            summary: 'Updated',
            detail: 'Governance issue resolved',
            life: 3000
          });

        },

        error: () => {

          this.toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Unable to update issue',
            life: 4000
          });

        }

      });

  }

  filterGovernance(
    type: string
  ) {

    this.selectedGovernanceFilter = type;

    if (type === 'All') {

      this.governanceRows =
        [...this.allGovernanceRows];

      return;
    }

    this.governanceRows =
      this.allGovernanceRows.filter(
        x => x.issueType === type
      );
  }


  exportGovernance() {

    import('xlsx').then(xlsx => {

      const worksheet =
        xlsx.utils.json_to_sheet(
          this.governanceRows
        );

      const workbook = {
        Sheets: { data: worksheet },
        SheetNames: ['data']
      };

      const excelBuffer =
        xlsx.write(workbook, {
          bookType: 'xlsx',
          type: 'array'
        });

      this.saveAsExcelFile(
        excelBuffer,
        'shopify-governance'
      );

    });

  }

  exportAudit() {

    import('xlsx').then(xlsx => {

      const worksheet =
        xlsx.utils.json_to_sheet(this.auditRows);

      const workbook = {
        Sheets: { data: worksheet },
        SheetNames: ['data']
      };

      const excelBuffer =
        xlsx.write(workbook, {
          bookType: 'xlsx',
          type: 'array'
        });

      this.saveAsExcelFile(
        excelBuffer,
        'shopify-taxonomy-audit'
      );

    });

  }

  saveAsExcelFile(
    buffer: any,
    fileName: string
  ): void {

    const data = new Blob(
      [buffer],
      {
        type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
      }
    );

    saveAs(
      data,
      `${fileName}_${new Date().getTime()}.xlsx`
    );

  }

}

