import { Component, Input, OnChanges } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { exportWorkbook } from './desk-export';
import { VendorBilling, VendorBillingSaveRequest, VendorRecord, VendorRecordField } from 'src/app/models/vendor/vendor-desk.models';

interface FieldGroup { name: string; fields: VendorRecordField[]; }

/** Vendor Desk tabs fed from Computyme:
 *  mode 'record'  every APMST field for the vendor, read only, with parsed terms and where the vendor is used
 *  mode 'billing' direct billing: Computyme's values (locked) and the PIV2 split (extension) */
@Component({
  selector: 'app-vendor-record',
  templateUrl: './vendor-record.component.html',
  styleUrls: ['./vendor-desk.shared.scss', './vendor-record.component.scss']
})
export class VendorRecordComponent implements OnChanges {
  @Input() vendorId: number | null = null;
  @Input() mode: 'record' | 'billing' = 'record';

  record: VendorRecord | null = null;
  groups: FieldGroup[] = [];
  showHidden = false;
  loading = false;
  error = '';

  billing: VendorBilling | null = null;
  draft: VendorBillingSaveRequest = {};
  overridePass = false;
  saving = false;
  saveError = '';
  saved = false;

  constructor(private data: DataService) { }

  ngOnChanges(): void {
    if (!this.vendorId) return;
    if (this.mode === 'record') this.loadRecord(); else this.loadBilling();
  }

  /* ------------------------------------------------------------ record */

  loadRecord(): void {
    this.loading = true;
    this.error = '';
    this.data.vendorRecord(this.vendorId!).subscribe({
      next: r => { this.record = r; this.loading = false; this.regroup(); },
      error: e => { this.loading = false; this.error = e?.error?.message || 'Couldn\'t load the vendor record.'; }
    });
  }

  regroup(): void {
    const by = new Map<string, VendorRecordField[]>();
    for (const f of this.record?.fields || []) {
      if (f.hidden && !this.showHidden) continue;
      if (!by.has(f.groupName)) by.set(f.groupName, []);
      by.get(f.groupName)!.push(f);
    }
    this.groups = Array.from(by.entries()).map(([name, fields]) => ({ name, fields }));
  }

  shown(f: VendorRecordField): string {
    const v = f.displayValue ?? f.value;
    return v == null || String(v).trim() === '' ? '—' : String(v);
  }

  /* ------------------------------------------------------------ billing */

  loadBilling(): void {
    this.loading = true;
    this.error = '';
    this.data.vendorBilling(this.vendorId!).subscribe({
      next: b => { this.setBilling(b); this.loading = false; },
      error: e => { this.loading = false; this.error = e?.error?.message || 'Couldn\'t load direct billing.'; }
    });
  }

  private setBilling(b: VendorBilling): void {
    this.billing = b;
    const s = b.split;
    this.draft = {
      cashDiscountPct: s?.cashDiscountPct ?? null,
      proSharePct: s?.proSharePct ?? null,
      specialDeductionPct: s?.specialDeductionPct ?? null,
      passToMemberPct: s?.passToMemberPct ?? null,
      addSurchargeToMemberBill: s?.addSurchargeToMemberBill ?? b.computyme?.addsSurchargeToMemberBill ?? null,
      effectiveFrom: s?.effectiveFrom ? s.effectiveFrom.substring(0, 10) : null,
      notes: s?.notes ?? null
    };
    this.overridePass = s?.passToMemberPct != null;
  }

  /** what passes to the member with the values on screen */
  get passCalculated(): number {
    const n = (v: number | null | undefined) => (v == null || isNaN(+v) ? 0 : +v);
    return Math.round((n(this.draft.cashDiscountPct) - n(this.draft.proSharePct) - n(this.draft.specialDeductionPct)) * 1000) / 1000;
  }

  /** start the split from Computyme's stored cash discount, if it reads as a number */
  takeComputymeDiscount(): void {
    const v = parseFloat(this.billing?.computyme?.cashDiscountStored || '');
    if (!isNaN(v)) this.draft.cashDiscountPct = v;
  }

