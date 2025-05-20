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
import { QtrRebatesComponent } from     './prointernalengine/components/dashboards/qtr-rebates/qtr-rebates.component';
import { RebatesupportComponent } from './prointernalengine/components/instantrebate/rebatesupport/rebatesupport.component';
import { InputGroupModule } from 'primeng/inputgroup';
import { MessageModule } from 'primeng/message';
import { MessagesModule } from 'primeng/messages';
import { PickListModule } from 'primeng/picklist';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { MultiSelectModule } from 'primeng/multiselect';
import { SliderModule } from 'primeng/slider';
import { RatingModule } from 'primeng/rating';
import { VendorStockComponent } from './prointernalengine/components/Vendor/vendor-stock/vendor-stock.component';
import { VendorSetupComponent } from './prointernalengine/components/Vendor/vendor-setup/vendor-setup.component';
import { ForecastComponent } from './prointernalengine/components/dashboards/accounting/forecast/forecast.component';
import { GatingComponent } from './prointernalengine/components/Product/Gating/gating.component';
import { PatronageComponent } from './prointernalengine/components/dashboards/patronage/patronage.component';
import { DialogModule } from 'primeng/dialog';
import { BadgeModule } from 'primeng/badge';
import { CheckboxModule } from 'primeng/checkbox';
import { ToolbarModule } from 'primeng/toolbar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { TabViewModule } from 'primeng/tabview';
import { RebateSetupComponent } from './prointernalengine/components/instantrebate/rebate-setup/rebate-setup.component';
import { VendorConfigurationComponent } from './prointernalengine/components/instantrebate/rebate-setup/vendor-configuration/vendor-configuration.component';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { RebateExcelUploaderComponent } from './prointernalengine/components/instantrebate/rebate-excel-uploader/rebate-excel-uploader.component'; 
import { ConfirmationService } from 'primeng/api'; // already assumed
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { PaymentsComponent } from './prointernalengine/components/dashboards/accounting/payments/payments.component';


@NgModule({
  declarations:
    [
    AppComponent,
    QtrRebatesComponent,
    RebateSetupComponent,  
    GatingComponent,
    VendorStockComponent,
    VendorSetupComponent,
    RebatesupportComponent,
    DashboardAccountingComponent,
    DashboardLandingComponent,
    VendorConfigurationComponent,
    RebateExcelUploaderComponent,
    ForecastComponent,
    UploaderComponent,
    FileAppComponent,
    PatronageComponent,
    PaymentsComponent
  ],

  imports: [
    CardModule,
    TooltipModule,
    ProgressSpinnerModule,
    MessageModule,
    MessagesModule,
    InputGroupModule,
    DialogModule,
    BadgeModule,
    TabViewModule,
    CheckboxModule,
    DividerModule,
    ConfirmDialogModule,
        ToolbarModule,
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
      MessageService,
      ConfirmationService
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
