import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { File } from 'src/app/prointernalengine/api/file';
import { Metric } from 'src/app/prointernalengine/api/metric';
import { Folder } from 'src/app/prointernalengine/api/folder';
import { QuarterlyRebates } from "src/app/models/accounting/quarterly-rebates";
import { Observable } from "rxjs";


@Injectable()
export class FileAppService {

  constructor(private http: HttpClient) {}



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

}
