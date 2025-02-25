import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessagesdemoComponent } from './messagesdemo.component';
import { MessagesdemoRoutingModule } from './messagesdemo-routing.module';
import { MessagesModule } from 'primeng/messages';
import { MessageModule } from 'primeng/message';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';

@NgModule({
	imports: [
		CommonModule,
		MessagesdemoRoutingModule,
		MessagesModule,
		MessageModule,
		ButtonModule,
		ToastModule,
		InputTextModule
	],
	declarations: [MessagesdemoComponent]
})
export class MessagesdemoModule { }
