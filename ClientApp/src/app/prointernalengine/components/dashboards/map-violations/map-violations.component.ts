import { Component } from '@angular/core';
import { HomePin, stablePin } from 'src/app/services/home-pin.service';

/** MAP violations: report one and review what's been submitted (moved off the dashboard into its own screen). */
@Component({
  selector: 'app-map-violations',
  template: `
    <div class="mv-head">
      <div>
        <h1>MAP violations</h1>
        <div class="sub">Report a dealer selling below MAP and review what's been submitted.</div>
      </div>
      <app-home-pin [pin]="pin"></app-home-pin>
    </div>
    <app-dashboard-classic only="map"></app-dashboard-classic>`,
  styles: [`
    :host { display: block; }
    .mv-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    h1 { margin: 0; font-size: 21px; font-weight: 700; color: #1a2434; }
    .sub { color: #5c6b81; font-size: 13px; margin-top: 4px; }
  `]
})
export class MapViolationsComponent {
  readonly pin: HomePin = stablePin({ id: 'map-violations', label: 'MAP violations', sub: 'Management', icon: 'pi pi-exclamation-triangle', route: '/map-violations', metric: 'map.violations' });
}
