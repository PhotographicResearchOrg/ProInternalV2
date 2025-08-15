import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Subject, firstValueFrom, takeUntil } from 'rxjs';
import { Prod, BrandOption, IQPrompt, ProductInfoType, Accessory, RelatedProduct, ProductAttribute, GroupMember } from 'src/app/models/Product/EditProduct'; 
import { DataService } from 'src/app/services/data.service'
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-product-edit',
  templateUrl: './product-edit.component.html'
})

export class ProductEditComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  loading = false;

  product!: Prod;
  brands: BrandOption[] = [];
  prompts: IQPrompt[] = [];
  showBrandRebate = false;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private api: DataService,
    private router: Router,
    private toast: MessageService
  ) { }

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code') || '';
    this.buildForm();
    this.init(code);
  }

  // ---------- Form builders / getters ----------
  private buildForm(): void {
    this.form = this.fb.group({
      productId: [0],
      productCode: [{ value: '', disabled: true }],
      modelName: ['', Validators.required],
      modelVersion: [''],
      p65: [''],

      isActive: [false],
      isPublic: [false],
      isForSale: [false],
      shippingHold: [false],
      isDiscontinued: [{ value: false, disabled: true }],
      requireSerialForSar: [false],
      specialOrder: [false],
      newProdOverride: [false],

      replacementCode: [''],

      topCatId: [null],
      categoryId: [null],

      brandId: [null],
      brandRebate: [null],

      multiple: [{ value: null, disabled: true }],
      carton: [{ value: null, disabled: true }],

      features: [''],
      specs: [''],
      faq: [''],
      outOfStockMessage: [''],
      stockDueDate: [null],

      accessories: this.fb.array([]),
      relatedProducts: this.fb.array([]),

      tags: [[]], // array of strings

      variationColorName: [''],
      variationColorHex: [''],
      variationSize: [''],

      // productAttributes[0] = SARAllowMultiple (boolean in form, will stringify on save)
      // productAttributes[1] = SARStartingPrompt (string)
      productAttributes: this.fb.array([]),
      // group is display-only list of members
      group: this.fb.array([]),
      isGroupDefault: [false]
    });
  }

  get accessoriesFA(): FormArray { return this.form.get('accessories') as FormArray; }
  get relatedFA(): FormArray { return this.form.get('relatedProducts') as FormArray; }
  get attrsFA(): FormArray { return this.form.get('productAttributes') as FormArray; }
  get groupFA(): FormArray { return this.form.get('group') as FormArray; }

  // ---------- Init / patch ----------
  private async init(code: string): Promise<void> {
    this.loading = true;
    try {
      const resp = await firstValueFrom(this.api.getProductByCode(code));
      if (!resp.success || !resp.data) {
        this.toast.add({ severity: 'error', summary: 'Error', detail: resp.message || 'Unable to load product' });
        this.router.navigate(['/ecommerce/product-overview']);
        return;
      }

      this.product = resp.data;

      this.prompts = this.product.iqPrompts || [];
      this.brands = this.product.brands || [];
      this.patchForm(this.product);

      // toggle brand rebate field when brand changes
      this.form.get('brandId')!.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((val: number | null) => {
          const selected = this.brands.find(b => b.brandId === val);
          this.showBrandRebate = !!selected?.displayBrandRebate;
          if (!this.showBrandRebate) this.form.get('brandRebate')!.setValue(null);
        });

      const selected = this.brands.find(b => b.brandId === this.form.get('brandId')!.value);
      this.showBrandRebate = !!selected?.displayBrandRebate;
    } finally {
      this.loading = false;
    }
  }

  private patchForm(p: Prod): void {
    this.form.patchValue({ ...p });

    // Accessories
    this.accessoriesFA.clear();
    (p.accessories || []).forEach((a: Accessory) =>
      this.accessoriesFA.push(this.fb.group({
        accessoryProductId: [a.accessoryProductId || 0],
        productCode: [a.productCode || ''],
        modelName: [a.modelName || '']
      }))
    );
    if (this.accessoriesFA.length === 0) this.addAccessoryRow();

    // Related
    this.relatedFA.clear();
    (p.relatedProducts || []).forEach((r: RelatedProduct) =>
      this.relatedFA.push(this.fb.group({
        relatedProductId: [r.relatedProductId || 0],
        productCode: [r.productCode || ''],
        modelName: [r.modelName || '']
      }))
    );
    if (this.relatedFA.length === 0) this.addRelatedRow();

    // Attributes (index 0/1 preserved for SAR flags)
    const attrMap = new Map<string, string>(
      (p.productAttributes || []).map((a: ProductAttribute) => [a.attributeName, a.attributeValue])
    );
    this.attrsFA.clear();
    this.attrsFA.push(this.fb.group({
      attributeName: ['SARAllowMultiple'],
      attributeValue: [attrMap.get('SARAllowMultiple') === 'true'] // boolean in form
    }));
    this.attrsFA.push(this.fb.group({
      attributeName: ['SARStartingPrompt'],
      attributeValue: [attrMap.get('SARStartingPrompt') || '']
    }));

    // Group (display)
    this.groupFA.clear();
    (p.group || []).forEach((m: GroupMember) =>
      this.groupFA.push(this.fb.group({
        productCode: [m.productCode],
        groupCode: [m.groupCode]
      }))
    );
  }

  // ---------- Accessory / Related handlers ----------
  addAccessoryRow(): void {
    this.accessoriesFA.push(this.fb.group({
      accessoryProductId: [0],
      productCode: [''],
      modelName: ['']
    }));
  }

  addRelatedRow(): void {
    this.relatedFA.push(this.fb.group({
      relatedProductId: [0],
      productCode: [''],
      modelName: ['']
    }));
  }

  async lookupRow(type: ProductInfoType, idx: number): Promise<void> {
    const array = type === 'accessory' ? this.accessoriesFA : this.relatedFA;
    const row = array.at(idx) as FormGroup;
    const code = String(row.get('productCode')!.value || '').trim();
    if (!code) return;

    const parentId = Number(this.form.get('productId')!.value || 0);
    const resp = await firstValueFrom(this.api.lookupProductInfo(code, type, parentId));

    if (resp.success && resp.data) {
      row.patchValue({
        modelName: resp.data.modelName,
        ...(type === 'accessory'
          ? { accessoryProductId: resp.data.productId }
          : { relatedProductId: resp.data.productId })
      });
      this.toast.add({ severity: 'success', summary: 'Linked', detail: resp.data.modelName });
      if (idx === array.length - 1) (type === 'accessory' ? this.addAccessoryRow() : this.addRelatedRow());
    } else {
      row.patchValue({ modelName: '' });
      this.toast.add({ severity: 'warn', summary: 'Not found', detail: resp.message || 'Invalid product code' });
    }
  }

  removeRow(type: ProductInfoType, idx: number): void {
    const array = type === 'accessory' ? this.accessoriesFA : this.relatedFA;
    array.removeAt(idx);
    if (array.length === 0) (type === 'accessory' ? this.addAccessoryRow() : this.addRelatedRow());
  }

  // ---------- Tags ----------
  async onTagAdd(evt: any): Promise<void> {
    const tag = this.extractTagFromChipsEvent(evt, 'add');
    if (!tag) return;

    const productId = Number(this.form.get('productId')!.value || 0);
    const resp = await firstValueFrom(this.api.addTag(productId, tag));
    if (!resp.success) {
      this.toast.add({ severity: 'error', summary: 'Tag error', detail: resp.message || 'Could not add tag' });
      // rollback UI
      const tags: string[] = [...(this.form.get('tags')!.value as string[])];
      tags.pop();
      this.form.get('tags')!.setValue(tags);
    }
  }

  async onTagRemove(evt: any): Promise<void> {
    const tag = this.extractTagFromChipsEvent(evt, 'remove');
    if (!tag) return;

    const productId = Number(this.form.get('productId')!.value || 0);
    const resp = await firstValueFrom(this.api.removeTag(productId, tag));
    if (!resp.success) {
      this.toast.add({ severity: 'error', summary: 'Tag error', detail: resp.message || 'Could not remove tag' });
      // restore UI
      const tags: string[] = [...(this.form.get('tags')!.value as string[]), tag];
      this.form.get('tags')!.setValue(tags);
    }
  }

  private extractTagFromChipsEvent(evt: any, kind: 'add' | 'remove'): string {
    // String directly
    if (typeof evt === 'string') return evt;

    // Common PrimeNG shapes
    if (evt?.chip !== undefined) return String(evt.chip);           // some versions
    if (evt?.item !== undefined) return String(evt.item);           // some versions
    if (evt?.removedTag !== undefined) return String(evt.removedTag);

    // Fallback: derive from the control’s current value
    const value = this.form.get('tags')!.value as string[] | undefined;
    if (Array.isArray(value)) {
      if (kind === 'add') return value[value.length - 1] ?? '';
      // For remove we can't infer reliably; return empty (no-op)
    }
    return '';
  }


  // ---------- Save / Group / Nav ----------
  async save(): Promise<void> {
    if (this.form.invalid) {
      this.toast.add({ severity: 'warn', summary: 'Validation', detail: 'Please fill all required fields' });
      this.form.markAllAsTouched();
      return;
    }

    // Normalize attributes (boolean -> 'true'/'false')
    const normalizedAttrs: ProductAttribute[] = (this.attrsFA.value as ProductAttribute[]).map((a: any) => ({
      attributeName: a.attributeName,
      attributeValue: a.attributeName === 'SARAllowMultiple'
        ? (a.attributeValue ? 'true' : 'false')
        : String(a.attributeValue ?? '')
    }));

    const payload: Prod = { ...(this.form.getRawValue() as Prod), productAttributes: normalizedAttrs };
    const resp = await firstValueFrom(this.api.updateProduct(payload));
    if (resp.success) {
      this.toast.add({ severity: 'success', summary: 'Saved', detail: resp.message || 'Product updated' });
    } else {
      this.toast.add({ severity: 'error', summary: 'Save failed', detail: resp.message || 'Unable to save' });
    }
  }

  async removeFromGroup(productCode: string): Promise<void> {
    const res = await firstValueFrom(this.api.removeFromGroup(productCode));
    this.toast.add({
      severity: res.success ? 'success' : 'error',
      summary: res.success ? 'Removed' : 'Failed',
      detail: res.message || ''
    });
    if (res.success) location.reload();
  }

  async addToGroup(): Promise<void> {
    const code = String(this.form.get('productCode')!.value || '');
    const colorName = String(this.form.get('variationColorName')!.value || '');
    const colorHex = String(this.form.get('variationColorHex')!.value || '');
    const size = String(this.form.get('variationSize')!.value || '');
    const input = document.getElementById('groupCodeInput') as HTMLInputElement | null;
    const groupCode = (input?.value || '').trim();

    if (!groupCode) {
      this.toast.add({ severity: 'warn', summary: 'Group', detail: 'Enter a Group Code' });
      return;
    }

    const res = await firstValueFrom(this.api.addToGroup({ productCode: code, groupCode, colorName, colorHex, size }));
    this.toast.add({
      severity: res.success ? 'success' : 'error',
      summary: res.success ? 'Added' : 'Failed',
      detail: res.message || ''
    });
    if (res.success) location.reload();
  }

  goTechSpecs(): void {
    const code = String(this.form.get('productCode')!.value || '');
    this.router.navigate(['/ecommerce/product-edit', code, 'techspecs']);
  }

  // ---------- Cleanup ----------
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
