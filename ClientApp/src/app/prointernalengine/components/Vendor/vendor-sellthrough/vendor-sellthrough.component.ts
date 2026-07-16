import { Component, OnInit, ViewChild } from '@angular/core';
import { forkJoin } from 'rxjs';
import { SellThroughCompliance } from 'src/app/models/vendor/SellThroughCompliance';
import { DataService } from 'src/app/services/data.service';
import { MessageService } from 'primeng/api';
import * as XLSX from 'xlsx';
import { formatDate } from '@angular/common';

interface SellThroughSummary {
  expectedDealers: number;
  submittedDealers: number;
  missingDealers: number;
  compliancePercent: number;
}



@Component({
  selector: 'app-vendor-sellthrough',
  templateUrl: './vendor-sellthrough.component.html',
  styleUrls: ['./vendor-sellthrough.component.scss']
})
export class VendorSellthroughComponent implements OnInit {


  constructor(
    private dataService: DataService,
    private messageService: MessageService
  ) { }

  totalMissingWeeks = 0;
  loading = false;
  startDate?: Date;
  endDate?: Date;
  selectedWeek: Date | null = null;
  dealerFilter = '';
  missingWeeksFilter = 0;
  showOnlyMissing = true;
  expectedDealers = 0;
  submittedDealers = 0;
  missingDealers = 0;
  compliancePercent = 0;
  filteredComplianceData: SellThroughCompliance[] = [];
  showSubmissionDialog = false;

  sendingFile = false;
  sendingRequest = false;
  exportComments = '';
  showRequestDialog = false;
  requestWeeks: string[] = [];

  selectedDealer?: SellThroughCompliance;
  selectedWeeks: string[] = [];
  submissionComments = '';
  selectedFiles: File[] = [];
  showHistoryDialog = false;
  historyData: any[] = [];
  selectedWeekFilter = '';
  weekOptions: any[] = [];
  requestHistoryData: any[] = [];
  showExportDialog = false;
  exportWeeks: string[] = [];
  exportEmail = '';
  selectedExportAccounts: number[] = [];
  selectedAccounts: number[] = [];

  sendingExport = false;

  missingWeekOptions = [
    { label: 'All Missing', value: 0 },
    { label: '1+ Weeks', value: 1 },
    { label: '3+ Weeks', value: 3 },
    { label: '5+ Weeks', value: 5 }
  ];

  @ViewChild('sellThroughUploader')
  sellThroughUploader: any;


  summary: SellThroughSummary = {
    expectedDealers: 0,
    submittedDealers: 0,
    missingDealers: 0,
    compliancePercent: 0
  };

  complianceData: SellThroughCompliance[] = [];

  ngOnInit(): void {
    this.loadData();
  }
  loadData(): void {

    this.loading = true;

    this.dataService.getSellThroughCompliance()
      .subscribe({
        next: (data) => {

          this.complianceData = data;

          this.buildWeekOptions();

          this.filteredComplianceData = [...data];

          this.missingDealers = data.length;

          this.totalMissingWeeks =
            data.reduce((sum, x) => sum + x.missingWeekCount, 0);

          this.submittedDealers =
            this.expectedDealers - this.missingDealers;

          this.compliancePercent =
            Math.round(
              (this.submittedDealers / this.expectedDealers) * 100
            );

          this.loading = false;
        },
        error: (err) => {

          console.error(err);

          this.loading = false;
        }
      });
  }

  openExportDialog(): void {

    this.exportWeeks = [];

    this.exportEmail = '';

    this.exportComments = '';

    this.selectedExportAccounts = [];

    this.showExportDialog = true;

  }

  getSortedExportDealers(): SellThroughCompliance[] {

    return [...this.filteredComplianceData]
      .sort((a, b) =>
        a.memberName.localeCompare(
          b.memberName
        )
      );

  }




  toggleExportAccount(
    account: number
  ): void {

    const idx =
      this.selectedExportAccounts.indexOf(account);

    if (idx >= 0) {

      this.selectedExportAccounts.splice(idx, 1);

    }
    else {

      this.selectedExportAccounts.push(account);

    }

  }


