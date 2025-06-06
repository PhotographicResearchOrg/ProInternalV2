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

  rolePermissions: string[] = [];
  availablePermissions: string[] = [];
  selectedRolePermissions: string[] = [];
  lastSyncedPermissions: string[] = [];


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



  loadRoles() {
    this.dataService.getAllRoles().subscribe(roles => {
      this.roles = roles.map(r => ({
        label: r.roleName,
        value: r.roleName,
        description: r.description
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
        this.rolePermissions = assigned;

        // Remove assigned from available list
        this.availablePermissions = all.filter(p => !assigned.includes(p));

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
    if (this.selectedRole) {
      this.dataService.assignPermissionsToRole(this.selectedRole, this.rolePermissions).subscribe(() => {
        this.toast.add({ severity: 'success', summary: 'Permissions saved' });
        this.showEditSidebar = false;
      });
    }
  }

  onPermissionsUpdated(): void {
    if (!this.selectedRole) return;

    const newAssigned = [...this.rolePermissions];
    const oldAssigned = this.lastSyncedPermissions || [];

    const added = newAssigned.filter(p => !oldAssigned.includes(p));
    const removed = oldAssigned.filter(p => !newAssigned.includes(p));

    const tasks: Observable<void>[] = [];

    if (added.length > 0) {
      tasks.push(this.dataService.assignPermissionsToRole(this.selectedRole, added));
    }

    if (removed.length > 0) {
      tasks.push(this.dataService.removePermissionsFromRole(this.selectedRole, removed));
    }

    if (tasks.length > 0) {
      forkJoin(tasks).subscribe(() => {
        this.toast.add({ severity: 'success', summary: 'Permissions updated' });
        this.lastSyncedPermissions = [...newAssigned];
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

    this.dataService.renameRole(oldName, newName).subscribe(() => {
     // this.toast.add({ severity: 'success', summary: 'Role Renamed' });
      this.renameMode = null;
      this.renameInput = '';
      this.loadRoles();
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
    this.dataService.deleteRole(role).subscribe(() => {
      this.toast.add({ severity: 'warn', summary: 'Role Deleted' });
      this.loadRoles();
    });
  }

  createRole() {
    if (!this.newRoleName.trim()) return;

    const exists = this.roles.some(r => r.value.toLowerCase() === this.newRoleName.trim().toLowerCase());
    if (exists) {
      this.toast.add({ severity: 'error', summary: 'Role already exists' });
      return;
    }

    this.dataService.createRole(this.newRoleName, this.newRoleDescription).subscribe(() => {
      this.toast.add({ severity: 'success', summary: 'Role Created' });
      this.newRoleName = '';
      this.newRoleDescription = '';
      this.createRoleDialog = false;
      this.loadRoles();
    });
  }


}
