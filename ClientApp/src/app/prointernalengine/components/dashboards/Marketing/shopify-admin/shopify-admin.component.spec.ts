import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShopifyAdminComponent } from './shopify-admin.component';

describe('ShopifyAdminComponent', () => {
  let component: ShopifyAdminComponent;
  let fixture: ComponentFixture<ShopifyAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShopifyAdminComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ShopifyAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
