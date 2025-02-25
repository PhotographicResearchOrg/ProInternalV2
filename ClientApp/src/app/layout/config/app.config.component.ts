import { Component, Input, OnInit, signal } from '@angular/core';
import { MenuService } from '../app.menu.service';
import {
    ColorScheme,
    LayoutService,
    MenuMode,
} from '../service/app.layout.service';

@Component({
    selector: 'app-config',
    templateUrl: './app.config.component.html',
})
export class AppConfigComponent implements OnInit {
    @Input() minimal: boolean = false;

    componentThemes: any[] = [];

    menuThemes: any[] = [];

    topbarThemes: any[] = [];

    scenes: any[] = [];

    scales: number[] = [12, 13, 14, 15, 16];

    selectedScene = signal<string>('');

    constructor(
        public layoutService: LayoutService,
        public menuService: MenuService
    ) {}

    get visible(): boolean {
        return this.layoutService.state.configSidebarVisible;
    }
    set visible(_val: boolean) {
        this.layoutService.state.configSidebarVisible = _val;
    }

    get scale(): number {
        return this.layoutService.config().scale;
    }
    set scale(_val: number) {
        this.layoutService.config.update((config) => ({
            ...config,
            scale: _val,
        }));
    }

    get menuMode(): MenuMode {
        return this.layoutService.config().menuMode;
    }
    set menuMode(_val: MenuMode) {
        this.layoutService.config().menuMode = _val;
        if (
            this.layoutService.isSlimPlus() ||
            this.layoutService.isSlim() ||
            this.layoutService.isHorizontal()
        ) {
            this.menuService.reset();
        }
    }

    get menuProfilePosition(): string {
        return this.layoutService.config().menuProfilePosition;
    }

    set menuProfilePosition(_val: string) {
        this.layoutService.config.update((config) => ({
            ...config,
            menuProfilePosition: _val,
        }));
        if (this.layoutService.isSlim() || this.layoutService.isHorizontal()) {
            this.menuService.reset();
        }
    }

    get colorScheme(): ColorScheme {
        return this.layoutService.config().colorScheme;
    }
    set colorScheme(_val: ColorScheme) {
        if (_val !== this.layoutService.config().colorScheme) {
            this.layoutService.config.update((config) => ({
                ...config,
                menuTheme: _val === 'dark' ? 'dark' : 'light',
                colorScheme: _val,
            }));

            setTimeout(() => {
                if (_val === 'dark') {
                    this.componentTheme =
                        this.componentTheme === 'black'
                            ? 'purple'
                            : this.componentTheme;
                }
            }, 10);
        }
    }

    get inputStyle(): string {
        return this.layoutService.config().inputStyle;
    }
    set inputStyle(_val: string) {
        this.layoutService.config.update((config) => ({
            ...config,
            inputStyle: _val,
        }));
    }

    get ripple(): boolean {
        return this.layoutService.config().ripple;
    }
    set ripple(_val: boolean) {
        this.layoutService.config.update((config) => ({
            ...config,
            ripple: _val,
        }));
    }

    get menuTheme(): string {
        return this.layoutService.config().menuTheme;
    }
    set menuTheme(_val: ColorScheme) {
        this.layoutService.config.update((config) => ({
            ...config,
            menuTheme: _val,
        }));
    }

    get topbarTheme(): string {
        return this.layoutService.config().topbarTheme;
    }
    set topbarTheme(_val: string) {
        this.layoutService.config.update((config) => ({
            ...config,
            topbarTheme: _val,
        }));
    }

    get componentTheme(): string {
        return this.layoutService.config().componentTheme;
    }
    set componentTheme(_val: string) {
        this.layoutService.config.update((config) => ({
            ...config,
            componentTheme: _val,
        }));
    }

