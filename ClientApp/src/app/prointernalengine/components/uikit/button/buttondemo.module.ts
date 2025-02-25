import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtondemoRoutingModule } from './buttondemo-routing.module';
import { ButtondemoComponent } from './buttondemo.component';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { SplitButtonModule } from 'primeng/splitbutton';
import { ToggleButtonModule } from 'primeng/togglebutton';

@NgModule({
	imports: [
		CommonModule,
		ButtondemoRoutingModule,
		ButtonModule,
		RippleModule,
		SplitButtonModule,
		ToggleButtonModule,
	],
	declarations: [ButtondemoComponent]
})
export class ButtondemoModule { }
