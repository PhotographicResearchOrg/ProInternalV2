import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MediademoComponent } from './mediademo.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: MediademoComponent }
	])],
	exports: [RouterModule]
})
export class MediademoRoutingModule { }
