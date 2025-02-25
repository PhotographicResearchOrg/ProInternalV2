import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TimelinedemoComponent } from './timelinedemo.component';

@NgModule({
    imports: [RouterModule.forChild([
        { path: '', component: TimelinedemoComponent }
    ])],
    exports: [RouterModule]
})
export class TimelinedemoRoutingModule { }
