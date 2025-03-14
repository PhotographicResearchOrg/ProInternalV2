import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrandExclusionsComponent } from './brand-exclusions.component';

describe('BrandExclusionsComponent', () => {
  let component: BrandExclusionsComponent;
  let fixture: ComponentFixture<BrandExclusionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrandExclusionsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BrandExclusionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
