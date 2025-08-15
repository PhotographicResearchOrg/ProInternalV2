import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EcommerceRoutingModule } from './ecommerce-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
// PrimeNG
import { PanelModule } from 'primeng/panel';
import { DividerModule } from 'primeng/divider';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DropdownModule } from 'primeng/dropdown';
import { ChipsModule } from 'primeng/chips';
// If you're on PrimeNG 16 or earlier:
import { CalendarModule } from 'primeng/calendar';
// If you're on PrimeNG 17+, use DatePickerModule and <p-datepicker> instead of <p-calendar>
// import { DatePickerModule } from 'primeng/datepicker';

import { FileUploadModule } from 'primeng/fileupload';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';

@NgModule({
    imports: [
    EcommerceRoutingModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,  // <-- REQUIRED for [formGroup]
    PanelModule,
    DividerModule,
    InputTextModule,
    InputTextareaModule,
    InputSwitchModule,
    DropdownModule,
    ChipsModule,
    CalendarModule,      // <-- or DatePickerModule (see note above)
    FileUploadModule,
    ToastModule,
    ButtonModule
    ],
    declarations: []
})
export class EcommerceModule { }
