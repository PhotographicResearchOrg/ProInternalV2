import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DataService } from 'src/app/services/data.service';
import { AuthService } from 'src/app/services/auth.service';
import { HomePin, HomePinService } from 'src/app/services/home-pin.service';

type Tone = 'ok' | 'warn' | 'bad' | 'none';
type Source = 'orders' | 'sar' | 'edi' | 'ir' | 'ship' | 'comments' | 'map' | 'brands' | 'cutover';

interface TileDef {
  key: string;
  label: string;
  icon: string;
  /** the screen it opens; also decides who sees it (Security Admin routes) */
  route: string | null;
  /** route to check when the tile has no screen of its own */
  needs?: string;
  source: Source;
  hint: string;
}
interface TileView { def: TileDef; value: string; sub: string; tone: Tone; loading: boolean; }

/* Every tile there is. One default set for everyone; each person picks and orders their own. */
const TILES: TileDef[] = [
  { key: 'orders.onhold', label: 'Orders on hold', icon: 'pi pi-clock', route: '/orders', source: 'orders', hint: 'Orders held, oldest first' },
  { key: 'orders.open', label: 'Open orders', icon: 'pi pi-shopping-cart', route: '/orders', source: 'orders', hint: 'Orders waiting to process' },
  { key: 'orders.specials', label: 'Special orders', icon: 'pi pi-star', route: '/orders', source: 'orders', hint: 'Special orders open' },
  { key: 'orders.dropship', label: 'Drop-ship orders', icon: 'pi pi-send', route: '/orders', source: 'orders', hint: 'Against the drop-ship alert level' },
  { key: 'edi.open', label: 'EDI orders open', icon: 'pi pi-file-import', route: '/orders/edi', source: 'edi', hint: 'Against the EDI alert level' },
  { key: 'ship.errors', label: 'Shipping errors', icon: 'pi pi-flag', route: '/shippingerror', source: 'ship', hint: 'Open shipping errors' },
  { key: 'sar.queue', label: 'SARs in queue', icon: 'pi pi-inbox', route: null, needs: '/dashboard-landing', source: 'sar', hint: 'PRO hold and member credits' },
  { key: 'ir.queue', label: 'Instant rebates in queue', icon: 'pi pi-ticket', route: '/rebatedesk', source: 'ir', hint: 'Against the rebate alert level' },
  { key: 'comments.open', label: 'Connection comments unanswered', icon: 'pi pi-comments', route: null, needs: '/dashboard-landing', source: 'comments', hint: 'Comments on Connection articles' },
  { key: 'map.violations', label: 'MAP violations submitted', icon: 'pi pi-exclamation-triangle', route: '/map-violations', source: 'map', hint: 'Submitted MAP violations' },
  { key: 'brands.novendor', label: 'Brands with no vendor', icon: 'pi pi-tags', route: '/brandvendors', source: 'brands', hint: 'Brands not linked to a vendor' },
  { key: 'cutover.computyme', label: 'Sections still on Computyme', icon: 'pi pi-map', route: '/cutover', source: 'cutover', hint: 'From the cutover map' }
];
const DEFAULT_TILES = ['orders.onhold', 'orders.open', 'edi.open', 'ship.errors', 'sar.queue', 'ir.queue', 'comments.open', 'brands.novendor'];

/** Home: the numbers people act on, as tiles. Each tile opens the screen that clears it. */
@Component({
  selector: 'app-home-desk',
  templateUrl: './home-desk.component.html',
  styleUrls: ['../../Vendor/vendor-desk/desk-shell.scss', './home-desk.component.scss']
})
export class HomeDeskComponent implements OnInit {
  available: TileDef[] = [];
  tiles: TileView[] = [];
  chosen: string[] = [];
  customizing = false;
  draft: { key: string; on: boolean }[] = [];
  saving = false;
  error = '';
  showClassic = false;
  greeting = '';
  pins: HomePin[] = [];
  view: 'today' | 'classic' = 'today';
  metrics: Record<string, TileView> = {};

  constructor(private data: DataService, private auth: AuthService, private pinsSvc: HomePinService, private router: Router) { }

