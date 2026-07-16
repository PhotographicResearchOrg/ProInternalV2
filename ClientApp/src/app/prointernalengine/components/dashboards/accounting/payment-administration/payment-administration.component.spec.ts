import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentAdministrationComponent } from './payment-administration.component';

describe('PaymentAdministrationComponent', () => {
  let component: PaymentAdministrationComponent;
  let fixture: ComponentFixture<PaymentAdministrationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentAdministrationComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PaymentAdministrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
