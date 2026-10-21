import { Directive, EventEmitter, HostBinding, HostListener, Input, Output, Pipe, PipeTransform } from '@angular/core';

/* Click-to-sort column headers for every Rebate Desk table.

   Component:   sorts = rdSorts();                       // one state per table, created on first use
   Header:      <th rdSort="claimDate" [rdSortBy]="sorts['claims']">Claimed</th>
                <th [rdSort]="byState" [rdSortBy]="sorts['claims']">State</th>   (byState = (r) => ...)
   Rows:        *ngFor="let c of rows | rdSort:sorts['claims'] | slice:0:take"

   Lists paged on the server: leave the pipe off and reload on (rdSortChange); the state's key and
   dir go to the API as sort / desc (desc = true).

   First click sorts ascending, second descending, third goes back to the list's own order.
   Blanks always sort last. Numbers (and all-digit text such as claim numbers) sort as numbers;
   dates written yyyy-mm-dd sort as text, which is the same as by date. */

export type RdSortKey = string | ((row: any) => any);
export interface RdSortState { key: RdSortKey | null; dir: 1 | -1; }

export function rdSorts(): Record<string, RdSortState> {
  const store: Record<string, RdSortState> = {};
  return new Proxy(store, {
    get(t, name: string) {
      if (typeof name !== 'string') return (t as any)[name];
      if (!t[name]) t[name] = { key: null, dir: 1 };
      return t[name];
    }
  });
}

function valueOf(row: any, key: RdSortKey): any {
  if (typeof key === 'function') return key(row);
  let v = row;
  for (const part of key.split('.')) { if (v == null) return null; v = v[part]; }
  return v;
}

const NUMERIC = /^\s*-?\d+(\.\d+)?\s*$/;

function comparable(v: any): { blank: boolean; num?: number; text?: string } {
  if (v === null || v === undefined || v === '') return { blank: true };
  if (typeof v === 'number') return isNaN(v) ? { blank: true } : { blank: false, num: v };
  if (typeof v === 'boolean') return { blank: false, num: v ? 1 : 0 };
  if (v instanceof Date) return { blank: false, num: v.getTime() };
  const s = String(v);
  if (NUMERIC.test(s)) return { blank: false, num: parseFloat(s) };
  return { blank: false, text: s };
}

export function rdCompare(a: any, b: any): number {
  const x = comparable(a), y = comparable(b);
  if (x.blank || y.blank) return x.blank === y.blank ? 0 : x.blank ? 1 : -1;
  if (x.num !== undefined && y.num !== undefined) return x.num - y.num;
  if (x.num !== undefined) return -1;
  if (y.num !== undefined) return 1;
  return (x.text as string).localeCompare(y.text as string, undefined, { numeric: true, sensitivity: 'base' });
}

@Directive({ selector: 'th[rdSort]' })
export class RebateSortHeaderDirective {
  @Input() rdSort!: RdSortKey;
  @Input() rdSortBy?: RdSortState;
  @Output() rdSortChange = new EventEmitter<RdSortState>();

  @HostBinding('class.sortable') readonly sortable = true;
  @HostBinding('attr.title') get hint() { return 'Sort by this column'; }
  @HostBinding('class.asc') get asc() { return !!this.rdSortBy && this.rdSortBy.key === this.rdSort && this.rdSortBy.dir === 1; }
  @HostBinding('class.desc') get desc() { return !!this.rdSortBy && this.rdSortBy.key === this.rdSort && this.rdSortBy.dir === -1; }
  @HostBinding('attr.aria-sort') get ariaSort() { return this.asc ? 'ascending' : this.desc ? 'descending' : null; }

  @HostListener('click', ['$event'])
  toggle(e: MouseEvent) {
    const s = this.rdSortBy;
    if (!s) return;
    const t = e.target as HTMLElement;
    if (t && t.closest('input, button, select, a')) return;   // a checkbox or button inside the header
    if (s.key !== this.rdSort) { s.key = this.rdSort; s.dir = 1; }
    else if (s.dir === 1) s.dir = -1;
    else { s.key = null; s.dir = 1; }
    this.rdSortChange.emit(s);
  }
}

/* Impure so a header click re-sorts at once; the result is kept until the list, its length or the sort changes. */
@Pipe({ name: 'rdSort', pure: false })
export class RebateSortPipe implements PipeTransform {
  private lastRows: any[] | null = null;
  private lastLen = -1;
  private lastKey: RdSortKey | null = null;
  private lastDir = 1;
  private result: any[] = [];

  /* Lists built by getters are new arrays on every check: same rows in the same order count as unchanged. */
  private sameRows(rows: any[]): boolean {
    const last = this.lastRows;
    if (!last || rows.length !== this.lastLen) return false;
    for (let i = 0; i < rows.length; i++) if (rows[i] !== last[i]) return false;
    return true;
  }

  transform<T>(rows: T[] | null | undefined, s?: RdSortState): T[] {
    if (!rows) return [];
    if (!s || !s.key) { this.lastRows = null; return rows; }
    if (s.key === this.lastKey && s.dir === this.lastDir && this.sameRows(rows))
      return this.result as T[];
    const key = s.key, dir = s.dir;
    this.result = rows.slice().sort((a, b) => {
      const va = valueOf(a, key), vb = valueOf(b, key);
      const ba = comparable(va).blank, bb = comparable(vb).blank;
      if (ba || bb) return ba === bb ? 0 : ba ? 1 : -1;      // blanks last either way
      return dir * rdCompare(va, vb);
    });
    this.lastRows = rows.slice(); this.lastLen = rows.length; this.lastKey = key; this.lastDir = dir;
    return this.result as T[];
  }
}

/* The query-string form of a sort, for lists sorted on the server. */
export function rdSortParams(s?: RdSortState): { sort?: string; desc?: boolean } {
  return s && typeof s.key === 'string' ? { sort: s.key, desc: s.dir === -1 } : {};
}
