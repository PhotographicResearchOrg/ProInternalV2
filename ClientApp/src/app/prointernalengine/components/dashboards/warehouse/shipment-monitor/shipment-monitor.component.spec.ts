import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShipmentMonitorComponent } from './shipment-monitor.component';

describe('ShipmentMonitorComponent', () => {
  let component: ShipmentMonitorComponent;
  let fixture: ComponentFixture<ShipmentMonitorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShipmentMonitorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ShipmentMonitorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
