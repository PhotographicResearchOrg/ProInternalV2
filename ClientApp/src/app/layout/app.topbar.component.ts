import { Component, ElementRef, ViewChild } from '@angular/core';
import { LayoutService } from './service/app.layout.service';
import { PrimeNGConfig } from 'primeng/api';
import { Router } from '@angular/router';
import { NotificationService } from 'src/app/services/notification.service';
import { Notification } from 'src/app/models/notifications';


@Component({
    selector: 'app-topbar',
    templateUrl: './app.topbar.component.html'
})


export class AppTopbarComponent {

  isRefreshing = true;
  notifications: Notification[] = [];
  unreadCount: number = 0;




  themeOptions =
    [
      { label: 'arya blue', value: 'arya-blue' },
      { label: 'arya green', value: 'arya-green' },
      { label: 'arya orange', value: 'arya-orange' },
      { label: 'arya purple', value: 'arya-purple' },
      { label: 'bootstrap4 dark blue', value: 'bootstrap4-dark-blue' },
      { label: 'bootstrap4 dark purple', value: 'bootstrap4-dark-purple' },
      { label: 'bootstrap4 light blue', value: 'bootstrap4-light-blue' },
      { label: 'bootstrap4 light purple', value: 'bootstrap4-light-purple' },
      { label: 'fluent light', value: 'fluent-light' },
      { label: 'lara dark amber', value: 'lara-dark-amber' },
      { label: 'lara dark blue', value: 'lara-dark-blue' },
      { label: 'lara dark cyan', value: 'lara-dark-cyan' },
      { label: 'lara dark green', value: 'lara-dark-green' },
      { label: 'lara dark indigo', value: 'lara-dark-indigo' },
      { label: 'lara dark pink', value: 'lara-dark-pink' },
      { label: 'lara dark purple', value: 'lara-dark-purple' },
      { label: 'lara dark teal', value: 'lara-dark-teal' },
      { label: 'lara light amber', value: 'lara-light-amber' },
      { label: 'lara light blue', value: 'lara-light-blue' },
      { label: 'lara light cyan', value: 'lara-light-cyan' },
      { label: 'lara light green', value: 'lara-light-green' },
      { label: 'lara light indigo', value: 'lara-light-indigo' },
      { label: 'lara light pink', value: 'lara-light-pink' },
      { label: 'lara light purple', value: 'lara-light-purple' },
      { label: 'lara light teal', value: 'lara-light-teal' },
      { label: 'luna amber', value: 'luna-amber' },
      { label: 'luna blue', value: 'luna-blue' },
      { label: 'luna green', value: 'luna-green' },
      { label: 'luna pink', value: 'luna-pink' },
      { label: 'md dark deeppurple', value: 'md-dark-deeppurple' },
      { label: 'md dark indigo', value: 'md-dark-indigo' },
      { label: 'md light deeppurple', value: 'md-light-deeppurple' },
      { label: 'md light indigo', value: 'md-light-indigo' },
      { label: 'mdc dark deeppurple', value: 'mdc-dark-deeppurple' },
      { label: 'mdc dark indigo', value: 'mdc-dark-indigo' },
      { label: 'mdc light deeppurple', value: 'mdc-light-deeppurple' },
      { label: 'mdc light indigo', value: 'mdc-light-indigo' },
      { label: 'mira', value: 'mira' },
      { label: 'nano', value: 'nano' },
      { label: 'nova accent', value: 'nova-accent' },
      { label: 'nova alt', value: 'nova-alt' },
      { label: 'nova', value: 'nova' },
      { label: 'rhea', value: 'rhea' },
      { label: 'saga blue', value: 'saga-blue' },
      { label: 'saga green', value: 'saga-green' },
      { label: 'saga orange', value: 'saga-orange' },
      { label: 'saga purple', value: 'saga-purple' },
      { label: 'soho dark', value: 'soho-dark' },
      { label: 'soho light', value: 'soho-light' },
      { label: 'tailwind light', value: 'tailwind-light' },
      { label: 'vela blue', value: 'vela-blue' },
      { label: 'vela green', value: 'vela-green' },
      { label: 'vela orange', value: 'vela-orange' },
      { label: 'vela purple', value: 'vela-purple' },
      { label: 'viva dark', value: 'viva-dark' },
      { label: 'viva light', value: 'viva-light' }
    ];



  selectedTheme: string = 'lara-light-indigo';

  ngOnInit()
  {
    const storedTheme = localStorage.getItem('selected-theme');

    if (storedTheme) {
      this.selectedTheme = storedTheme;
      this.onThemeChange(storedTheme);
    } else {
      this.onThemeChange(this.selectedTheme);
    }


    this.notificationService.get().subscribe(n => {
      this.notifications = n;
      this.unreadCount = n.filter(n => !n.isRead).length;
    });
   

  }

  markAsRead(id: number) {
    this.notificationService.markAsRead(id);
    this.unreadCount = this.notifications.filter(n => !n.isRead).length;
  }

  markAllAsRead() {
    this.notifications.forEach(n => this.notificationService.markAsRead(n.id));
    this.unreadCount = 0;
  }

  delete(id: number) {
    this.notificationService.delete(id);

  }


    @ViewChild('menuButton') menuButton!: ElementRef;
    @ViewChild('mobileMenuButton') mobileMenuButton!: ElementRef;
    
  constructor(
    private primengConfig: PrimeNGConfig,
    public layoutService: LayoutService,
    public el: ElementRef,
    private router: Router,
    private notificationService: NotificationService 
  ) { }

    activeItem!: number;


    get mobileTopbarActive(): boolean {
        return this.layoutService.state.topbarMenuActive;
  }


  refreshPage(): void {
    // Option 1: Full page reload
    // location.reload();
    this.isRefreshing = true;
    setTimeout(() => {
      // do your work
      this.isRefreshing = false;
    }, 1000);
    // Option 2: Re-run your core logic (e.g., API calls)
    // If this is in your layout component and you want to target a child,
    // you can use a shared service with an observable or call a specific method if routed.
    const currentUrl = this.router.url;
    // Example if you’re refreshing a dashboard
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigateByUrl(currentUrl);
    });
  }



    onMenuButtonClick() {
        this.layoutService.onMenuToggle();
    }

    onMobileTopbarMenuButtonClick() {
        this.layoutService.onTopbarMenuToggle();
    }

  onThemeChange(themeValue: string) {
    console.log('-----------------------------------------------------')

    const themeLink = document.getElementById('theme-css') as HTMLLinkElement;

    if (themeLink) {
      themeLink.href = `assets/layout/styles/theme/themes/${themeValue}/theme.css`;
      localStorage.setItem('selected-theme', themeValue);
    }
  }


}
