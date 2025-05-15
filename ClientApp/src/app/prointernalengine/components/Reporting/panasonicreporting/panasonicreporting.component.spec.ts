import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PanasonicreportingComponent } from './panasonicreporting.component';

describe('PanasonicreportingComponent', () => {
  let component: PanasonicreportingComponent;
  let fixture: ComponentFixture<PanasonicreportingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PanasonicreportingComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PanasonicreportingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
