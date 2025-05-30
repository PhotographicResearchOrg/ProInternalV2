import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IrDeclinesTableComponent } from './ir-declines-table.component';

describe('IrDeclinesTableComponent', () => {
  let component: IrDeclinesTableComponent;
  let fixture: ComponentFixture<IrDeclinesTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IrDeclinesTableComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(IrDeclinesTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
