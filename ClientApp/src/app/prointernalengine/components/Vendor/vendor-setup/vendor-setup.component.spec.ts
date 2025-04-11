import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VendorSetupComponent } from './vendor-setup.component';

describe('VendorSetupComponent', () => {
  let component: VendorSetupComponent;
  let fixture: ComponentFixture<VendorSetupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VendorSetupComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(VendorSetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
