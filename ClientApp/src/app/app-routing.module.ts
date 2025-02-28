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
import { GatingComponent } from  './prointernalengine/components/product/gating/gating.component';

const routerOptions: ExtraOptions = {
  anchorScrolling: 'enabled',
  useHash: true
};

const routes: Routes = [
  {
    path: '', redirectTo: 'auth/login', pathMatch: 'full'
  }, //default route
  {
    path: "", component: AppLayoutComponent,
    children: [

                { path: '', data: { breadcrumb: 'Landing Page Dash' }, component: DashboardLandingComponent },
                { path: 'dashboard-accounting', data: { breadcrumb: 'Accounting Dashboard' }, component: DashboardAccountingComponent },
                { path: 'Dashboard-landing', data: { breadcrumb: 'PRO Dashboard' }, component: DashboardLandingComponent },
                { path: 'qtr-rebates', data: { breadcrumb: 'Quarterly Rebates' }, component: QtrRebatesComponent },
                { path: 'rebatesupport', data: { breadcrumb: 'Quarterly Rebates' }, component: RebatesupportComponent },
                 { path: 'apps/files', data: { breadcrumb: 'Files' }, component: FileAppComponent },
                { path: 'uikit', data: { breadcrumb: 'UI Kit' }, loadChildren: () => import('./prointernalengine/components/uikit/uikit.module').then(m => m.UIkitModule) },
                { path: 'utilities', data: { breadcrumb: 'Utilities' }, loadChildren: () => import('./prointernalengine/components/utilities/utilities.module').then(m => m.UtilitiesModule) },
                { path: 'pages', data: { breadcrumb: 'Pages' }, loadChildren: () => import('./prointernalengine/components/pages/pages.module').then(m => m.PagesModule) },
                { path: 'profile', data: { breadcrumb: 'User Management' }, loadChildren: () => import('./prointernalengine/components/profile/profile.module').then(m => m.ProfileModule) },
                { path: 'documentation', data: { breadcrumb: 'Documentation' }, loadChildren: () => import('./prointernalengine/components/documentation/documentation.module').then(m => m.DocumentationModule) },
                { path: 'blocks', data: { breadcrumb: 'Prime Blocks' }, loadChildren: () => import('./prointernalengine/components/primeblocks/primeblocks.module').then(m => m.PrimeBlocksModule) },
                { path: 'ecommerce', data: { breadcrumb: 'E-Commerce' }, loadChildren: () => import('./prointernalengine/components/ecommerce/ecommerce.module').then(m => m.EcommerceModule) },
                { path: 'apps', data: { breadcrumb: 'Apps' }, loadChildren: () => import('./prointernalengine/components/apps/apps.module').then(m => m.AppsModule) },
                { path: 'instantrebate', component: RebatesupportComponent },
                { path: 'gating', data: { breadcrumb: 'Product Gating' }, component: GatingComponent },
      
      ]
  },

    { path: 'auth', data: { breadcrumb: 'Auth' }, loadChildren: () => import('./prointernalengine/components/auth/auth.module').then(m => m.AuthModule) },
    { path: 'notfound', loadChildren: () => import('./prointernalengine/components/notfound/notfound.module').then(m => m.NotfoundModule) },
    { path: 'landing', loadChildren: () => import('./prointernalengine/components/landing/landing.module').then(m => m.LandingModule) },
    { path: '**', redirectTo: '/notfound' }
];


@NgModule({
    imports: [RouterModule.forRoot(routes, routerOptions)],
    exports: [RouterModule]
})

//@NgModule({
//  /*  imports: [RouterModule.forRoot(routes, { enableTracing: false, relativeLinkResolution: "legacy", onSameUrlNavigation: 'reload' })],*/
//  imports: [RouterModule.forRoot(routes, { enableTracing: false, onSameUrlNavigation: 'reload' })],

//  exports: [RouterModule],
//})

  //@NgModule({
  //  imports: [RouterModule.forRoot(routes, { useHash: true }),
  //    CommonModule],
  //  exports: [RouterModule]
  //})
export class AppRoutingModule { }
