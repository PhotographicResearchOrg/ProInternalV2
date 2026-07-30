import { Injectable } from '@angular/core';

export interface FavoriteFolder {
  path: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly storageKey = 'fileFavorites';

  list(): FavoriteFolder[] {
    try { return JSON.parse(localStorage.getItem(this.storageKey) || '[]'); }
    catch { return []; }
  }

  isFavorite(path: string): boolean {
    return this.list().some(f => f.path === path);
  }

  toggle(path: string, label: string): FavoriteFolder[] {
    const favorites = this.isFavorite(path)
      ? this.list().filter(f => f.path !== path)
      : [...this.list(), { path, label }];
    localStorage.setItem(this.storageKey, JSON.stringify(favorites));
    return favorites;
  }

  remove(path: string): FavoriteFolder[] {
    const favorites = this.list().filter(f => f.path !== path);
    localStorage.setItem(this.storageKey, JSON.stringify(favorites));
    return favorites;
  }
}
