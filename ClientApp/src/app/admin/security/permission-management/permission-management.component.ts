import { Component, OnInit } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Observable, forkJoin } from 'rxjs';
import { PickListMoveToTargetEvent, PickListMoveToSourceEvent } from 'primeng/picklist';
import { Router, Route } from '@angular/router';

@Component({
  selector: 'app-permission-management',
  templateUrl: './permission-management.component.html',
  styleUrls: ['./permission-management.component.scss']
})

export class PermissionManagementComponent implements OnInit {
  //permissions: string[] = [];
  permissions: { permissionName: string, description: string }[] = [];
  selectedPermission: any = null;
  newPermission = { name: '', description: '' };
  editMode = false;
  createDialogVisible = false;
  permissionSearchTerm: string = '';
  permissionSortOptions = [
    { label: 'Name A-Z', value: 'nameAsc' },
    { label: 'Name Z-A', value: 'nameDesc' }
  ];


  selectedPermissionSort: string = '';
  filteredPermissions: { permissionName: string; description?: string }[] = [];
  originalPermissionName: string = '';
  unconfiguredRoutes: {
    path: string;
    suggestedPermission: string;
    description: string;
    routePath: string;
  }[] = [];
  missingPermissionDialogVisible = false; 
  constructor(
    private dataService: DataService,
    private toast: MessageService,
    private confirmationService: ConfirmationService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadPermissions();
  }
  ngOnDestroy(): void {
    this.confirmationService.close();
  }

 

  loadPermissions() {
    this.dataService.getAllPermissions().subscribe(perms => {
      this.permissions = perms;
      this.applyPermissionFilter();
    });
  }

  applyPermissionFilter() {
  let result = [...this.permissions];

  if (this.permissionSearchTerm?.trim()) {
    const term = this.permissionSearchTerm.toLowerCase();
    result = result.filter(p =>
      p.permissionName.toLowerCase().includes(term) ||
      p.description?.toLowerCase().includes(term)
    );
  }

  if (this.selectedPermissionSort === 'nameAsc') {
    result.sort((a, b) => a.permissionName.localeCompare(b.permissionName));
  } else if (this.selectedPermissionSort === 'nameDesc') {
    result.sort((a, b) => b.permissionName.localeCompare(a.permissionName));
  }

  this.filteredPermissions = result;
}

  openCreateDialog(): void {
    this.newPermission = { name: '', description: '' };
    this.createDialogVisible = true;
    this.editMode = false;
  }

  openEditDialog(permission: any): void {
    this.newPermission = { name: permission.permissionName, description: permission.description };
    this.originalPermissionName = permission.permissionName; // <== add this line
    this.editMode = true;
    this.createDialogVisible = true;
  }


  savePermission(): void {
    const { name, description } = this.newPermission;

    if (this.editMode) {
      this.dataService.updatePermission(this.originalPermissionName, name.trim(), description.trim()).subscribe({
        next: () => {
          this.toast.add({ severity: 'success', summary: 'Permission Updated' });
          this.createDialogVisible = false;
          this.loadPermissions();
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Failed to update permission' });
        }
      });
    } else {
      this.dataService.createPermission(name.trim(), description.trim()).subscribe({
        next: () => {
          this.toast.add({ severity: 'success', summary: 'Permission Created' });
          this.createDialogVisible = false;
          this.loadPermissions();
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Failed to create permission' });
        }
      });
    }
  }


  confirmDelete(permission: any): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${permission.permissionName}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.dataService.deletePermission(permission.permissionName).subscribe({
          next: () => {
            this.toast.add({ severity: 'warn', summary: 'Permission Deleted' });
            this.loadPermissions();
          },
          error: () => {
            this.toast.add({ severity: 'error', summary: 'Failed to delete permission' });
          }
        });
      }
    });
  }



  scanRoutesForUnprotectedPermissions(): void {
    const routes = this.flattenRoutes(this.router.config);
    const existing = this.permissions.map(p => p.permissionName);

    this.unconfiguredRoutes = routes
      .filter(r =>
        r.path &&
        !(r.data?.['permissions']?.length) &&
        r.component &&
        !existing.includes(this.buildPermissionFromRoute(r).suggestedPermission)
      )
      .map(r => this.buildPermissionFromRoute(r));

    this.missingPermissionDialogVisible = true;
  }



  flattenRoutes(routes: Route[], prefix = ''): Route[] {
    return routes.flatMap(route => {
      const fullPath = prefix + '/' + (route.path || '');
      const flat: Route = { ...route, path: fullPath.replace('//', '/') };
      return route.children?.length
        ? [flat, ...this.flattenRoutes(route.children, fullPath)]
        : [flat];
    });
  }

  buildPermissionFromRoute(route: Route): {
    path: string;
    suggestedPermission: string;
    description: string;
    routePath: string;
  } {
    const cleanedPath = route.path?.replace(/\/+/g, '/').replace(/^\//, '') || '';

    return {
      path: cleanedPath,
      suggestedPermission: `ACCESS_${cleanedPath.toUpperCase().replace(/[\/\-]/g, '_')}`,
      description: `Permission for /${cleanedPath}`,
      routePath: '/' + cleanedPath // ✅ for display
    };
  }



  createSuggestedPermissions(): void {
    const tasks = this.unconfiguredRoutes.map(p =>
      this.dataService.createPermission(p.suggestedPermission, p.description, p.routePath)
    );

    forkJoin(tasks).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: 'Permissions Created' });
        this.loadPermissions();
        this.missingPermissionDialogVisible = false;
      },
      error: () => {
        this.toast.add({ severity: 'error', summary: 'Failed to create some permissions' });
      }
    });
  }



}
