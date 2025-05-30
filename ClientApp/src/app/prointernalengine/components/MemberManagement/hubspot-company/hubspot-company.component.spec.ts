import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HubspotCompanyComponent } from './hubspot-company.component';

describe('HubspotCompanyComponent', () => {
  let component: HubspotCompanyComponent;
  let fixture: ComponentFixture<HubspotCompanyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HubspotCompanyComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HubspotCompanyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