  getVisibleWeeks(
    row: SellThroughCompliance
  ): string[] {

    let weeks =
      this.getMissingWeekList(row);

    weeks = weeks.sort(
      (a, b) =>
        new Date(a).getTime() -
        new Date(b).getTime()
    );

    if (!this.selectedWeekFilter) {
      return weeks;
    }

    return weeks.filter(
      x => x === this.selectedWeekFilter
    );

  }


  getMissingSeverity(count: number): string {

    if (count >= 5) {
      return 'danger';
    }

    if (count >= 3) {
      return 'warning';
    }

    return 'info';
  }


  getStatusSeverity(
    status: string
  ): string {

    switch (status) {

      case 'Sent To BRM':
        return 'success';

      case 'Requested':
        return 'warning';

      default:
        return 'danger';

    }
  }
  onFileSelected(event: any): void {

    if (event.files?.length > 0) {

      this.selectedFiles = event.files;

    }

  }



  submitFile(): void {

    if (this.sendingFile) {
      return;
    }


    if (!this.selectedDealer) {
      return;
    }

    if (this.selectedFiles.length === 0) {

      this.messageService.add({
        severity: 'warn',
        summary: 'Missing File',
        detail: 'Please select a file to send.'
      });

      return;
    }

    if (this.selectedWeeks.length === 0) {

      this.messageService.add({
        severity: 'warn',
        summary: 'Missing Week',
        detail: 'Please select at least one reporting week.'
      });

      return;
    }

    const formData = new FormData();

    formData.append(
      'dealerName',
      this.selectedDealer.memberName
    );

    formData.append(
      'brmName',
      this.selectedDealer.brmName
    );

    formData.append(
      'brmEmail',
      this.selectedDealer.brmEmail
    );

    formData.append(
      'weeks',
      this.selectedWeeks.join(', ')
    );

    formData.append(
      'comments',
      this.submissionComments || ''
    );

    for (const file of this.selectedFiles) {

      formData.append(
        'files',
        file
      );

    };

    formData.append(
      'account',
      this.selectedDealer.account.toString()
    );

    formData.append(
      'username',
      localStorage.getItem('userData') || ''
    );

    this.sendingFile = true;

    this.dataService
      .sendSellThroughFile(formData)
      .subscribe({
        next: () => {

          this.sendingFile = false;

          if (this.sellThroughUploader) {
            this.sellThroughUploader.clear();
          }

          this.showSubmissionDialog = false;

          this.loadData();

          this.selectedDealer = undefined;

          this.selectedWeeks = [];

          this.submissionComments = '';

          this.selectedFiles = [];

          this.messageService.add({
            severity: 'success',
            summary: 'Sent',
            detail: 'Sell Through file sent successfully.'
          });

        },
        error: err => {

          this.sendingFile = false;
          console.error(err);

          this.messageService.add({
            severity: 'error',
            summary: 'Send Failed',
            detail: 'Unable to send Sell Through file.'
          });

        }
      });
  }

