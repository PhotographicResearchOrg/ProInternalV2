import { Component, Input, OnChanges, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { HomePin, HomePinService } from 'src/app/services/home-pin.service';

/** "Pin to home" on any desk drawer: puts a shortcut to it on the person's home page. */
@Component({
  selector: 'app-home-pin',
  template: `
    <button type="button" class="pinbtn" [class.on]="pinned" [disabled]="busy || !pin"
            (click)="toggle()" [attr.aria-pressed]="pinned"
            [pTooltip]="pinned ? 'On your home page. Click to remove it.' : 'Put a shortcut to this on your home page'" tooltipPosition="bottom">
      <i class="pi" [ngClass]="pinned ? 'pi-bookmark-fill' : 'pi-bookmark'"></i><span *ngIf="!compact">{{ pinned ? 'On home' : 'Pin to home' }}</span>
    </button>`,
  styles: [`
    .pinbtn { border: 1px solid #d9dee6; background: #fff; color: #5c6b81; border-radius: 8px; padding: 6px 10px; font: inherit; font-size: 12.5px;
              font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
    .pinbtn.on { color: #0e7c73; border-color: #b7e0dc; background: #dff1ef; }
    .pinbtn:disabled { opacity: .6; cursor: default; }
    .pinbtn:focus-visible { outline: 2px solid #0e7c73; outline-offset: 2px; }
    .pinbtn i { font-size: 12px; }
  `]
})
export class HomePinComponent implements OnInit, OnChanges, OnDestroy {
  @Input() pin: HomePin | null = null;
  @Input() compact = false;
  pinned = false;
  busy = false;
  private sub?: Subscription;

  constructor(private pins: HomePinService) { }

  ngOnInit(): void {
    this.pins.ensure();
    this.sub = this.pins.changes.subscribe(() => this.pinned = !!this.pin && this.pins.isPinned(this.pin.id));
  }

  ngOnChanges(): void { this.pinned = !!this.pin && this.pins.isPinned(this.pin.id); }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  toggle(): void {
    if (!this.pin) return;
    this.busy = true;
    const done = () => this.busy = false;
    (this.pinned ? this.pins.unpin(this.pin.id) : this.pins.pin(this.pin)).subscribe({ next: done, error: done });
  }
}
