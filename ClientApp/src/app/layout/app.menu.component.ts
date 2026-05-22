import { OnInit, Component } from '@angular/core';
import { AuthService } from "src/app/services/auth.service";

@Component({
  selector: 'app-menu',
  templateUrl: './app.menu.component.html'
})
export class AppMenuComponent implements OnInit {

  constructor(private authService: AuthService) { }

  model: any[] = [];

  ngOnInit() {
    const rawModel: any[] = [];

    const can = (path: string) => this.hasRoutePermission(path);

    rawModel.push({
      label: 'PRO-Internal',
      icon: 'pi pi-home',
      items: [{
        label: 'Dashboards', icon: 'pi pi-chart-line',
        items: [
          can('/dashboard-landing') && { label: 'Home', icon: 'pi pi-fw pi-home', routerLink: ['/dashboard-landing'] },
          (can('/dashboard-accounting') || can('/qtr-rebates') || can('/forecast') || can('/patronage') || can('/payments')) && {

            label: 'Accounting', icon: 'pi pi-fw pi-money-bill',
            items:
              [
              can('/dashboard-accounting') && { label: 'Accounting Dash', icon: 'pi pi-fw pi-sign-in', routerLink: ['/dashboard-accounting'] },
              can('/qtr-rebates') && { label: 'Quarterly Rebates', icon: 'pi pi-fw pi-times-circle', routerLink: ['/qtr-rebates'] },
              can('/forecast') && { label: 'Forecasting', icon: 'pi pi-chart-line', routerLink: ['/forecast'] },
              can('/patronage') && { label: 'Patronage', icon: 'pi pi-file', routerLink: ['/patronage'] },
              can('/payments') && { label: 'Payments', icon: 'pi pi-briefcase', routerLink: ['/payments'] },
                can('/receivables') && { label: 'Receivables', icon: 'pi-list', routerLink: ['/receivables'] },

              can('/credits') && { label: 'Credits', icon: 'pi pi-dollar', routerLink: ['/credits']},
              can('/vendor-billing') && { label: 'Vendor Billing', icon: 'pi pi-briefcase', routerLink: ['/vendor-billing'] },
            ]
          },

          can('/shopify-admin') &&
          {
            label: 'Marketing',
            icon: 'pi pi-megaphone',
            items:
              [
                {
                  label: 'Shopify Admin',
                  icon: 'pi pi-shopify',
                  routerLink: ['/shopify-admin']
                }
              ]
          },



          can('/BRMdash') &&
            {
            label: 'BRM', icon: 'pi pi-user',
            items:[{ label: 'BRM Dash', icon: 'pi pi-tags', routerLink: ['/BRMdash'] }]},
          can('/BRMdash') &&
          {
            label: 'Warehouse', icon: 'pi pi-map-marker',
            items:
              [
                { label: 'Shipping Errors', icon: 'pi pi-flag', routerLink: ['/shippingerror'] },

                { label: 'Shipping Monitor', icon: 'pi pi-truck', routerLink: ['/shippingmonitor'] }
              ]
          }

        ]
      }]
    });

    rawModel.push({
      items: [{
        label: 'Reporting', icon: 'pi pi-chart-bar',
        items: [
          can('/powerbi') && { label: 'PRO Report Hub', icon: 'pi pi-chart-bar', routerLink: ['/powerbi'] }
        ]
      }]
    });

    can('/rebatesupport') && rawModel.push({
      label: 'Rebate Management',
      icon: 'pi pi-wrench',
      items: [
        can('/rebatesupport') && { label: '(IR) Maintenance', icon: 'pi pi-dollar', routerLink: ['/rebatesupport'] },
        can('/rebatesetup') && { label: '(IR) Setup', icon: 'pi pi-wrench', routerLink: ['/rebatesetup'] },
        can('/uploadrebates') && { label: '(IR) Batch Upload', icon: 'pi pi-database', routerLink: ['/uploadrebates'] }
      ]
    });

    rawModel.push({
      label: 'Management',
      icon: 'pi pi-fw pi-wallet',
      items:
        [
        {
          label: 'Product Management', icon: 'pi pi-box',
            items:
           [
               can('ecommerce/product-overview') && { label: 'Product Configuration', icon: 'pi pi-sliders-h', routerLink: ['ecommerce/product-overview'] },(can('/gating') || can('/exclusions/group')) &&
              {
                label: 'Exclusions', icon: 'pi pi-ban',
                items:
                 [
                  can('/gating') && { label: 'Brand Gating', icon: 'pi pi-lock', routerLink: ['/gating'] },
                  can('/exclusions/group') && { label: 'Exclusion Groups', icon: 'pi pi-ban', routerLink: ['/exclusions/group'] }
                 ]
                },
                //Edit Product
                //can('ecommerce/product-edit') &&
                {
                  label: 'Edit Product', icon: 'pi pi-pencil',
                  routerLink: ['/productedit'] // adjust to your actual route
                }
           ],
          },
        {
          label: 'Vendor Management', icon: 'pi pi-briefcase',
          items: [
            can('/setup') && { label: 'Vendor SetUp', icon: 'pi pi-cog', routerLink: ['/setup'] },
            can('/stock') && { label: 'Stock Submissions', icon: 'pi pi-cloud-upload', routerLink: ['/stock'] }
          ]
        },

        {
          label: 'Account Management', icon: 'pi pi-briefcase',
          items: [
            can('/accountmanagement') && { label: 'Account Management', icon: 'pi pi-cog', routerLink: ['/accountmanagement'] }, 
          ]
        },

      ]
    });

    can('ecommerce/new-product') && rawModel.push({ label: 'New Products', icon: 'pi pi-fw pi-plus', routerLink: ['ecommerce/new-product'] });

    (can('/BRMsetup') || can('/security-admin')) && rawModel.push({
      label: 'Member Management', icon: 'pi pi-fw pi-list',
      items: [
        can('/BRMsetup') && { label: 'BRM SetUp', icon: 'pi pi-cog', routerLink: ['/BRMsetup'] },
        can('/security-admin') && {
          label: 'Security Admin',
          icon: 'pi pi-lock',
          routerLink: ['/security-admin'],
          tooltip: 'Manage roles & permissions',
          tooltipOptions: { position: 'right' }
        }
      ]
    });

    can('ecommerce/order-history') && rawModel.push({ label: 'Process Orders', icon: 'pi pi-fw pi-history', routerLink: ['ecommerce/order-history'] });

    this.model = this.cleanMenuItems(rawModel);
  }

  cleanMenuItems(items: any[]): any[] {
    return (items || [])
      .filter(item => !!item)
      .map(item => {
        const cleanedItem: any = { ...item };
        if (Array.isArray(cleanedItem.items)) {
          const children = this.cleanMenuItems(cleanedItem.items);
          if (children.length) {
            cleanedItem.items = children;
          } else {
            delete cleanedItem.items;
          }
        }
        return cleanedItem;
      });
  }

  hasRoutePermission(path: string): boolean {
    return this.authService.getAllowedRoutes().includes(path.toLowerCase());
  }
}
