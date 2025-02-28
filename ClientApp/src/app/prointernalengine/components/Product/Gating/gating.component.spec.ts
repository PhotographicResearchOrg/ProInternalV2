import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GatingComponent } from './gating.component';

describe('GatingComponent', () => {
  let component: GatingComponent;
  let fixture: ComponentFixture<GatingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GatingComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GatingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
