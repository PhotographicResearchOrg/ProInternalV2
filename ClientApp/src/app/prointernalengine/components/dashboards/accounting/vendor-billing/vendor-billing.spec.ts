import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VendorBilling } from './vendor-billing';

describe('VendorBilling', () => {
  let component: VendorBilling;
  let fixture: ComponentFixture<VendorBilling>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VendorBilling]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VendorBilling);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
