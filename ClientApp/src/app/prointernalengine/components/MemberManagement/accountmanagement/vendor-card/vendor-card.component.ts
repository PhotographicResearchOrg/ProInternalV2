// src/app/accountmanagement/vendor-card/vendor-card.component.ts
//
// Full vendor management dashboard, ported from the HTML prototype.
// Shell + all sections are here with STUB data. Section nav and the two header
// toggles work; every other action calls stub() and shows a toast.
// Wire real data / flows in slowly from here.

import { Component, Input, OnInit } from '@angular/core';

interface NavItem { id: string; label: string; icon: string; }
interface Tile { id: string; icon: string; title: string; lines: string[]; color: number; }
interface Person { name: string; title: string; email: string; phone: string; primary?: boolean; }
interface ContactGroup { group: string; color: number; people: Person[]; }
interface Contract { name: string; type: string; start: string; end: string; value: string; status: string; }
interface PriceList { name: string; eff: string; exp: string; skus: number; status: string; cur: string; }
interface Rebate {
  id: string; name: string; code: string; amount: string; eligibility: string; scope: string;
  window: string; funding: string; claim: string; status: string; web: boolean;
  rebated: number; budget: number; redemptions: number; burn: number;
}
interface AuditEntry { who: string; when: string; section: string; field: string; from: string; to: string; }
interface CustomField { id: string; label: string; type: string; value: string; section: string; publishable: boolean; }

@Component({
  selector: 'app-vendor-card',
  templateUrl: './vendor-card.component.html',
  styleUrls: ['./vendor-card.component.scss']
})
export class VendorCardComponent implements OnInit {

  @Input() vendorId: number | string = 0;

  // palette (exposed so the template can inline data-driven colors)
  P = {
    ink: '#1a2434', sub: '#5c6b81', faint: '#8a97ab',
    teal: '#0e7c73', tealSoft: '#dff1ef', violet: '#5b4bb5', violetSoft: '#e9e6f7',
    amber: '#a15c07', amberSoft: '#fbeecb', blue: '#1d4ed8', blueSoft: '#dce8fd',
    green: '#166534', greenSoft: '#dcfce7', muted: '#eef1f5'
  };

  brandColors = [
    { fg: '#0e7c73', bg: '#dff1ef' },
    { fg: '#5b4bb5', bg: '#e9e6f7' },
    { fg: '#a15c07', bg: '#fbeecb' },
    { fg: '#1d4ed8', bg: '#dce8fd' }
  ];

  vendor = {
    name: 'Tamron', legal: 'Northgate Bldg. Supply Co., LLC',
    id: 'VND-10428', acct: '4471-A', initials: 'NG', rep: 'Dana Whitmore'
  };


  brands = ['TimberLine', 'StormGuard', 'Cascade Pro', 'IronOak'];

