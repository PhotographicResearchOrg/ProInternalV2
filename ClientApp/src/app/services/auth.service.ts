import { Injectable } from "@angular/core";
import { Router, UrlSegment } from "@angular/router";
import { ApiService } from "./api.service";
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subscription, debounceTime } from 'rxjs';
import { DataService } from "../services/data.service";
import { Observable,of, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { LoginResponse } from '../models/LoginResponse'; // <- make sure path is correct
import { jwtDecode } from 'jwt-decode'; 




interface TokenPayload {
  sub: string;
  permissions: string; // JSON string of permissions array
}

@Injectable({
  providedIn: "root",
})

export class AuthService {

  constructor(private router: Router, private api: ApiService, private httpClient: HttpClient, private dataService: DataService) {}
  //Auth

  set token(token: string) {
    document.cookie = `token=${token}; path=/`;
  }

  get token(): string {
    var match = document.cookie.match(new RegExp('(^| )token=([^;]+)'));
    if (match) return match[2];
    return '';
    //return sessionStorage.getItem("token");
  }

  set redirectTo(page: string)
  {
    page = "Dashboard-landing"
    alert(page)
    if (page !== '/login')
    {
      sessionStorage.setItem("redirectTo", page);
    }
  }


  getPermissions(): string[] {
    const raw = localStorage.getItem('permissions');
    console.log('------------------AUTH SERVICE ---------------------------------------------')
    console.log(raw)
    try {
      const parsed = JSON.parse(raw ?? '[]');
      
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }


  hasPermission(permission: string): boolean {
    const userPermissions = JSON.parse(localStorage.getItem('permissions') || '[]');
    return userPermissions.includes(permission);
  }

  get redirectTo() {
    let page: string;
    page = sessionStorage.getItem("redirectTo") || '/Dashboard-landing';
    return page;
  }



  login(username: string, password: string): Observable<boolean>
  {
      return this.dataService.login(username, password).pipe(
      map((response: any) =>
      {
        if (response?.error) {
          console.warn('Login response contains error:', response.error);
          return false;
        }
        // ✅ Success — store token
        const decoded: any = jwtDecode(response.token);
        localStorage.setItem('token', decoded.token);

        // Store permissions in localStorage as parsed array
        const permissions = decoded.permissions;
        localStorage.setItem('permissions', JSON.stringify(permissions));

        const userData = decoded.userLastName;
        localStorage.setItem('userData', JSON.stringify(userData));

        return true;

      }),
        catchError(error => {
          console.error('Login failed due to HTTP error:', error);
          return of(false);
        })
      );
  }



  isLoggedIn() {
    return !!localStorage.getItem('token'); // or sessionStorage, depending on where you stor
  }
  logout(): void {
    // Clear localStorage
    localStorage.clear();

    // Clear sessionStorage (optional)
    sessionStorage.clear();

    // Delete cookies (if manually set)
    this.deleteAllCookies();

    // Redirect to login
    this.router.navigate(['/auth/login']);
  }



  private deleteAllCookies(): void {
    const cookies = document.cookie.split(";");

    for (let cookie of cookies) {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  }
}



