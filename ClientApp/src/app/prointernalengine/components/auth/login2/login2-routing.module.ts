import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Login2Component } from './login2.component';

@NgModule({
    imports: [RouterModule.forChild([
        { path: '', component: Login2Component }
    ])],
    exports: [RouterModule]
})
export class Login2RoutingModule { }
