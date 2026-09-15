import { Page } from '@playwright/test';

/**
 * Opens an Odoo app via the real home-menu app-switcher click (the top-left "Home menu"
 * link), rather than BasePage.navigateTo's pushState/popstate hack — that hack is only
 * proven reliable for same-app navigation within the Employees module it was written
 * for. Clicking through the actual app tile exercises OWL's own menu-click handler so
 * it reliably routes to apps like Contacts/Sales that the pushState approach silently
 * fails to load (URL changes, but the previous view stays rendered).
 *
 * Establishes the backend/portal session first via the login form, matching
 * BasePage._bootOdooSpa, since a cold page has no session cookie yet.
 */
export async function openOdooApp(page: Page, appLabel: string): Promise<void> {
  const baseURL = process.env.ODOO_BASE_URL ?? 'http://localhost:8069';
  const alreadyBooted = await page.locator('.o_main_navbar').isVisible({ timeout: 1_000 }).catch(() => false);

  if (!alreadyBooted) {
    await page.goto(`${baseURL}/web/login`);
    const state = await Promise.race([
      page.locator('.o_main_navbar').waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'ready' as const),
      page.getByRole('textbox', { name: 'Email' }).waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'login' as const),
    ]).catch(() => 'login' as const);

    if (state === 'login') {
      const email = process.env.ADMIN_EMAIL ?? 'admin';
      const password = process.env.ADMIN_PASSWORD ?? 'admin';
      await page.getByRole('textbox', { name: 'Email' }).fill(email);
      await page.getByRole('textbox', { name: 'Password' }).fill(password);
      await page.getByRole('button', { name: 'Log in' }).click();
      await page.waitForSelector('.o_main_navbar', { state: 'visible', timeout: 45_000 });
    }
  }

  // After login, a fresh/idle session sometimes lands directly on the app-picker grid
  // (no in-app navbar yet) rather than inside an app — in that case the app tile is
  // already on screen and there is no separate "Home menu" toggle to click first.
  const appTile = page.getByRole('option', { name: appLabel, exact: true });
  const gridAlreadyOpen = await appTile.isVisible({ timeout: 3_000 }).catch(() => false);
  if (!gridAlreadyOpen) {
    await page.getByRole('link', { name: 'Home menu' }).click();
  }
  await appTile.click();
  await page.waitForSelector(
    '.o_list_view, .o_kanban_view, .o_form_view',
    { state: 'visible', timeout: 20_000 },
  );
}
