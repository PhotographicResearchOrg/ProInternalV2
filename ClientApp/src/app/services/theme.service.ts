import { Injectable } from '@angular/core';


@Injectable({
  providedIn: 'root'
})
export class ThemeService  {

  constructor() { }

  switchTheme(themeName: string) {
    const themeLink = document.getElementById('theme-css') as HTMLLinkElement;
    themeLink.href = `assets/themes/${themeName}/theme.css`;
  }



}
