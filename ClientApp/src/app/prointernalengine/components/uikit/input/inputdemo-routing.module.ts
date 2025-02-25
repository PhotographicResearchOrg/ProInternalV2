import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { InputdemoComponent } from './inputdemo.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: InputdemoComponent }
	])],
	exports: [RouterModule]
})
export class InputdemoRoutingModule { }
