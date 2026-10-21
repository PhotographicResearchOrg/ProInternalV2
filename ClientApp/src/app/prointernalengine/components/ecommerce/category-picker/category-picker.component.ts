import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DataService } from 'src/app/services/data.service';
import { CategoryNode } from 'src/app/models/category/category-desk.models';

/** Product Desk: where this product sits, and moving it. Saves through the Category Desk publish, so it shows in its history. */
@Component({
  selector: 'app-category-picker',
  templateUrl: './category-picker.component.html',
  styleUrls: ['./category-picker.component.scss']
})
export class CategoryPickerComponent implements OnChanges {
  @Input() productId: number | string = 0;
  /** Category ids as the product page reads them today: top, category, sub-category. */
  @Input() categoryPath: string[] = [];
  @Output() changed = new EventEmitter<void>();

  loading = false;
  nodes = new Map<number, CategoryNode>();
  sqlIsMaster = false;
  canEdit = false;
  picking = false;
  search = '';
  saving = false;
  error: string | null = null;

  constructor(private data: DataService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId'] || changes['categoryPath']) {
      this.picking = false;
      this.error = null;
      if (!this.nodes.size) { this.load(); }
    }
  }

  private load(): void {
    this.loading = true;
    this.data.categoryTree().subscribe({
      next: t => {
        this.nodes = new Map(t.nodes.map(n => [n.catId, n]));
        this.sqlIsMaster = t.sqlIsMaster;
        this.canEdit = t.canEdit;
        this.loading = false;
      },
      error: () => { this.loading = false; this.error = 'Couldn\'t load the categories.'; }
    });
  }

  get nodeId(): number {
    const ids = (this.categoryPath || []).map(Number).filter(n => n > 0);
    return ids.length ? ids[ids.length - 1] : 0;
  }

  get node(): CategoryNode | undefined { return this.nodes.get(this.nodeId); }

  get crumbs(): string[] { return this.node ? this.node.pathNames.split(' › ') : []; }

  /** The EGRP category the product sits in (Computyme's until cutover). */
  get egrpNode(): CategoryNode | undefined { return this.node?.egrpNodeId ? this.nodes.get(this.node.egrpNodeId) : undefined; }

  /* Until cutover the product stays inside its EGRP category. */
  get options(): CategoryNode[] {
    const q = this.search.trim().toLowerCase();
    const branch = !this.sqlIsMaster ? this.node?.egrpNodeId ?? null : null;
    return [...this.nodes.values()]
      .filter(n => n.depth >= 1 && (branch === null || n.egrpNodeId === branch))
      .filter(n => !q || n.pathNames.toLowerCase().includes(q))
      .sort((a, b) => a.pathNames.localeCompare(b.pathNames))
      .slice(0, 200);
  }

  pick(n: CategoryNode): void {
    if (n.catId === this.nodeId) { this.picking = false; return; }
    this.saving = true;
    this.error = null;
    this.data.categoryPublish({
      changes: { categories: [], products: [{ productId: Number(this.productId), nodeId: n.catId, source: 'USER' }] },
      comment: 'Product Desk',
      baseVersion: null
    }).subscribe({
      next: () => { this.saving = false; this.picking = false; this.changed.emit(); },
      error: (e: HttpErrorResponse) => {
        this.saving = false;
        this.error = e?.status === 403 ? 'You need Categories.Edit in Security Admin to change categories.' : e?.error?.message || 'The change didn\'t save.';
      }
    });
  }
}
