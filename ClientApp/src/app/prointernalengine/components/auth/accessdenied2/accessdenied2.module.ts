import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Accessdenied2RoutingModule } from './accessdenied2-routing.module';
import { Accessdenied2Component } from './accessdenied2.component'
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';

@NgModule({
    imports: [
        CommonModule,
        Accessdenied2RoutingModule,
        ButtonModule,
        RippleModule
    ],
    declarations: [Accessdenied2Component]
})
export class Accessdenied2Module {}
