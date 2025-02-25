import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { OverlaysdemoComponent } from './overlaysdemo.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: OverlaysdemoComponent }
	])],
	exports: [RouterModule]
})
export class OverlaysdemoRoutingModule { }
