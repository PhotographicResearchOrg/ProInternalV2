import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartsdemoRoutingModule } from './chartsdemo-routing.module';
import { ChartModule } from 'primeng/chart'
import { ChartsdemoComponent } from './chartsdemo.component';

@NgModule({
	imports: [
		CommonModule,
		ChartsdemoRoutingModule,
		ChartModule
	],
	declarations: [ChartsdemoComponent]
})
export class ChartsdemoModule { }
