import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FloatLabeldemoComponent } from './floatlabeldemo.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: FloatLabeldemoComponent }
	])],
	exports: [RouterModule]
})
export class FloatlabeldemoRoutingModule { }
