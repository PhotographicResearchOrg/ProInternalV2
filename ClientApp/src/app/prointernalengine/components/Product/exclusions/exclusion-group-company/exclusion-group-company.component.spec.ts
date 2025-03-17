import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExclusionGroupCompanyComponent } from './exclusion-group-company.component';

describe('ExclusionGroupCompanyComponent', () => {
  let component: ExclusionGroupCompanyComponent;
  let fixture: ComponentFixture<ExclusionGroupCompanyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExclusionGroupCompanyComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ExclusionGroupCompanyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
