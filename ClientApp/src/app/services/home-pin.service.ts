import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';

/** A drawer pinned from a desk to the home page. */
export interface HomePin {
  /** stable id, e.g. 'vendor:1023:terms' */
  id: string;
  label: string;
  /** where it lives, e.g. 'Vendor Desk · Terms & Financials' */
  sub?: string | null;
  icon?: string | null;
  route: string;
  query?: Record<string, string> | null;
  /** a home tile key whose number to show on the pin (optional) */
  metric?: string | null;
}

export interface HomeLayout { tiles: string[] | null; pins: HomePin[]; }

/** Each person's home page: the tiles they chose and the drawers they pinned (api/home/layout). */
@Injectable({ providedIn: 'root' })
export class HomePinService {
  private layout$ = new BehaviorSubject<HomeLayout | null>(null);
  private loading = false;

  constructor(private api: ApiService) { }

  get changes(): Observable<HomeLayout | null> { return this.layout$.asObservable(); }

  load(force = false): Observable<HomeLayout> {
    const have = this.layout$.value;
    if (have && !force) return of(have);
    return this.api.get<{ json: string | null }>('API/home/layout').pipe(
      map(r => this.parse(r?.json)),
      catchError(() => of({ tiles: null, pins: [] } as HomeLayout)),
      tap(l => this.layout$.next(l))
    );
  }

  /** make sure the layout is loaded (for pin buttons on desks) */
  ensure(): void {
    if (this.layout$.value || this.loading) return;
    this.loading = true;
    this.load().subscribe({ complete: () => this.loading = false });
  }

  isPinned(id: string): boolean { return !!this.layout$.value?.pins.some(p => p.id === id); }

  pin(p: HomePin): Observable<boolean> {
    const l = this.layout$.value || { tiles: null, pins: [] };
    if (l.pins.some(x => x.id === p.id)) return of(true);
    return this.save({ tiles: l.tiles, pins: [...l.pins, p] });
  }

  unpin(id: string): Observable<boolean> {
    const l = this.layout$.value || { tiles: null, pins: [] };
    return this.save({ tiles: l.tiles, pins: l.pins.filter(x => x.id !== id) });
  }

  save(l: HomeLayout): Observable<boolean> {
    const body: any = { pins: l.pins };
    if (l.tiles) body.tiles = l.tiles;
    return this.api.put<{ saved: boolean }>('API/home/layout', { json: JSON.stringify(body) }).pipe(
      tap(() => this.layout$.next({ tiles: l.tiles, pins: l.pins })),
      map(() => true)
    );
  }

  reset(): Observable<boolean> {
    return this.api.delete<{ saved: boolean }>('API/home/layout').pipe(
      tap(() => this.layout$.next({ tiles: null, pins: [] })),
      map(() => true)
    );
  }

  private parse(json: string | null | undefined): HomeLayout {
    try {
      const o = json ? JSON.parse(json) : null;
      return { tiles: Array.isArray(o?.tiles) && o.tiles.length ? o.tiles : null, pins: Array.isArray(o?.pins) ? o.pins : [] };
    } catch { return { tiles: null, pins: [] }; }
  }
}

/** Same pin object for the same id, so a desk can build its pin in a getter without changing the input every check. */
const pinCache = new Map<string, HomePin>();
export function stablePin(p: HomePin): HomePin {
  const have = pinCache.get(p.id);
  if (have && have.label === p.label && have.sub === p.sub) return have;
  pinCache.set(p.id, p);
  return p;
}
