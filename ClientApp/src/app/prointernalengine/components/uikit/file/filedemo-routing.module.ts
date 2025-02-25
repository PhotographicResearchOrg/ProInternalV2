import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FiledemoComponent } from './filedemo.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: FiledemoComponent }
	])],
	exports: [RouterModule]
})
export class FiledemoRoutingModule { }
