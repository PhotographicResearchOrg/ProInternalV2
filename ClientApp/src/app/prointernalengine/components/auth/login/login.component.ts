import { Component } from '@angular/core';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { AuthService } from 'src/app/services/auth.service';
import { Router, UrlSegment } from "@angular/router";

@Component({
    templateUrl: './login.component.html',
})

export class LoginComponent {
    public username: string = "";
    public password: string = "";

    rememberMe: boolean = false;

  constructor(private layoutService: LayoutService, private router: Router, private authService: AuthService) { }

  get dark(): boolean {return this.layoutService.config().colorScheme !== 'light';}

  ngOnInit()
  {

  }

  login() {

    this.authService.login(this.username, this.password)

  }

}
