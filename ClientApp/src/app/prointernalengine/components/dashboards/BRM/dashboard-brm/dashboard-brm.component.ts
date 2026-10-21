import { Component } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';

/* The BRM's page: shipping errors, their HubSpot companies, and the instant-rebate claims that need
   support (the same panel as the Rebate Desk). Picking companies filters the claims to those accounts.
   After any action on a claim the notification badge is reloaded, as before. */
@Component({
  selector: 'app-dashboard-brm',
  templateUrl: './dashboard-brm.component.html',
  styleUrls: ['../../../rebates/shared/rebate-desk.shared.scss', './dashboard-brm.component.scss']
})
export class DashboardBrmComponent {
  public SelectedAccountNumbers: string[] = [];
  public isHubspotCardCollapsed = true;
  public isShippingCardCollapsed = false;
  public brmShippingErrorCount = 0;

  constructor(private notificationService: NotificationService) {}

  onAccountFilter(accountNumbers: string[]): void {
    this.SelectedAccountNumbers = (accountNumbers || []).map(a => String(a));
  }

  show(card: 'shipping' | 'companies' | 'declines'): void {
    if (card === 'shipping') this.isShippingCardCollapsed = false;
    if (card === 'companies') this.isHubspotCardCollapsed = false;
    setTimeout(() => document.getElementById('brm-' + card)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  refreshNotifications(): void {
    this.notificationService.load();
  }
}
