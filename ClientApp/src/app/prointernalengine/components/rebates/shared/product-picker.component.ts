import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Rail, RebateDeskService } from 'src/app/services/rebate-desk.service';

/* Finds a rebate product (model) by description, PRO code or id, on one rail. */
@Component({
  selector: 'app-rebate-product-picker',
  template: `
    <div class="typeahead">
      <input class="in" [placeholder]="placeholder" [(ngModel)]="text" (ngModelChange)="search$.next($event)"
             (focus)="open = true" (blur)="closeSoon()" />
      <div class="options" *ngIf="open && options.length">
        <div class="opt" *ngFor="let p of options" (mousedown)="choose(p)">
          <b>{{ p.description }}</b>
          <span class="sub"> · #{{ p.modelId }} · PRO {{ p.proCodes || p.proCodeText }} · {{ p.vendorName }}</span>
          <span class="chip bad" *ngIf="!p.isActive">retired</span>
        </div>
      </div>
    </div>`,
  styleUrls: ['./rebate-desk.shared.scss']
})
export class RebateProductPickerComponent implements OnDestroy {
  @Input() rail: Rail = 'IR';
  @Input() vendorId: number | null = null;
  @Input() placeholder = 'Search description or PRO code';
  @Input() set initial(v: string | null | undefined) {
    if (v) { this.text = v; this.search$.next(v); }
  }
  @Output() picked = new EventEmitter<any>();

  text = '';
  open = false;
  options: any[] = [];
  search$ = new Subject<string>();
  private sub: Subscription;

  constructor(private desk: RebateDeskService) {
    this.sub = this.search$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => (q && q.trim().length >= 2)
        ? this.desk.products(this.rail, { q: q.trim(), vendorId: this.vendorId, pageSize: 20 }).pipe(catchError(() => of({ total: 0, rows: [] })))
        : of({ total: 0, rows: [] }))
    ).subscribe(r => (this.options = r.rows));
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
