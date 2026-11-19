import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  /**
   * Navigate to any Odoo SPA URL.
   *
   * ROOT CAUSE (Jinasena SaaS):
   *   The Website module intercepts all cold HTTP requests to /odoo/* and /web,
   *   redirecting unauthenticated visitors to the company portal login page.
   *   A backend session_id cookie alone does NOT satisfy the website-portal
   *   authentication check.
   *
   * SOLUTION (two-part):
   *   1. _bootOdooSpa() establishes the website-portal session by submitting the
   *      /web/login form (same flow as auth.setup.ts).
   *   2. After that session exists, page.goto() is used for all subsequent
   *      navigation — the Website module recognises the authenticated portal
   *      session and no longer intercepts the request.
   *
   * WHY NOT pushState + popstate:
   *   After login, Odoo lands on the home/app-picker page (/odoo).
   *   Firing a popstate event from that context caused OWL's home-menu router
   *   to open the app-switcher overlay instead of loading the target view,
   *   leaving .o_searchview and other list/form selectors invisible.
   */
  async navigateTo(urlSuffix: string): Promise<void> {
    const baseURL = process.env.ODOO_BASE_URL ?? 'http://localhost:8069';
    const currentUrl = this.page.url();

    // "Active SPA view" = we are inside a specific Odoo view path (/odoo/<something>),
    // NOT on the root home/app-picker page (/odoo) and NOT on the login page.
    // From an active SPA view, pushState + popstate triggers OWL client-side routing.
    // From the home/app-picker page, popstate instead opens the app-switcher overlay.
    const onActiveSpaView =
      currentUrl.startsWith(baseURL) && /\/odoo\/[^?#]/.test(currentUrl);

    if (!onActiveSpaView) {
      await this._bootOdooSpa();

      // After boot we are on the home page (app-picker combobox is expanded).
      // Click the "Employees" app option to leave the home menu and load any Odoo view.
      // Once an action is loaded, popstate navigation works without triggering the overlay.
      const employeesOption = this.page.getByRole('option', { name: 'Employees' });
      const isHomeMenu = await employeesOption.isVisible({ timeout: 6_000 }).catch(() => false);
      if (isHomeMenu) {
        await employeesOption.click();
        // Wait for the home-menu app-picker listbox to fully unmount before asserting
        // the view — avoids a race where the listbox is still visible and the 10s timeout
        // in EmployeeListPage.navigate() expires before the view renders (RC-C).
        await this.page.waitForSelector('[role=listbox]', { state: 'detached', timeout: 10_000 }).catch(() => {});
        await this.page.waitForSelector(
          '.o_list_view, .o_kanban_view, .o_form_view',
          { state: 'visible', timeout: 20_000 },
        );
      }
    }

    // Client-side navigation via OWL router — no HTTP request, bypasses Website module.
    await this.page.evaluate((path) => {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    }, urlSuffix);

    // Give OWL a moment to unmount the current view before waitForOdooReady checks.
    await this.page.waitForTimeout(400);

    // Mid-suite recovery: OWL sometimes intercepts popstate mid-run and opens the
    // home-menu app-picker (listbox) instead of routing to the target view.
    // Detected via [role=listbox] being visible after the pushState fires.
    // Fix: click Employees to exit the home menu, then re-fire pushState.
    const listboxVisible = await this.page.locator('[role=listbox]').isVisible({ timeout: 300 }).catch(() => false);
    if (listboxVisible) {
      await this.page.getByRole('option', { name: 'Employees' }).click().catch(() => {});
      await this.page.waitForSelector('[role=listbox]', { state: 'detached', timeout: 10_000 }).catch(() => {});
      await this.page.evaluate((path) => {
        window.history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
      }, urlSuffix);
      await this.page.waitForTimeout(400);
    }

    await this.waitForOdooReady();
  }

  /**
   * Establish the Odoo backend + website-portal session via the login form.
   *
   * Uses Promise.race to reliably detect two states after goto('/web/login'):
   *   - 'ready': storageState cookies were valid → Odoo redirected to home, navbar visible
   *   - 'login': login form is visible → fill credentials and submit
   *
   * The old 4-second isVisible fast-path was too short on a slow SaaS instance;
   * it incorrectly fell through to the login branch when the navbar took >4 s to render,
   * causing getByRole('textbox') to wait forever on the already-loaded home page.
   */
  private async _bootOdooSpa(): Promise<void> {
    const baseURL = process.env.ODOO_BASE_URL ?? 'http://localhost:8069';
    await this.page.goto(`${baseURL}/web/login`);

    const state = await Promise.race([
      this.page.locator('.o_main_navbar')
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => 'ready' as const),
      this.page.getByRole('textbox', { name: 'Email' })
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => 'login' as const),
    ]).catch(() => 'login' as const); // timeout → attempt login anyway

    if (state === 'ready') return;

    const email    = process.env.ADMIN_EMAIL    ?? 'admin';
    const password = process.env.ADMIN_PASSWORD ?? 'admin';
    await this.page.getByRole('textbox', { name: 'Email' }).fill(email);
    await this.page.getByRole('textbox', { name: 'Password' }).fill(password);
    await this.page.getByRole('button',  { name: 'Log in'   }).click();
    await this.page.waitForSelector('.o_main_navbar', { state: 'visible', timeout: 45_000 });
  }

  /** Waits until Odoo's action manager has rendered and the loading spinner is gone */
  async waitForOdooReady(): Promise<void> {
    // Primary: wait for a concrete view element (form / list / kanban / settings).
    // These are only present once Odoo has rendered the newly-navigated action,
    // so they're much more reliable than .o_action_manager which is always present
    // in the app shell.  The timeout is intentionally short (15 s) so that a
    // broken URL fails fast rather than stalling the entire suite for 45 s.
    await this.page.waitForSelector(
      '.o_view_controller, .o_form_view, .o_list_view, .o_kanban_view, .o_settings_container',
      { state: 'visible', timeout: 15_000 },
    ).catch(async () => {
      // Fallback: accept the outer app shell for unusual views (activity, discuss, etc.)
      await this.page.waitForSelector(
        '.o_action_manager, .o_web_client',
        { state: 'visible', timeout: 5_000 },
      ).catch(() => {});
    });
    // Wait for Odoo's loading overlay to clear (it may not appear for fast navigations)
    await this.page.waitForSelector('.o_loading_indicator', { state: 'hidden', timeout: 8_000 }).catch(() => {});
  }

  // ── Toasts / Notifications ──────────────────────────────────────────────────

  async getToastMessage(timeout = 5_000): Promise<string> {
    const toast = this.page.locator('.o_notification_manager .o_notification');
    await toast.waitFor({ state: 'visible', timeout });
    return (await toast.locator('.o_notification_content').textContent()) ?? '';
  }

  async expectSuccessToast(message?: string): Promise<void> {
    const toast = this.page.locator('.o_notification_manager .o_notification.o_notification_success, .o_notification_manager .o_notification[data-type="success"]');
    await expect(toast.first()).toBeVisible({ timeout: 8_000 });
    if (message) {
      await expect(toast.first()).toContainText(message);
    }
  }

  async expectErrorToast(message?: string): Promise<void> {
    const toast = this.page.locator('.o_notification_manager .o_notification.o_notification_danger, .o_notification_manager .o_notification[data-type="danger"]');
    await expect(toast.first()).toBeVisible({ timeout: 8_000 });
    if (message) {
      await expect(toast.first()).toContainText(message);
    }
  }

  async dismissToast(): Promise<void> {
    const closeBtn = this.page.locator('.o_notification_manager .o_notification .o_notification_close');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  }

  // ── Dialog helpers ──────────────────────────────────────────────────────────

  async confirmDialog(): Promise<void> {
    const btn = this.page.locator('.modal-footer .btn-primary:not(.d-none)').first();
    await btn.waitFor({ state: 'visible', timeout: 5_000 });
    await btn.click();
    await this.page.waitForSelector('.modal', { state: 'hidden', timeout: 10_000 });
  }

  async cancelDialog(): Promise<void> {
    const btn = this.page.locator('.modal-footer .btn-secondary, .modal-footer .o_form_button_cancel').first();
    await btn.waitFor({ state: 'visible', timeout: 5_000 });
    await btn.click();
    await this.page.waitForSelector('.modal', { state: 'hidden', timeout: 10_000 });
  }

  async getDialogMessage(): Promise<string> {
    const body = this.page.locator('.modal .modal-body');
    await body.waitFor({ state: 'visible', timeout: 5_000 });
    return (await body.textContent()) ?? '';
  }

  // ── Utility ─────────────────────────────────────────────────────────────────

  async takeScreenshot(name: string): Promise<Buffer> {
    return this.page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
  }

  /** Opens Odoo's debug/developer menu */
  async openDebugMenu(): Promise<void> {
    const debugBtn = this.page.locator('.o_debug_manager button, [class*="o_debug_manager"] .dropdown-toggle');
    await debugBtn.click();
  }

  /** Waits for a specific URL path pattern */
  async waitForUrl(pattern: string | RegExp): Promise<void> {
    await this.page.waitForURL(pattern, { timeout: 15_000 });
  }

  /** Returns the text of the current breadcrumb trail */
  async getBreadcrumbText(): Promise<string[]> {
    const items = this.page.locator('.o_breadcrumb .o_breadcrumb_item span, .breadcrumb .breadcrumb-item span');
    const count = await items.count();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      texts.push((await items.nth(i).textContent())?.trim() ?? '');
    }
    return texts;
  }

  protected locator(selector: string): Locator {
    return this.page.locator(selector);
  }
}
