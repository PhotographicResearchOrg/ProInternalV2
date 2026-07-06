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

  downloadUrl(path: string): string {
    return `/api/files/download?path=${encodeURIComponent(path)}`;
  }
  viewUrl(path: string): string {
    return `/api/files/view?path=${encodeURIComponent(path)}`;
  }

  // UPLOAD 
  upload(path: string, file: globalThis.File): Observable<any> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http.post('Files/upload', fd, {
      params: { path },
      reportProgress: true,
      observe: 'events',
    });
  }

}
