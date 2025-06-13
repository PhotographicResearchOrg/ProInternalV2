import { Component } from '@angular/core';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { AuthService } from 'src/app/services/auth.service';
import { Router, UrlSegment } from "@angular/router";
import { LoginResponse } from 'src/app/models/LoginResponse';
import { Location } from '@angular/common';


@Component({
    templateUrl: './login.component.html',
})

export class LoginComponent {
    public username: string = "";
    public password: string = "";

    rememberMe: boolean = false;

  constructor(private layoutService: LayoutService, private router: Router, private authService: AuthService, private location: Location) { }

  get dark(): boolean {return this.layoutService.config().colorScheme !== 'light';}

  ngOnInit()
  {

  }


  login() {
    this.authService.login(this.username, this.password).subscribe({
      next: (response: LoginResponse) => {
        console.log('Permissions received:', response.permissions);
        console.log('Decoded JWT permissions:', JSON.parse(atob(response.token.split('.')[1])));

        const user = {
          ...response.user,
          roles: response.roles,
          permissions: response.permissions,
          extraPermissions: response.extraPermissions
        };
        localStorage.setItem('user', JSON.stringify(user));

        // ✅ Ensure clean browser URL state
        this.location.replaceState('/');

        // ✅ Slight delay guarantees the route guard sees the updated localStorage
        setTimeout(() => {
          this.router.navigate(['/dashboard-landing']);
        }, 0);
      },
      error: (err) => {
        console.error('Login failed', err);
        this.router.navigate(['/auth/access']);
      }
    });
  }




}