  generateExport(
    emailAfterDownload: boolean
  ): void {

    if (this.sendingExport) {
      return;
    }

    this.sendingExport = true;

    const request = {

      weeks: this.exportWeeks,

      accounts: this.selectedExportAccounts,

      emailTo: this.exportEmail,

      comments: this.exportComments

    };

    this.dataService
      .exportSellThrough(request)
      .subscribe({

        next: (data: any[]) => {

          const exportData =
            data.map(x => ({

              ID: '',
              Member: x.dba,
              MemberNumber: x.account,
              ProductCode: x.productCode,
              Sales: x.sales,
              Inventory: x.inventory,
              WeekEnding: formatDate(x.weekEnding, 'yyyy-MM-dd', 'en-US')
            }));

          const worksheet =
            XLSX.utils.json_to_sheet(
              exportData
            );

          const workbook =
            XLSX.utils.book_new();

          XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            'Sell Through'
          );

          const fileName =
            `SonySellThrough_${new Date()
              .toISOString()
              .replace(/[:.]/g, '_')}.xlsx`;

          XLSX.writeFile(
            workbook,
            fileName
          );

          if (!emailAfterDownload) {

            this.sendingExport = false;

            this.messageService.add({

              severity: 'success',

              summary: 'Export Generated',

              detail:
                'Excel file downloaded successfully.'

            });

            return;

          }

          const excelBuffer =
            XLSX.write(
              workbook,
              {
                bookType: 'xlsx',
                type: 'array'
              }
            );

          const blob =
            new Blob(
              [excelBuffer],
              {
                type:
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              }
            );

          const reader =
            new FileReader();

          reader.onload = () => {

            const base64 =
              (reader.result as string)
                .split(',')[1];

            const emailRequest = {

              missingDealers:
                this.filteredComplianceData
                  .filter(row =>

                    this.exportWeeks.some(week =>
                      row.missingWeeks?.includes(week)
                    )

                    &&

                    (
                      this.selectedExportAccounts.length === 0
                      ||
                      this.selectedExportAccounts.includes(
                        row.account
                      )
                    )

                  )
                  .map(row => ({

                    account:
                      row.account,

                    memberName:
                      row.memberName,

                    missingWeeks:
                      row.missingWeeks
                        .split(',')
                        .map(x => x.trim())
                        .filter(x =>
                          this.exportWeeks.includes(x)
                        )
                        .sort((a, b) =>
                          new Date(a).getTime() -
                          new Date(b).getTime()
                        )
                        .join(', ')

                  })),


              emailTo:
                this.exportEmail,

              comments:
                this.exportComments,

              fileName:
                fileName,

              base64File:
                base64,

              weeks:
                this.exportWeeks,

              dealers:
                this.selectedExportAccounts.length === 0
                  ? ['ALL DEALERS']
                  : this.getSortedExportDealers()
                    .filter(x =>
                      this.selectedExportAccounts.includes(
                        x.account
                      )
                    )
                    .map(x => x.memberName)

            };

            this.dataService
              .emailSellThroughExport(
                emailRequest
              )
              .subscribe({

                next: () => {

                  this.sendingExport = false;

                  this.messageService.add({

                    severity: 'success',

                    summary: 'Email Sent',

                    detail:
                      'Export downloaded and emailed successfully.'

                  });

                },

                error: err => {

                  this.sendingExport = false;

                  console.error(err);

                  this.messageService.add({

                    severity: 'error',

                    summary: 'Email Failed',

                    detail:
                      'Unable to email export.'

                  });

                }

              });

          };

          reader.readAsDataURL(
            blob
          );

        },

        error: err => {

          this.sendingExport = false;

          console.error(err);

          this.messageService.add({

            severity: 'error',

            summary: 'Export Failed',

            detail:
              'Unable to generate export.'

          });

        }

      });

  }



  toggleExportWeek(
    week: string
  ): void {

    const idx =
      this.exportWeeks.indexOf(week);

    if (idx >= 0) {

      this.exportWeeks.splice(idx, 1);

    }
    else {

      this.exportWeeks.push(week);

    }

  }




  toggleWeek(week: string): void {

    const idx = this.selectedWeeks.indexOf(week);

    if (idx >= 0) {
      this.selectedWeeks.splice(idx, 1);
    }
    else {
      this.selectedWeeks.push(week);
    }
  }

  toggleRequestWeek(
    week: string
  ): void {

    const idx =
      this.requestWeeks.indexOf(week);

    if (idx >= 0) {

      this.requestWeeks.splice(idx, 1);

    }
    else {

      this.requestWeeks.push(week);

    }
  }




  getMissingWeekList(row: SellThroughCompliance): string[] {

    if (!row.missingWeeks) {
      return [];
    }

    return row.missingWeeks
      .split(',')
      .map(x => x.trim());
  }


  buildWeekOptions(): void {

    const weeks = new Set<string>();

    this.complianceData.forEach(row => {

      if (row.missingWeeks) {

        row.missingWeeks
          .split(',')
          .forEach(x => weeks.add(x.trim()));

      }

    });

    this.weekOptions = [
      {
        label: 'All Weeks',
        value: ''
      },
      ...Array.from(weeks)
        .sort((a, b) =>
          new Date(b).getTime() -
          new Date(a).getTime()
        )
        .map(x => ({
          label: x,
          value: x
        }))
    ];

  }


  openSubmissionDialog(row: SellThroughCompliance): void {

    this.selectedDealer = row;

    this.selectedWeeks = [];

    this.submissionComments = '';

    this.selectedFiles = [];

    this.showSubmissionDialog = true;
  }

  openRequestDialog(
    row: SellThroughCompliance
  ): void {

    this.selectedDealer = row;

    this.requestWeeks = [];

    this.showRequestDialog = true;
  }

  applyFilters(): void {

    this.filteredComplianceData = this.complianceData.filter(x => {

      const dealerMatch =
        !this.dealerFilter ||
        x.memberName.toLowerCase().includes(
          this.dealerFilter.toLowerCase()
        );

      const missingMatch =
        this.missingWeeksFilter === 0 ||
        x.missingWeekCount >= this.missingWeeksFilter;

      const weekMatch =
        !this.selectedWeekFilter ||
        x.missingWeeks?.includes(
          this.selectedWeekFilter
        );

      return dealerMatch &&
        missingMatch &&
        weekMatch;

    });

  }

  requestData(
    row: SellThroughCompliance,
    week: string
  ): void {

    const request = {
      account: row.account,
      dealerName: row.memberName,
      contactEmail: row.contactEmail,
      weekEnding: week,
      requestedBy:
        localStorage.getItem('userData') || ''
    };

    this.dataService
      .sendSellThroughRequest(request)
      .subscribe({
        next: () => {

          this.messageService.add({
            severity: 'success',
            summary: 'Request Sent',
            detail: `Request sent for ${week}`
          });

        },
        error: err => {

          console.error(err);

          this.messageService.add({
            severity: 'error',
            summary: 'Send Failed',
            detail: 'Unable to send request.'
          });

        }
      });
  }

  submitRequest(): void {

    if (this.sendingRequest) {
      return;
    }

    if (!this.selectedDealer) {
      return;
    }

    if (this.requestWeeks.length === 0) {

      this.messageService.add({
        severity: 'warn',
        summary: 'Missing Week',
        detail: 'Please select at least one reporting week.'
      });

      return;
    }

    this.sendingRequest = true;

    const requests = this.requestWeeks.map(week => {

      const request = {
        account: this.selectedDealer!.account,
        dealerName: this.selectedDealer!.memberName,
        contactEmail: this.selectedDealer!.contactEmail,
        weekEnding: week,
        requestedBy:
          localStorage.getItem('userData') || ''
      };

      return this.dataService
        .sendSellThroughRequest(request);

    });

    forkJoin(requests)
      .subscribe({

        next: () => {

          this.sendingRequest = false;

          this.showRequestDialog = false;

          this.requestWeeks = [];

          this.selectedDealer = undefined;

          this.loadData();

          this.messageService.add({
            severity: 'success',
            summary: 'Request Sent',
            detail: 'Dealer request email(s) sent successfully.'
          });

        },

        error: err => {

          this.sendingRequest = false;

          console.error(err);

          this.messageService.add({
            severity: 'error',
            summary: 'Send Failed',
            detail: 'Unable to send dealer request email.'
          });

        }

      });

  }





  viewHistory(row: SellThroughCompliance): void {

    this.dataService
      .getSellThroughSubmissionHistory(row.account)
      .subscribe({

        next: data => {

          this.historyData = data;

          this.dataService
            .getSellThroughRequestHistory(row.account)
            .subscribe({

              next: requestData => {

                this.requestHistoryData = requestData;

                this.showHistoryDialog = true;

              }

            });

        }

      });

  }
}
