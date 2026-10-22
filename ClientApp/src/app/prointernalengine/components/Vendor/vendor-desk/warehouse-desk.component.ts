import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DataService } from 'src/app/services/data.service';
import { WarehouseContact, WarehouseDetail, WarehouseRow, WarehouseView } from 'src/app/models/vendor/vendor-desk.models';
import { exportWorkbook } from './desk-export';
import { HomePin, stablePin } from 'src/app/services/home-pin.service';

/** Warehouses: where stock is held, with address, hours, receiving notes and contacts. */
@Component({
  selector: 'app-warehouse-desk',
  templateUrl: './warehouse-desk.component.html',
  styleUrls: ['./desk-shell.scss', './warehouse-desk.component.scss']
})
export class WarehouseDeskComponent implements OnInit {
  list: WarehouseRow[] = [];
  canEdit = false;
  view: WarehouseView | null = null;
  selected: string | null = null;
  draft: WarehouseDetail | null = null;
  isNew = false;
  loading = false;
  saving = false;
  error = '';
  saved = '';

  contactDraft: WarehouseContact | null = null;
  contactError = '';
  showLog = false;

  readonly types = [
    { value: 'OWN', label: 'Our warehouse' },
    { value: '3PL', label: '3PL' },
    { value: 'VENDOR', label: 'Vendor (ships direct)' }
  ];
  readonly sources = [
    { value: 'COMPUTYME', label: 'Computyme (PA stock)' },
    { value: 'FEED', label: 'Stock feed from the warehouse' },
    { value: 'PIV2', label: 'Kept in PIV2' }
  ];

  constructor(private data: DataService, private route: ActivatedRoute) { }

  ngOnInit(): void {
    const want = this.route.snapshot?.queryParamMap?.get('code');
    this.loadList(want);
  }

  loadList(select?: string | null): void {
    this.data.warehouses().subscribe({
      next: r => {
        this.list = r.warehouses || [];
        this.canEdit = r.canEdit;
        const code = select || this.selected || this.list[0]?.warehouseCode;
        if (code) this.open(code);
      },
      error: e => this.error = e?.error?.message || 'Couldn\'t load the warehouses.'
    });
  }

  open(code: string): void {
    this.selected = code;
    this.isNew = false;
    this.loading = true;
    this.error = this.saved = '';
    this.contactDraft = null;
    this.data.warehouse(code).subscribe({
      next: v => { this.view = v; this.draft = { ...v.warehouse }; this.loading = false; },
      error: e => { this.loading = false; this.error = e?.error?.message || 'Couldn\'t load that warehouse.'; }
    });
  }

  addNew(): void {
    this.selected = null;
    this.isNew = true;
    this.view = null;
    this.saved = this.error = '';
    this.draft = { warehouseCode: '', name: '', warehouseType: '3PL', stockSource: 'FEED', isActive: true, sortOrder: 100, country: 'US' };
  }

  get locked(): boolean { return !this.canEdit; }
  get computymeStock(): boolean { return !this.isNew && this.view?.warehouse.stockSource === 'COMPUTYME'; }

  save(): void {
    if (!this.draft) return;
    this.saving = true;
    this.error = this.saved = '';
    this.data.warehouseSave(this.draft).subscribe({
      next: r => { this.saving = false; this.saved = 'Saved'; this.loadList(r.warehouseCode); },
      error: e => { this.saving = false; this.error = e?.error?.message || 'Couldn\'t save the warehouse.'; }
    });
  }

  address(w: WarehouseRow | WarehouseDetail): string {
    const line2 = [w.city, [w.state, w.postalCode].filter(x => !!x).join(' ')].filter(x => !!x).join(', ');
    return [w.address1, w.address2, line2, w.country].filter(x => !!x).join(' · ') || 'No address yet';
  }

  typeLabel(t: string): string { return this.types.find(x => x.value === t)?.label || t; }

  /* ------------------------------------------------------------ contacts */

  newContact(): void { this.contactDraft = { name: '', isPrimary: !(this.view?.contacts.length), role: '' }; this.contactError = ''; }
  editContact(c: WarehouseContact): void { this.contactDraft = { ...c }; this.contactError = ''; }

  saveContact(): void {
    if (!this.contactDraft || !this.selected) return;
    if (!this.contactDraft.name?.trim()) { this.contactError = 'A contact needs a name.'; return; }
    this.data.warehouseContactSave(this.selected, this.contactDraft).subscribe({
      next: () => { this.contactDraft = null; this.open(this.selected!); this.loadListOnly(); },
      error: e => this.contactError = e?.error?.message || 'Couldn\'t save the contact.'
    });
  }

  removeContact(c: WarehouseContact): void {
    if (!c.contactId) return;
    this.data.warehouseContactDelete(c.contactId).subscribe({
      next: () => { this.open(this.selected!); this.loadListOnly(); },
      error: e => this.contactError = e?.error?.message || 'Couldn\'t remove the contact.'
    });
  }

  private loadListOnly(): void {
    this.data.warehouses().subscribe({ next: r => this.list = r.warehouses || [] });
  }

  get homePin(): HomePin | null {
    if (this.isNew || !this.selected || !this.draft) return null;
    return stablePin({ id: `warehouse:${this.selected}`, label: this.draft.name || this.selected, sub: 'Warehouses',
      icon: 'pi pi-building', route: '/warehouses', query: { code: this.selected } });
  }

  export(): void {
    exportWorkbook('Warehouses', [
      { name: 'Warehouses', rows: this.list.map(w => ({ Code: w.warehouseCode, Name: w.name, Type: this.typeLabel(w.warehouseType),
          Address: this.address(w), Phone: w.phone || '', Email: w.email || '', 'Stock from': w.stockSource,
          'Primary contact': w.primaryContact || '', 'Contact email': w.primaryEmail || '', 'Contact phone': w.primaryPhone || '',
          Contacts: w.contacts, Active: w.isActive ? 'Yes' : 'No' })) },
      { name: 'Contacts (' + (this.selected || '') + ')', rows: (this.view?.contacts || []).map(c => ({ Name: c.name, Role: c.role || '',
          Email: c.email || '', Phone: c.phone || '', Primary: c.isPrimary ? 'Yes' : '', Notes: c.notes || '' })) }
    ]);
  }
}
