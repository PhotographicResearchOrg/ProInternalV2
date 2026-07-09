import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { File } from 'src/app/prointernalengine/api/file';
import { Metric } from 'src/app/prointernalengine/api/metric';
import { Folder } from 'src/app/prointernalengine/api/folder';
import { QuarterlyRebates } from "src/app/models/accounting/quarterly-rebates";
import { Observable } from "rxjs";


export interface FileSystemEntry {
  name: string;
  relativePath: string;
  isFolder: boolean;
  sizeBytes: number;
  modifiedUtc: string;
}

export interface FolderSize {
  totalBytes: number;
  fileCount: number;
}


@Injectable()
export class FileAppService {

  constructor(private http: HttpClient) { }

  getQuarterySummary() {
    return this.http.get<Array<QuarterlyRebates>>('Accounting/CurrentQuarterLiability');
  }

  getQuarterly() {
    return this.http.get<any>('assets/demo/data/file-management.json')
      .toPromise()
      .then(res => res.quarterly as Metric[])
      .then(data => data);
  }

  getQuarterlyFiles() {
    return this.http.get<any>('assets/demo/data/file-management.json')
      .toPromise()
      .then(res => res.quarterlyfiles as File[])
      .then(data => data);
  }


  getFiles() {
    return this.http.get<any>('assets/demo/data/file-management.json')
      .toPromise()
      .then(res => res.files as File[])
      .then(data => data);
  }

  getMetrics() {
    return this.http.get<any>('assets/demo/data/file-management.json')
      .toPromise()
      .then(res => res.metrics as Metric[])
      .then(data => data);
  }

  getFoldersSmall() {
    return this.http.get<any>('assets/demo/data/file-management.json')
      .toPromise()
      .then(res => res.folders_small as Folder[])
      .then(data => data);
  }

  getFoldersLarge() {
    return this.http.get<any>('assets/demo/data/file-management.json')
      .toPromise()
      .then(res => res.folders_large as Folder[])
      .then(data => data);
  }

  //BROWSE
  listFolder(path: string = ''): Observable<FileSystemEntry[]> {
    return this.http.get<FileSystemEntry[]>('Files/list', { params: { path } });
  }

  downloadFile(path: string) {
    return this.http.get(`Files/download`, {
      params: { path },
      responseType: 'blob',
      observe: 'response',
    });
  }
  viewFile(path: string) {
    return this.http.get(`Files/view`, {
      params: { path },
      responseType: 'blob',
    });
  }

  // UPLOAD 
  upload(path: string, file: globalThis.File): Observable<any> {
    const fd = new FormData();
    fd.append('files', file, file.name);
    return this.http.post('Files/upload', fd, {
      params: { path },
      reportProgress: true,
      observe: 'events',
    });
  }

  folderSize(path: string = ''): Observable<FolderSize> {
    return this.http.get<FolderSize>('Files/size', { params: { path } });
  }

}
