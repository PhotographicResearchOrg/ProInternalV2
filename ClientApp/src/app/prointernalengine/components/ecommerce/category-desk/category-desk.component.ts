import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { DataService } from 'src/app/services/data.service';
import {
  CategoryChange, CategoryFilters, CategoryNode, CategoryProductQuery, CategoryProductRow, CategorySummary,
  ChangeSource, EgrpOption, OrphanCategory, PROBLEM_LABELS, ProductQueue, PublishItem, PublishSummary, RevertConflict
} from 'src/app/models/category/category-desk.models';

/* One category as the draft sees it: the server's row with any draft change applied. */
interface Cat {
  catId: number;
  parentCatId: number | null;
  name: string;
  visible: boolean;
  notes: string | null;
  egrp: number | null;
  deleted?: boolean;
  isNew?: boolean;
}

/* A product placed somewhere else in this draft. */
interface Move {
  productId: number;
  nodeId: number;
  fromNodeId: number;
  source: ChangeSource;
  label: string;
  active: boolean;
}

interface TreeRow {
  cat: Cat;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  total: number;
  active: number;
  changed: boolean;
  effectiveVisible: boolean;
  locked: boolean;
}

interface PreviewRow { catId: number; name: string; depth: number; hasChildren: boolean; expanded: boolean; selected: boolean; }

type ChooserPurpose = 'move-products' | 'delete-reallocate' | 'merge';

/** Category Desk: /categories. Everything is a draft until Publish. */
@Component({
  selector: 'app-category-desk',
  templateUrl: './category-desk.component.html',
  styleUrls: ['../../MemberManagement/member-desk/member-desk.component.scss', './category-desk.component.scss'],
  providers: [MessageService]
})
export class CategoryDeskComponent implements OnInit, OnDestroy {
  readonly problemLabels = PROBLEM_LABELS;
  readonly draftKey = 'categoryDesk.draft.v1';

  loading = true;
  sqlIsMaster = false;
  canEdit = false;
  version = 0;
  summary: CategorySummary = { uncategorized: 0, suspect: 0, visibleEmpty: 0, orphans: 0, version: 0 };
  egrps: EgrpOption[] = [];
  orphans: OrphanCategory[] = [];
  filters: CategoryFilters = { brands: [], vendors: [] };

  /* server state */
  private base = new Map<number, CategoryNode>();
  private rootId: number | null = null;

  /* draft */
  private draftCats = new Map<number, Cat>();
  private moves = new Map<number, Move>();
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private nextTempId = -1;

  /* derived, rebuilt after every change */
  private children = new Map<number, number[]>();
  private ownTotal = new Map<number, number>();
  private ownActive = new Map<number, number>();
  private totals = new Map<number, { all: number; active: number }>();
  private movedNodes = new Set<number>();
  rows: TreeRow[] = [];
  preview: PreviewRow[] = [];
  changeCount = 0;

  /* tree ui */
  expanded = new Set<number>();
  previewExpanded = new Set<number>();
  selectedId: number | null = null;
  treeFilter = '';
  renamingId: number | null = null;
  renameText = '';
  dragCatId: number | null = null;
  dropTargetId: number | null = null;

  /* right side */
  view: 'products' | 'history' = 'products';
  queue: ProductQueue | null = null;
  query: CategoryProductQuery = { status: 'ACTIVE', includeChildren: true, page: 1, pageSize: 100 };
  products: CategoryProductRow[] = [];
  productTotal = 0;
  productsLoading = false;
  selectedProducts = new Set<number>();
  selectAllMatching = false;
  acceptAbove = 80;
  private productSearch$ = new Subject<void>();
  private subs: Subscription[] = [];

  /* modals */
  chooser: { purpose: ChooserPurpose; title: string; subtitle: string; branchTopId: number | null; excludeId: number | null; search: string; busy?: boolean } | null = null;
  publishModal: { comment: string; busy: boolean; error?: string } | null = null;
  addModal: { parentId: number | null; name: string; egrp: number | null; fromEgrp: boolean } | null = null;
  history: PublishSummary[] = [];
  historyLoading = false;
  detail: { summary: PublishSummary; items: PublishItem[] } | null = null;
  revertModal: { summary: PublishSummary; conflicts: RevertConflict[]; skip: boolean; busy: boolean; error?: string } | null = null;

  constructor(private data: DataService, private toast: MessageService) {}

  // ================================================================ load

