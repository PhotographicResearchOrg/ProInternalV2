import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IrSetupDashboardComponent } from './ir-setup-dashboard.component';

describe('IrSetupDashboardComponent', () => {
  let component: IrSetupDashboardComponent;
  let fixture: ComponentFixture<IrSetupDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IrSetupDashboardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(IrSetupDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
