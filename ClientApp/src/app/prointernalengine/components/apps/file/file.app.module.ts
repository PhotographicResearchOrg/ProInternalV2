import { NgModule } from '@angular/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { TableModule } from 'primeng/table';
import { MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { FileAppService } from './service/file.app.service';
import { FileAppRoutingModule } from './file.app-routing.module';
import { FileAppComponent } from './file.app.component';

@NgModule({
  imports: [
    ProgressSpinnerModule,
    TooltipModule,
    CommonModule,
    FileAppRoutingModule,
    FormsModule,
    ButtonModule,
    RippleModule,
    ToastModule,
    TableModule,
    MenuModule,
    BreadcrumbModule
  ],
  declarations: [FileAppComponent],
  providers: [FileAppService]
})
export class FileAppModule { }