  saveBilling(): void {
    if (!this.vendorId) return;
    this.saving = true;
    this.saveError = '';
    this.saved = false;
    const body: VendorBillingSaveRequest = { ...this.draft, passToMemberPct: this.overridePass ? this.draft.passToMemberPct : null };
    this.data.vendorBillingSave(this.vendorId, body).subscribe({
      next: b => { this.saving = false; this.saved = true; this.setBilling(b); },
      error: e => { this.saving = false; this.saveError = e?.error?.message || 'Couldn\'t save the split.'; }
    });
  }

  exportRecord(): void {
    const r = this.record;
    if (!r) return;
    exportWorkbook(`Vendor${r.vendorId}_Record`, [
      { name: 'Vendor record', rows: r.fields.map(f => ({ Group: f.groupName, Field: f.label, Column: f.columnName, Value: f.displayValue ?? f.value ?? '', Note: f.note || '' })) },
      { name: 'Terms', rows: r.terms ? [{ 'As typed': r.terms.dueDaysText || '', Meaning: r.terms.description, Type: r.terms.termsType,
          'Net days': r.terms.netDays ?? '', 'Day of month': r.terms.dayOfMonth ?? '', 'Cash discount %': r.terms.cashDiscountPct ?? r.terms.cashDiscountText ?? '' }] : [] },
      { name: 'Usage', rows: r.usage ? [{ 'Live products bought here': r.usage.liveProductsAsVendor, 'Products incl. discontinued': r.usage.productsAsVendor,
          Brands: r.usage.brands, 'Direct-billing programs': r.usage.directBillingPrograms, 'Open POs': r.usage.openPurchaseOrders, 'POs on file': r.usage.purchaseOrders }] : [] }
    ]);
  }

  exportBilling(): void {
    const b = this.billing;
    if (!b) return;
    const c = b.computyme;
    exportWorkbook(`Vendor${b.vendorId}_DirectBilling`, [
      { name: 'Computyme', rows: c ? [{ 'Cash discount (stored)': c.cashDiscountStored || '', 'PRO surcharge (stored)': c.surchargeStored || '',
          'Surcharge code': c.surchargeCodeStored || '', 'On member bill': c.addsSurchargeToMemberBill ? 'Yes' : 'No', 'Due days': c.dueDaysText || '' }] : [] },
      { name: 'Programs', rows: b.programs.map(p => ({ Program: p.programNo ?? '', Name: p.name || '', 'Surcharge (stored)': p.surchargeStored || '',
          'Special deduction': p.specialDeductionStored || '', 'Special %': p.specialPctStored || '', 'Admin days': p.adminDaysStored || '',
          FTR: p.ftrStored || '', 'YTD sales': p.ytdSalesStored || '', 'Prior year': p.priorYearStored || '', Surcharges: p.surchargesStored || '' })) },
      { name: 'Split', rows: b.split ? [{ 'Cash discount %': b.split.cashDiscountPct ?? '', 'PRO keeps %': b.split.proSharePct ?? '',
          'Special deduction %': b.split.specialDeductionPct ?? '', 'Passed to member %': b.split.passToMemberEffectivePct ?? '',
          'Passed to member is': b.split.passToMemberIsCalculated ? 'worked out' : 'set', 'On member bill': b.split.addSurchargeToMemberBill ? 'Yes' : 'No',
          'Effective from': b.split.effectiveFrom || '', Notes: b.split.notes || '', 'Saved by': b.split.updatedBy || '', Saved: b.split.updatedAt || '' }] : [] },
      { name: 'Split changes', rows: b.log.map(l => ({ When: l.changedAt, Who: l.changedBy || '', Before: l.oldJson || '', After: l.newJson || '' })) }
    ]);
  }

  dash(v: string | null | undefined): string { return v == null || String(v).trim() === '' ? '—' : String(v); }
}
