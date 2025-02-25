import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelinedemoRoutingModule } from './timelinedemo-routing.module';
import { TimelinedemoComponent } from './timelinedemo.component';
import { TimelineModule } from 'primeng/timeline';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@NgModule({
    imports: [
        CommonModule,
        TimelineModule,
        ButtonModule,
        CardModule,
        TimelinedemoRoutingModule
    ],
    declarations: [TimelinedemoComponent]
})
export class TimelinedemoModule { }
