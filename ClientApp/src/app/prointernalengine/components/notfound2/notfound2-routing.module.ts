import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Notfound2Component } from './notfound2.component';

@NgModule({
    imports: [RouterModule.forChild([
        { path: '', component: Notfound2Component }
    ])],
    exports: [RouterModule]
})
export class Notfound2RoutingModule { }