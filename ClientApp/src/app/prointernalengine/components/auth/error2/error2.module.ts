import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Error2RoutingModule } from './error2-routing.module';
import { Error2Component } from './error2.component';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { DividerModule } from 'primeng/divider';

@NgModule({
    imports: [
        CommonModule,
        Error2RoutingModule,
        ButtonModule,
        RippleModule,
        DividerModule
    ],
    declarations: [Error2Component]
})
export class Error2Module { }
