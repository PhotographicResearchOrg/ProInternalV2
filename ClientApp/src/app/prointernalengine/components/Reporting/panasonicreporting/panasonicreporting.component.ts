import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';

import { panaAccount, panaRep } from 'src/app/models/vendor/panasonicreporting';
import { DataService } from 'src/app/services/data.service';

import * as XLSX from 'xlsx';




@Component({
  selector: 'app-panasonicreporting',
  standalone: true,
  templateUrl: './panasonicreporting.component.html',
  styleUrl: './panasonicreporting.component.scss',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    InputTextModule,
    DropdownModule,
    ButtonModule,
    TabViewModule,
    ToastModule,
    DialogModule,
    ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService]
})
export class PanasonicreportingComponent {

  accounts: panaAccount[] = [];
  reps: panaRep[] = [];
  accountDialogVisible = false;
  repDialogVisible = false;
  editingAccount: panaAccount = { meca: '', accountNumber: null, accountName: '', repid: null };
  editingRep: panaRep | null = null;

  constructor(
    private dataService: DataService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.dataService.getAllReps().subscribe(reps => this.reps = reps);
    this.dataService.getAllAccounts().subscribe(accounts => this.accounts = accounts);
  }

  // Account logic
  showAddAccountDialog(): void {
    this.editingAccount = { meca: '', accountNumber: null, accountName: '', repid: null };
    this.accountDialogVisible = true;
  }

  openEditAccountDialog(account: panaAccount): void {
    this.editingAccount = {
      ...account,
      repid: (account as any).repId ?? account.repid ?? null 
    };
    this.accountDialogVisible = true;
  }


  exportAccountsToExcel(): void {
    const exportData = this.accounts.map(acc => ({
      MECA: acc.meca,
      'Account Number': acc.accountNumber,
      'Account Name': acc.accountName,
      Rep: this.getRepName(acc.repid)
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Accounts');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
    XLSX.writeFile(workbook, `PanasonicAccounts_${timestamp}.xlsx`);
  }


  confirmAddAccount(): void {
    if (!this.editingAccount) return;
    console.log('Saving account:', this.editingAccount);

    this.dataService.saveAccount(this.editingAccount).subscribe({
      next: (savedAccount: panaAccount) => {
        const index = this.accounts.findIndex(a => a.id === savedAccount.id);
        if (index !== -1) {
          this.accounts[index] = { ...savedAccount };
        } else {
          this.accounts.push({ ...savedAccount });
        }

        this.accountDialogVisible = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Account Saved',
          detail: `"${savedAccount.accountName}" was successfully saved.`
        });

        this.editingAccount = { meca: '', accountNumber: null, accountName: '', repid: null };
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Save Failed',
          detail: 'Could not save account.'
        });
        console.error(err);
      }
    });
  }


  confirmAddRep(): void {
    if (!this.editingRep) return;

    this.dataService.saveRep(this.editingRep).subscribe({
      next: (savedRep: panaRep) => {
        const index = this.reps.findIndex(r => r.id === savedRep.id);
        if (index !== -1) {
          this.reps[index] = { ...savedRep };
        } else {
          this.reps.push({ ...savedRep });
        }

        this.repDialogVisible = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Rep Saved',
          detail: `"${savedRep.repName}" was successfully saved.`
        });

        this.editingRep = null;
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Save Failed',
          detail: 'Could not save rep.'
        });
        console.error(err);
      }
    });
  }





  saveAccount(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Account Saved',
      detail: `"${this.editingAccount.accountName}" has been saved.`
    });
    this.accountDialogVisible = false;
  }


  deleteAccount(account: panaAccount): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${account.accountName}" (MECA: ${account.meca})?`,
      header: 'Confirm Account Deletion',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.dataService.deleteAccount(account.meca).subscribe(() => {
          this.accounts = this.accounts.filter(a => a !== account);
          this.messageService.add({
            severity: 'success',
            summary: 'Account Deleted',
            detail: `${account.accountName} removed.`
          });
        });
      }
    });
  }

  isAccountValid(): boolean {
    const a = this.editingAccount;
    return !!(a.meca && a.accountNumber && a.accountName && a.repid);
  }

  // Rep logic
  showAddRepDialog(): void {
    this.editingRep = { repName: '', email: '' };
    this.repDialogVisible = true;
  }

  openEditRepDialog(rep: panaRep): void {
    this.editingRep = { ...rep };
    this.repDialogVisible = true;
  }






  saveEditedRep(): void {
    if (!this.editingRep) return;

    // Future implementation for saving to backend
    this.messageService.add({
      severity: 'success',
      summary: 'Rep Updated',
      detail: `"${this.editingRep.repName}" was updated.`
    });

    this.repDialogVisible = false;
    this.editingRep = null;
  }

  deleteRep(rep: panaRep): void {
    if (!rep.id) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Deletion Skipped',
        detail: `Rep "${rep.repName}" has no ID.`
      });
      return;
    }

    this.confirmationService.confirm({
      message: `Are you sure you want to delete rep "${rep.repName}"?`,
      header: 'Confirm Rep Deletion',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.dataService.deleteRep(rep.id!).subscribe(() => {
          this.reps = this.reps.filter(r => r.id !== rep.id);
          this.messageService.add({
            severity: 'success',
            summary: 'Rep Deleted',
            detail: `Rep "${rep.repName}" removed.`
          });
        });
      }
    });
  }

  isRepValid(): boolean {
    const r = this.editingRep;
    return !!(r?.repName && r?.email);
  }

  getRepName(repid: number | null): string {
    if (repid == null) return '';
    const rep = this.reps.find(r => r.id === repid);
    return rep ? rep.repName : '❌ Unknown Rep';
  }

  getRepById(id: number): panaRep | {} {
    return this.reps.find(r => r.id === id) || {};
  }

  save(): void {
    this.accounts.forEach(a => this.dataService.saveAccount(a).subscribe());
    this.reps.forEach(r => this.dataService.saveRep(r).subscribe());

    this.messageService.add({
      severity: 'success',
      summary: 'Changes Saved',
      detail: 'All updates saved.',
      life: 3000
    });
  }
}
