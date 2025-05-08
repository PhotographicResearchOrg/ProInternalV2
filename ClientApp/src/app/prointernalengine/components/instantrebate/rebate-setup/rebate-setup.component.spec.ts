import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RebateSetupComponent } from './rebate-setup.component';

describe('RebateSetupComponent', () => {
  let component: RebateSetupComponent;
  let fixture: ComponentFixture<RebateSetupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RebateSetupComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RebateSetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
