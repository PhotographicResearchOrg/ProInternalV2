import { NgModule } from '@angular/core';
import { UploaderModule } from './prointernalengine/components/apps/file/uploader/uploader.module';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AppLayoutModule } from './layout/app.layout.module';
import { MenuModule } from 'primeng/menu';
import { ChartModule } from 'primeng/chart';
import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ProgressBarModule } from 'primeng/progressbar';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { FileUploadModule } from 'primeng/fileupload';
import { DataService } from "./services/data.service";
import { AuthInterceptor } from './services/auth.interceptor';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
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
import { HubspotCompanyComponent } from './prointernalengine/components/MemberManagement/hubspot-company/hubspot-company.component';
import { DashboardBrmComponent } from './prointernalengine/components//dashboards/BRM/dashboard-brm/dashboard-brm.component';
import { IrDeclinesTableComponent } from './prointernalengine/components/shared/ir-declines-table/ir-declines-table.component';
import { AccountManagementComponent } from './prointernalengine/components/MemberManagement/accountmanagement/accountmanagement.component';
import { VendorGridComponent } from './prointernalengine/components/MemberManagement/accountmanagement/vendor-grid/vendor-grid.component';
import { ProSubscriptionsComponent } from './prointernalengine/components/MemberManagement/accountmanagement/pro-subscriptions/pro-subscriptions.component';
import { MemberGridComponent } from './prointernalengine/components/MemberManagement/accountmanagement/member-grid/member-grid.component';
import { ClientGridComponent } from './prointernalengine/components/MemberManagement/accountmanagement/client-grid/client-grid.component';
import { AffiliateGridComponent } from './prointernalengine/components/MemberManagement/accountmanagement/affiliate-grid/affiliate-grid.component';
import { ReceivablesComponent } from './prointernalengine/components/dashboards/accounting/receivables/receivables.component';
import { ShippingerrorsComponent} from './prointernalengine/components/dashboards/warehouse/shippingerrors/shippingerrors.component'; 
import { SidebarModule } from 'primeng/sidebar';
import { ShippingerrorbrmComponent } from './prointernalengine/components/dashboards/BRM/shippingerrorbrm/shippingerrorbrm.component';
import { PaymentTypeComponent } from './prointernalengine/components/shared/payment-type/payment-type.component';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ProductEditComponent } from './prointernalengine/components/ecommerce/product-edit/product-edit.component'; 
import { PanelModule } from 'primeng/panel';
import { BrowserModule } from '@angular/platform-browser';             // <-- add
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'; // <-- add
import { ChipsModule } from 'primeng/chips';
import { CalendarModule } from 'primeng/calendar'; // If PrimeNG 17+, use DatePickerModule instead
/* Components */

import { VendorCardComponent } from './prointernalengine/components/MemberManagement/accountmanagement/vendor-card/vendor-card.component';
import { CreditsComponent } from './prointernalengine/components/dashboards/accounting/credits.component/credits.component';
import { VendorBillingComponent } from './prointernalengine/components/dashboards/accounting/vendor-billing/vendor-billing';
import { InputNumberModule } from 'primeng/inputnumber';
import { ShipmentMonitorComponent } from './prointernalengine/components/dashboards/warehouse/shipment-monitor/shipment-monitor.component';
import { VendorSellthroughComponent } from './prointernalengine/components/Vendor/vendor-sellthrough/vendor-sellthrough.component';
import { IrSetupDashboardComponent } from './prointernalengine/components/instantrebate/ir-setup-dashboard/ir-setup-dashboard.component';
import { PaymentAdministrationComponent } from './prointernalengine/components/dashboards/accounting/payment-administration/payment-administration.component'




@NgModule({
  declarations:
    [
    PaymentAdministrationComponent,
    IrSetupDashboardComponent,
    VendorCardComponent,
    CreditsComponent,
    VendorBillingComponent,
    ProductEditComponent,
    ReceivablesComponent,
    AffiliateGridComponent,
    ClientGridComponent,
    MemberGridComponent,
    ProSubscriptionsComponent,
    VendorGridComponent,
    AccountManagementComponent,
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
    PatronageComponent,
    PaymentsComponent,
    HubspotCompanyComponent,
    DashboardBrmComponent,
    IrDeclinesTableComponent,
    VendorGridComponent,
    ShippingerrorsComponent,
    ShippingerrorbrmComponent,
    PaymentTypeComponent,
    ShipmentMonitorComponent,
    VendorSellthroughComponent
  ],

  imports: [
    UploaderModule,
    InputNumberModule,
    BrowserModule,                 // <-- required
    BrowserAnimationsModule,       // <-- required for PrimeNG
    ChipsModule,
    CalendarModule, // If on PrimeNG 17+, swap to DatePickerModule and change <p-calendar> to <p-datepicker>
    ReactiveFormsModule,
    PanelModule,
    ConfirmPopupModule,
    SidebarModule,
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
      { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi:true },
      FileAppService,
      DataService,
      MessageService,
      ConfirmationService
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
