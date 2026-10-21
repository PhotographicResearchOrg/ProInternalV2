import { Injectable } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';

/* Rebate Desk security by drawer, read from the signed-in user's permissions (Security Administration).

   RebateDesk.<Area>.View   see the drawer        RebateDesk.<Area>.Edit   see it and use its buttons

   Someone with no RebateDesk.* permission keeps the old access: every drawer and button shows as before
   (the server still applies Rebates.Upload / Manage / Accounting). PIV2_ADMIN sees and changes everything.
   The server checks the same rules on every call; this only decides what is shown. */

export type DeskArea =
  | 'Uploads' | 'Purgatory' | 'Batches' | 'Programs' | 'Products' | 'Vendors' | 'Templates'
  | 'Claims' | 'DebitMemos' | 'Declines' | 'Investigate' | 'StockPad' | 'History'
  | 'PP.Programs' | 'PP.Products' | 'PP.Vendors' | 'PP.Claims' | 'PP.DebitMemos' | 'PP.History';

/* Each desk view and the drawer permission it belongs to (overview: anyone who can open the desk). */
export const VIEW_AREAS: Record<string, DeskArea | null> = {
  'overview': null, 'upload': 'Uploads', 'uploads': 'Uploads', 'purgatory': 'Purgatory',
  'programs': 'Programs', 'batches': 'Batches', 'products': 'Products', 'vendors': 'Vendors', 'templates': 'Templates',
  'claims': 'Claims', 'debitmemos': 'DebitMemos', 'declines': 'Declines', 'investigate': 'Investigate',
  'stockpad': 'StockPad', 'history': 'History',
  'pp-programs': 'PP.Programs', 'pp-products': 'PP.Products', 'pp-vendors': 'PP.Vendors',
  'pp-claims': 'PP.Claims', 'pp-debitmemos': 'PP.DebitMemos', 'pp-history': 'PP.History'
};

@Injectable({ providedIn: 'root' })
export class DeskAccessService {
  constructor(private auth: AuthService) {}

  private names(): Set<string> {
    const set = new Set<string>();
    for (const p of this.auth.getPermissions() || []) {
      const n = (p as any)?.permissionName ?? (p as any)?.PermissionName;
      if (typeof n === 'string') set.add(n.toLowerCase());
    }
    return set;
  }

  private get admin(): boolean { try { return this.auth.hasRole('PIV2_ADMIN'); } catch { return false; } }

  /* True once the user has been given any drawer permission (then drawers are checked one by one). */
  get byDrawer(): boolean {
    for (const n of this.names()) if (n.startsWith('rebatedesk.')) return true;
    return false;
  }

  canView(area: DeskArea | null): boolean {
    if (!area || this.admin || !this.byDrawer) return true;
    const n = this.names(), a = `rebatedesk.${area.toLowerCase()}`;
    return n.has(a + '.view') || n.has(a + '.edit');
  }

  canEdit(area: DeskArea | null): boolean {
    if (this.admin || !this.byDrawer) return true;   // old access: buttons as before (the server still checks)
    if (!area) return false;
    return this.names().has(`rebatedesk.${area.toLowerCase()}.edit`);
  }

  canViewKey(viewKey: string): boolean { return this.canView(VIEW_AREAS[viewKey] ?? null); }
  canEditKey(viewKey: string): boolean { return this.canEdit(VIEW_AREAS[viewKey] ?? null); }
}
