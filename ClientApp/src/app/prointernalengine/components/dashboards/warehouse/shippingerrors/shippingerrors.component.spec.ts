import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShippingerrorsComponent } from './shippingerrors.component';

describe('ShippingerrorsComponent', () => {
  let component: ShippingerrorsComponent;
  let fixture: ComponentFixture<ShippingerrorsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShippingerrorsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ShippingerrorsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
