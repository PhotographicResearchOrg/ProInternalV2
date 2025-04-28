import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatronageComponent } from './patronage.component';

describe('PatronageComponent', () => {
  let component: PatronageComponent;
  let fixture: ComponentFixture<PatronageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatronageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PatronageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
