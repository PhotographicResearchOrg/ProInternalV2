import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileUploadModule } from 'primeng/fileupload';
import { FiledemoRoutingModule } from './filedemo-routing.module';
import { FiledemoComponent } from './filedemo.component';


@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		FiledemoRoutingModule,
		FileUploadModule
	],
	declarations: [FiledemoComponent],
})
export class FiledemoModule { }
