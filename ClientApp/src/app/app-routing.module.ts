import { NgModule } from '@angular/core';
import { ExtraOptions,RouterModule,Routes } from '@angular/router';
import { AppLayoutComponent } from './layout/app.layout.component';
import { QtrRebatesComponent } from "src/app/prointernalengine/components/dashboards/qtr-rebates/qtr-rebates.component";
import { DashboardAccountingComponent } from "src/app/prointernalengine/components/dashboards/accounting/dashboardaccounting.component";
import { RebatesupportComponent } from "src/app/prointernalengine/components/instantrebate/rebatesupport/rebatesupport.component";
import { DashboardLandingComponent } from "src/app/prointernalengine/components/dashboards/landing/dashboardlanding.component";
import { LoginComponent } from "src/app/prointernalengine/components/auth/login/login.component"; 
import { FileAppComponent } from './prointernalengine/components/apps/file/file.app.component';
import { AuthModule } from './prointernalengine/components/auth/auth.module';
import { BrandExclusionsComponent } from './prointernalengine/components/Product/exclusions/brand-exclusions/brand-exclusions.component';
import { ExclusionGroupsComponent } from './prointernalengine/components/Product/exclusions/exclusion-groups/exclusion-groups.component';
import { ExclusionGroupCompanyComponent } from './prointernalengine/components/Product/exclusions/exclusion-group-company/exclusion-group-company.component';
import { AuthGuard } from "src/app/services/auth.guard";
import { PowerbiComponent } from "src/app/prointernalengine/components/Reporting/powerbi/powerbi.component";
import { VendorStockComponent } from 'src/app/prointernalengine/components/Vendor/vendor-stock/vendor-stock.component';
import { GatingComponent } from './prointernalengine/components/Product/Gating/gating.component';
import { VendorSetupComponent } from 'src/app/prointernalengine/components/Vendor/vendor-setup/vendor-setup.component';
import { ForecastComponent } from './prointernalengine/components/dashboards/accounting/forecast/forecast.component';
import { PatronageComponent } from './prointernalengine/components/dashboards/patronage/patronage.component';
import { RebateSetupComponent } from './prointernalengine/components/instantrebate/rebate-setup/rebate-setup.component';
import { RebateExcelUploaderComponent } from './prointernalengine/components/instantrebate/rebate-excel-uploader/rebate-excel-uploader.component';
import { EzPaySummary } from './models/accounting/EzPaySummary';
import { PaymentsComponent } from './prointernalengine/components/dashboards/accounting/payments/payments.component';
import { HubspotCompanyComponent } from './prointernalengine/components/MemberManagement/hubspot-company/hubspot-company.component';
import { DashboardBrmComponent } from './prointernalengine/components//dashboards/BRM/dashboard-brm/dashboard-brm.component';
import { SecurityAdminComponent } from 'src/app/admin/security/security-admin/security-admin.component';
import { AccountManagementComponent } from './prointernalengine/components/MemberManagement/accountmanagement/accountmanagement.component';
import { ReceivablesComponent } from './prointernalengine/components/dashboards/accounting/receivables/receivables.component';
import { ShippingerrorsComponent } from './prointernalengine/components/dashboards/warehouse/shippingerrors/shippingerrors.component'; 
import { ProductEditComponent } from './prointernalengine/components/ecommerce/product-edit/product-edit.component';
import { ShopifyAdminComponent } from './prointernalengine/components/dashboards/Marketing/shopify-admin/shopify-admin.component';
import { CreditsComponent } from './prointernalengine/components/dashboards/accounting/credits.component/credits.component';
import { VendorBillingComponent } from './prointernalengine/components/dashboards/accounting/vendor-billing/vendor-billing';
import { ShipmentMonitorComponent } from './prointernalengine/components/dashboards/warehouse/shipment-monitor/shipment-monitor.component';
import { VendorSellthroughComponent } from './prointernalengine/components/Vendor/vendor-sellthrough/vendor-sellthrough.component';
import { VendorCardComponent } from './prointernalengine/components/MemberManagement/accountmanagement/vendor-card/vendor-card.component';
import { IrSetupDashboardComponent } from './prointernalengine/components/instantrebate/ir-setup-dashboard/ir-setup-dashboard.component';
import { PaymentAdministrationComponent } from './prointernalengine/components/dashboards/accounting/payment-administration/payment-administration.component';

