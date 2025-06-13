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

    const allowedRoutes = this.authService.getAllowedRoutes();
    const rawPath = route.routeConfig?.path ?? '';
    const requestedPath = '/' + rawPath.toLowerCase();

    console.log('Requested:', requestedPath);
    console.log('Allowed:', allowedRoutes);

    if (!allowedRoutes.includes(requestedPath)) {
      this.router.navigate(['/auth/access']);
      return false;
    }

    return true;
  }


}
