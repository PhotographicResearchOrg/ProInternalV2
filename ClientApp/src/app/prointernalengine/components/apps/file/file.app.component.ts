import { Component, OnInit, ViewChild, OnDestroy, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FileAppService, FileSystemEntry, FolderSize } from './service/file.app.service';
import { MenuItem } from 'primeng/api';
import { Subscription, } from 'rxjs';
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

  directBytes = 0;
  directCount = 0;

  deepBytes = 0;
  deepFileCount = 0;
  deepCalculated = false;
  storageLoading = false;
  isDragging = false;
  uploading = false;
  uploadProgress = 0;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private sizeCache = new Map<string, FolderSize>();
  private routeSub?: Subscription;
  constructor(
    private fileService: FileAppService,
    private route: ActivatedRoute,
    private router: Router,
  ) { }

  ngOnInit() {
    this.routeSub = this.route.queryParams.subscribe(p => this.loadFolder(p['path'] || ''));
  }

  ngOnDestroy() {
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

        // instant direct-folder size from the listing we already have 
        this.directBytes = this.files.reduce((sum, f) => sum + (f.sizeBytes || 0), 0);
        this.directCount = this.files.length;

        // reset the recursive total, reuse cache if this folder was calculated before
        const cached = this.sizeCache.get(path);
        if (cached) { this.applyDeep(cached); }
        else { this.deepBytes = 0; this.deepFileCount = 0; this.deepCalculated = false; this.storageLoading = false; }
      },
      error: () => {
        this.folders = [];
        this.files = [];
        this.directBytes = 0; this.directCount = 0;
        this.deepCalculated = false;
        this.loading = false;
      },
    });
  }

  calculateDeepSize() {
    const path = this.currentRelativePath;
    const cached = this.sizeCache.get(path);
    if (cached) { this.applyDeep(cached); return; }
    this.storageLoading = true;
    this.fileService.folderSize(path).subscribe({
      next: (s) => { this.sizeCache.set(path, s); this.applyDeep(s); this.storageLoading = false; },
      error: () => { this.storageLoading = false; },
    });
  }

  private applyDeep(s: FolderSize) {
    this.deepBytes = s.totalBytes;
    this.deepFileCount = s.fileCount;
    this.deepCalculated = true;
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

  onDragOver(e: DragEvent) { e.preventDefault(); e.stopPropagation(); this.isDragging = true; }
  onDragLeave(e: DragEvent) { e.preventDefault(); e.stopPropagation(); this.isDragging = false; }

  onDrop(e: DragEvent) {
    e.preventDefault(); e.stopPropagation();
    this.isDragging = false;
    const files = e.dataTransfer?.files;
    if (files && files.length) this.uploadFiles(Array.from(files));
  }

  onBrowse() { this.fileInput.nativeElement.click(); }

  onFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length) this.uploadFiles(Array.from(input.files));
    input.value = ''; 
  }

  uploadFiles(files: File[]) {
    const path = this.currentRelativePath;
    this.uploading = true;
    this.uploadProgress = 0;
    let remaining = files.length;
    for (const file of files) {
      this.fileService.upload(path, file).subscribe({
        next: (ev) => {
          if (ev.type === HttpEventType.UploadProgress && ev.total) {
            this.uploadProgress = Math.round((ev.loaded / ev.total) * 100);
          } else if (ev.type === HttpEventType.Response) {
            if (--remaining === 0) { this.uploading = false; this.refresh(); }
          }
        },
        error: () => { if (--remaining === 0) this.uploading = false; },
      });
    }
  }
} 
