import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VendorSellthroughComponent } from './vendor-sellthrough.component';

describe('VendorSellthroughComponent', () => {
  let component: VendorSellthroughComponent;
  let fixture: ComponentFixture<VendorSellthroughComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VendorSellthroughComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(VendorSellthroughComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
