import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { DataService } from 'src/app/services/data.service';
import { ProductAssetField, ProductAssetsView, ProductImageAsset, ProductShopifyChange } from 'src/app/models/Product/product-assets.models';

export interface AssetFolder { name: string; count: number; icon: string; }

/**
 * Product Desk · Shopify & assets (read only).
 * Shopify: every Shopify column on ProductData, the productlastchanged feed (what was sent and Shopify's answer),
 * governance issues and the taxonomy audit. Assets: images (ProductImage + FolderScan sizes), documents (UploadFile),
 * S3 files (GetProductFiles), and video / asset columns on ProductData.
 */
@Component({
  selector: 'app-product-assets',
  templateUrl: './product-assets.component.html',
  styleUrls: ['./product-assets.component.scss']
})
export class ProductAssetsComponent implements OnChanges {
  @Input() productId: number | string = 0;
  /** Compact: only the folder summary (for the product's Overview), with a link to the full section. */
  @Input() compact = false;
  @Output() openFull = new EventEmitter<void>();

  view: ProductAssetsView | null = null;
  loading = false;
  error: string | null = null;
  showAllFeed = false;
  bigImage: string | null = null;

  constructor(private data: DataService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId']) { this.load(); }
  }

  load(): void {
    const id = Number(this.productId);
    this.view = null;
    this.error = null;
    if (!id) { return; }
    this.loading = true;
    this.data.productAssets(id, this.compact).subscribe({
      next: v => { this.view = v; this.loading = false; },
      error: (e: HttpErrorResponse) => { this.loading = false; this.error = e?.error?.message || 'Couldn\'t load Shopify and assets.'; }
    });
  }

  // ------------------------------------------------------------ folder summary

  /** What the product has, by folder: image sizes, document folders (from UploadFile's location), S3 files, videos. */
  get folders(): AssetFolder[] {
    const v = this.view;
    if (!v) { return []; }
    const out: AssetFolder[] = [];
    const add = (name: string, count: number, icon: string) => { if (count > 0) { out.push({ name, count, icon }); } };
    add('Product Image - Hi Res', v.images.filter(i => i.hasFull).length, 'pi pi-image');
    add('Product Image - 250', v.images.filter(i => i.has250).length, 'pi pi-image');
    add('Product Image - Lo Res', v.images.filter(i => i.has100).length, 'pi pi-image');
    add('Images on the B2B site', v.images.filter(i => i.inProductImage).length, 'pi pi-globe');
    const docFolders = new Map<string, number>();
    v.documents.forEach(d => {
      const parts = (d.fileLocation ?? '').split(/[\\/]/).filter(x => !!x);
      const folder = parts.length ? parts[parts.length - 1] : 'Documents';
      docFolders.set(folder, (docFolders.get(folder) ?? 0) + 1);
    });
    [...docFolders.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([n, c]) => add(n, c, 'pi pi-file-pdf'));
    add('S3 files', v.files.length, 'pi pi-cloud');
    add('Videos', this.otherFields.filter(f => /video|youtube/i.test(f.fieldName) && !!f.fieldValue).length, 'pi pi-video');
    return out;
  }

  get assetTotal(): number { return this.folders.filter(f => f.name !== 'Images on the B2B site').reduce((a, f) => a + f.count, 0); }

  // ------------------------------------------------------------ Shopify

  get shopifyFields(): ProductAssetField[] {
    return (this.view?.fields ?? []).filter(f => /shopify/i.test(f.fieldName));
  }

  get otherFields(): ProductAssetField[] {
    return (this.view?.fields ?? []).filter(f => !/shopify/i.test(f.fieldName));
  }

  /** The Shopify product id: the ShopifyProdID column (or any Shopify column ending in ProdID / ProductID). */
  get shopifyProductId(): string | null {
    const f = this.shopifyFields.find(x => /prod(uct)?id$/i.test(x.fieldName));
    return f?.fieldValue || null;
  }

  get adminLink(): string | null {
    const url = this.view?.shopifyAdminProductUrl;
    const id = this.shopifyProductId;
    return url && id ? url.replace('{id}', encodeURIComponent(id)) : null;
  }