    ngOnInit() {
        this.componentThemes = [
            { name: 'purple', color: '#6f42c1' },
            { name: 'indigo', color: '#6610f2' },
            { name: 'pink', color: '#d63384' },
            { name: 'blue', color: '#0d6efd' },
            { name: 'cyan', color: '#0dcaf0' },
            { name: 'teal', color: '#20c997' },
            { name: 'green', color: '#198754' },
            { name: 'yellow', color: '#ffc107' },
            { name: 'orange', color: '#fd7e14' },
            { name: 'black', color: '#000000' },
        ];

        this.menuThemes = [
            { name: 'light', color: '#ffffff' },
            { name: 'dark', color: '#212529' },
        ];

        this.topbarThemes = [
            { name: 'light', color: '#FFFFFF' },
            { name: 'dark', color: '#212529' },
            { name: 'blue', color: '#1565C0' },
            { name: 'purple', color: '#6A1B9A' },
            { name: 'pink', color: '#AD1457' },
            { name: 'cyan', color: '#0097A7' },
            { name: 'teal', color: '#00796B' },
            { name: 'green', color: '#43A047' },
            { name: 'yellow', color: '#FBC02D' },
            { name: 'orange', color: '#FB8C00' },
            { name: 'indigo', color: '#3F51B5' },
        ];

        this.scenes = [
            {
                sceneName: 'Green Light',
                colorScheme: 'light',
                colorSchemeColor: '#EFEFEF',
                menuTheme: 'light',
                menuThemeColor: '#ffffff',
                componentTheme: 'green',
                componentThemeColor: '#198754',
                topbarTheme: 'green',
                topbarThemeColor: '#43A047',
                menuMode: 'static',
                cardColor: '#ffffff',
            },
            {
                sceneName: 'Dark Sea',
                colorScheme: 'dark',
                colorSchemeColor: '#20262e',
                menuTheme: 'dark',
                menuThemeColor: '#2a323d',
                componentTheme: 'cyan',
                componentThemeColor: '#0dcaf0',
                topbarTheme: 'cyan',
                topbarThemeColor: '#0097A7',
                menuMode: 'static',
                cardColor: '#2a323d',
            },
            {
                sceneName: 'Blue Marble',
                colorScheme: 'light',
                colorSchemeColor: '#EFEFEF',
                menuTheme: 'light',
                menuThemeColor: '#ffffff',
                componentTheme: 'blue',
                componentThemeColor: '#0d6efd',
                topbarTheme: 'blue',
                topbarThemeColor: '#1565C0',
                menuMode: 'static',
                cardColor: '#ffffff',
            },
            {
                sceneName: 'Emerald',
                colorScheme: 'dark',
                colorSchemeColor: '#20262e',
                menuTheme: 'dark',
                menuThemeColor: '#2a323d',
                componentTheme: 'teal',
                componentThemeColor: '#20c997',
                topbarTheme: 'teal',
                topbarThemeColor: '#00796B',
                menuMode: 'static',
                cardColor: '#2a323d',
            },
            {
                sceneName: 'Piano Black',
                colorScheme: 'light',
                colorSchemeColor: '#EFEFEF',
                menuTheme: 'light',
                menuThemeColor: '#ffffff',
                componentTheme: 'black',
                componentThemeColor: '#000000',
                topbarTheme: 'light',
                topbarThemeColor: '#FFFFFF',
                menuMode: 'static',
                cardColor: '#ffffff',
            },
            {
                sceneName: 'Bolt',
                colorScheme: 'dark',
                colorSchemeColor: '#20262e',
                menuTheme: 'dark',
                menuThemeColor: '#2a323d',
                componentTheme: 'yellow',
                componentThemeColor: '#ffc107',
                topbarTheme: 'yellow',
                topbarThemeColor: '#FBC02D',
                menuMode: 'static',
                cardColor: '#2a323d',
            },
            {
                sceneName: 'Amber',
                colorScheme: 'light',
                colorSchemeColor: '#EFEFEF',
                menuTheme: 'dark',
                menuThemeColor: '#212529',
                componentTheme: 'yellow',
                componentThemeColor: '#ffc107',
                topbarTheme: 'yellow',
                topbarThemeColor: '#FBC02D',
                menuMode: 'horizontal',
                cardColor: '#ffffff',
            },
            {
                sceneName: 'Kingdom',
                colorScheme: 'dark',
                colorSchemeColor: '#20262e',
                menuTheme: 'dark',
                menuThemeColor: '#2a323d',
                componentTheme: 'indigo',
                componentThemeColor: '#6610f2',
                topbarTheme: 'purple',
                topbarThemeColor: '#6A1B9A',
                menuMode: 'reveal',
                cardColor: '#2a323d',
            },
        ];
    }

    onConfigButtonClick() {
        this.layoutService.showConfigSidebar();
    }

    changeTheme(theme: string) {
        this.componentTheme = theme;
    }

    changeTopbarTheme(theme: string) {
        this.topbarTheme = theme;
    }

    changeMenuTheme(theme: ColorScheme) {
        this.menuTheme = theme;
    }

    decrementScale() {
        this.scale--;
    }

    incrementScale() {
        this.scale++;
    }

    changeScene(item: any) {
        const {
            colorScheme,
            componentTheme,
            menuTheme,
            topbarTheme,
            menuMode,
            sceneName,
        } = item;
        this.selectedScene.set(sceneName);
        this.colorScheme = colorScheme;
        this.componentTheme = componentTheme;
        this.menuTheme = menuTheme;
        this.topbarTheme = topbarTheme;
        this.menuMode = menuMode;

        console.log(item);
    }
}
