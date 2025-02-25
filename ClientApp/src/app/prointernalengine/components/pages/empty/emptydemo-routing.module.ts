import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { EmptydemoComponent } from './emptydemo.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: EmptydemoComponent }
	])],
	exports: [RouterModule]
})
export class EmptydemoRoutingModule { }
