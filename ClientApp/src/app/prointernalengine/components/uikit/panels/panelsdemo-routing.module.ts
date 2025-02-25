import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PanelsdemoComponent } from './panelsdemo.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: PanelsdemoComponent }
	])],
	exports: [RouterModule]
})
export class PanelsdemoRoutingModule { }
