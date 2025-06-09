import { Component, OnInit } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Observable, forkJoin } from 'rxjs';
import { PickListMoveToTargetEvent, PickListMoveToSourceEvent } from 'primeng/picklist';



@Component({
  selector: 'app-role-management',
  templateUrl: './role-management.component.html',
  styleUrls: ['./role-management.component.scss']
})
export class RolesManagementComponent implements OnInit {

  roles: { label: string; value: string; description?: string }[] = [];
  filteredRoles: { label: string; value: string; description?: string }[] = [];

  selectedRole: string = '';
  newRoleName: string = '';
  newRoleDescription: string = '';
  rolePermissions: (string | { permissionName: string; description?: string })[] = [];
  availablePermissions: { permissionName: string, description: string }[] = [];
  selectedRolePermissions: string[] = [];
  lastSyncedPermissions: (string | { permissionName: string; description?: string })[] = [];
  renameMode: string | null = null;
  renameInput: string = '';

  // UI states
  showEditSidebar = false;
  createRoleDialog = false;
  isMobile = window.innerWidth < 768;

  // Filters
  roleSearchTerm: string = '';
  roleFilterOptions: { label: string; value: string }[] = [];
  selectedRoleFilter: string[] = [];

  sortOptions = [
    { label: 'Name A-Z', value: 'nameAsc' },
    { label: 'Name Z-A', value: 'nameDesc' }
  ];
  selectedSort: string = '';

  constructor(
    private dataService: DataService,
    private toast: MessageService,
    private confirmationService: ConfirmationService
  ) { }

  ngOnInit() {
    this.loadRoles();
    this.loadPermissions();
  }

  ngOnDestroy(): void {
    this.confirmationService.close();
  }

  loadRoles() {
    this.dataService.getAllRoles().subscribe(roles => {

      this.roles = roles.map(r => ({
        label: r.roleName,
        value: r.roleName,
        description: r.roleDescription    
      }));

      this.roleFilterOptions = this.roles.map(r => ({
        label: r.label,
        value: r.value
      }));

      // Reset state
      this.roleSearchTerm = '';
      this.selectedRoleFilter = [];
      this.selectedSort = '';

      this.filteredRoles = [...this.roles];
    });
  }

  loadPermissions() {
    this.dataService.getAllPermissions().subscribe(perms => {
      this.availablePermissions = perms;
    });



  }


  cancelRename() {
    this.renameMode = null;
    this.renameInput = '';
  }




  applyRoleFilters() {
    let result = [...this.roles];

    // Filter by search
    if (this.roleSearchTerm?.trim()) {
      const term = this.roleSearchTerm.toLowerCase();
      result = result.filter(role =>
        role.label.toLowerCase().includes(term) ||
        role.description?.toLowerCase().includes(term)
      );
    }

    // Filter by selected roles
    if (this.selectedRoleFilter?.length) {
      result = result.filter(role => this.selectedRoleFilter.includes(role.value));
    }

    // Apply sorting
    if (this.selectedSort === 'nameAsc') {
      result.sort((a, b) => a.label.localeCompare(b.label));
    } else if (this.selectedSort === 'nameDesc') {
      result.sort((a, b) => b.label.localeCompare(a.label));
    }

    this.filteredRoles = result;
  }

  clearRoleFilter() {
    this.selectedRoleFilter = [];
    this.applyRoleFilters();
  }

  handleRoleClick(roleValue: string, event: MouseEvent) {
    event.stopPropagation();
    if (this.renameMode === roleValue) return;
    this.selectedRole = roleValue;
    this.showEditSidebar = false;

    // Get all permissions first
    this.dataService.getAllPermissions().subscribe(all => {
      // Then get assigned permissions for the selected role
      this.dataService.getPermissionsByRole(roleValue).subscribe(assigned => {

        // assigned: string[] of permission names
        this.rolePermissions = all.filter(p => assigned.includes(p.permissionName));

        // available = all minus assigned
        this.availablePermissions = all.filter(p => !assigned.includes(p.permissionName));

        this.lastSyncedPermissions = [...this.rolePermissions];
        this.showEditSidebar = true;
      });
    });
  }


  




