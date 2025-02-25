import {
    ChangeDetectorRef,
    Component,
    OnDestroy,
    Renderer2,
    ViewChild,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { MenuService } from './app.menu.service';
import { AppSidebarComponent } from './app.sidebar.component';
import { AppTopbarComponent } from './app.topbar.component';
import { LayoutService } from './service/app.layout.service';

@Component({
    selector: 'app-layout',
    templateUrl: './app.layout.component.html',
})
export class AppLayoutComponent implements OnDestroy {
    overlayMenuOpenSubscription: Subscription;
    topbarMenuOpenSubscription: Subscription;
    menuProfileOpenSubscription: Subscription;
    menuOutsideClickListener: any;
    menuScrollListener: any;
    topbarMenuOutsideClickListener: any;
    menuProfileOutsideClickListener: any;
    @ViewChild(AppSidebarComponent) appSidebar!: AppSidebarComponent;
    @ViewChild(AppTopbarComponent) appTopbar!: AppTopbarComponent;

    constructor(
        private menuService: MenuService,
        public layoutService: LayoutService,
        public renderer: Renderer2,
        public router: Router,
        private cd: ChangeDetectorRef
    ) {
        this.hideMenuProfile();

        this.overlayMenuOpenSubscription =
            this.layoutService.overlayOpen$.subscribe(() => {
                this.hideTopbarMenu();

                if (!this.menuOutsideClickListener) {
                    this.menuOutsideClickListener = this.renderer.listen(
                        'document',
                        'click',
                        (event) => {
                            const isOutsideClicked = !(
                                this.appSidebar.el.nativeElement.isSameNode(
                                    event.target
                                ) ||
                                this.appSidebar.el.nativeElement.contains(
                                    event.target
                                ) ||
                                this.appTopbar.menuButton.nativeElement.isSameNode(
                                    event.target
                                ) ||
                                this.appTopbar.menuButton.nativeElement.contains(
                                    event.target
                                )
                            );
                            if (isOutsideClicked) {
                                this.hideMenu();
                            }
                        }
                    );
                }

                if (
                    (this.layoutService.isHorizontal() ||
                        this.layoutService.isSlim() ||
                        this.layoutService.isSlimPlus()) &&
                    !this.menuScrollListener
                ) {
                    this.menuScrollListener = this.renderer.listen(
                        this.appSidebar.menuContainer.nativeElement,
                        'scroll',
                        (event) => {
                            if (this.layoutService.isDesktop()) {
                                this.hideMenu();
                            }
                        }
                    );
                }

                if (this.layoutService.state.staticMenuMobileActive) {
                    this.blockBodyScroll();
                }
            });

        this.topbarMenuOpenSubscription =
            this.layoutService.topbarMenuOpen$.subscribe(() => {
                if (!this.topbarMenuOutsideClickListener) {
                    this.topbarMenuOutsideClickListener = this.renderer.listen(
                        'document',
                        'click',
                        (event) => {
                            const isOutsideClicked = !(
                                this.appTopbar.el.nativeElement.isSameNode(
                                    event.target
                                ) ||
                                this.appTopbar.el.nativeElement.contains(
                                    event.target
                                ) ||
                                this.appTopbar.mobileMenuButton.nativeElement.isSameNode(
                                    event.target
                                ) ||
                                this.appTopbar.mobileMenuButton.nativeElement.contains(
                                    event.target
                                )
                            );
                            if (isOutsideClicked) {
                                this.hideTopbarMenu();
                            }
                        }
                    );
                }

                if (this.layoutService.state.staticMenuMobileActive) {
                    this.blockBodyScroll();
                }
            });

        this.menuProfileOpenSubscription =
            this.layoutService.menuProfileOpen$.subscribe(() => {
                this.hideMenu();

                if (!this.menuProfileOutsideClickListener) {
                    this.menuProfileOutsideClickListener = this.renderer.listen(
                        'document',
                        'click',
                        (event) => {
                            const isOutsideClicked = !(
                                this.appSidebar.menuProfile.el.nativeElement.isSameNode(
                                    event.target
                                ) ||
                                this.appSidebar.menuProfile.el.nativeElement.contains(
                                    event.target
                                )
                            );
                            if (isOutsideClicked) {
                                this.hideMenuProfile();
                            }
                        }
                    );
                }
            });

        this.router.events
            .pipe(filter((event) => event instanceof NavigationEnd))
            .subscribe(() => {
                this.hideMenu();
                this.hideTopbarMenu();
                this.hideMenuProfile();
            });
    }

    blockBodyScroll(): void {
        if (document.body.classList) {
            document.body.classList.add('blocked-scroll');
        } else {
            document.body.className += ' blocked-scroll';
        }
    }

    unblockBodyScroll(): void {
        if (document.body.classList) {
            document.body.classList.remove('blocked-scroll');
        } else {
            document.body.className = document.body.className.replace(
                new RegExp(
                    '(^|\\b)' +
                        'blocked-scroll'.split(' ').join('|') +
                        '(\\b|$)',
                    'gi'
                ),
                ' '
            );
        }
    }

    hideMenu() {
        this.layoutService.state.overlayMenuActive = false;
        this.layoutService.state.staticMenuMobileActive = false;
        this.layoutService.state.menuHoverActive = false;
        this.menuService.reset();

        if (this.menuOutsideClickListener) {
            this.menuOutsideClickListener();
            this.menuOutsideClickListener = null;
        }

        if (this.menuScrollListener) {
            this.menuScrollListener();
            this.menuScrollListener = null;
        }
        this.unblockBodyScroll();
    }

    hideTopbarMenu() {
        this.layoutService.state.topbarMenuActive = false;

        if (this.topbarMenuOutsideClickListener) {
            this.topbarMenuOutsideClickListener();
            this.topbarMenuOutsideClickListener = null;
        }
    }

    hideMenuProfile() {
        this.layoutService.state.menuProfileActive = false;

        if (this.menuProfileOutsideClickListener) {
            this.menuProfileOutsideClickListener();
            this.menuProfileOutsideClickListener = null;
        }
    }

    get containerClass() {
        let styleClass: { [key: string]: any } = {
            'layout-overlay':
                this.layoutService.config().menuMode === 'overlay',
            'layout-static': this.layoutService.config().menuMode === 'static',
            'layout-slim': this.layoutService.config().menuMode === 'slim',
            'layout-slim-plus':
                this.layoutService.config().menuMode === 'slim-plus',
            'layout-horizontal':
                this.layoutService.config().menuMode === 'horizontal',
            'layout-reveal': this.layoutService.config().menuMode === 'reveal',
            'layout-drawer': this.layoutService.config().menuMode === 'drawer',
            'p-input-filled':
                this.layoutService.config().inputStyle === 'filled',
            'p-ripple-disabled': !this.layoutService.config().ripple,
            'layout-static-inactive':
                this.layoutService.state.staticMenuDesktopInactive &&
                this.layoutService.config().menuMode === 'static',
            'layout-overlay-active': this.layoutService.state.overlayMenuActive,
            'layout-mobile-active':
                this.layoutService.state.staticMenuMobileActive,
            'layout-topbar-menu-active':
                this.layoutService.state.topbarMenuActive,
            'layout-menu-profile-active':
                this.layoutService.state.menuProfileActive,
            'layout-sidebar-active': this.layoutService.state.sidebarActive,
            'layout-sidebar-anchored': this.layoutService.state.anchored,
        };

        styleClass['layout-topbar-' + this.layoutService.config().topbarTheme] =
            true;
        styleClass['layout-menu-' + this.layoutService.config().menuTheme] =
            true;
        styleClass[
            'layout-menu-profile-' +
                this.layoutService.config().menuProfilePosition
        ] = true;
        return styleClass;
    }

    ngOnDestroy() {
        if (this.overlayMenuOpenSubscription) {
            this.overlayMenuOpenSubscription.unsubscribe();
        }

        if (this.menuOutsideClickListener) {
            this.menuOutsideClickListener();
        }
    }
}
