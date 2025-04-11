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

    rawModel.push(
      {
        label: 'PRO-Internal',
        icon: 'pi pi-home',
        items: [{
          label: 'Dashboards', icon: 'pi pi-chart-line',
          items:
            [{ label: 'Home', icon: 'pi pi-fw pi-home', routerLink: ['/Dashboard-landing'] },
            {
              label: 'Accounting', icon: 'pi pi-fw pi-money-bill',
              items: [
                { label: 'Accounting Dash', icon: 'pi pi-fw pi-sign-in', routerLink: ['/dashboard-accounting'] },
                { label: 'Quarterly Rebates', icon: 'pi pi-fw pi-times-circle', routerLink: ['/qtr-rebates'] }
              ]
            },
            { label: 'Product', icon: 'pi pi-fw pi-money-bill', routerLink: ['/dashboard-banking'] }
            ]
        },
        ]
      });


    rawModel.push(
      {

        items: [{
          label: 'Reporting', icon: 'pi pi-chart-bar',
        items: [
          { label: 'PRO Report Hub', icon: 'pi pi-chart-bar', routerLink: ['/powerbi'] },
          //{label: 'Connection Comments', icon: 'pi pi-fw pi-comments', routerLink: ['/apps/chat'] },
          //{label: 'Product List',icon: 'pi pi-fw pi-list',routerLink: ['ecommerce/product-list']},
          //{label: 'New Products', icon: 'pi pi-fw pi-plus', routerLink: ['ecommerce/new-product'] },
          //{label: 'Shopping Cart',icon: 'pi pi-fw pi-shopping-cart',routerLink: ['ecommerce/shopping-cart']},
          //{label: 'Checkout Form',icon: 'pi pi-fw pi-check-square',routerLink: ['ecommerce/checkout-form']},
          //{label: 'Member Management', icon: 'pi pi-fw pi-list', routerLink: ['profile/list'] },
          //{label: 'Process Orders', icon: 'pi pi-fw pi-history', routerLink: ['ecommerce/order-history'] },
          //{label: 'Order Summary',icon: 'pi pi-fw pi-file',routerLink: ['ecommerce/order-summary']}
          //{label: 'Quarterly Rebates',icon: 'pi pi-fw pi-times-circle',routerLink: ['ecommerce/qtr-rebates']}
          ]
        },
        ]
      });



    rawModel.push(
      {
        label: 'Rebate Management',
        icon: 'pi pi-wrench',
        items: [
          { label: '(IR) Maintenance', icon: 'pi pi-dollar', routerLink: ['/rebatesupport'] },
          /*       { label: ' BRM - (IR) Support', icon: 'pi pi-wrench', routerLink: ['/rebatesupport'] }*/
          //{label: 'Connection Comments', icon: 'pi pi-fw pi-comments', routerLink: ['/apps/chat'] },
          //{label: 'Product List',icon: 'pi pi-fw pi-list',routerLink: ['ecommerce/product-list']},
          //{label: 'New Products', icon: 'pi pi-fw pi-plus', routerLink: ['ecommerce/new-product'] },
          //{label: 'Shopping Cart',icon: 'pi pi-fw pi-shopping-cart',routerLink: ['ecommerce/shopping-cart']},
          //{label: 'Checkout Form',icon: 'pi pi-fw pi-check-square',routerLink: ['ecommerce/checkout-form']},
          //{label: 'Member Management', icon: 'pi pi-fw pi-list', routerLink: ['profile/list'] },
          //{label: 'Process Orders', icon: 'pi pi-fw pi-history', routerLink: ['ecommerce/order-history'] },
          //{label: 'Order Summary',icon: 'pi pi-fw pi-file',routerLink: ['ecommerce/order-summary']}
          //{label: 'Quarterly Rebates',icon: 'pi pi-fw pi-times-circle',routerLink: ['ecommerce/qtr-rebates']}
        ]
      });








    rawModel.push
      ({
        label: 'Management',
        icon: 'pi pi-fw pi-wallet',
        items:
          [
            {
              label: 'Product Management', icon: 'pi pi-box',
              items:
                [
                  { label: 'Product Configuration', icon: 'pi pi-sliders-h', routerLink: ['ecommerce/product-overview'] },
                 
                  {
                    label: 'Exclusions', icon: 'pi pi-ban',
                    items: [
                      /*       { label: 'Brand Exclusions', icon: 'pi pi-fw pi-building', routerLink: ['/exclusions/brand'] },*/
                      { label: 'Brand Gating', icon: 'pi pi-lock', routerLink: ['/gating'] },
                      { label: 'Exclusion Groups', icon: 'pi pi-ban', routerLink: ['/exclusions/group'] },
                     /* { label: 'Company Exclusion Groups', icon: 'pi pi-fw pi-building', routerLink: ['/exclusion/group/company'] }*/
                    ]
                  }
                ]
            },
            {
              label: 'Vendor Management', icon: 'pi pi-briefcase',
              items:
               [
                  { label: 'Vendor SetUp', icon: 'pi pi-cog', routerLink: ['/setup'] },
                  {
                    label: 'Stock Submissions', icon: 'pi pi-cloud-upload',routerLink: ['/stock']
                    //items: [
                    //  /*       { label: 'Brand Exclusions', icon: 'pi pi-fw pi-building', routerLink: ['/exclusions/brand'] },*/
                    //  { label: 'Brand Gating', icon: 'pi pi-fw pi-building', routerLink: ['/gating'] },
                    //  { label: 'Exclusion Groups', icon: 'pi pi-fw pi-building', routerLink: ['/exclusions/group'] },
                    //  /* { label: 'Company Exclusion Groups', icon: 'pi pi-fw pi-building', routerLink: ['/exclusion/group/company'] }*/
                    //]
                  }
               ]
            }
          ]
      });




    //rawModel.push
    //  ({
    //    label: 'Configurations',
    //    icon: 'pi pi-fw pi-wallet',
    //    items:
    //      [
    //        {
    //          label: 'Theme', icon: 'pi pi-fw pi-image',
    //          items:
    //            [
    //              {
    //                label: 'Settings',
    //                icon: 'pi pi-cog',
    //                routerLink: ['/user-settings'],
      
    //              }
    //            ]
    //        }
    //      ]
    //  });







    if (this.authService.hasPermission('Super Admin')) {
      rawModel.push
        (
          this.authService.hasPermission('Super Admin') ?
            { label: 'Connection Comments', icon: 'pi pi-fw pi-comments', routerLink: ['/apps/chat'] } : null
        );
    }

    rawModel.push({ label: 'New Products', icon: 'pi pi-fw pi-plus', routerLink: ['ecommerce/new-product'] });
    rawModel.push({ label: 'Member Management', icon: 'pi pi-fw pi-list', routerLink: ['profile/list'] });
    rawModel.push({ label: 'Process Orders', icon: 'pi pi-fw pi-history', routerLink: ['ecommerce/order-history'] });

    if (this.authService.hasPermission('Super Admin')) {
      rawModel.push({
        label: 'Company',
        icon: 'pi pi-th-large',
        items:
          [
            {
              label: 'PRO Calendar',
              icon: 'pi pi-fw pi-calendar',
              routerLink: ['/apps/calendar']
            },
            {
              label: 'PRO Files',
              icon: 'pi pi-fw pi-folder',
              routerLink: ['/apps/files']
            },
            {
              label: 'PRO Ticket Center',
              icon: 'pi pi-fw pi-sliders-v',
              routerLink: ['/apps/kanban']
            },
            {
              label: 'Mail',
              icon: 'pi pi-fw pi-envelope',
              items:
                [
                  {
                    label: 'Inbox',
                    icon: 'pi pi-fw pi-inbox',
                    routerLink: ['/apps/mail/inbox']
                  },
                  {
                    label: 'Compose',
                    icon: 'pi pi-fw pi-pencil',
                    routerLink: ['/apps/mail/compose']
                  },
                  {
                    label: 'Detail',
                    icon: 'pi pi-fw pi-comment',
                    routerLink: ['/apps/mail/detail/1000']
                  }
                ]
            },
            {
              label: ' PRO Task List',
              icon: 'pi pi-fw pi-check-square',
              routerLink: ['/apps/tasklist']
            }
          ]
      });
    }



    if (this.authService.hasPermission('Super Admin')) {
      rawModel.push({
        label: 'UI Kit',
        icon: 'pi pi-fw pi-star-fill',

        items: [
          {
            label: 'Form Layout',
            icon: 'pi pi-fw pi-id-card',
            routerLink: ['/uikit/formlayout']
          },
          {
            label: 'Input',
            icon: 'pi pi-fw pi-check-square',
            routerLink: ['/uikit/input']
          },
          {
            label: 'Float Label',
            icon: 'pi pi-fw pi-bookmark',
            routerLink: ['/uikit/floatlabel']
          },
          {
            label: 'Invalid State',
            icon: 'pi pi-fw pi-exclamation-circle',
            routerLink: ['/uikit/invalidstate']
          },
          {
            label: 'Button',
            icon: 'pi pi-fw pi-box',
            routerLink: ['/uikit/button']
          },
          {
            label: 'Table',
            icon: 'pi pi-fw pi-table',
            routerLink: ['/uikit/table']
          },
          {
            label: 'List',
            icon: 'pi pi-fw pi-list',
            routerLink: ['/uikit/list']
          },
          {
            label: 'Tree',
            icon: 'pi pi-fw pi-share-alt',
            routerLink: ['/uikit/tree']
          },
          {
            label: 'Panel',
            icon: 'pi pi-fw pi-tablet',
            routerLink: ['/uikit/panel']
          },
          {
            label: 'Overlay',
            icon: 'pi pi-fw pi-clone',
            routerLink: ['/uikit/overlay']
          },
          {
            label: 'Media',
            icon: 'pi pi-fw pi-image',
            routerLink: ['/uikit/media']
          },
          {
            label: 'Menu',
            icon: 'pi pi-fw pi-bars',
            routerLink: ['/uikit/menu'],
            routerLinkActiveOptions: { paths: 'subset', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' }
          },
          {
            label: 'Message',
            icon: 'pi pi-fw pi-comment',
            routerLink: ['/uikit/message']
          },
          {
            label: 'File',
            icon: 'pi pi-fw pi-file',
            routerLink: ['/uikit/file']
          },
          {
            label: 'Chart',
            icon: 'pi pi-fw pi-chart-bar',
            routerLink: ['/uikit/charts']
          },
          {
            label: 'Misc',
            icon: 'pi pi-fw pi-circle-off',
            routerLink: ['/uikit/misc']
          }
        ]
      });
    }


    if (this.authService.hasPermission('Super Admin')) {
      rawModel.push(
        {
          label: 'Prime Blocks',
          icon: 'pi pi-fw pi-prime',
          items: [
            {
              label: 'Free Blocks',
              icon: 'pi pi-fw pi-eye',
              routerLink: ['/blocks']
            },
            //{
            //    label: 'All Blocks',
            //    icon: 'pi pi-fw pi-globe',
            //    url: ['https://www.primefaces.org/primeblocks-ng'],
            //    target: '_blank'
            //}
          ]
        }
      );
    }

    if (this.authService.hasPermission('Super Admin')) {
      rawModel.push(
        {
          label: 'Utilities',
          icon: 'pi pi-fw pi-compass',
          items: [
            {
              label: 'PrimeIcons',
              icon: 'pi pi-fw pi-prime',
              routerLink: ['utilities/icons']
            },
            {
              label: 'Colors',
              icon: 'pi pi-fw pi-palette',
              routerLink: ['utilities/colors']
            },
            {
              label: 'PrimeFlex',
              icon: 'pi pi-fw pi-desktop',
              url: ['https://www.primefaces.org/primeflex/'],
              target: '_blank'
            },
            {
              label: 'Figma',
              icon: 'pi pi-fw pi-pencil',
              url: ['https://www.figma.com/file/LuzEn29BAxr03T2vMQ5A1y/Preview-%7C-Avalon-1.0.0?node-id=0%3A1&t=uRZE9N9j7l5GUvvA-1'],
              target: '_blank'
            },
          ]
        });
    }



    if (this.authService.hasPermission('Super Admin')) {
      rawModel.push(
        {
          label: 'Core Pages',
          icon: 'pi pi-fw pi-briefcase',
          items:
            [
              {
                label: 'Auth',
                icon: 'pi pi-fw pi-user',
                items:
                  [
                    {
                      label: 'Login',
                      icon: 'pi pi-fw pi-sign-in',
                      routerLink: ['/auth/login']
                    },
                    //{
                    //    label: 'Login 2',
                    //    icon: 'pi pi-fw pi-sign-in',
                    //    routerLink: ['/auth/login2']
                    //},
                    {
                      label: 'Error',
                      icon: 'pi pi-fw pi-times-circle',
                      routerLink: ['/auth/error']
                    },
                    //{
                    //    label: 'Error 2',
                    //    icon: 'pi pi-fw pi-times-circle',
                    //    routerLink: ['/auth/error2']
                    //},
                    {
                      label: 'Access Denied',
                      icon: 'pi pi-fw pi-lock',
                      routerLink: ['/auth/access']
                    },
                    //{
                    //    label: 'Access Denied 2',
                    //    icon: 'pi pi-fw pi-lock',
                    //    routerLink: ['/auth/access2']
                    //},
                  ]
              }
            ]
        });
    }


      this.model = this.cleanMenuItems(rawModel);

    }



  cleanMenuItems(items: any[]): any[] {
    console.log('Cleaning menu items...', items);
        console.log('Has Super Admin?', this.authService.hasPermission('Super Admin'));
    return (items || [])
      .filter(item => !!item) // filter out null/undefined
      .map(item => {
        const cleanedItem: any = { ...item };

        if (Array.isArray(cleanedItem.items)) {
          const cleanedChildren = this.cleanMenuItems(cleanedItem.items);
          if (cleanedChildren.length > 0) {
            cleanedItem.items = cleanedChildren;
          } else {
            delete cleanedItem.items; // remove empty arrays
          }
        }

        return cleanedItem;
      });

  }


}
