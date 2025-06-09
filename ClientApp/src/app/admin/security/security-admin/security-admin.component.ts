import { Component } from '@angular/core';
import { TabViewModule } from 'primeng/tabview';
import { PermissionManagementComponent } from 'src/app/admin/security/permission-management/permission-management.component';
import { RolesManagementComponent } from 'src/app/admin/security/role-management/role-management.component';
import { UserManagementComponent } from 'src/app/admin/security/user-management/user-management.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-security-admin',
  templateUrl: './security-admin.component.html',
  styleUrl: './security-admin.component.scss'
})
export class SecurityAdminComponent {
  activeTabIndex: number = 0;

}
