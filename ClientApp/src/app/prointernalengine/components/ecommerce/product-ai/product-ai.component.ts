import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { DataService } from 'src/app/services/data.service';
import { AiGate, AiStatus, RESEARCH_TOPICS, ResearchSnapshot } from 'src/app/models/ai/ai.models';

/** Product Desk · Market research. Every answer is saved to the product with the model, cost, who and when. */
@Component({
  selector: 'app-product-ai',
  templateUrl: './product-ai.component.html',
  styleUrls: ['./product-ai.component.scss']
})
export class ProductAiComponent implements OnChanges {
  @Input() productId: number | string = 0;

  readonly topics = RESEARCH_TOPICS;

  status: AiStatus | null = null;
  research: ResearchSnapshot[] = [];
  open: ResearchSnapshot | null = null;
  openHtml = '';
  question = '';
  asking: string | null = null;     // topic key or 'OWN' while a question is running
  loading = false;
  error: string | null = null;
  usageMonth = new Date().toISOString().slice(0, 7);
  exporting = false;

  constructor(private data: DataService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId']) { this.load(); }
  }

  get gate(): AiGate | undefined { return this.status?.features.find(f => f.feature === 'MARKET_RESEARCH'); }
  get canAsk(): boolean { return !!this.gate?.allowed && !this.asking; }
  get budgetPct(): number {
    const s = this.status;
    return s && s.budgetUsd > 0 ? Math.min(100, Math.round((s.monthCostUsd / s.budgetUsd) * 100)) : 0;
  }

  load(): void {
    const id = Number(this.productId);
    this.open = null;
    this.error = null;
    this.data.aiStatus().subscribe({
      next: s => {
        this.status = s;
        if (id && this.gate && (this.gate.allowed || s.canSeeUsage || this.gate.reason?.includes('budget') || this.gate.reason?.includes('limit'))) {
          this.loadList(id);
        }
      },
      error: () => this.error = 'Couldn\'t check AI access.'
    });
  }

  private loadList(id: number): void {
    this.loading = true;
    this.data.aiResearchList(id).subscribe({
      next: r => { this.research = r; this.loading = false; },
      error: () => { this.research = []; this.loading = false; }
    });
  }

  ask(topic: string | null): void {
    const id = Number(this.productId);
    const question = topic ? null : this.question.trim();
    if (!id || (!topic && !question)) { this.error = 'Type a question, or pick a topic.'; return; }
    this.asking = topic ?? 'OWN';
    this.error = null;
    this.data.aiResearch(id, { topic, question }).subscribe({
      next: r => {
        this.asking = null;
        this.question = '';
        this.show(r);
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.asking = null;
        this.error = e?.error?.message || 'Market research didn\'t answer. Try again in a moment.';
        this.load();
      }
    });
  }

  view(r: ResearchSnapshot): void {
    if (!r.fileId) { return; }
    this.data.aiResearchGet(Number(this.productId), r.fileId).subscribe({
      next: full => this.show({ ...r, markdown: full.markdown }),
      error: () => this.error = 'Couldn\'t open that answer.'
    });
  }

  private show(r: ResearchSnapshot): void {
    this.open = r;
    this.openHtml = this.render(r.markdown ?? '');
  }

  exportList(): void {
    const rows = this.research.map(r => ({
      When: new Date(r.calledAt + (r.calledAt.endsWith('Z') ? '' : 'Z')).toLocaleString(),
      Who: r.userName, Question: r.question ?? '', Topic: r.detail ?? '', Model: r.model ?? '',
      'Cost (USD)': r.costUsd, 'Cost is estimate': r.costIsEstimate ? 'Yes' : 'No'
    }));
    this.write(rows, 'Research', `MarketResearch_${this.productId}`);
  }

  exportUsage(): void {
    const [y, m] = this.usageMonth.split('-').map(Number);
    if (!y || !m) { return; }
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    this.exporting = true;
    this.data.aiUsage(from, to).subscribe({
      next: rows => {
        this.exporting = false;
        this.write(rows.map(u => ({
          When: new Date(u.calledAt + (u.calledAt.endsWith('Z') ? '' : 'Z')).toLocaleString(), Who: u.userName, Feature: u.feature,
          Provider: u.provider, Model: u.model, Product: u.productCode ?? '', 'Product name': u.modelName ?? '', Items: u.items,
          'Cost (USD)': u.costUsd, 'Cost is estimate': u.costIsEstimate ? 'Yes' : 'No', Status: u.status, Question: u.question ?? '', Detail: u.detail ?? ''
        })), 'AI usage', `AiUsage_${this.usageMonth}`);
      },
      error: () => { this.exporting = false; this.error = 'Couldn\'t load the usage report.'; }
    });
  }

  private write(rows: any[], sheet: string, file: string): void {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheet);
    XLSX.writeFile(wb, `${file}.xlsx`);
  }

  /* Small Markdown renderer for the saved answers: escapes everything first, then adds
     headings, lists, bold, italics, http(s) links and [n] source markers. */
  private render(md: string): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const inline = (s: string) => esc(s)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\s)_([^_]+)_(?=\s|$)/g, '$1<em>$2</em>')
      .replace(/\[(\d{1,3})\]/g, '<sup class="cite">$1</sup>');
    const out: string[] = [];
    let list: 'ul' | 'ol' | null = null;
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const line of md.split(/\r?\n/)) {
      const t = line.trim();
      let m: RegExpMatchArray | null;
      if (!t) { close(); continue; }
      if ((m = t.match(/^(#{1,4})\s+(.*)$/))) { close(); const n = Math.min(4, m[1].length + 2); out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
      if ((m = t.match(/^[-*]\s+(.*)$/))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
      if ((m = t.match(/^\d+\.\s+(.*)$/))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
      close();
      out.push(`<p>${inline(t)}</p>`);
    }
    close();
    return out.join('');
  }
}
