import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TreedemoComponent } from './treedemo.component';
import { TreedemoRoutingModule } from './treedemo-routing.module';
import { TreeModule } from 'primeng/tree';
import { TreeTableModule } from 'primeng/treetable';

@NgModule({
	imports: [
		CommonModule,
		TreedemoRoutingModule,
		FormsModule,
		TreeModule,
		TreeTableModule
	],
	declarations: [TreedemoComponent],
})
export class TreedemoModule { }