  /** The last status change Shopify processed (IsPublic 1 = active, 0 = archived). */
  get lastStatus(): { status: string; when: string | null; ok: boolean | null; row: ProductShopifyChange } | null {
    const row = (this.view?.shopifyFeed ?? []).find(r => (r.change ?? '').toLowerCase() === 'ispublic' && !!r.dateProcessed);
    if (!row) { return null; }
    return { status: String(row.newValue).trim() === '1' ? 'Active' : 'Archived', when: row.dateProcessed, ok: this.resultOk(row.result), row };
  }

  get pendingCount(): number {
    return (this.view?.shopifyFeed ?? []).filter(r => !r.dateProcessed).length;
  }

  get feed(): ProductShopifyChange[] {
    const f = this.view?.shopifyFeed ?? [];
    return this.showAllFeed ? f : f.slice(0, 8);
  }

  /** Shopify's answer: OK when it returned the product, failed when it returned errors. */
  resultOk(result: string | null): boolean | null {
    if (!result) { return null; }
    const r = result.toLowerCase();
    if (r.startsWith('skipped')) { return null; }
    if (r.includes('"errors"') || r.includes('"error"') || r.includes('usererrors":[{') || r.includes('error processing')) { return false; }
    if (r.includes('"product"') || r.includes('"data"')) { return true; }
    return null;
  }

  // ------------------------------------------------------------ assets

  imageUrl(img: ProductImageAsset | string): string {
    const name = typeof img === 'string' ? img : img.imageName;
    return (this.view?.imageBaseUrl ?? '') + encodeURIComponent(name);
  }

  isLink(v: string | null): boolean { return !!v && /^https?:\/\//i.test(v.trim()); }

  /** A video column holding a YouTube id or link, as a link to watch it. */
  videoLink(f: ProductAssetField): string | null {
    const v = (f.fieldValue ?? '').trim();
    if (!v) { return null; }
    if (this.isLink(v)) { return v; }
    if (/video|youtube/i.test(f.fieldName) && /^[A-Za-z0-9_-]{11}$/.test(v)) { return `https://www.youtube.com/watch?v=${v}`; }
    return null;
  }

  when(v: string | null): string {
    if (!v) { return '—'; }
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleString();
  }

  // ------------------------------------------------------------ export

  exportAll(): void {
    const v = this.view;
    if (!v) { return; }
    const wb = XLSX.utils.book_new();
    const add = (rows: any[], name: string) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': 'None' }]), name);
    add(v.fields.map(f => ({ Field: f.fieldName, Value: f.fieldValue ?? '' })), 'Fields');
    add(v.shopifyFeed.map(r => ({ Id: r.id, Change: r.change, Old: r.oldValue, New: r.newValue, Changed: this.when(r.dateChanged),
      Processed: this.when(r.dateProcessed), Result: r.result ?? '' })), 'Shopify feed');
    add(v.shopifyIssues.map(i => ({ Type: i.issueType, Severity: i.issueSeverity, Details: i.details, Created: this.when(i.createdDate),
      'Shopify product': i.shopifyProductId })), 'Shopify issues');
    add(v.shopifyTaxonomy.map(t => ({ 'Shopify category': t.shopifyCategoryFullName, 'Category id': t.shopifyCategoryId, Applied: t.wasApplied ? 'Yes' : 'No',
      Images: t.imageCount, Status: t.status, Created: this.when(t.createdDate) })), 'Shopify taxonomy');
    add(v.images.map(i => ({ Image: i.imageName, Order: i.displayOrder ?? '', 'In ProductImage': i.inProductImage ? 'Yes' : 'No',
      '100px': i.has100 ? 'Yes' : 'No', '250px': i.has250 ? 'Yes' : 'No', Full: i.hasFull ? 'Yes' : 'No', Url: this.imageUrl(i) })), 'Images');
    add(v.documents.map(d => ({ File: d.fileName, Name: d.displayName ?? '', Location: d.fileLocation ?? '', Link: d.link ?? '' })), 'Documents');
    add(v.files.map(f => ({ Name: f.displayName ?? '', Bucket: f.bucket ?? '', Link: f.link ?? '' })), 'S3 files');
    XLSX.writeFile(wb, `Assets_${v.productCode}.xlsx`);
  }
}
