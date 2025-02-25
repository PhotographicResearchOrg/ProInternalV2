import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MiscdemoComponent } from './miscdemo.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: MiscdemoComponent }
	])],
	exports: [RouterModule]
})
export class MiscdemoRoutingModule { }