  ngOnInit(): void {
    this.subs.push(this.productSearch$.pipe(debounceTime(300)).subscribe(() => this.loadProducts()));
    this.data.categoryFilters().subscribe({ next: f => this.filters = f, error: () => {} });
    this.load(true);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  load(restoreDraft = false): void {
    this.loading = true;
    this.data.categoryTree().subscribe({
      next: t => {
        this.base.clear();
        t.nodes.forEach(n => this.base.set(n.catId, n));
        const roots = t.nodes.filter(n => n.depth === 0).map(n => n.catId);
        this.rootId = roots.length ? Math.min(...roots) : null;
        this.sqlIsMaster = t.sqlIsMaster;
        this.canEdit = t.canEdit;
        this.summary = t.summary;
        this.version = t.summary.version;
        this.egrps = t.egrpsNotOnTree;
        this.orphans = t.orphans;
        if (restoreDraft) { this.restoreDraft(); }
        this.rebuild();
        this.loading = false;
        this.loadProducts();
      },
      error: e => { this.loading = false; this.fail(e, 'Couldn\'t load the categories.'); }
    });
  }

  // ================================================================ draft basics

  cat(id: number | null): Cat | null {
    if (id === null) { return null; }
    const d = this.draftCats.get(id);
    if (d) { return d.deleted ? null : d; }
    const b = this.base.get(id);
    return b ? { catId: b.catId, parentCatId: b.parentCatId, name: b.name, visible: b.visible, notes: b.notes, egrp: b.egrp } : null;
  }

  private snapshot(): string {
    return JSON.stringify({ cats: [...this.draftCats.values()], moves: [...this.moves.values()], next: this.nextTempId });
  }

  private applySnapshot(s: string): void {
    const o = JSON.parse(s);
    this.draftCats = new Map((o.cats as Cat[]).map(c => [c.catId, c]));
    this.moves = new Map((o.moves as Move[]).map(m => [m.productId, m]));
    this.nextTempId = o.next ?? -1;
  }

  /** Every change goes through here so undo always works. */
  private change(fn: () => void): void {
    if (!this.canEdit) { return; }
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 200) { this.undoStack.shift(); }
    this.redoStack = [];
    fn();
    this.rebuild();
    this.saveDraft();
  }

  undo(): void {
    const s = this.undoStack.pop();
    if (!s) { return; }
    this.redoStack.push(this.snapshot());
    this.applySnapshot(s);
    this.rebuild();
    this.saveDraft();
  }

