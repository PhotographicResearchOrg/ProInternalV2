import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShippingerrorbrmComponent } from './shippingerrorbrm.component';

describe('ShippingerrorbrmComponent', () => {
  let component: ShippingerrorbrmComponent;
  let fixture: ComponentFixture<ShippingerrorbrmComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShippingerrorbrmComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ShippingerrorbrmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
