import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MessagesdemoComponent } from './messagesdemo.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: MessagesdemoComponent }
	])],
	exports: [RouterModule]
})
export class MessagesdemoRoutingModule { }