  redo(): void {
    const s = this.redoStack.pop();
    if (!s) { return; }
    this.undoStack.push(this.snapshot());
    this.applySnapshot(s);
    this.rebuild();
    this.saveDraft();
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  discard(): void {
    if (!this.changeCount) { return; }
    this.change(() => { this.draftCats.clear(); this.moves.clear(); });
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); this.redo(); }
    if (e.key === 'F2' && this.selectedId !== null) { e.preventDefault(); this.startRename(this.selectedId); }
  }

  /* The draft survives a reload in this browser until it is published or discarded. */
  private saveDraft(): void {
    try {
      if (!this.changeCount) { localStorage.removeItem(this.draftKey); return; }
      localStorage.setItem(this.draftKey, JSON.stringify({ version: this.version, draft: this.snapshot() }));
    } catch { /* storage unavailable: the draft lives until the page closes */ }
  }

  private restoreDraft(): void {
    try {
      const raw = localStorage.getItem(this.draftKey);
      if (!raw) { return; }
      const o = JSON.parse(raw);
      this.applySnapshot(o.draft);
      /* drop changes to categories that no longer exist */
      [...this.draftCats.keys()].filter(id => id > 0 && !this.base.has(id)).forEach(id => this.draftCats.delete(id));
      if (this.draftCats.size || this.moves.size) {
        this.toast.add({ severity: 'info', summary: 'Draft restored', detail: 'Your unpublished changes from last time are back. Discard them if you don\'t want them.' });
      }
    } catch { /* ignore a bad stored draft */ }
  }

  // ================================================================ derived state

  private rebuild(): void {
    /* children */
    this.children.clear();
    const all = new Set<number>([...this.base.keys(), ...this.draftCats.keys()]);
    all.forEach(id => {
      const c = this.cat(id);
      if (!c || c.parentCatId === null) { return; }
      const list = this.children.get(c.parentCatId) ?? [];
      list.push(id);
      this.children.set(c.parentCatId, list);
    });
    this.children.forEach(list => list.sort((a, b) => (this.cat(a)!.name).localeCompare(this.cat(b)!.name)));

    /* own counts, with draft product moves applied */
    this.ownTotal.clear();
    this.ownActive.clear();
    this.base.forEach(n => { this.ownTotal.set(n.catId, n.ownCount); this.ownActive.set(n.catId, n.ownActiveCount); });
    this.moves.forEach(m => {
      this.bump(m.fromNodeId, -1, m.active);
      this.bump(m.nodeId, +1, m.active);
    });

    this.totals.clear();
    this.movedNodes.clear();
    this.moves.forEach(m => { if (m.nodeId !== m.fromNodeId) { this.movedNodes.add(m.nodeId); this.movedNodes.add(m.fromNodeId); } });

    this.changeCount = this.countChanges();
    this.buildRows();
    this.buildPreview();
  }

  private bump(id: number, by: number, active: boolean): void {
    if (!id) { return; }
    this.ownTotal.set(id, (this.ownTotal.get(id) ?? 0) + by);
    if (active) { this.ownActive.set(id, (this.ownActive.get(id) ?? 0) + by); }
  }

  /** Products in a category and everything under it, in the draft. */
  rolled(id: number, activeOnly = false): number {
    let t = this.totals.get(id);
    if (!t) {
      t = { all: this.ownTotal.get(id) ?? 0, active: this.ownActive.get(id) ?? 0 };
      for (const c of this.children.get(id) ?? []) {
        t.all += this.rolled(c, false);
        t.active += this.rolled(c, true);
      }
      this.totals.set(id, t);
    }
    return activeOnly ? t.active : t.all;
  }

  depthOf(id: number): number {
    let d = 0;
    let c = this.cat(id);
    while (c && c.parentCatId !== null && d < 40) { d++; c = this.cat(c.parentCatId); }
    return d;
  }

  topOf(id: number | null): number | null {
    let c = this.cat(id);
    let guard = 0;
    while (c && c.parentCatId !== null && c.parentCatId !== this.rootId && guard++ < 40) { c = this.cat(c.parentCatId); }
    return c && c.parentCatId === this.rootId ? c.catId : null;
  }

  pathOf(id: number | null): string {
    const names: string[] = [];
    let c = this.cat(id);
    let guard = 0;
    while (c && c.catId !== this.rootId && guard++ < 40) { names.unshift(c.name); c = this.cat(c.parentCatId); }
    return names.join(' › ');
  }

  effectiveVisible(id: number): boolean {
    let c = this.cat(id);
    let guard = 0;
    while (c && c.catId !== this.rootId && guard++ < 40) {
      if (!c.visible) { return false; }
      c = this.cat(c.parentCatId);
    }
    return true;
  }

  isAncestor(ancestorId: number, id: number): boolean {
    let c = this.cat(id);
    let guard = 0;
    while (c && guard++ < 40) {
      if (c.catId === ancestorId) { return true; }
      c = this.cat(c.parentCatId);
    }
    return false;
  }

  isChanged(id: number): boolean {
    const d = this.draftCats.get(id);
    if (!d) { return false; }
    if (d.isNew || d.deleted) { return true; }
    const b = this.base.get(id);
    return !b || b.name !== d.name || b.parentCatId !== d.parentCatId || b.visible !== d.visible
      || (b.notes ?? '') !== (d.notes ?? '') || (b.egrp ?? null) !== (d.egrp ?? null);
  }

  isLockedTop(id: number): boolean {
    return !this.sqlIsMaster && this.depthOf(id) === 1;
  }

  private countChanges(): number {
    let n = 0;
    this.draftCats.forEach((_, id) => { if (this.isChanged(id)) { n++; } });
    this.moves.forEach(m => { if (m.nodeId !== m.fromNodeId) { n++; } });
    return n;
  }

  private buildRows(): void {
    const out: TreeRow[] = [];
    const filter = this.treeFilter.trim().toLowerCase();
    const matches = new Set<number>();
    if (filter) {
      /* keep matching categories and every category above them */
      const all = new Set<number>([...this.base.keys(), ...this.draftCats.keys()]);
      all.forEach(id => {
        const c = this.cat(id);
        if (c && c.name.toLowerCase().includes(filter)) {
          let p: Cat | null = c;
          let guard = 0;
          while (p && guard++ < 40) { matches.add(p.catId); p = this.cat(p.parentCatId); }
        }
      });
    }
    const walk = (id: number, depth: number) => {
      const c = this.cat(id);
      if (!c) { return; }
      if (filter && !matches.has(id)) { return; }
      const kids = this.children.get(id) ?? [];
      const open = filter ? true : this.expanded.has(id);
      out.push({
        cat: c, depth, hasChildren: kids.length > 0, expanded: open,
        total: this.rolled(id), active: this.rolled(id, true),
        changed: this.isChanged(id) || this.movedNodes.has(id),
        effectiveVisible: this.effectiveVisible(id),
        locked: !this.sqlIsMaster && depth === 1
      });
      if (open) { kids.forEach(k => walk(k, depth + 1)); }
    };
    if (this.rootId !== null) { (this.children.get(this.rootId) ?? []).forEach(id => walk(id, 1)); }
    this.rows = out;
  }

  /* The Connection WH page: children of the root, A-Z, hidden and empty categories left out. */
  private buildPreview(): void {
    const out: PreviewRow[] = [];
    const shown = (id: number) => { const c = this.cat(id); return !!c && c.visible && this.rolled(id, true) > 0; };
    const walk = (id: number, depth: number) => {
      const kids = (this.children.get(id) ?? []).filter(shown);
      const open = this.previewExpanded.has(id);
      out.push({ catId: id, name: this.cat(id)!.name, depth, hasChildren: kids.length > 0, expanded: open, selected: id === this.selectedId });
      if (open) { kids.forEach(k => walk(k, depth + 1)); }
    };
    if (this.rootId !== null) { (this.children.get(this.rootId) ?? []).filter(shown).forEach(id => walk(id, 0)); }
    this.preview = out;
  }

  // ================================================================ tree actions

  toggle(row: TreeRow, e?: Event): void {
    e?.stopPropagation();
    if (this.expanded.has(row.cat.catId)) { this.expanded.delete(row.cat.catId); } else { this.expanded.add(row.cat.catId); }
    this.buildRows();
  }

  expandAll(open: boolean): void {
    this.expanded.clear();
    if (open) { this.children.forEach((_, id) => this.expanded.add(id)); }
    this.buildRows();
  }

  onTreeFilter(): void { this.buildRows(); }

  select(id: number): void {
    this.selectedId = id;
    this.queue = null;
    this.view = 'products';
    /* open the path in the tree and the preview */
    let c = this.cat(this.cat(id)?.parentCatId ?? null);
    let guard = 0;
    while (c && guard++ < 40) { this.expanded.add(c.catId); this.previewExpanded.add(c.catId); c = this.cat(c.parentCatId); }
    this.previewExpanded.add(id);
    this.query = { ...this.query, nodeId: id, queue: null, page: 1 };
    this.selectedProducts.clear();
    this.selectAllMatching = false;
    this.buildRows();
    this.buildPreview();
    this.loadProducts();
  }

  get orphanNames(): string {
    return this.orphans.slice(0, 5).map(o => o.name).join(', ') + (this.orphans.length > 5 ? '…' : '');
  }

  get selected(): Cat | null { return this.cat(this.selectedId); }
  get selectedBase(): CategoryNode | undefined { return this.selectedId !== null ? this.base.get(this.selectedId) : undefined; }

  private edit(id: number, patch: Partial<Cat>): void {
    const c = this.cat(id);
    if (!c) { return; }
    this.draftCats.set(id, { ...c, ...patch, isNew: this.draftCats.get(id)?.isNew });
  }

  startRename(id: number): void {
    if (!this.canEdit) { return; }
    this.renamingId = id;
    this.renameText = this.cat(id)?.name ?? '';
  }

  commitRename(): void {
    const id = this.renamingId;
    const name = this.renameText.trim();
    this.renamingId = null;
    if (id === null || !name || name === this.cat(id)?.name) { return; }
    if (name.length > 100) { this.warn('Names are 100 characters or fewer.'); return; }
    if (this.siblingNameTaken(this.cat(id)!.parentCatId, name, id)) { this.warn(`There's already a ${name} there.`); return; }
    this.change(() => this.edit(id, { name }));
  }

  private siblingNameTaken(parentId: number | null, name: string, exceptId: number | null): boolean {
    return (this.children.get(parentId ?? -999) ?? [])
      .some(k => k !== exceptId && this.cat(k)!.name.trim().toLowerCase() === name.trim().toLowerCase());
  }

  setVisible(id: number, visible: boolean): void {
    if (visible && this.cat(id)?.parentCatId !== null && !this.effectiveVisible(this.cat(id)!.parentCatId!)) {
      this.warn('Its parent is hidden. Show the parent first; a hidden category hides everything under it.');
      return;
    }
    this.change(() => this.edit(id, { visible }));
  }

  saveNotes(id: number, notes: string): void {
    const value = notes.trim() || null;
    if ((this.cat(id)?.notes ?? null) === value) { return; }
    if (value && value.length > 1000) { this.warn('Notes are 1,000 characters or fewer.'); return; }
    this.change(() => this.edit(id, { notes: value }));
  }

  openAdd(parentId: number | null, fromEgrp = false): void {
    this.addModal = { parentId, name: '', egrp: null, fromEgrp };
  }

  pickEgrp(e: EgrpOption): void {
    if (!this.addModal) { return; }
    this.addModal.egrp = e.egrp;
    this.addModal.name = this.titleCase(e.name);
  }

  confirmAdd(): void {
    const m = this.addModal;
    if (!m) { return; }
    const name = m.name.trim();
    const parentId = m.parentId ?? this.rootId;
    if (!name) { this.warn('Give it a name.'); return; }
    if (parentId === this.rootId && !this.sqlIsMaster && m.egrp === null) {
      this.warn('The top level is the Computyme EGRP. Pick an EGRP from the list.');
      return;
    }
    if (this.siblingNameTaken(parentId, name, null)) { this.warn(`There's already a ${name} there.`); return; }
    const id = this.nextTempId--;
    this.change(() => this.draftCats.set(id, {
      catId: id, parentCatId: parentId, name, visible: true, notes: null, egrp: m.egrp, isNew: true
    }));
    if (parentId !== null) { this.expanded.add(parentId); }
    this.addModal = null;
    this.select(id);
  }

  egrpsLeft(): EgrpOption[] {
    const used = new Set<number>();
    this.draftCats.forEach(c => { if (!c.deleted && c.egrp !== null) { used.add(c.egrp); } });
    return this.egrps.filter(e => !used.has(e.egrp));
  }

  /* ---------------------------------------------------------------- drag and drop */

  canDragCat(row: TreeRow): boolean { return this.canEdit && !row.locked; }

  onCatDragStart(e: DragEvent, row: TreeRow): void {
    if (!this.canDragCat(row)) { e.preventDefault(); return; }
    this.dragCatId = row.cat.catId;
    e.dataTransfer?.setData('text/plain', `cat:${row.cat.catId}`);
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; }
  }

  onProductDragStart(e: DragEvent, p: CategoryProductRow): void {
    if (!this.canEdit) { e.preventDefault(); return; }
    if (!this.selectedProducts.has(p.productId)) { this.selectedProducts.clear(); this.selectedProducts.add(p.productId); }
    e.dataTransfer?.setData('text/plain', 'products');
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; }
  }

  onDragOver(e: DragEvent, row: TreeRow): void {
    if (!this.canEdit) { return; }
    e.preventDefault();
    this.dropTargetId = row.cat.catId;
  }

  onDragLeave(row: TreeRow): void {
    if (this.dropTargetId === row.cat.catId) { this.dropTargetId = null; }
  }

  onDrop(e: DragEvent, row: TreeRow): void {
    e.preventDefault();
    this.dropTargetId = null;
    const what = e.dataTransfer?.getData('text/plain') ?? '';
    if (what.startsWith('cat:')) {
      this.moveCategory(Number(what.slice(4)), row.cat.catId);
    } else if (what === 'products') {
      this.moveSelectedProducts(row.cat.catId);
    }
    this.dragCatId = null;
  }

  moveCategory(id: number, newParentId: number): void {
    const c = this.cat(id);
    if (!c || id === newParentId || c.parentCatId === newParentId) { return; }
    if (this.isAncestor(id, newParentId)) { this.warn('A category can\'t go inside itself.'); return; }
    if (!this.sqlIsMaster) {
      if (this.depthOf(id) === 1) { this.warn('Top-level (EGRP) categories are Computyme\'s until product data moves to SQL.'); return; }
      if (this.topOf(id) !== this.topOf(newParentId)) {
        this.warn(`${c.name} can't leave its EGRP branch (${this.cat(this.topOf(id))?.name}). That's a Computyme change until cutover.`);
        return;
      }
    }
    if (this.siblingNameTaken(newParentId, c.name, id)) { this.warn(`There's already a ${c.name} there.`); return; }
    const hidden = !this.effectiveVisible(newParentId) && c.visible;
    this.change(() => this.edit(id, { parentCatId: newParentId }));
    this.expanded.add(newParentId);
    this.buildRows();
    if (hidden) { this.toast.add({ severity: 'warn', summary: 'Moved under a hidden category', detail: `${c.name} will be hidden on the WH page too.` }); }
  }

  // ================================================================ products

  searchProducts(): void {
    this.query.page = 1;
    this.selectedProducts.clear();
    this.selectAllMatching = false;
    this.productSearch$.next();
  }

  openQueue(queue: ProductQueue): void {
    this.queue = queue;
    this.view = 'products';
    this.selectedId = null;
    this.query = { ...this.query, nodeId: null, queue, page: 1, status: 'ACTIVE' };
    this.selectedProducts.clear();
    this.selectAllMatching = false;
    this.buildPreview();
    this.loadProducts();
  }

  clearQueue(): void {
    this.queue = null;
    this.query = { ...this.query, queue: null, page: 1 };
    this.loadProducts();
  }

  loadProducts(): void {
    this.productsLoading = true;
    this.data.categoryProducts(this.query).subscribe({
      next: page => {
        this.products = page.rows;
        this.productTotal = page.total;
        this.productsLoading = false;
      },
      error: e => { this.productsLoading = false; this.fail(e, 'Couldn\'t load products.'); }
    });
  }

  page(delta: number): void {
    const last = Math.max(1, Math.ceil(this.productTotal / (this.query.pageSize || 100)));
    const next = Math.min(last, Math.max(1, (this.query.page ?? 1) + delta));
    if (next === this.query.page) { return; }
    this.query.page = next;
    this.loadProducts();
  }

  get pageLabel(): string {
    const size = this.query.pageSize || 100;
    const from = this.productTotal ? ((this.query.page ?? 1) - 1) * size + 1 : 0;
    return `${from.toLocaleString()}–${Math.min(this.productTotal, from + size - 1).toLocaleString()} of ${this.productTotal.toLocaleString()}`;
  }

  draftNode(p: CategoryProductRow): number { return this.moves.get(p.productId)?.nodeId ?? p.nodeId; }
  isMoved(p: CategoryProductRow): boolean { const m = this.moves.get(p.productId); return !!m && m.nodeId !== m.fromNodeId; }

  toggleProduct(p: CategoryProductRow, on: boolean): void {
    this.selectAllMatching = false;
    if (on) { this.selectedProducts.add(p.productId); } else { this.selectedProducts.delete(p.productId); }
  }

  get allOnPageSelected(): boolean { return this.products.length > 0 && this.products.every(p => this.selectedProducts.has(p.productId)); }

  togglePage(on: boolean): void {
    this.selectAllMatching = false;
    this.products.forEach(p => on ? this.selectedProducts.add(p.productId) : this.selectedProducts.delete(p.productId));
  }

  get selectionCount(): number { return this.selectAllMatching ? this.productTotal : this.selectedProducts.size; }

  /** Rows the next action applies to: the ticked ones, or every match. */
  private withSelection(then: (rows: CategoryProductRow[]) => void): void {
    if (!this.selectAllMatching) {
      const known = new Map(this.products.map(p => [p.productId, p]));
      const missing = [...this.selectedProducts].filter(id => !known.has(id));
      if (!missing.length) { then([...this.selectedProducts].map(id => known.get(id)!)); return; }
    }
    this.productsLoading = true;
    this.data.categoryProducts({ ...this.query, page: 1, pageSize: 0 }).subscribe({
      next: page => {
        this.productsLoading = false;
        then(this.selectAllMatching ? page.rows : page.rows.filter(r => this.selectedProducts.has(r.productId)));
      },
      error: e => { this.productsLoading = false; this.fail(e, 'Couldn\'t load the selection.'); }
    });
  }

  private placeProducts(rows: CategoryProductRow[], nodeId: number, source: ChangeSource): { moved: number; outside: number } {
    let moved = 0;
    let outside = 0;
    const targetTop = this.topOf(nodeId);
    this.change(() => {
      rows.forEach(r => {
        if (!this.sqlIsMaster && r.egrpTopId !== null && targetTop !== r.egrpTopId) { outside++; return; }
        const prev = this.moves.get(r.productId);
        const from = prev?.fromNodeId ?? r.nodeId;
        if (from === nodeId) { this.moves.delete(r.productId); } else {
          this.moves.set(r.productId, { productId: r.productId, nodeId, fromNodeId: from, source, label: `${r.productCode} ${r.modelName}`, active: !r.isDiscontinued });
        }
        moved++;
      });
    });
    return { moved, outside };
  }

  moveSelectedProducts(nodeId: number, source: ChangeSource = 'USER'): void {
    if (!this.selectionCount) { this.warn('Tick the products to move first.'); return; }
    this.withSelection(rows => {
      const r = this.placeProducts(rows, nodeId, source);
      this.selectedProducts.clear();
      this.selectAllMatching = false;
      this.toast.add({
        severity: r.outside ? 'warn' : 'success',
        summary: `${r.moved.toLocaleString()} product(s) moved to ${this.cat(nodeId)?.name} in the draft`,
        detail: r.outside ? `${r.outside.toLocaleString()} left where they are: they're in another EGRP branch. Change their EGRP in Computyme first.` : 'They go live when you publish.'
      });
    });
  }

  acceptSuggestion(p: CategoryProductRow): void {
    if (p.suggestedNodeId === null) { return; }
    if (!this.cat(p.suggestedNodeId)) { this.warn('That category is being deleted in your draft.'); return; }
    this.placeProducts([p], p.suggestedNodeId, 'RULE');
  }

  acceptAllAbove(): void {
    const rows = this.products.filter(p => p.suggestedNodeId !== null && !!this.cat(p.suggestedNodeId)
      && (p.suggestConfidence ?? 0) >= this.acceptAbove && p.suggestSignal !== 'EGRP' && !this.isMoved(p));
    if (!rows.length) { this.warn(`No suggestions on this page at ${this.acceptAbove}% or above.`); return; }
    this.change(() => rows.forEach(p => {
      this.moves.set(p.productId, { productId: p.productId, nodeId: p.suggestedNodeId!, fromNodeId: p.nodeId, source: 'RULE', label: `${p.productCode} ${p.modelName}`, active: !p.isDiscontinued });
    }));
    this.toast.add({ severity: 'success', summary: `${rows.length} suggestion(s) accepted into the draft`, detail: 'Check the preview, then publish.' });
  }

  /* Put the replacement of a discontinued product in the same category (it's found by code). */
  placeReplacement(p: CategoryProductRow): void {
    if (!p.replacementCode) { return; }
    const target = this.draftNode(p);
    if (!target) { this.warn('This product has no category to copy.'); return; }
    this.data.categoryProducts({ term: p.replacementCode, page: 1, pageSize: 20 }).subscribe(page => {
      const r = page.rows.find(x => x.productCode.toLowerCase() === p.replacementCode!.toLowerCase());
      if (!r) { this.warn(`Replacement ${p.replacementCode} isn't in the product table.`); return; }
      const res = this.placeProducts([r], target, 'USER');
      if (res.outside) { this.warn(`${r.productCode} is in another EGRP; change it in Computyme first.`); return; }
      this.toast.add({ severity: 'success', summary: `${r.productCode} goes to ${this.pathOf(target)}`, detail: 'In the draft until you publish.' });
    });
  }

  // ================================================================ chooser (move to, reallocate, merge)

  openChooser(purpose: ChooserPurpose): void {
    const sel = this.selected;
    if (purpose === 'move-products') {
      if (!this.selectionCount) { this.warn('Tick the products to move first.'); return; }
      this.chooser = { purpose, title: `Move ${this.selectionCount.toLocaleString()} product(s) to…`, subtitle: 'Products in another EGRP branch stay where they are.', branchTopId: null, excludeId: null, search: '' };
    } else if (sel && purpose === 'delete-reallocate') {
      this.chooser = { purpose, title: `Delete ${sel.name}`, subtitle: `${this.rolled(sel.catId).toLocaleString()} product(s) are in it. Pick where they go; its sub-categories are deleted with it.`, branchTopId: this.sqlIsMaster ? null : this.topOf(sel.catId), excludeId: sel.catId, search: '' };
    } else if (sel && purpose === 'merge') {
      this.chooser = { purpose, title: `Merge ${sel.name} into…`, subtitle: 'Its products and sub-categories move to the category you pick, then it is removed.', branchTopId: this.sqlIsMaster ? null : this.topOf(sel.catId), excludeId: sel.catId, search: '' };
    }
  }

  get chooserOptions(): { id: number; path: string; locked: boolean }[] {
    const c = this.chooser;
    if (!c) { return []; }
    const q = c.search.trim().toLowerCase();
    const out: { id: number; path: string; locked: boolean }[] = [];
    const all = new Set<number>([...this.base.keys(), ...this.draftCats.keys()]);
    all.forEach(id => {
      const cat = this.cat(id);
      if (!cat || id === this.rootId || this.depthOf(id) < 1) { return; }
      if (c.excludeId !== null && this.isAncestor(c.excludeId, id)) { return; }
      if (c.branchTopId !== null && this.topOf(id) !== c.branchTopId) { return; }
      const path = this.pathOf(id);
      if (q && !path.toLowerCase().includes(q)) { return; }
      out.push({ id, path, locked: false });
    });
    return out.sort((a, b) => a.path.localeCompare(b.path)).slice(0, 300);
  }

  choose(targetId: number): void {
    const c = this.chooser;
    const sel = this.selected;
    if (!c) { return; }
    if (c.purpose === 'move-products') {
      this.chooser = null;
      this.moveSelectedProducts(targetId);
      return;
    }
    if (!sel) { this.chooser = null; return; }
    c.busy = true;
    /* every product in the category (and below, for delete) */
    this.data.categoryProducts({ nodeId: sel.catId, includeChildren: c.purpose === 'delete-reallocate', page: 1, pageSize: 0 }).subscribe({
      next: page => {
        const subtree = this.subtreeIds(sel.catId);
        this.change(() => {
          page.rows.forEach(r => {
            const node = this.draftNode(r);
            if (c.purpose === 'merge' && node !== sel.catId) { return; }
            this.moves.set(r.productId, { productId: r.productId, nodeId: targetId, fromNodeId: this.moves.get(r.productId)?.fromNodeId ?? r.nodeId, source: 'USER', label: `${r.productCode} ${r.modelName}`, active: !r.isDiscontinued });
          });
          /* products already moved into the subtree in this draft go too */
          this.moves.forEach(m => { if (subtree.has(m.nodeId) && (c.purpose === 'delete-reallocate' || m.nodeId === sel.catId)) { m.nodeId = targetId; } });
          if (c.purpose === 'merge') {
            (this.children.get(sel.catId) ?? []).forEach(k => this.edit(k, { parentCatId: targetId }));
            this.markDeleted(sel.catId);
          } else {
            [...subtree].forEach(id => this.markDeleted(id));
          }
        });
        this.chooser = null;
        this.selectedId = targetId;
        this.select(targetId);
      },
      error: e => { c.busy = false; this.fail(e, 'Couldn\'t load the products to move.'); }
    });
  }

  deleteSelected(): void {
    const sel = this.selected;
    if (!sel) { return; }
    if (this.isLockedTop(sel.catId)) { this.warn('Top-level (EGRP) categories stay until product data moves to SQL.'); return; }
    if (this.rolled(sel.catId) > 0) { this.openChooser('delete-reallocate'); return; }
    const parent = sel.parentCatId;
    this.change(() => [...this.subtreeIds(sel.catId)].forEach(id => this.markDeleted(id)));
    if (parent !== null && parent !== this.rootId) { this.select(parent); } else { this.selectedId = null; }
  }

  private subtreeIds(id: number): Set<number> {
    const out = new Set<number>([id]);
    (this.children.get(id) ?? []).forEach(k => this.subtreeIds(k).forEach(x => out.add(x)));
    return out;
  }

  private markDeleted(id: number): void {
    const c = this.cat(id);
    if (!c) { return; }
    if (this.draftCats.get(id)?.isNew) { this.draftCats.delete(id); return; }
    this.draftCats.set(id, { ...c, deleted: true });
  }

  // ================================================================ publish

  get draftChanges(): { cats: { label: string; what: string }[]; moves: Move[] } {
    const cats: { label: string; what: string }[] = [];
    this.draftCats.forEach((d, id) => {
      if (!this.isChanged(id)) { return; }
      const b = this.base.get(id);
      const what: string[] = [];
      if (d.deleted) { what.push('delete'); }
      else if (d.isNew) { what.push(`add under ${this.pathOf(d.parentCatId) || 'top level'}`); }
      else if (b) {
        if (b.name !== d.name) { what.push(`rename from ${b.name}`); }
        if (b.parentCatId !== d.parentCatId) { what.push(`move to ${this.pathOf(d.parentCatId)}`); }
        if (b.visible !== d.visible) { what.push(d.visible ? 'show' : 'hide'); }
        if ((b.notes ?? '') !== (d.notes ?? '')) { what.push('notes'); }
      }
      cats.push({ label: d.deleted ? (b?.name ?? d.name) : d.name, what: what.join(', ') });
    });
    return { cats, moves: [...this.moves.values()].filter(m => m.nodeId !== m.fromNodeId) };
  }

  openPublish(): void {
    if (!this.changeCount) { return; }
    this.publishModal = { comment: '', busy: false };
  }

  publish(): void {
    const m = this.publishModal;
    if (!m) { return; }
    const categories: CategoryChange[] = [];
    this.draftCats.forEach((d, id) => {
      if (!this.isChanged(id)) { return; }
      categories.push({ id, parentId: d.parentCatId, name: d.name, visible: d.visible, notes: d.notes, egrp: d.egrp, delete: !!d.deleted, source: 'USER' });
    });
    const products = [...this.moves.values()].filter(x => x.nodeId !== x.fromNodeId).map(x => ({ productId: x.productId, nodeId: x.nodeId, source: x.source }));
    m.busy = true;
    m.error = undefined;
    this.data.categoryPublish({ changes: { categories, products }, comment: m.comment.trim() || null, baseVersion: this.version }).subscribe({
      next: r => {
        this.publishModal = null;
        this.draftCats.clear();
        this.moves.clear();
        this.undoStack = [];
        this.redoStack = [];
        const newSelected = r.newIds.find(x => x.tempId === this.selectedId)?.catId;
        if (newSelected) { this.selectedId = newSelected; }
        this.saveDraft();
        this.toast.add({ severity: 'success', summary: `Published #${r.publishId}`, detail: `${r.categoryChanges} category and ${r.productChanges} product change(s) are live.` });
        this.load();
        if (this.view === 'history') { this.loadHistory(); }
      },
      error: e => { m.busy = false; m.error = this.message(e, 'The publish didn\'t go through.'); }
    });
  }

  // ================================================================ history and revert

  showHistory(): void {
    this.view = 'history';
    this.loadHistory();
  }

  loadHistory(): void {
    this.historyLoading = true;
    this.data.categoryHistory().subscribe({
      next: h => { this.history = h; this.historyLoading = false; },
      error: e => { this.historyLoading = false; this.fail(e, 'Couldn\'t load the history.'); }
    });
  }

  openDetail(s: PublishSummary): void {
    this.data.categoryPublishDetail(s.publishId).subscribe({
      next: items => this.detail = { summary: s, items },
      error: e => this.fail(e, 'Couldn\'t load that publish.')
    });
  }

  openRevert(s: PublishSummary): void {
    if (this.changeCount) { this.warn('Publish or discard your draft before reverting.'); return; }
    this.data.categoryRevertCheck(s.publishId).subscribe({
      next: conflicts => this.revertModal = { summary: s, conflicts, skip: true, busy: false },
      error: e => this.fail(e, 'Couldn\'t check that publish.')
    });
  }

  revert(): void {
    const m = this.revertModal;
    if (!m) { return; }
    m.busy = true;
    m.error = undefined;
    this.data.categoryRevert(m.summary.publishId, m.skip).subscribe({
      next: r => {
        this.revertModal = null;
        this.detail = null;
        this.toast.add({ severity: 'success', summary: `Publish #${m.summary.publishId} reverted`, detail: `As publish #${r.publishId}. It can be reverted too.` });
        this.load();
        this.loadHistory();
      },
      error: e => { m.busy = false; m.error = this.message(e, 'The revert didn\'t go through.'); }
    });
  }

  previewToggle(r: PreviewRow): void {
    if (this.previewExpanded.has(r.catId)) { this.previewExpanded.delete(r.catId); } else { this.previewExpanded.add(r.catId); }
    this.buildPreview();
  }

  // ================================================================ export to Excel

  exportTree(): void {
    const rows: any[] = [];
    const walk = (id: number, depth: number) => {
      const c = this.cat(id);
      if (!c) { return; }
      rows.push({
        'Category id': id > 0 ? id : '(new)', Path: this.pathOf(id), Level: depth, 'Shown on B2B': this.effectiveVisible(id) && this.rolled(id, true) > 0 ? 'Yes' : 'No',
        Visible: c.visible ? 'Yes' : 'No', EGRP: c.egrp ?? '', Products: this.rolled(id), Active: this.rolled(id, true), Notes: c.notes ?? '',
        'Unpublished change': this.isChanged(id) ? 'Yes' : ''
      });
      (this.children.get(id) ?? []).forEach(k => walk(k, depth + 1));
    };
    if (this.rootId !== null) { (this.children.get(this.rootId) ?? []).forEach(id => walk(id, 1)); }
    this.writeXlsx(rows, 'Categories', 'CategoryTree');
  }

  exportProducts(): void {
    this.productsLoading = true;
    this.data.categoryProducts({ ...this.query, page: 1, pageSize: 0 }).subscribe({
      next: page => {
        this.productsLoading = false;
        this.writeXlsx(page.rows.map(p => ({
          'Product code': p.productCode, Model: p.modelName, Brand: p.brandName, Vendor: p.vendorName ?? '', EGRP: p.egrp ?? '',
          Status: p.isDiscontinued ? 'Discontinued' : 'Active', 'For sale': p.isForSale ? 'Yes' : 'No', Public: p.isPublic ? 'Yes' : 'No',
          Category: p.nodePath ?? '', 'Draft category': this.isMoved(p) ? this.pathOf(this.draftNode(p)) : '',
          Problem: p.problem ? this.problemLabels[p.problem] ?? p.problem : '', Replacement: p.replacementCode ?? ''
        })), 'Products', this.queue ? `Category${this.queue}` : 'CategoryProducts');
      },
      error: e => { this.productsLoading = false; this.fail(e, 'Couldn\'t export.'); }
    });
  }

  exportHistory(): void {
    this.writeXlsx(this.history.map(h => ({
      Publish: h.publishId, When: new Date(h.publishedAt).toLocaleString(), By: h.publishedBy, Comment: h.comment ?? '',
      'Category changes': h.categoryChanges, 'Product moves': h.productChanges, 'From suggestions': h.fromSuggestion, 'From AI': h.fromAi,
      'Revert of': h.revertOfPublishId ?? '', 'Reverted by': h.revertedByPublishId ?? ''
    })), 'History', 'CategoryHistory');
  }

  exportDetail(): void {
    const d = this.detail;
    if (!d) { return; }
    this.writeXlsx(d.items.map(i => ({
      Type: i.itemType, Id: i.itemId, Item: i.itemLabel, Action: i.action, Changed: i.fields ?? '', Source: i.source,
      'Before (category / parent)': i.beforePath ?? '', 'After (category / parent)': i.afterPath ?? '', Before: i.beforeJson ?? '', After: i.afterJson ?? ''
    })), `Publish ${d.summary.publishId}`, `CategoryPublish${d.summary.publishId}`);
  }

  private writeXlsx(rows: any[], sheet: string, file: string): void {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31));
    XLSX.writeFile(wb, `${file}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ================================================================ helpers

  trackRow = (_: number, r: TreeRow) => r.cat.catId;
  trackProduct = (_: number, p: CategoryProductRow) => p.productId;

  private titleCase(s: string): string {
    return (s ?? '').toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase()).trim();
  }

  private warn(detail: string): void {
    this.toast.add({ severity: 'warn', summary: 'Not done', detail });
  }

  private message(e: HttpErrorResponse, fallback: string): string {
    if (e?.status === 403) { return 'You don\'t have permission for that. Ask for Categories.Edit in Security Admin.'; }
    return e?.error?.message || fallback;
  }

  private fail(e: HttpErrorResponse, fallback: string): void {
    this.toast.add({ severity: 'error', summary: 'Something went wrong', detail: this.message(e, fallback) });
  }
}
