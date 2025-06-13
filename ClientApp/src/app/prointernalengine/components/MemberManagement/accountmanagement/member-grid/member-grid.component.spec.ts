import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberGridComponent } from './member-grid.component';

describe('MemberGridComponent', () => {
  let component: MemberGridComponent;
  let fixture: ComponentFixture<MemberGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberGridComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MemberGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
