import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RebateExcelUploaderComponent } from './rebate-excel-uploader.component';

describe('RebateExcelUploaderComponent', () => {
  let component: RebateExcelUploaderComponent;
  let fixture: ComponentFixture<RebateExcelUploaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RebateExcelUploaderComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RebateExcelUploaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