  onRoleSelect() {
    if (this.selectedRole) {
      this.dataService.getPermissionsByRole(this.selectedRole).subscribe(perms => {
        this.rolePermissions = perms;
        this.showEditSidebar = true;
      });
    }
  }


 

  saveRolePermissions() {
    if (!this.selectedRole) return;

    const permissionsToSave = this.rolePermissions.map(p =>
      typeof p === 'string' ? p : p.permissionName
    );

    this.dataService.assignPermissionsToRole(this.selectedRole, permissionsToSave).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: 'Permissions saved' });
        this.showEditSidebar = false;
      },
      error: () => {
        this.toast.add({ severity: 'error', summary: 'Failed to save permissions' });
      }
    });
  }


  onPermissionsUpdated(): void {
    if (!this.selectedRole) return;

    const newPerms = this.rolePermissions.map(p => typeof p === 'string' ? p : p.permissionName);
    const oldPerms = this.lastSyncedPermissions.map(p => typeof p === 'string' ? p : p.permissionName);

    const added = newPerms.filter(p => !oldPerms.includes(p));
    const removed = oldPerms.filter(p => !newPerms.includes(p));

    const tasks: Observable<void>[] = [];

    if (added.length > 0) {
      tasks.push(this.dataService.assignPermissionsToRole(this.selectedRole, added));
    }

    if (removed.length > 0) {
      tasks.push(this.dataService.removePermissionsFromRole(this.selectedRole, removed));
    }

    if (tasks.length > 0) {
      forkJoin(tasks).subscribe({
        next: () => {
          this.toast.add({ severity: 'success', summary: 'Permissions updated' });
          this.lastSyncedPermissions = [...newPerms];
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: 'Failed to update permissions' });
        }
      });
    }
  }




  openRenameRole(roleValue: string) {
    this.renameMode = roleValue;
    this.renameInput = roleValue;
  }

  renameRoleConfirmed(oldName: string) {
    const newName = this.renameInput.trim();
    if (!newName || newName === oldName) {
      this.cancelRename();
      return;
    }

    const duplicate = this.roles.some(r =>
      r.value.toLowerCase() === newName.toLowerCase() && r.value !== oldName
    );

    if (duplicate) {
      this.toast.add({ severity: 'error', summary: 'Role name already exists' });
      return;
    }

    this.dataService.renameRole(oldName, newName).subscribe({
      next: () => {
        this.renameMode = null;
        this.renameInput = '';
        this.loadRoles();
        this.toast.add({ severity: 'success', summary: 'Role renamed' });
      },
      error: () => {
        this.toast.add({ severity: 'error', summary: 'Failed to rename role' });
      }
    });
  }


  confirmDeleteRole(role: string) {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete the role "${role}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.deleteRole(role)
    });
  }

  deleteRole(role: string) {
    this.dataService.deleteRole(role).subscribe({
      next: () => {
        this.toast.add({ severity: 'warn', summary: 'Role Deleted' });
        this.loadRoles();
      },
      error: () => {
        this.toast.add({ severity: 'error', summary: 'Failed to delete role' });
      }
    });
  }

  createRole() {
    if (!this.newRoleName.trim()) return;

    const exists = this.roles.some(r => r.value.toLowerCase() === this.newRoleName.trim().toLowerCase());
    if (exists) {
      this.toast.add({ severity: 'error', summary: 'Role already exists' });
      return;
    }

    this.dataService.createRole(this.newRoleName, this.newRoleDescription).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: 'Role Created' });
        this.newRoleName = '';
        this.newRoleDescription = '';
        this.createRoleDialog = false;
        this.loadRoles();
      },
      error: () => {
        this.toast.add({ severity: 'error', summary: 'Failed to create role' });
      }
    });
  }



}
