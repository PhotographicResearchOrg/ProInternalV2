import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TreedemoComponent } from './treedemo.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: TreedemoComponent }
	])],
	exports: [RouterModule]
})
export class TreedemoRoutingModule { }
