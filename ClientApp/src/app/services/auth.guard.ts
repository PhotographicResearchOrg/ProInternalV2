import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) { }

  canActivate(route: ActivatedRouteSnapshot): boolean {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/auth/login']);
      return false;
    }

    const requiredPermissions: string[] = route.data['permissions'] || [];
    const requiredRoles: string[] = route.data['roles'] || [];

    const userPermissions = this.authService.getPermissions?.() || [];
    const userRoles = this.authService.getRoles?.() || [];

    const hasAllPermissions = requiredPermissions.every(p => userPermissions.includes(p));
    const hasAnyRole = requiredRoles.length === 0 || requiredRoles.some(r => userRoles.includes(r));

    if (requiredPermissions.length && !hasAllPermissions) {
      this.router.navigate(['/auth/access']);
      return false;
    }

    if (requiredRoles.length && !hasAnyRole) {
      this.router.navigate(['/auth/access']);
      return false;
    }

    return true;
  }

}
