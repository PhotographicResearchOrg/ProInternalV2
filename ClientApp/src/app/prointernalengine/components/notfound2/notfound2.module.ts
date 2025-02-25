import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Notfound2RoutingModule } from './notfound2-routing.module';
import { Notfound2Component } from './notfound2.component';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';

@NgModule({
    imports: [
        CommonModule,
        Notfound2RoutingModule,
        ButtonModule,
        RippleModule
    ],
    declarations: [Notfound2Component]
})
export class Notfound2Module { }
