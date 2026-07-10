import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { FileUploadModule } from 'primeng/fileupload';
import { ToastModule } from 'primeng/toast';
import { UploaderComponent } from './uploader.component';

@NgModule({
  imports: [CommonModule, FormsModule, ButtonModule, RippleModule, FileUploadModule, ToastModule],
  declarations: [UploaderComponent],
  exports: [UploaderComponent]
})
export class UploaderModule { }
