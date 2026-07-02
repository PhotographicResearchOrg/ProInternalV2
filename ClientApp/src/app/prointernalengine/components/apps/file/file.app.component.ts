import { Component, OnInit } from '@angular/core';
import { Folder } from 'src/app/prointernalengine/api/folder';
import { File } from 'src/app/prointernalengine/api/file';
import { Metric } from 'src/app/prointernalengine/api/metric';
import { FileAppService } from './service/file.app.service';
import { MenuItem } from 'primeng/api';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { Subscription, debounceTime } from 'rxjs';
import { HttpEventType } from '@angular/common/http';

@Component({
    templateUrl: './file.app.component.html',
    styleUrls: ['./file.app.component.scss'],
})
export class FileAppComponent implements OnInit {
    fileChart: any;

    fileChartOptions: any;

    chartPlugins: any;

    metrics: Metric[] = [];

    menuitems: MenuItem[] = [];

    subscription: Subscription;

    currentRelativePath = '';

    folders: FileSystemEntry[] = []; //real folders in current directory

    files: FileSystemEntry[] = []; //real files in current directory

    breadcrumbItems = MenuItem[] = [];

    breadcrumbHome: MenuItem = { icon: 'pi pi-home', command: () => this.navigateTo('') };

    loading = false;

    @ViewChild('fileUploader') fileUploader: any;


    constructor(
        private fileService: FileAppService,
        private layoutService: LayoutService
    ) {
        this.subscription = this.layoutService.configUpdate$
            .pipe(debounceTime(25))
            .subscribe((config) => {
                this.initChart();
            });
    }

    ngOnInit() {
        this.fileService.getFiles().then((data) => (this.files = data));
        this.fileService.getMetrics().then((data) => (this.metrics = data));
        this.fileService
            .getFoldersLarge()
            .then((data) => (this.folders = data));

        this.initChart();

        this.menuitems = [
            { label: 'View', icon: 'pi pi-search' },
            { label: 'Refresh', icon: 'pi pi-refresh' },
        ];
  }


  loadFolder(path: string) {
    this.currentRelativePath = path;
    this.loading = true;
    this.fileService.listFolder(path).subscribe({
      next: (entries) => {
        this.folders = entries.filter((e) => e.isFolder);
        this.files = entries.filter((e) => !e.isFolder);
        this.buildBreadcrumb();
        this.loading = false;
      },
      error: () => {
        this.folders = [];
        this.files = [];
        this.loading = false;
      },
    });
  }

  openFolder(folder: FileSystemEntry) {
    this.loadFolder(folder.relativePath);
  }

  navigateTo(path: string) {
    this.loadFolder(path);
  }

  refresh() {
    this.loadFolder(this.currentRelativePath);
  }

  private buildBreadcrumb() {
    const segments = this.currentRelativePath.split(/[\\/]/).filter((s) => s.length);
    let acc = '';
    this.breadcrumbItems = segments.map((seg) => {
      acc = acc ? `${acc}/${seg}` : seg;
      const target = acc;
      return { label: seg, command: () => this.navigateTo(target) } as MenuItem;
    });
  }

  viewUrl(entry: FileSystemEntry): string {
    return this.fileService.viewUrl(entry.relativePath);
  }

  downloadUrl(entry: FileSystemEntry): string {
    return this.fileService.downloadUrl(entry.relativePath);
  }

  formatSize(bytes: number): string {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let n = bytes;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  }

  onUpload(event: { files: globalThis.File[] }) {
    const path = this.currentRelativePath;
    for (const file of event.files) {
      this.fileService.upload(path, file).subscribe((ev) => {
        if (ev.type === HttpEventType.UploadProgress && ev.total) {
          // ev.loaded / ev.total -> drive a progress bar if you add one
        } else if (ev.type === HttpEventType.Response) {
          this.refresh();          // re-list so the new file shows
          this.fileUploader?.clear();
        }
      });
    }
  }

    initChart() {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');

        this.chartPlugins = [
            {
                beforeDraw: function (chart: any) {
                    let ctx = chart.ctx;
                    let width = chart.width;
                    let height = chart.height;
                    let fontSize = 1.5;
                    let oldFill = ctx.fillStyle;

                    ctx.restore();
                    ctx.font = fontSize + 'rem sans-serif';
                    ctx.textBaseline = 'middle';

                    let text = 'Free Space';
                    let text2 = 50 + 'GB / ' + 80 + 'GB';
                    let textX = Math.round(
                        (width - ctx.measureText(text).width) / 2
                    );
                    let textY = (height + chart.chartArea.top) / 2.25;

                    let text2X = Math.round(
                        (width - ctx.measureText(text).width) / 2.1
                    );
                    let text2Y = (height + chart.chartArea.top) / 1.75;

                    ctx.fillStyle =
                        chart.config.data.datasets[0].backgroundColor[0];
                    ctx.fillText(text, textX, textY);
                    ctx.fillText(text2, text2X, text2Y);
                    ctx.fillStyle = oldFill;
                    ctx.save();
                },
            },
        ];

        this.fileChart = {
            datasets: [
                {
                    data: [300, 100],
                    backgroundColor: [
                        documentStyle.getPropertyValue('--primary-600'),
                        documentStyle.getPropertyValue('--primary-100'),
                    ],
                    hoverBackgroundColor: [
                        documentStyle.getPropertyValue('--primary-700'),
                        documentStyle.getPropertyValue('--primary-200'),
                    ],
                    borderColor: 'transparent',
                    fill: true,
                },
            ],
        };

        this.fileChartOptions = {
            animation: {
                duration: 0,
            },
            cutout: '90%',
            plugins: {
                legend: {
                    labels: {
                        color: textColor,
                    },
                },
            },
        };
  }
}
