import { Component, Input, OnChanges } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { VendorLogin, VendorLoginSaveRequest, VendorLogins } from 'src/app/models/vendor/vendor-desk.models';
import { exportWorkbook } from './desk-export';

/** Vendor Desk › Contacts: the vendor's people and their credit-site logins (dbo.VendorUsers, what old
 *  ProInternal's Administration › VendorContacts edits). Passwords can be set, never shown. Nothing is deleted:
 *  contacts are switched off. */
@Component({
  selector: 'app-vendor-logins',
  templateUrl: './vendor-logins.component.html',
  styleUrls: ['./vendor-desk.shared.scss']
})
export class VendorLoginsComponent implements OnChanges {
  @Input() vendorId: number | null = null;

  data: VendorLogins | null = null;
  loading = false;
  error = '';
  showOff = false;
  draft: (VendorLoginSaveRequest & { confirm?: string }) | null = null;
  saving = false;
  saveError = '';

  constructor(private api: DataService) { }

  ngOnChanges(): void { if (this.vendorId) this.load(); }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.vendorLogins(this.vendorId!).subscribe({
      next: d => { this.data = d; this.loading = false; },
      error: e => { this.loading = false; this.error = e?.error?.message || 'Couldn\'t load the contacts.'; }
    });
  }

  get shown(): VendorLogin[] { return (this.data?.contacts || []).filter(c => this.showOff || c.isActive); }
  get offCount(): number { return (this.data?.contacts || []).filter(c => !c.isActive).length; }

  name(c: VendorLogin): string { return [c.firstName, c.lastName].filter(x => !!x).join(' ') || '(no name)'; }

  add(): void {
    this.saveError = '';
    this.draft = { userId: null, firstName: '', lastName: '', email: '', phone: '', phoneAlt: '', fax: '', isActive: true,
                   contactType: this.data?.types[0]?.contactType ?? 1, username: '', password: '', confirm: '' };
  }

  edit(c: VendorLogin): void {
    this.saveError = '';
    this.draft = { userId: c.userId, firstName: c.firstName || '', lastName: c.lastName || '', email: c.email, phone: c.phone,
                   phoneAlt: c.phoneAlt, fax: c.fax, isActive: c.isActive, contactType: c.contactType, username: c.username,
                   password: '', confirm: '' };
  }

  save(): void {
    if (!this.draft || !this.vendorId) return;
    if (this.draft.password && this.draft.password !== this.draft.confirm) { this.saveError = 'The two passwords don\'t match.'; return; }
    this.saving = true;
    this.saveError = '';
    const { confirm, ...body } = this.draft;
    this.api.vendorLoginSave(this.vendorId, body).subscribe({
      next: () => { this.saving = false; this.draft = null; this.load(); },
      error: e => { this.saving = false; this.saveError = e?.error?.message || 'Couldn\'t save the contact.'; }
    });
  }

  toggle(c: VendorLogin): void {
    if (!this.vendorId) return;
    this.api.vendorLoginActive(this.vendorId, c.userId, !c.isActive).subscribe({
      next: () => this.load(),
      error: e => this.error = e?.error?.message || 'Couldn\'t change the contact.'
    });
  }

  addressText(a: { address1?: string | null; address2?: string | null; city?: string | null; state?: string | null; zip?: string | null; country?: string | null }): string {
    return [a.address1, a.address2, [a.city, [a.state, a.zip].filter(x => !!x).join(' ')].filter(x => !!x).join(', '), a.country].filter(x => !!x).join(' · ');
  }

  export(): void {
    const d = this.data;
    if (!d) return;
    exportWorkbook(`Vendor${d.vendorId}_Contacts`, [
      { name: 'Contacts', rows: d.contacts.map(c => ({ Name: this.name(c), Type: c.contactTypeName || c.contactType, Email: c.email || '',
          Phone: c.phone || '', 'Alt phone': c.phoneAlt || '', Fax: c.fax || '', 'Login name': c.username || '',
          'Password set': c.hasPassword ? 'Yes' : 'No', Active: c.isActive ? 'Yes' : 'No', 'Last login': c.lastLogin || '' })) },
      { name: 'Addresses', rows: d.addresses.map(a => ({ Address: this.addressText(a), Type: a.addressTypeId, Primary: a.isPrimary ? 'Yes' : '' })) }
    ]);
  }
}