const routerOptions: ExtraOptions = {
  anchorScrolling: 'enabled',
  useHash: true
};
const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' }, // Default route

  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [AuthGuard],
    children: [

      { path: 'dashboard-landing', component: DashboardLandingComponent, canActivate: [AuthGuard], data: { breadcrumb: 'PRO Dashboard' } },
      { path: 'dashboard-accounting', component: DashboardAccountingComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Accounting Dashboard' } },
      { path: 'qtr-rebates', component: QtrRebatesComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Quarterly Rebates' } },
      { path: 'powerbi', component: PowerbiComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Reporting' } },
      { path: 'rebatesupport', component: RebatesupportComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Quarterly Rebates' } },

      //{ path: 'apps/files', canActivate: [AuthGuard], data: { breadcrumb: 'Files' }, loadChildren: () => import('./prointernalengine/components/apps/file/file.app.module').then(m => m.FileAppModule) },

      {
        path: 'apps/files',
        component: FileAppComponent,
        canActivate: [AuthGuard],
        data: { breadcrumb: 'Files' }
      },

      { path: 'BRMsetup', component: HubspotCompanyComponent, canActivate: [AuthGuard] },
      { path: 'BRMdash', component: DashboardBrmComponent, canActivate: [AuthGuard] },
      { path: 'security-admin', component: SecurityAdminComponent, canActivate: [AuthGuard] },
      { path: 'instantrebate', component: RebatesupportComponent, canActivate: [AuthGuard] },
      { path: 'rebatesetup', component: RebateSetupComponent, canActivate: [AuthGuard] },
      { path: 'uploadrebates', component: RebateExcelUploaderComponent, canActivate: [AuthGuard] },
      { path: 'rebatemanagement', component: IrSetupDashboardComponent, canActivate: [AuthGuard] },
      { path: 'gating', component: GatingComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Product Gating' } },
      { path: 'stock', component: VendorStockComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Vendor Stock' } },
      { path: 'forecast', component: ForecastComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Forcasting' } },
      { path: 'patronage', component: PatronageComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Patronage' } },
      { path: 'payments', component: PaymentsComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Payments' } },
      { path: 'payment-administration', component: PaymentAdministrationComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Payment Administration' } },


      { path: 'setup', component: VendorSetupComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Vendor SetUp' } },
      { path: 'exclusions/brand', component: BrandExclusionsComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Brand Exclusions' } },
      { path: 'exclusions/group', component: ExclusionGroupsComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Exclusion Groups' } },
      { path: 'exclusion/group/company', component: ExclusionGroupCompanyComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Company Exclusion Groups' } },
      { path: 'accountmanagement', component: AccountManagementComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Account Management' } },
      { path: 'receivables', component: ReceivablesComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Accounting - Receivables' } },

      

      { path: 'vendor-card', component: VendorCardComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Vendor' } },

      { path: 'shippingerror', component: ShippingerrorsComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Shipping Errors' } },
      { path: 'shippingmonitor', component: ShipmentMonitorComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Shipping Monitor' } },
      { path: 'productedit', component: ProductEditComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Product Edit' } },
      { path: 'credits', component: CreditsComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Accounting - Credits' }},
      { path: 'vendor-billing', component: VendorBillingComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Accounting - Vendor Billing' } },
      { path: 'sellthrough', component: VendorSellthroughComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Vendor - Vendor Sellthrough' } },
      { path: 'shopify-admin', component: ShopifyAdminComponent, canActivate: [AuthGuard], data: { breadcrumb: 'Shopify Admin' }},


      {
        path: 'ecommerce',
        children: [
          {
            path: 'product-overview',
            loadChildren: () =>
              import('./prointernalengine/components/ecommerce/productoverview/productoverview.module')
                .then(m => m.ProductoverviewModule),
            data: { breadcrumb: 'Product Overview' }
          }
        ]
      }

    ]
  },


  // Auth & misc modules
  { path: 'auth', loadChildren: () => import('./prointernalengine/components/auth/auth.module').then(m => m.AuthModule), data: { breadcrumb: 'Auth' } },
  { path: 'notfound', loadChildren: () => import('./prointernalengine/components/notfound/notfound.module').then(m => m.NotfoundModule) },
  { path: 'landing', loadChildren: () => import('./prointernalengine/components/landing/landing.module').then(m => m.LandingModule) },
  { path: 'security-admin', loadChildren: () => import('./admin/security/security.module').then(m => m.SecurityModule) },


  // Fallback route
  { path: '**', redirectTo: '/notfound' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, routerOptions)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