  ngOnInit(): void {
    const h = new Date().getHours();
    this.greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const allowed = new Set(this.auth.getAllowedRoutes());
    const can = (r: string) => allowed.has(r.toLowerCase()) || allowed.has(r.replace(/^\//, '').toLowerCase());
    this.available = TILES.filter(t => can(t.route || t.needs || '/dashboard-landing'));

    this.pinsSvc.load(true).subscribe(l => {
      this.pins = l.pins || [];
      this.apply(l.tiles?.length ? l.tiles : DEFAULT_TILES);
    });
  }

  private apply(keys: string[]): void {
    const byKey = new Map(this.available.map(t => [t.key, t]));
    this.chosen = keys.filter(k => byKey.has(k));
    this.tiles = this.chosen.map(k => ({ def: byKey.get(k)!, value: '…', sub: '', tone: 'none', loading: true }));
    /* pins that show a number reuse the tile's figures */
    const extra = this.pins.map(p => p.metric).filter((m): m is string => !!m && !this.chosen.includes(m) && byKey.has(m));
    const hidden = extra.map(k => ({ def: byKey.get(k)!, value: '…', sub: '', tone: 'none' as Tone, loading: true }));
    this.metrics = {};
    [...this.tiles, ...hidden].forEach(t => this.metrics[t.def.key] = t);
    this.load([...this.tiles, ...hidden]);
  }

  private load(all: TileView[]): void {
    const need = new Set(all.map(t => t.def.source));
    const safe = <T>(o: any) => (o as any).pipe(catchError(() => of(null as T | null)));
    const calls: Record<string, any> = {};
    if (need.has('orders')) calls['orders'] = safe(this.data.getOrderMetrics());
    if (need.has('sar')) calls['sar'] = safe(this.data.getSARSMetrics());
    if (need.has('edi')) calls['edi'] = safe(this.data.getEDIMetrics());
    if (need.has('ir')) calls['ir'] = safe(this.data.getIRMetrics());
    if (need.has('ship')) calls['ship'] = safe(this.data.getShippingErrorMetrics());
    if (need.has('comments')) calls['comments'] = safe(this.data.getCommentMetrics());
    if (need.has('map')) calls['map'] = safe(this.data.getAllMapViolations());
    if (need.has('brands')) calls['brands'] = safe(this.data.brandVendors(null));
    if (need.has('cutover')) calls['cutover'] = safe(this.data.cutoverMap());
    if (!Object.keys(calls).length) return;
    forkJoin(calls).subscribe((r: any) => all.forEach(t => this.fill(t, r)));
  }

  private fill(t: TileView, r: any): void {
    const n = (v: any) => (v == null || isNaN(+v) ? null : +v);
    const ago = (d: any) => { if (!d) return ''; const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000); return days > 0 ? `oldest ${days} day${days === 1 ? '' : 's'}` : 'oldest today'; };
    const set = (value: number | null, sub: string, tone: Tone) => { t.value = value == null ? '—' : value.toLocaleString(); t.sub = value == null ? 'Couldn\'t load' : sub; t.tone = value == null ? 'none' : tone; t.loading = false; };
    const o = r.orders, s = r.sar, e = r.edi, i = r.ir, sh = r.ship, c = r.comments;
    switch (t.def.key) {
      case 'orders.onhold': { const v = n(o?.onHoldOrders); set(v, v ? ago(o?.oldestOnHold) : 'Nothing on hold', v ? 'warn' : 'ok'); break; }
      case 'orders.open': set(n(o?.openOrders), o?.lastRunTime ? `last run ${new Date(o.lastRunTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '', 'none'); break;
      case 'orders.specials': set(n(o?.specialsOrders), 'open', 'none'); break;
      case 'orders.dropship': { const v = n(o?.dropShipOrders), th = n(o?.dropShipThreshold); set(v, th ? `alert at ${th}` : '', v != null && th != null && v >= th ? 'bad' : 'ok'); break; }
      case 'edi.open': { const v = n(e?.openEDIOrders), th = n(e?.ediAlertThreshold); set(v, v ? ago(e?.oldestInQueue) : 'All clear', v != null && th != null && v >= th ? 'bad' : v ? 'warn' : 'ok'); break; }
      case 'ship.errors': { const v = n(sh?.openShippingErrors), th = n(sh?.threshold); set(v, v ? ago(sh?.oldestInQueue) : 'All clear', v != null && th != null && v >= th ? 'bad' : v ? 'warn' : 'ok'); break; }
      case 'sar.queue': { const v = n(s?.totalInQueue); set(v, v ? `${n(s?.proHoldInQueue) ?? 0} PRO hold · ${n(s?.memCreditsInQueue) ?? 0} member credits` : 'All clear', v ? 'warn' : 'ok'); break; }
      case 'ir.queue': { const v = n(i?.irsInQueue), th = n(i?.threshold); set(v, v ? ago(i?.oldestInQueue) : 'All clear', v != null && th != null && v >= th ? 'bad' : v ? 'warn' : 'ok'); break; }
      case 'comments.open': { const v = n(c?.unresponded); set(v, v ? 'waiting for a reply' : 'All answered', v ? 'warn' : 'ok'); break; }
      case 'map.violations': { const v = Array.isArray(r.map) ? r.map.length : null; set(v, 'submitted', 'none'); break; }
      case 'brands.novendor': { const b = r.brands?.brands; const v = Array.isArray(b) ? b.filter((x: any) => x.linkStatus === 'NO_VENDOR').length : null; set(v, v ? 'link them on Brands & vendors' : 'Every brand has a vendor', v ? 'bad' : 'ok'); break; }
      case 'cutover.computyme': { const sec = r.cutover?.sections; const v = Array.isArray(sec) ? sec.filter((x: any) => x.owner === 'COMPUTYME').length : null; set(v, Array.isArray(sec) ? `of ${sec.length} sections` : '', 'none'); break; }
    }
  }

  open(t: TileView): void {
    if (t.def.route) this.router.navigateByUrl(t.def.route);
    else this.view = 'classic';
  }

  openPin(p: HomePin): void {
    this.router.navigate([p.route], { queryParams: p.query || undefined });
  }

  unpin(p: HomePin, e?: Event): void {
    e?.stopPropagation();
    this.pinsSvc.unpin(p.id).subscribe(() => this.pins = this.pins.filter(x => x.id !== p.id));
  }

  movePin(i: number, d: number): void {
    const j = i + d;
    if (j < 0 || j >= this.pins.length) return;
    const next = [...this.pins];
    [next[i], next[j]] = [next[j], next[i]];
    this.pins = next;
    this.pinsSvc.save({ tiles: this.chosen, pins: next }).subscribe();
  }

  /* ------------------------------------------------------------ customize */

  startCustomize(): void {
    const on = new Set(this.chosen);
    this.draft = [
      ...this.chosen.map(k => ({ key: k, on: true })),
      ...this.available.filter(t => !on.has(t.key)).map(t => ({ key: t.key, on: false }))
    ];
    this.customizing = true;
    this.error = '';
  }

  label(key: string): string { return this.available.find(t => t.key === key)?.label || key; }
  hint(key: string): string { return this.available.find(t => t.key === key)?.hint || ''; }

  move(i: number, d: number): void {
    const j = i + d;
    if (j < 0 || j >= this.draft.length) return;
    [this.draft[i], this.draft[j]] = [this.draft[j], this.draft[i]];
  }

  saveCustomize(): void {
    const keys = this.draft.filter(x => x.on).map(x => x.key);
    if (!keys.length) { this.error = 'Pick at least one tile.'; return; }
    this.saving = true;
    this.pinsSvc.save({ tiles: keys, pins: this.pins }).subscribe({
      next: () => { this.saving = false; this.customizing = false; this.apply(keys); },
      error: e => { this.saving = false; this.error = e?.error?.message || 'Couldn\'t save your tiles.'; }
    });
  }

  resetCustomize(): void {
    this.saving = true;
    this.pinsSvc.save({ tiles: null, pins: this.pins }).subscribe({
      next: () => { this.saving = false; this.customizing = false; this.apply(DEFAULT_TILES); },
      error: e => { this.saving = false; this.error = e?.error?.message || 'Couldn\'t reset.'; }
    });
  }

  trackTile = (_: number, t: TileView) => t.def.key;
  trackPin = (_: number, p: HomePin) => p.id;
}
