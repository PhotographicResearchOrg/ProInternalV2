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
  photoFailed = false;

  ngOnInit() {
    this.strapiService.getStaffMember().subscribe({
      next: data => { this.currentUser = this.findMe(data || []); },
      error: () => { this.currentUser = null; }
    });
  }

  /** Who is signed in, on the Strapi staff list (the B2B site's staff page). Matched on, in order:
   *  the e-mail's name part = the login name; then the last name in the token. Never a guess on a blank name. */
  private findMe(staff: ProUser[]): ProUser | null {
    let login = '', last = '';
    try {
      const token = localStorage.getItem('token') || '';
      const payload = token.split('.')[1];
      if (payload) {
        const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        login = String(claims?.sub || claims?.unique_name || '').trim().toLowerCase();
        last = String(claims?.userLastName || '').trim().toLowerCase();
      }
    } catch { /* fall back to the stored last name */ }
    if (!last) last = (localStorage.getItem('userData') || '').replace(/['"]/g, '').trim().toLowerCase();
    this.lastName = last;

    if (login) {
      const byEmail = staff.find(s => (s.email || '').toLowerCase().split('@')[0] === login);
      if (byEmail) return byEmail;
    }
    if (last) {
      const byLast = staff.filter(s => {
        const parts = (s.name || '').toLowerCase().trim().split(/\s+/);
        return parts.length > 0 && parts[parts.length - 1] === last;
      });
      if (byLast.length === 1) return byLast[0];
      const contains = staff.filter(s => (s.name || '').toLowerCase().includes(last));
      if (contains.length === 1) return contains[0];
      if (byLast.length) return byLast[0];
    }
    return null;
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
