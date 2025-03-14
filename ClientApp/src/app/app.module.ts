import { NgModule } from '@angular/core';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AppLayoutModule } from './layout/app.layout.module';
import { MenuModule } from 'primeng/menu';
import { ChartModule } from 'primeng/chart';
import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ProgressBarModule } from 'primeng/progressbar';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { FileUploadModule } from 'primeng/fileupload';
import { DataService } from "src/app/services/data.service";
import { HttpClientModule } from '@angular/common/http';
import { UploaderComponent } from './prointernalengine/components/apps/file/uploader/uploader.component';
import { FileAppComponent } from './prointernalengine/components/apps/file/file.app.component';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { DashboardAccountingComponent } from './prointernalengine/components/dashboards/accounting/dashboardaccounting.component';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { DashboardLandingComponent } from './prointernalengine/components/dashboards/landing/dashboardlanding.component';
import { InputSwitchModule } from 'primeng/inputswitch';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FileAppService } from './prointernalengine/components/apps/file/service/file.app.service';
import { QtrRebatesComponent } from './prointernalengine/components/dashboards/qtr-rebates/qtr-rebates.component';
import { RebatesupportComponent } from './prointernalengine/components/instantrebate/rebatesupport/rebatesupport.component';
import { GatingComponent } from './prointernalengine/components/Product/Gating/gating.component';

import { PickListModule } from 'primeng/picklist';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { MultiSelectModule } from 'primeng/multiselect';
import { SliderModule } from 'primeng/slider';
import { RatingModule } from 'primeng/rating';




@NgModule({
    declarations: [
    AppComponent,
    QtrRebatesComponent,
    GatingComponent,
    RebatesupportComponent,
    DashboardAccountingComponent,
    DashboardLandingComponent,
    UploaderComponent,
    FileAppComponent
    ],
  imports: [
        PickListModule,
        ToggleButtonModule,
        MultiSelectModule,
        SliderModule,
        RatingModule,
        HttpClientModule,
        AutoCompleteModule,
        SelectButtonModule,
        AppRoutingModule,
        AppLayoutModule,
        MenuModule,
        ChartModule,
        ToastModule,
        TableModule,
        FormsModule,
        ButtonModule,
        RippleModule,
        CommonModule,
        ProgressBarModule,
        DropdownModule,
        InputTextareaModule,
        InputTextModule,
        TagModule,
        OverlayPanelModule,
        FileUploadModule,
        InputSwitchModule
  ],
 
  providers:
    [
      FileAppService,
      DataService,
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
