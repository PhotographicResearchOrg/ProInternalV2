import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) { }



  canActivate(route: ActivatedRouteSnapshot): boolean {
    const isLoggedIn = this.authService.isLoggedIn();

    if (!isLoggedIn) {
      this.router.navigate(['/auth/login']);
      return false;
    }

    const requiredPermissions = route.data['permissions'] as string[];

    //const userPermissions = this.authService.getPermissions(); // or from localStorage

    const userPermissions = JSON.parse(localStorage.getItem('permissions') || '[]');

    const userData = localStorage.getItem('userData');
  
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.every(p => userPermissions.includes(p));

      if (!hasPermission) {
        this.router.navigate(['/auth/access']);
        return false;
      }
    }

    return true;
  }



}
