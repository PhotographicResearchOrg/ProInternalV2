import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Rail, RebateDeskService, apiMessage } from 'src/app/services/rebate-desk.service';

/* Finds a rebate product (dbo.RebateCameraModels, the rebate setup) by description or PRO code, on one rail. Not the PRO catalog. */
@Component({
  selector: 'app-rebate-product-picker',
  template: `
    <div class="typeahead">
      <input class="in" [placeholder]="placeholder" [(ngModel)]="text" (ngModelChange)="search$.next($event)"
             (focus)="open = true" (blur)="closeSoon()" />
      <div class="options" *ngIf="open && (error || searched)">
        <div class="opt sub" *ngIf="error" style="color: #b42318">Search failed: {{ error }}</div>
        <div class="opt sub" *ngIf="!error && !options.length">No rebate products match "{{ text }}".</div>
        <div class="opt" *ngFor="let p of options" (mousedown)="choose(p)">
          <b>{{ p.description }}</b>
          <span class="sub"> · PRO {{ p.proCodes || p.proCodeText }} · {{ p.vendorName }}</span>
          <span class="chip bad" *ngIf="!p.isActive">retired</span>
        </div>
      </div>
    </div>`,
  styleUrls: ['./rebate-desk.shared.scss']
})
export class RebateProductPickerComponent implements OnDestroy {
  @Input() rail: Rail = 'IR';
  @Input() vendorId: number | null = null;
  @Input() placeholder = 'Search rebate products: description or PRO code';
  @Input() set initial(v: string | null | undefined) {
    if (v) { this.text = v; this.search$.next(v); }
  }
  @Output() picked = new EventEmitter<any>();

  text = '';
  open = false;
  options: any[] = [];
  error = '';
  searched = false;
  search$ = new Subject<string>();
  private sub: Subscription;

  constructor(private desk: RebateDeskService) {
    this.sub = this.search$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => (q && q.trim().length >= 2)
        ? this.desk.products(this.rail, { q: q.trim(), vendorId: this.vendorId, pageSize: 20 }).pipe(
            catchError(e => of({ total: 0, rows: [], error: apiMessage(e) })))
        : of({ total: 0, rows: [], idle: true }))
    ).subscribe((r: any) => {
      this.options = r.rows ?? [];
      this.error = r.error ?? '';
      this.searched = !r.idle;
    });
  }

  choose(p: any): void {
    this.text = p.description;
    this.open = false;
    this.picked.emit(p);
  }

  closeSoon(): void {
    setTimeout(() => (this.open = false), 150);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
