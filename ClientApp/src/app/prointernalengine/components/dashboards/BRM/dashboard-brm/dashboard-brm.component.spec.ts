import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardBrmComponent } from './dashboard-brm.component';

describe('DashboardBrmComponent', () => {
  let component: DashboardBrmComponent;
  let fixture: ComponentFixture<DashboardBrmComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardBrmComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DashboardBrmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
