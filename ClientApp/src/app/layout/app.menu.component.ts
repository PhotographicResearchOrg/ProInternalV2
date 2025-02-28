import { OnInit, Component } from '@angular/core';


@Component({
    selector: 'app-menu',
    templateUrl: './app.menu.component.html'
})
export class AppMenuComponent implements OnInit {

    model: any[] = [];



    ngOnInit() {
        this.model = [
            {
                label: 'PRO-Internal',
                icon: 'pi pi-home',
                items: [{label: 'Dashboards', icon: 'pi pi-fw pi-home',
                    items:
                      [{ label: 'Home', icon: 'pi pi-fw pi-home', routerLink: ['/Dashboard-landing']  },
                        {label: 'Accounting',icon: 'pi pi-fw pi-money-bill',
                          items:[
                              { label: 'Accounting Dash', icon: 'pi pi-fw pi-sign-in', routerLink: ['/dashboard-accounting'] },
                              { label: 'Quarterly Rebates', icon: 'pi pi-fw pi-times-circle', routerLink: ['/qtr-rebates'] }
                         
                           
                            /*{label: 'Fetch Data', icon: 'pi pi-fw pi-lock', routerLink: ['/fetch-data'] },*/
                            
                            ]
                        },
                         { label: 'Product', icon: 'pi pi-fw pi-money-bill', routerLink: ['/dashboard-banking']  }
                        ]
                    },
                ]
          },

          {
            label: 'Rebate Management',
            icon: 'pi pi-wrench',
            items: [
              { label: '(IR) Maintenance', icon: 'pi pi-wrench', routerLink: ['/rebatesupport'] },
              { label: ' BRM - (IR) Support', icon: 'pi pi-wrench', routerLink: ['/rebatesupport'] }

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


          {
            label: 'Management',
            icon: 'pi pi-fw pi-wallet',
            items: [
              {
                label: 'Product Management', icon: 'pi pi-fw pi-image', 

                items: [

                  { label: 'Product Configuration', icon: 'pi pi-fw pi-sign-in', routerLink: ['ecommerce/product-overview'] },
                  { label: 'Product Gating', icon: 'pi pi-fw pi-building', routerLink: ['/gating'] }

                  /*{label: 'Fetch Data', icon: 'pi pi-fw pi-lock', routerLink: ['/fetch-data'] },*/

                ]

              },

              

                    {label: 'Connection Comments',icon: 'pi pi-fw pi-comments',routerLink: ['/apps/chat']},
                   //{label: 'Product List',icon: 'pi pi-fw pi-list',routerLink: ['ecommerce/product-list']},
                    {label: 'New Products',icon: 'pi pi-fw pi-plus',routerLink: ['ecommerce/new-product']},
                  //{label: 'Shopping Cart',icon: 'pi pi-fw pi-shopping-cart',routerLink: ['ecommerce/shopping-cart']},
                  //{label: 'Checkout Form',icon: 'pi pi-fw pi-check-square',routerLink: ['ecommerce/checkout-form']},
                    {label: 'Member Management',icon: 'pi pi-fw pi-list',routerLink: ['profile/list']},
                    {label: 'Process Orders',icon: 'pi pi-fw pi-history',routerLink: ['ecommerce/order-history']},
                  //{label: 'Order Summary',icon: 'pi pi-fw pi-file',routerLink: ['ecommerce/order-summary']}
                  //{label: 'Quarterly Rebates',icon: 'pi pi-fw pi-times-circle',routerLink: ['ecommerce/qtr-rebates']}
            ]
          },
            {
                label: 'Company',
                icon: 'pi pi-th-large',
                items: [
                    //{
                    //    label: 'Blog',
                    //    icon: 'pi pi-fw pi-comment',
                    //    items: [
                    //        {
                    //            label: 'List',
                    //            icon: 'pi pi-fw pi-image',
                    //            routerLink: ['/apps/blog/list']
                    //        },
                    //        {
                    //            label: 'Detail',
                    //            icon: 'pi pi-fw pi-list',
                    //            routerLink: ['/apps/blog/detail']
                    //        },
                    //        {
                    //            label: 'Edit',
                    //            icon: 'pi pi-fw pi-pencil',
                    //            routerLink: ['/apps/blog/edit']
                    //        }
                    //    ]
                    //},
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
                        items: [
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
            },
            {
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
            },
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
            },
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
            },
            {
                label: 'Core Pages',
                icon: 'pi pi-fw pi-briefcase',
                items: [
                    //{
                    //    label: 'Landing',
                    //    icon: 'pi pi-fw pi-globe',
                    //    routerLink: ['/landing']
                    //},
                    {
                        label: 'Auth',
                        icon: 'pi pi-fw pi-user',
                        items: [
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
                    },
                    {
                        label: 'Crud',
                        icon: 'pi pi-fw pi-pencil',
                        routerLink: ['/pages/crud']
                    },
                    {
                        label: 'Timeline',
                        icon: 'pi pi-fw pi-calendar',
                        routerLink: ['/pages/timeline']
                    },
                    {
                        label: 'Invoice',
                        icon: 'pi pi-fw pi-dollar',
                        routerLink: ['/pages/invoice']
                    },
                    {
                        label: 'Help',
                        icon: 'pi pi-fw pi-question-circle',
                        routerLink: ['/pages/help']
                    },
                    {
                        label: 'Not Found',
                        icon: 'pi pi-fw pi-exclamation-circle',
                        routerLink: ['/notfound']
                    },
                    //{
                    //    label: 'Not Found 2',
                    //    icon: 'pi pi-fw pi-exclamation-circle',
                    //    routerLink: ['/notfound2']
                    //},
                    {
                        label: 'Empty Page',
                        icon: 'pi pi-fw pi-circle-off',
                        routerLink: ['/pages/empty']
                    },
                ]
            },
            {
                label: 'User Management',
                icon: 'pi pi-fw pi-user',
                items: [
                   
                    {
                        label: 'Create',
                        icon: 'pi pi-fw pi-plus',
                        routerLink: ['profile/create']
                    }
                ]
            },
            {
                label: 'Hierarchy',
                icon: 'pi pi-fw pi-align-left',
                items: [
                    {
                        label: 'Submenu 1',
                        icon: 'pi pi-fw pi-align-left',
                        items: [
                            {
                                label: 'Submenu 1.1',
                                icon: 'pi pi-fw pi-align-left',
                                items: [
                                    {
                                        label: 'Submenu 1.1.1',
                                        icon: 'pi pi-fw pi-align-left',
                                    },
                                    {
                                        label: 'Submenu 1.1.2',
                                        icon: 'pi pi-fw pi-align-left',
                                    },
                                    {
                                        label: 'Submenu 1.1.3',
                                        icon: 'pi pi-fw pi-align-left',
                                    }
                                ]
                            },
                            {
                                label: 'Submenu 1.2',
                                icon: 'pi pi-fw pi-align-left',
                                items: [
                                    {
                                        label: 'Submenu 1.2.1',
                                        icon: 'pi pi-fw pi-align-left',
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        label: 'Submenu 2',
                        icon: 'pi pi-fw pi-align-left',
                        items: [
                            {
                                label: 'Submenu 2.1',
                                icon: 'pi pi-fw pi-align-left',
                                items: [
                                    {
                                        label: 'Submenu 2.1.1',
                                        icon: 'pi pi-fw pi-align-left',
                                    },
                                    {
                                        label: 'Submenu 2.1.2',
                                        icon: 'pi pi-fw pi-align-left',
                                    }
                                ]
                            },
                            {
                                label: 'Submenu 2.2',
                                icon: 'pi pi-fw pi-align-left',
                                items: [
                                    {
                                        label: 'Submenu 2.2.1',
                                        icon: 'pi pi-fw pi-align-left',
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            //{
            //    label: 'Start',
            //    icon: 'pi pi-fw pi-download',
            //    items: [
            //        {
            //            label: 'Buy Now',
            //            icon: 'pi pi-fw pi-shopping-cart',
            //            url: ['https://www.primefaces.org/store']
            //        },
            //        {
            //            label: 'Documentation',
            //            icon: 'pi pi-fw pi-info-circle',
            //            routerLink: ['/documentation']
            //        }
            //    ]
            //}
        ];
    }
}
