import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Metric } from 'src/app/prointernalengine/api/metric';
import { FileAppService, FileSystemEntry, FolderSize } from './service/file.app.service';
import { MenuItem } from 'primeng/api';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { Subscription, debounceTime } from 'rxjs';
import { HttpEventType } from '@angular/common/http';

@Component({
  templateUrl: './file.app.component.html',
  styleUrls: ['./file.app.component.scss'],
})
export class FileAppComponent implements OnInit {
  // real file-browser state
  currentRelativePath = '';
  folders: FileSystemEntry[] = [];
  files: FileSystemEntry[] = [];
  breadcrumbItems: MenuItem[] = [];
  breadcrumbHome: MenuItem = { icon: 'pi pi-home', command: () => this.navigateTo('') };
  loading = false;

  storageBytes = 0;
  storageFileCount = 0;
  storageLoading = false;
  rootBytes = 0;
  private sizeCache = new Map<string, FolderSize>();

  fileChart: any;
  fileChartOptions: any;
  chartPlugins: any;
  subscription: Subscription;
  private routeSub?: Subscription;

  @ViewChild('fileUploader') fileUploader: any;

  constructor(
    private fileService: FileAppService,
    private layoutService: LayoutService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.subscription = this.layoutService.configUpdate$
      .pipe(debounceTime(25)).subscribe(() => this.renderChart());
  }

  ngOnInit() {
    this.fileService.folderSize('').subscribe({
      next: (s) => { this.rootBytes = s.totalBytes || 1; this.renderChart(); },
      error: () => { this.rootBytes = 1; },
    });
    this.routeSub = this.route.queryParams.subscribe(p => this.loadFolder(p['path'] || ''));
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.routeSub?.unsubscribe();
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
        const cached = this.sizeCache.get(path);
        if (cached) { this.applySize(cached); }
        else { this.storageBytes = 0; this.storageFileCount = 0; this.storageLoading = false; }
      },
      error: () => {
        this.folders = [];
        this.files = [];
        this.loading = false;
      },
    });
  }

  loadFolderSize(path: string) {
    const cached = this.sizeCache.get(path);
    if (cached) { this.applySize(cached); return; }
    this.storageLoading = true;
    if (!this.rootBytes) {
      this.fileService.folderSize('').subscribe({
        next: (r) => { this.rootBytes = r.totalBytes || 1; this.renderChart(); },
        error: () => { this.rootBytes = 1; },
      });
    }
    this.fileService.folderSize(path).subscribe({
      next: (s) => { this.sizeCache.set(path, s); this.applySize(s); this.storageLoading = false; },
      error: () => { this.storageLoading = false; },
    });
  }

  private applySize(s: FolderSize) {
    this.storageBytes = s.totalBytes;
    this.storageFileCount = s.fileCount;
    this.renderChart();
  }

  openFolder(folder: FileSystemEntry) {
    this.navigateTo(folder.relativePath);
  }

  navigateTo(path: string) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { path: path || null },
    });
  }

  refresh() { this.sizeCache.delete(this.currentRelativePath); this.loadFolder(this.currentRelativePath); }

  private buildBreadcrumb() {
    const segments = this.currentRelativePath.split(/[\\/]/).filter((s) => s.length);
    let acc = '';
    this.breadcrumbItems = segments.map((seg) => {
      acc = acc ? `${acc}/${seg}` : seg;
      const target = acc;
      return { label: seg, command: () => this.navigateTo(target) } as MenuItem;
    });
  }
  download(file: FileSystemEntry) {
    const start = performance.now();
    this.fileService.downloadFile(file.relativePath).subscribe(resp => {
      const secs = ((performance.now() - start) / 1000).toFixed(3);
      console.log(`Download ${file.name} (${file.sizeBytes} bytes) total ${secs}s`);
      const blob = resp.body as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = file.name; a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  view(file: FileSystemEntry) {
    const start = performance.now();
    this.fileService.viewFile(file.relativePath).subscribe(blob => {
      console.log(`View ${file.name} total ${((performance.now() - start) / 1000).toFixed(3)}s`);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    });
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB']; let n = bytes, i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
  }

  onUpload(event:any) {
    const path = this.currentRelativePath;
    for (const file of event.files) {
      this.fileService.upload(path, file).subscribe((ev) => {
        if (ev.type === HttpEventType.UploadProgress && ev.total) {
          // ev.loaded / ev.total -> progress bar if you add one
        } else if (ev.type === HttpEventType.Response) {
          this.refresh();
          this.fileUploader?.clear();
        }
      });
    }
  }
  get usedPercent(): number {
    if (!this.rootBytes) return 0;
    return Math.min(100, Math.round((this.storageBytes / this.rootBytes) * 100));
  }

  private renderChart() {
    const ds = getComputedStyle(document.documentElement);
    const used = this.usedPercent;
    this.fileChart = {
      datasets: [{
        data: [used, 100 - used],
        backgroundColor: [ds.getPropertyValue('--primary-500'), ds.getPropertyValue('--surface-200')],
        borderColor: 'transparent',
      }],
    };
    this.fileChartOptions = {
      animation: { duration: 400 },
      cutout: '80%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
    };
  }
}
