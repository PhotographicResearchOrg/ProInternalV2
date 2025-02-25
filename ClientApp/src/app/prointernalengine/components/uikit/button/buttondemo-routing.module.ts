import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ButtondemoComponent } from './buttondemo.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: ButtondemoComponent }
	])],
	exports: [RouterModule]
})
export class ButtondemoRoutingModule { }