  navSections: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: 'pi pi-th-large' },
    { id: 'terms', label: 'Terms & Financials', icon: 'pi pi-receipt' },
    { id: 'contacts', label: 'Contacts', icon: 'pi pi-users' },
    { id: 'contracts', label: 'Contracts', icon: 'pi pi-file' },
    { id: 'pricelists', label: 'Price Lists', icon: 'pi pi-tags' },
    { id: 'policies', label: 'Policies', icon: 'pi pi-truck' },
    { id: 'rebates', label: 'Instant Rebates', icon: 'pi pi-ticket' },
    { id: 'audit', label: 'Audit Log', icon: 'pi pi-history' }
  ];
  activeSection = 'overview';

  live = true;
  onWeb = true;
  toastMsg = '';
  private toastT: any;

  overviewTiles: Tile[] = [
    { id: 'terms', icon: 'pi pi-receipt', title: 'Terms & Financials', color: 0, lines: ['Net 30 · 2/10 early pay', 'PRO 32% / Member 18%', 'FOB Origin · USD'] },
    { id: 'contacts', icon: 'pi pi-users', title: 'Contacts', color: 1, lines: ['8 people across 4 roles', 'Sales: Dana Whitmore', 'AP: Priya Nandakumar'] },
    { id: 'contracts', icon: 'pi pi-file', title: 'Contracts', color: 3, lines: ['3 active · 1 expiring', 'Master supply thru 2027', 'Rebate rider renews Sep'] },
    { id: 'pricelists', icon: 'pi pi-tags', title: 'Price Lists', color: 2, lines: ['5 lists · 2 variants each', '2026 Wholesale effective', 'PRO + Member tiers set'] },
    { id: 'policies', icon: 'pi pi-truck', title: 'Policies', color: 0, lines: ['Free freight over $2,500', 'Returns: 30d · 15% restock', 'RMA required'] },
    { id: 'rebates', icon: 'pi pi-ticket', title: 'Instant Rebates', color: 1, lines: ['3 programs · 1 active now', 'StormGuard $5/unit live', 'TimberLine PRO 8% scheduled'] }
  ];

  contacts: ContactGroup[] = [
    {
      group: 'Sales', color: 0, people: [
        { name: 'Dana Whitmore', title: 'Territory Sales Rep', email: 'dana.w@northgate.com', phone: '(206) 555-0142', primary: true },
        { name: 'Marcus Ely', title: 'Inside Sales', email: 'marcus.e@northgate.com', phone: '(206) 555-0177' }
      ]
    },
    {
      group: 'Accounts Payable', color: 1, people: [
        { name: 'Priya Nandakumar', title: 'AP Coordinator', email: 'ap@northgate.com', phone: '(206) 555-0190', primary: true }
      ]
    },
    {
      group: 'Warranty & Support', color: 2, people: [
        { name: 'Lena Ortiz', title: 'Warranty Claims', email: 'support@northgate.com', phone: '(206) 555-0155' }
      ]
    },
    {
      group: 'Logistics', color: 3, people: [
        { name: 'Sam Boone', title: 'Freight & Dispatch', email: 'dispatch@northgate.com', phone: '(206) 555-0128', primary: true }
      ]
    }
  ];

  contracts: Contract[] = [
    { name: 'Master Supply Agreement', type: 'Supply', start: '2024-01-01', end: '2027-12-31', value: '$4.2M/yr', status: 'active' },
    { name: 'Volume Rebate Rider', type: 'Rebate', start: '2025-09-01', end: '2026-08-31', value: '3% > $1M', status: 'expiring' },
    { name: 'Co-op Marketing Fund', type: 'Marketing', start: '2025-01-01', end: '2026-12-31', value: '$85,000', status: 'active' },
    { name: '2023 Pricing Addendum', type: 'Pricing', start: '2023-01-01', end: '2024-12-31', value: '—', status: 'expired' }
  ];

  lists: PriceList[] = [
    { name: '2026 Wholesale', eff: '2026-01-01', exp: '2026-12-31', skus: 1842, status: 'active', cur: 'USD' },
    { name: 'PRO Contractor Tier', eff: '2026-01-01', exp: '2026-12-31', skus: 1610, status: 'active', cur: 'USD' },
    { name: 'Member Standard', eff: '2026-01-01', exp: '2026-12-31', skus: 1610, status: 'active', cur: 'USD' },
    { name: 'Q1 Promo Sheet', eff: '2026-01-01', exp: '2026-03-31', skus: 214, status: 'expiring', cur: 'USD' },
    { name: '2025 Wholesale', eff: '2025-01-01', exp: '2025-12-31', skus: 1788, status: 'expired', cur: 'USD' }
  ];

  rebates: Rebate[] = [
    { id: 'rb_1', name: 'StormGuard Spring Instant Savings', code: 'SG-SPR26', amount: '$5.00 / unit', eligibility: 'all', scope: 'StormGuard', window: 'Jun 1 → Aug 31', funding: 'Vendor funded', claim: 'Off-invoice', status: 'active', web: true, rebated: 6200, budget: 50000, redemptions: 1240, burn: 12 },
    { id: 'rb_2', name: 'TimberLine Contractor Bonus', code: 'TL-PRO-Q3', amount: '8% off', eligibility: 'pro', scope: 'TimberLine, Cascade Pro', window: 'Aug 1 → Sep 30', funding: 'Split 50/50', claim: 'Accrual claim', status: 'scheduled', web: false, rebated: 0, budget: 75000, redemptions: 0, burn: 0 },
    { id: 'rb_3', name: 'IronOak Clearance Instant Rebate', code: 'IO-CLR25', amount: '$12.00 / unit', eligibility: 'member', scope: 'All vendor products', window: 'Nov 1 → Dec 31', funding: 'Vendor funded', claim: 'Off-invoice', status: 'expired', web: true, rebated: 10104, budget: 30000, redemptions: 842, burn: 34 }
  ];

  audit: AuditEntry[] = [
    { who: 'Dana Whitmore', when: '2 days ago', section: 'Terms', field: 'PRO discount', from: '30%', to: '32%' },
    { who: 'Priya Nandakumar', when: '5 days ago', section: 'Terms', field: 'Credit limit', from: '$200,000', to: '$250,000' },
    { who: 'System', when: '1 week ago', section: 'Price Lists', field: '2026 Wholesale', from: 'draft', to: 'published' },
    { who: 'Sam Boone', when: '2 weeks ago', section: 'Policies', field: 'Free-freight threshold', from: '$3,000', to: '$2,500' },
    { who: 'Dana Whitmore', when: '3 weeks ago', section: 'Vendor', field: 'Show on web', from: 'off', to: 'on' },
    { who: 'Marcus Ely', when: 'Apr 2', section: 'Contacts', field: 'Added contact', from: '—', to: 'Lena Ortiz' }
  ];

  customFields: CustomField[] = [
    { id: 'cf_warranty', label: 'Warranty period', type: 'Number', value: '24 months', section: 'terms', publishable: false }
  ];

  statusMap: { [k: string]: { fg: string; bg: string; label: string; icon: string } } = {
    active: { fg: '#166534', bg: '#dcfce7', label: 'Active', icon: 'pi pi-check-circle' },
    scheduled: { fg: '#1d4ed8', bg: '#dce8fd', label: 'Scheduled', icon: 'pi pi-clock' },
    expiring: { fg: '#a15c07', bg: '#fbeecb', label: 'Expiring soon', icon: 'pi pi-exclamation-triangle' },
    expired: { fg: '#8a97ab', bg: '#eef1f5', label: 'Expired', icon: 'pi pi-history' },
    draft: { fg: '#a15c07', bg: '#fbeecb', label: 'Draft', icon: 'pi pi-pencil' }
  };
  eligMap: { [k: string]: { fg: string; bg: string; label: string } } = {
    all: { fg: '#5c6b81', bg: '#eef1f5', label: 'All customers' },
    pro: { fg: '#0e7c73', bg: '#dff1ef', label: 'PRO only' },
    member: { fg: '#5b4bb5', bg: '#e9e6f7', label: 'Member only' }
  };
  sectionColor: { [k: string]: { fg: string; bg: string } } = {
    Terms: { fg: '#0e7c73', bg: '#dff1ef' }, 'Price Lists': { fg: '#a15c07', bg: '#fbeecb' },
    Policies: { fg: '#1d4ed8', bg: '#dce8fd' }, Vendor: { fg: '#5b4bb5', bg: '#e9e6f7' }, Contacts: { fg: '#5b4bb5', bg: '#e9e6f7' }
  };

  ngOnInit(): void {
    // TODO(details): load real vendor via DataService.getVendor(this.vendorId)
  }

  // --- nav + toggles (functional) ---
  setSection(id: string): void { this.activeSection = id; }
  toggleLive(): void { this.live = !this.live; }
  toggleWeb(): void {
    this.onWeb = !this.onWeb;
    // TODO(details): call DataService.toggleVendorWebStatus(this.vendorId)
    this.showToast(this.onWeb ? 'Vendor is live on web' : 'Vendor hidden from web');
  }

  // --- everything else is a stub for now ---
  stub(msg = "This flow isn't wired up yet — stub"): void { this.showToast(msg); }
  showToast(msg: string): void {
    this.toastMsg = msg;
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => (this.toastMsg = ''), 2400);
  }

  // --- template helpers ---
  brand(i: number) { return this.brandColors[i % this.brandColors.length]; }

  initials(n: string): string {
    return n === 'System' ? 'SY' : (n || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }
  customFor(section: string): CustomField[] { return this.customFields.filter(f => f.section === section); }
  recent(): AuditEntry[] { return this.audit.slice(0, 3); }
  activeRebates(): Rebate[] { return this.rebates.filter(r => r.status === 'active'); }
  openLiability(): number { return this.activeRebates().reduce((a, r) => a + (r.budget - r.rebated), 0); }
  totalRedemptions(): number { return this.rebates.reduce((a, r) => a + r.redemptions, 0); }
  status(s: string) { return this.statusMap[s] || this.statusMap['draft']; }
  elig(e: string) { return this.eligMap[e] || this.eligMap['all']; }
  secColor(s: string) { return this.sectionColor[s] || { fg: this.P.sub, bg: '#eef1f5' }; }
}
