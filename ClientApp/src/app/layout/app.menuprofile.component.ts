import { Component, ElementRef } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { LayoutService } from './service/app.layout.service';
import { AuthService } from "src/app/services/auth.service";
import { StrapiService } from 'src/app/services/strapi.service'
import { ProUser } from '../models/pro-user'

@Component({
    selector: 'app-menu-profile',
    templateUrl: './app.menuprofile.component.html',
    animations: [
        trigger('menu', [
            transition('void => inline', [
                style({ height: 0 }),
                animate(
                    '400ms cubic-bezier(0.86, 0, 0.07, 1)',
                    style({ opacity: 1, height: '*' })
                ),
            ]),
            transition('inline => void', [
                animate(
                    '400ms cubic-bezier(0.86, 0, 0.07, 1)',
                    style({ opacity: 0, height: '0' })
                ),
            ]),
            transition('void => overlay', [
                style({ opacity: 0, transform: 'scaleY(0.8)' }),
                animate('.12s cubic-bezier(0, 0, 0.2, 1)'),
            ]),
            transition('overlay => void', [
                animate('.1s linear', style({ opacity: 0 })),
            ]),
        ]),
    ],
})
export class AppMenuProfileComponent {
  constructor(public layoutService: LayoutService, public el: ElementRef, public authService: AuthService, private strapiService: StrapiService) {}

  currentUser: ProUser | null = null;
  lastName: string= "";

  ngOnInit() {
    this.strapiService.getStaffMember().subscribe(data => {

      const storedName = (localStorage.getItem('userData') || '') .replace(/['"]/g, '')  // Remove single/double quotes
  .trim();          ; // fallback to empty string
      this.lastName = storedName;
      console.log('-----------------------get user data ---------------------');
      console.log(this.lastName);
      console.log(data);


    this.currentUser =
      data.find((staff: any) =>
        staff.name.toLowerCase().includes(this.lastName.toLowerCase())
      ) || null;
    });

    console.log(this.currentUser)
}

    toggleMenu() {
        this.layoutService.onMenuProfileToggle();
    }

    get isHorizontal() {
        return (
            this.layoutService.isHorizontal() && this.layoutService.isDesktop()
        );
    }

    get menuProfileActive(): boolean {
        return this.layoutService.state.menuProfileActive;
    }

    get menuProfilePosition(): string {
        return this.layoutService.config().menuProfilePosition;
    }

    get isTooltipDisabled(): boolean {
        return !this.layoutService.isSlim();
  }


  onLogoutClick() {
    this.authService.logout();
  }

}
