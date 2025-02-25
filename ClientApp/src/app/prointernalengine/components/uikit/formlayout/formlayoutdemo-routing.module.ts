import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormLayoutdemoComponent } from './formlayoutdemo.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: FormLayoutdemoComponent }
	])],
	exports: [RouterModule]
})
export class FormLayoutdemoRoutingModule { }
