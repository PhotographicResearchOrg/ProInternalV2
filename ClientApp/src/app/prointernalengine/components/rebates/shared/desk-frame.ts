import { LayoutService } from 'src/app/layout/service/app.layout.service';

/* Full-width pages (Rebate Desk, BRM dashboard) close the app's main menu while they are open, so
   the page has the room; the menu button in the top bar still opens it. Returns a function that puts
   the menu back the way it was when the page closes (only if this page closed it). */
export function collapseMainMenu(layout: LayoutService): () => void {
  try {
    if (!layout.isDesktop() || layout.config().menuMode !== 'static' || layout.state.staticMenuDesktopInactive)
      return () => {};
    layout.state.staticMenuDesktopInactive = true;
    return () => { layout.state.staticMenuDesktopInactive = false; };
  } catch {
    return () => {};
  }
}
