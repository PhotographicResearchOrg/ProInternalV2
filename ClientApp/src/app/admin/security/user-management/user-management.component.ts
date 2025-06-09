import { Component, OnInit } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { ProUser } from 'src/app/models/pro-user';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Observable, forkJoin } from 'rxjs';




@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {
  users: ProUser[] = [];
  selectedUser: ProUser | null = null;

  allRoles: string[] = [];
  availableRoles: string[] = [];
  selectedRoles: string[] = [];

  allPermissions: { permissionName: string, description: string }[] = [];
  //allPermissions: { label: string; value: string }[] = [];
  availableExtraPermissionOptions: { label: string; value: string }[] = [];
  selectedExtraPermissions: string[] = [];

  roleFilterOptions: { label: string; value: string }[] = [];
  selectedRoleFilter: string[] = [];
  permissionsToAdd: string[] = [];

  searchTerm = '';
  selectedSort = '';
  showEditSidebar = false;
  isMobile = window.innerWidth < 768;

  sortOptions = [
    { label: 'Name A-Z', value: 'nameAsc' },
    { label: 'Name Z-A', value: 'nameDesc' },
    { label: 'Email A-Z', value: 'emailAsc' },
    { label: 'Email Z-A', value: 'emailDesc' }
  ];

  constructor(
    private dataService: DataService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) { }

  ngOnInit(): void {

    this.dataService.getAllRoles().subscribe(roles => {
      const roleNames = roles.map(r => r.roleName); // Extract role names from object
      this.allRoles = roleNames.map(r => r.toLowerCase());
      this.roleFilterOptions = roleNames.map(r => ({ label: r, value: r.toLowerCase() }));
      this.loadUsers();
    });

 


    this.dataService.getAllPermissions().subscribe(perms => {
      this.allPermissions = perms;

      this.availableExtraPermissionOptions = perms.map(p => ({
        label: `${p.permissionName} — ${p.description}`,
        value: p.permissionName
      }));
    });


  }


  ngOnDestroy(): void {
    this.confirmationService.close();
  }


  loadUsers(): void {
    this.dataService.getUsers().subscribe(users => {
      this.users = users;
    });
  }


  updateAvailableExtraPermissionOptions(): void {
    const selectedSet = new Set(this.selectedExtraPermissions);
    this.availableExtraPermissionOptions = this.allPermissions
      .filter(p => !selectedSet.has(p.permissionName))
      .map(p => ({
        label: `${p.permissionName} — ${p.description}`,
        value: p.permissionName
      }));
  }



  addExtraPermissions() {
    for (const perm of this.permissionsToAdd) {
      if (!this.selectedExtraPermissions.includes(perm)) {
        this.selectedExtraPermissions.push(perm);
      }
    }

    // Clear selection and trigger change detection
    this.permissionsToAdd = [];

    // Force re-render by rebuilding available options
    this.availableExtraPermissionOptions = this.allPermissions
      .filter(p => !this.selectedExtraPermissions.includes(p.permissionName))
      .map(p => ({
        label: `${p.permissionName} — ${p.description}`,
        value: p.permissionName
      }));
  }


  get filteredUsers(): ProUser[] {
    let filtered = [...this.users];

    if (this.selectedRoleFilter?.length) {
      filtered = filtered.filter(user =>
        user.roles?.some(role => this.selectedRoleFilter.includes(role.toLowerCase()))
      );
    }

    if (this.searchTerm?.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.username?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term)
      );
    }

    switch (this.selectedSort) {
      case 'nameAsc': return filtered.sort((a, b) => a.username.localeCompare(b.username));
      case 'nameDesc': return filtered.sort((a, b) => b.username.localeCompare(a.username));
      case 'emailAsc': return filtered.sort((a, b) => a.email.localeCompare(b.email));
      case 'emailDesc': return filtered.sort((a, b) => b.email.localeCompare(a.email));
      default: return filtered;
    }
  }

  editUserRoles(user: ProUser): void {
    this.selectedUser = user;
    const currentRoles = user.roles?.map(r => r.toLowerCase()) || [];
    this.selectedRoles = [...currentRoles];
    this.availableRoles = this.allRoles.filter(r => !currentRoles.includes(r));
    this.selectedExtraPermissions = [...(user.extraPermissions || [])];
    this.updateAvailableExtraPermissionOptions();
    this.showEditSidebar = true;
  }


  saveUserEdits(): void {
    if (!this.selectedUser) return;
    const userId = this.selectedUser.userId;

    this.dataService.assignRoles(userId, this.selectedRoles).subscribe(() => {
      this.selectedUser!.roles = [...this.selectedRoles];

      this.dataService.assignExtraPermissions(userId, this.selectedExtraPermissions).subscribe(() => {
        this.selectedUser!.extraPermissions = [...this.selectedExtraPermissions];
        this.showEditSidebar = false;

        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'User roles and permissions updated.'
        });
      });

    });
  }


  removeExtraPermission(perm: string): void {
    this.selectedExtraPermissions = this.selectedExtraPermissions.filter(p => p !== perm);
    if (this.selectedUser) {
      this.selectedUser.extraPermissions = [...this.selectedExtraPermissions];
    }
    this.updateAvailableExtraPermissionOptions();
  }


  disableUser(user: ProUser): void {
    this.dataService.disableUser(user.userId).subscribe(() => {
      this.messageService.add({ severity: 'warn', summary: 'User Disabled' });
      this.showEditSidebar = false;
      this.loadUsers();
    });
  }

  enableUser(user: ProUser): void {
    this.dataService.enableUser(user.userId).subscribe(() => {
      this.messageService.add({ severity: 'success', summary: 'User Enabled' });
      this.showEditSidebar = false;
      this.loadUsers();
    });
  }

  confirmDisableUser(user: ProUser): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to disable ${user.username}?`,
      header: 'Confirm Disable',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.disableUser(user)
    });
  }

  confirmEnableUser(user: ProUser): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to enable ${user.username}?`,
      header: 'Confirm Enable',
      icon: 'pi pi-check-circle',
      accept: () => this.enableUser(user)
    });
  }

  confirmDeleteUser(user: ProUser): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to permanently delete ${user.username}?`,
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.dataService.deleteUser(user.userId).subscribe(() => {
          this.messageService.add({ severity: 'error', summary: 'User Deleted' });
          this.showEditSidebar = false;
          this.loadUsers();
        });
      }
    });
  }


  clearRoleFilter(): void {
    this.selectedRoleFilter = [];
  }

  sortUsers(): void {
    this.users = [...this.users]; // trigger change detection
  }

  getStatusSeverity(status: string | undefined): 'success' | 'info' | 'warning' | 'danger' | null {
    switch (status?.toLowerCase()) {
      case 'active': return 'success';
      case 'disabled': return 'danger';
      case 'system': return 'warning';
      default: return 'success';
    }
  }

}
