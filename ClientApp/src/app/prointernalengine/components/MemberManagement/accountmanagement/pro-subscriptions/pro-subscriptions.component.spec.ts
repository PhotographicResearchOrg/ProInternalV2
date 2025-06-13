import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProSubscriptionsComponent } from './pro-subscriptions.component';

describe('ProSubscriptionsComponent', () => {
  let component: ProSubscriptionsComponent;
  let fixture: ComponentFixture<ProSubscriptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProSubscriptionsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ProSubscriptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
