import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VendorStockComponent } from './vendor-stock.component';

describe('VendorStockComponent', () => {
  let component: VendorStockComponent;
  let fixture: ComponentFixture<VendorStockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VendorStockComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(VendorStockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
