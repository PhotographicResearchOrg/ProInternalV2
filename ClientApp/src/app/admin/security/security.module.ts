import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabViewModule } from 'primeng/tabview';
import { ChipModule } from 'primeng/chip';
import { DialogModule } from 'primeng/dialog';
import { MultiSelectModule } from 'primeng/multiselect';
import { SidebarModule } from 'primeng/sidebar';
import { PickListModule } from 'primeng/picklist';
import { MessageService } from 'primeng/api'; 
import { ToastModule } from 'primeng/toast';
import { ListboxModule } from 'primeng/listbox';
import { ConfirmationService } from 'primeng/api'; // already assumed
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { UserManagementComponent } from 'src/app/admin/security/user-management/user-management.component';
import { RolesManagementComponent } from 'src/app/admin/security/role-management/role-management.component';
import { PermissionManagementComponent } from 'src/app/admin/security/permission-management/permission-management.component';
import { SecurityAdminComponent } from 'src/app/admin/security/security-admin/security-admin.component';

import { FormsModule } from '@angular/forms';
import { BadgeModule } from 'primeng/badge';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { AutoCompleteModule } from 'primeng/autocomplete';


@NgModule({
  declarations: [
    SecurityAdminComponent,
    UserManagementComponent,
    RolesManagementComponent,
    PermissionManagementComponent
    
  ],
  imports: [
    TooltipModule,
    ConfirmDialogModule,
    ListboxModule,
    SidebarModule,
    PickListModule,
    CommonModule,
    TabViewModule,
    ChipModule,
    DialogModule,
    MultiSelectModule,
    FormsModule,
    BadgeModule,
    DropdownModule,
    ButtonModule,
    ToastModule,
    AutoCompleteModule,
    TableModule
  ],
   providers:
    [
       MessageService, ConfirmationService
    ],
})
export class SecurityModule { }
