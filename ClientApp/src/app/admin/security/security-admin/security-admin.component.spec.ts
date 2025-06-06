import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SecurityAdminComponent } from './security-admin.component';

describe('SecurityAdminComponent', () => {
  let component: SecurityAdminComponent;
  let fixture: ComponentFixture<SecurityAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SecurityAdminComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SecurityAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
