import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ChartsdemoComponent } from './chartsdemo.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: ChartsdemoComponent }
	])],
	exports: [RouterModule]
})
export class ChartsdemoRoutingModule { }
