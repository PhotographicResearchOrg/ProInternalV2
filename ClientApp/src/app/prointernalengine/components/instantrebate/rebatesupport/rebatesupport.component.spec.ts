import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RebatesupportComponent } from './rebatesupport.component';

describe('RebatesupportComponent', () => {
  let component: RebatesupportComponent;
  let fixture: ComponentFixture<RebatesupportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RebatesupportComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RebatesupportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
