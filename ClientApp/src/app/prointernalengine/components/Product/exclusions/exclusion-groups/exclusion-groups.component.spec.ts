import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExclusionGroupsComponent } from './exclusion-groups.component';

describe('ExclusionGroupsComponent', () => {
  let component: ExclusionGroupsComponent;
  let fixture: ComponentFixture<ExclusionGroupsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExclusionGroupsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ExclusionGroupsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
