import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AffiliateGridComponent } from './affiliate-grid.component';

describe('AffiliateGridComponent', () => {
  let component: AffiliateGridComponent;
  let fixture: ComponentFixture<AffiliateGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AffiliateGridComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AffiliateGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
