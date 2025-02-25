//import { NgModule } from '@angular/core';
//import { RouterModule, Routes } from '@angular/router';

//import { QtrRebatesComponent } from "src/app/prointernalengine/components/dashboards/qtr-rebates/qtr-rebates.component";
//import { DashboardBankingComponent } from "src/app/prointernalengine/components/dashboards/banking/dashboardbanking.component";
//import { DashboardEcommerceComponent } from "src/app/prointernalengine/components/dashboards/e-commerce/dashboardecommerce.component"; 


//const routes: Routes = [
//  { path: '', data: { breadcrumb: 'PRO Dashboard' }, component: DashboardEcommerceComponent },
//  { path: 'dashboard-banking', data: { breadcrumb: 'Accounting Dashboard' }, component: DashboardBankingComponent },
//  { path: 'qtr-rebates', data: { breadcrumb: 'Rebates Dashboard' }, component: QtrRebatesComponent }
//];



//@NgModule({
//  imports: [RouterModule.forRoot(routes, { enableTracing: false, onSameUrlNavigation: 'reload' })],
//  exports: [RouterModule],
//})

////@NgModule({
////    imports: [RouterModule.forChild([
////        { path: '', data: {breadcrumb: 'PRO Dashboard'}, loadChildren: () => import('./e-commerce/dashboardecommerce.module').then(m => m.DashboardEcommerceModule) },
////       /* { path: 'dashboard-banking', data: {breadcrumb: 'Accounting Dashboard'}, loadChildren: () => import('./banking/dashboardbanking.module').then(m => m.DashboardBankingModule) },*/
/////*      { path: "qtr-rebates", data: { breadcrumb: 'Rebate Dashboard' },component: QtrRebatesComponent},*/
////    ])],
////    exports: [RouterModule]
////})
//export class DashboardsRoutingModule { }
