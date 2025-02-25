import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TabledemoComponent } from './tabledemo.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: TabledemoComponent }
	])],
	exports: [RouterModule]
})
export class TabledemoRoutingModule { }
