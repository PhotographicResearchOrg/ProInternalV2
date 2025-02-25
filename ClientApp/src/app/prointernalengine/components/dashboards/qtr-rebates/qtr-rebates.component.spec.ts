import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QtrRebatesComponent } from './qtr-rebates.component';

describe('QtrRebatesComponent', () => {
  let component: QtrRebatesComponent;
  let fixture: ComponentFixture<QtrRebatesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QtrRebatesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(QtrRebatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
