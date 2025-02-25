import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Error2Component } from './error2.component';

@NgModule({
    imports: [RouterModule.forChild([
        { path: '', component: Error2Component }
    ])],
    exports: [RouterModule]
})
export class Error2RoutingModule { }
