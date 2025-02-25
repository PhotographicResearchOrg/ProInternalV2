import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Login2RoutingModule } from './login2-routing.module';
import { Login2Component } from './login2.component';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';
import { AppConfigModule } from 'src/app/layout/config/app.config.module';
import { RippleModule } from 'primeng/ripple';

@NgModule({
    imports: [
        CommonModule,
        Login2RoutingModule,
        ButtonModule,
        InputTextModule,
        CheckboxModule,
        FormsModule,
        AppConfigModule,
        RippleModule
    ],
    declarations: [Login2Component]
})
export class Login2Module { }
