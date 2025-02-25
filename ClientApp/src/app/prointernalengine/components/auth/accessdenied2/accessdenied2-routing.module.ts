import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Accessdenied2Component } from './accessdenied2.component';

@NgModule({
    imports: [RouterModule.forChild([
        { path: '', component: Accessdenied2Component }
    ])],
    exports: [RouterModule]
})
export class Accessdenied2RoutingModule {}
