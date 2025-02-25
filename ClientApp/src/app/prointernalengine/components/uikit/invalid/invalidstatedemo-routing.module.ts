import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { InvalidStatedemoComponent } from './invalidstatedemo.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: InvalidStatedemoComponent }
	])],
	exports: [RouterModule]
})
export class InvalidStatedemoRoutingModule { }
