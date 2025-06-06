import { Injectable } from "@angular/core";
import { Router, UrlSegment } from "@angular/router";
import { ApiService } from "./api.service";
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subscription, debounceTime } from 'rxjs';
import { DataService } from "../services/data.service";
import { Observable,of, throwError } from 'rxjs';
import { catchError, tap, map, switchMap } from 'rxjs/operators';
import { LoginResponse } from '../models/LoginResponse'; // <- make sure path is correct
import { jwtDecode } from 'jwt-decode';
import { NotificationService } from 'src/app/services/notification.service';

interface TokenPayload {
  sub: string;
  permissions: string; // JSON string of permissions array
}

@Injectable({
  providedIn: "root",
})

export class AuthService {

  constructor(private router: Router, private api: ApiService, private httpClient: HttpClient, private dataService: DataService,
    private notificationService: NotificationService
  ) { }
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

  getRoles(): string[] {
    const token = localStorage.getItem('token');
    if (!token) return [];

    try {
      const decoded: any = jwtDecode(token);
      const roles = decoded['role'];
      return Array.isArray(roles) ? roles : [roles]; // supports single or multiple
    } catch (e) {
      return [];
    }
  }

  hasRole(role: string): boolean {
    return this.getRoles().includes(role);
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


  login(username: string, password: string): Observable<LoginResponse> {
    return this.dataService.login(username, password).pipe(
      tap(response => {
        const token = response.token;
        localStorage.setItem('token', token);

        const decoded: any = jwtDecode(token);
        localStorage.setItem('permissions', JSON.stringify(decoded.permissions));
        localStorage.setItem('userData', JSON.stringify(decoded.userLastName));
        localStorage.setItem('userId', decoded.userId);

        // You can also store extraPermissions directly if needed
        localStorage.setItem('roles', JSON.stringify(response.roles));
        localStorage.setItem('extraPermissions', JSON.stringify(response.extraPermissions));

        // Load notifications
        this.dataService.getNotifications().subscribe(notifications => {
          this.notificationService.set(notifications);
        });
      }),
      catchError(error => {
        console.error('Login failed due to HTTP error:', error);
        throw error; // propagate error to component
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



