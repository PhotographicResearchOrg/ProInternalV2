import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { options } from "@fullcalendar/core/preact";
import { Observable } from "rxjs";
import { isDevMode } from '@angular/core';

@Injectable({
  providedIn: "root",
})
export class ApiService {

  private _apiUrl: string;
  private defaultHeaders: HttpHeaders;
  constructor(private http: HttpClient)
  {
    console.log(isDevMode());
    //console.log(environment.production);

    if (isDevMode())
      this._apiUrl = "http://localhost:5248";
    else
      this._apiUrl = "";

      this.defaultHeaders = new HttpHeaders().set("Content-Type", "application/json; charset=utf-8");
  }

  set apiUrl(val: string) {
    this._apiUrl = val;
  }

  getUrl(url: string) {



    if (this._apiUrl != "")
    {
      return `${this._apiUrl}/${url}`;
    }
    else
    { 
      return `${url}`;
    }
  }

  get<T>(url: string): Observable<T> {
    return this.http.get<T>(this.getUrl(url));
  }

  getBlob(url: string): Observable<any> {
    return this.http.get(this.getUrl(url), { responseType: "blob" }); 
  }

  getJSON(url: string): Observable<any> {
    let options = {};
    options = { headers: this.defaultHeaders, observe: 'body', responseType: 'text' as 'json' };
    return this.http.get<any>(this.getUrl(url), options);
  }


  post<T>(url: string, objectToPost: any, headers?: HttpHeaders): Observable<T> {
    let options = {};
    if (!!headers) {
      options = { headers: headers };
    } else {
      options = { headers: this.defaultHeaders };
    }
    return this.http.post<T>(this.getUrl(url), JSON.stringify(objectToPost), options);
  }

  postFormData<T>(url: string, formData: FormData): Observable<T> {
    return this.http.post<T>(this.getUrl(url), formData, {
      responseType: 'text' as unknown as 'json' // workaround for Angular type system
    });
  }


  postGetBlob(url: string, objectToPost: any): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
    return this.http.post(this.getUrl(url), objectToPost, { headers, responseType: "blob" as 'json' });
  }
  put<T>(url: string, objectToPost: any): Observable<T> {
    return this.http.put<T>(this.getUrl(url), JSON.stringify(objectToPost), { headers: this.defaultHeaders });
  }

  delete<T>(url: string): Observable<T> {
    return this.http.delete<T>(this.getUrl(url));
  }


  postBlob(url: string, formData: FormData): Observable<any> {
    const headers = new HttpHeaders({ enctype: "multipart/form-data" });
    return this.http.post(this.getUrl(url), formData, { headers: headers });
  }
}
