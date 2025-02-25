import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ListdemoComponent } from './listdemo.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: ListdemoComponent }
	])],
	exports: [RouterModule]
})
export class ListdemoRoutingModule { }
