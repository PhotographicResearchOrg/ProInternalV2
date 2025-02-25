import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmptydemoRoutingModule } from './emptydemo-routing.module';
import { EmptydemoComponent } from './emptydemo.component';

@NgModule({
	imports: [
		CommonModule,
		EmptydemoRoutingModule
	],
	declarations: [EmptydemoComponent]
})
export class EmptydemoModule { }
