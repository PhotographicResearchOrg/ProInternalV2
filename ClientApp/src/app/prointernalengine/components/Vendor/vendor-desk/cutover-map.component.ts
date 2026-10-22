import { Component, OnInit } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { CutoverMap, CutoverSection, DataOwner } from 'src/app/models/vendor/vendor-desk.models';
import { OWNER_INFO } from './owner-mark.component';
import { exportWorkbook } from './desk-export';
import { HomePin, stablePin } from 'src/app/services/home-pin.service';

interface AreaGroup { area: string; sections: CutoverSection[]; }

/** Cutover map: every section of the business, who is master today, what the B2B site reads, and what's next. */
@Component({
  selector: 'app-cutover-map',
  templateUrl: './cutover-map.component.html',
  styleUrls: ['./vendor-desk.shared.scss', './cutover-map.component.scss']
})
export class CutoverMapComponent implements OnInit {
  map: CutoverMap | null = null;
  loading = false;
  error = '';

  ownerFilter: DataOwner | '' = '';
  b2bOnly = false;
  search = '';
  groups: AreaGroup[] = [];

  editing: string | null = null;
  draft = { owner: 'COMPUTYME' as DataOwner, nextStep: '', note: '' };
  saving = false;
  saveError = '';
  showLog = false;

  readonly owners: DataOwner[] = ['COMPUTYME', 'SQL', 'MIXED', 'EXTENSION'];
  readonly ownerInfo = OWNER_INFO;

  constructor(private data: DataService) { }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = '';
    this.data.cutoverMap().subscribe({
      next: m => { this.map = m; this.loading = false; this.regroup(); },
      error: e => { this.loading = false; this.error = e?.error?.message || 'Couldn\'t load the cutover map.'; }
    });
  }

  count(owner: DataOwner): number {
    return (this.map?.sections || []).filter(s => s.owner === owner).length;
  }
  get b2bCount(): number {
    return (this.map?.sections || []).filter(s => !!s.b2BReads).length;
  }

  setOwnerFilter(o: DataOwner | ''): void {
    this.ownerFilter = this.ownerFilter === o ? '' : o;
    this.regroup();
  }

  regroup(): void {
    const q = this.search.trim().toLowerCase();
    const rows = (this.map?.sections || []).filter(s =>
      (!this.ownerFilter || s.owner === this.ownerFilter) &&
      (!this.b2bOnly || !!s.b2BReads) &&
      (!q || [s.name, s.area, s.summary, s.computymeSource, s.sqlObjects, s.b2BReads, s.nextStep]
        .some(t => (t || '').toLowerCase().includes(q))));
    const byArea = new Map<string, CutoverSection[]>();
    for (const s of rows) {
      if (!byArea.has(s.area)) byArea.set(s.area, []);
      byArea.get(s.area)!.push(s);
    }
    this.groups = Array.from(byArea.entries()).map(([area, sections]) => ({ area, sections }));
  }

  startEdit(s: CutoverSection): void {
    this.editing = s.sectionKey;
    this.draft = { owner: s.owner, nextStep: s.nextStep || '', note: '' };
    this.saveError = '';
  }

  cancelEdit(): void { this.editing = null; this.saveError = ''; }

  save(s: CutoverSection): void {
    if (!this.draft.note.trim()) { this.saveError = 'Say why the owner is changing.'; return; }
    this.saving = true;
    this.saveError = '';
    this.data.cutoverSetOwner(s.sectionKey, { owner: this.draft.owner, nextStep: this.draft.nextStep || null, note: this.draft.note })
      .subscribe({
        next: m => {
          this.saving = false;
          this.editing = null;
          if (this.map) { this.map.sections = m.sections; this.map.log = m.log; }
          this.regroup();
        },
        error: e => { this.saving = false; this.saveError = e?.error?.message || 'Couldn\'t save.'; }
      });
  }

  export(): void {
    if (!this.map) return;
    exportWorkbook('CutoverMap', [
      { name: 'Sections', rows: this.map.sections.map(s => ({
        Area: s.area, Section: s.name, Master: OWNER_INFO[s.owner]?.label || s.owner, Summary: s.summary || '',
        Computyme: s.computymeSource || '', 'SQL / PIV2': s.sqlObjects || '', 'B2B site reads': s.b2BReads || '',
        Screen: s.pivScreen || '', 'Next step': s.nextStep || '', Updated: s.updatedAt, 'Updated by': s.updatedBy || '' })) },
      { name: 'Owner changes', rows: this.map.log.map(l => ({
        When: l.changedAt, Section: l.name || l.sectionKey, From: l.oldOwner || '', To: l.newOwner, Why: l.note || '', Who: l.changedBy || '' })) }
    ]);
  }

  readonly homePin: HomePin = stablePin({ id: 'cutover', label: 'Cutover map', sub: 'Admin', icon: 'pi pi-map', route: '/cutover', metric: 'cutover.computyme' });

  trackKey = (_: number, s: CutoverSection) => s.sectionKey;
}
