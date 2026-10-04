// src/app/accountmanagement/vendor-custom-fields/vendor-custom-fields.component.ts
//
// Defines the custom fields shown on every vendor card. Each field belongs
// to one vendor-card section (Terms & Financials, Contracts, ...) and only
// appears there; per-vendor values are entered on the vendor card itself.

import { Component, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Observable } from 'rxjs';
import { DataService } from 'src/app/services/data.service';
import {
  VendorCustomFieldDefinitionApi, VENDOR_CUSTOM_FIELD_SECTIONS, VENDOR_CUSTOM_FIELD_TYPES
} from 'src/app/models/vendor/vendor-card.model';

@Component({
  selector: 'app-vendor-custom-fields',
  templateUrl: './vendor-custom-fields.component.html',
  styleUrls: ['./vendor-custom-fields.component.scss']
})
export class VendorCustomFieldsComponent implements OnInit {

  definitions: VendorCustomFieldDefinitionApi[] = [];
  loading = false;
  saving = false;

  sectionOptions = VENDOR_CUSTOM_FIELD_SECTIONS.map(s => ({ label: s.label, value: s.id }));
  sectionFilterOptions = [{ label: 'All sections', value: '' }, ...this.sectionOptions];
  typeOptions = VENDOR_CUSTOM_FIELD_TYPES;
  sectionFilter = '';

  dialogVisible = false;
  editingId: number | null = null;
  editingUsageCount = 0;
  draft: Partial<VendorCustomFieldDefinitionApi> = {};

  // field-level validation errors from the last failed save, keyed by
  // lowercased API property name (e.g. "label" -> message)
  formErrors: { [field: string]: string } = {};

  constructor(
    private dataService: DataService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) { }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.dataService.getVendorCustomFieldDefinitions().subscribe({
      next: list => {
        this.definitions = list || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast('error', 'Could not load custom fields');
      }
    });
  }

  filtered(): VendorCustomFieldDefinitionApi[] {
    return this.sectionFilter
      ? this.definitions.filter(d => d.section === this.sectionFilter)
      : this.definitions;
  }

  sectionLabel(id: string): string {
    return VENDOR_CUSTOM_FIELD_SECTIONS.find(s => s.id === id)?.label || id;
  }

  openAdd(): void {
    this.formErrors = {};
    this.editingId = null;
    this.editingUsageCount = 0;
    this.draft = {
      section: this.sectionFilter || VENDOR_CUSTOM_FIELD_SECTIONS[0].id,
      dataType: 'Text',
      isPublishable: false,
      sortOrder: 0
    };
    this.dialogVisible = true;
  }

  openEdit(d: VendorCustomFieldDefinitionApi): void {
    this.formErrors = {};
    this.editingId = d.vendorCustomFieldDefinitionId;
    this.editingUsageCount = d.usageCount;
    this.draft = {
      section: d.section, label: d.label, dataType: d.dataType,
      isPublishable: d.isPublishable, sortOrder: d.sortOrder
    };
    this.dialogVisible = true;
  }

  save(): void {
    if (!this.draft.label?.trim()) return;

    this.saving = true;
    const body = { ...this.draft, label: this.draft.label.trim(), sortOrder: this.draft.sortOrder || 0 };
    const request: Observable<unknown> = this.editingId
      ? this.dataService.updateVendorCustomFieldDefinition(this.editingId, body)
      : this.dataService.addVendorCustomFieldDefinition(body);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.dialogVisible = false;
        this.toast('success', this.editingId ? 'Custom field updated' : 'Custom field added');
        this.load();
      },
      error: err => {
        this.saving = false;
        this.handleSaveError(err);
      }
    });
  }

  confirmDelete(d: VendorCustomFieldDefinitionApi): void {
    const usage = d.usageCount
      ? ` It has a value on ${d.usageCount} vendor${d.usageCount === 1 ? '' : 's'}; those values will be permanently deleted.`
      : '';
    this.confirmationService.confirm({
      key: 'cf-delete',
      header: 'Delete custom field',
      icon: 'pi pi-exclamation-triangle',
      message: `Delete "${d.label}" from ${this.sectionLabel(d.section)} for all vendors?${usage}`,
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.dataService.deleteVendorCustomFieldDefinition(d.vendorCustomFieldDefinitionId).subscribe({
          next: () => {
            this.toast('success', 'Custom field deleted');
            this.load();
          },
          error: () => this.toast('error', 'Could not delete custom field')
        });
      }
    });
  }

  fieldError(field: string): string {
    return this.formErrors[field.toLowerCase()] || '';
  }

  // ASP.NET ValidationProblemDetails: { errors: { Field: [msg, ...] } }
  private handleSaveError(err: any): void {
    const apiErrors = err?.error?.errors;
    if (apiErrors && typeof apiErrors === 'object') {
      const parsed: { [field: string]: string } = {};
      for (const key of Object.keys(apiErrors)) {
        const messages = apiErrors[key];
        parsed[key.toLowerCase()] = Array.isArray(messages) ? messages[0] : String(messages);
      }
      this.formErrors = parsed;
    } else {
      this.formErrors = {};
      this.toast('error', 'Could not save custom field');
    }
  }

  private toast(severity: 'success' | 'error', detail: string): void {
    this.messageService.add({ severity, summary: severity === 'success' ? 'Saved' : 'Error', detail, life: 2500 });
  }
}
