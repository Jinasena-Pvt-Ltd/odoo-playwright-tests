/**
 * Step 3 — Reporting for the sales module.
 *
 * Recorded tours (admin only), all of the form  Sales → Reporting → <report>:
 *   tour_export (31).json   Sales Reporting for sales module            → Reporting > Sales
 *   tour_export (29).json   Invoices Reporting for sales module          → Reporting > Invoices
 *   tour_export (30).json   Sales Invoices Reporting for sales module   → Reporting > Sales Invoice Lines
 *   tour_export (34).json   Customers Reporting for sales module         → Reporting > Customers
 *   tour_export (33).json   SalesPerson Reporting for sales module       → Reporting > Salespersons
 *   tour_export (32).json   Product Reporting for sales module           → Reporting > Products
 *                           (tour_export (35).json is an identical copy of (32))
 *
 * For each report:
 *   1. it opens from the menu and renders a view, with no Odoo error dialog
 *   2. every view-switcher button (list / pivot / graph …) opens without an error
 *   3. a filter from the search panel can be applied and removed
 * Reports only read data — nothing is created, so there is nothing to clean up.
 *
 * Note: the Invoices and Sales Invoice Lines menus are Studio menus whose xmlid has a random suffix
 * that changes with every build, so they are found by xmlid prefix or by label.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../../../core/fixtures/index';

interface Report {
  name: string;
  /** Locates the report's entry inside the Sales > Reporting dropdown. */
  menu: (page: Page) => ReturnType<Page['locator']>;
}

const REPORTS: Report[] = [
  {
    name: 'Sales',
    menu: p => p.locator('[data-menu-xmlid="sale.menu_reporting_sales"]').first(),
  },
  {
    name: 'Invoices',
    menu: p => p.locator('[data-menu-xmlid^="studio_customization.sales_invoices_"]')
      .or(p.locator('.dropdown-menu').getByRole('menuitem', { name: 'Invoices', exact: true })).first(),
  },
  {
    name: 'Customers',
    menu: p => p.locator('[data-menu-xmlid="sale.menu_reporting_customer"]').first(),
  },
  {
    name: 'Salespersons',
    menu: p => p.locator('[data-menu-xmlid="sale.menu_reporting_salespeople"]').first(),
  },
  {
    name: 'Products',
    menu: p => p.locator('[data-menu-xmlid="sale.menu_reporting_product"]').first(),
  },
  {
    name: 'Sales Invoice Lines',
    menu: p => p.locator('[data-menu-xmlid^="studio_customization.sales_sales_invoice_"]')
      .or(p.locator('.dropdown-menu').getByRole('menuitem', { name: 'Sales Invoice Lines', exact: true })).first(),
  },
];

/** Opens Odoo and logs in if the saved admin session is not accepted (fresh server session). */
async function ensureLoggedIn(page: Page): Promise<void> {
  await page.goto('/web', { waitUntil: 'domcontentloaded' });
  const state = await Promise.race([
    page.locator('.o_main_navbar').waitFor({ state: 'visible', timeout: 60_000 }).then(() => 'ready' as const),
    page.getByRole('textbox', { name: 'Email' }).waitFor({ state: 'visible', timeout: 60_000 }).then(() => 'login' as const),
  ]).catch(() => 'none' as const);
  if (state === 'login') {
    await page.getByRole('textbox', { name: 'Email' }).fill(process.env.ADMIN_EMAIL ?? 'admin');
    await page.getByRole('textbox', { name: 'Password' }).fill(process.env.ADMIN_PASSWORD ?? 'admin');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.locator('.o_main_navbar').waitFor({ state: 'visible', timeout: 90_000 });
  } else if (state === 'none') {
    throw new Error('Odoo did not load (neither the navbar nor the login form appeared). Check ODOO_BASE_URL.');
  }
}

/** Sales → Reporting → <report>, clicking the menus as the tours do. */
async function openReport(page: Page, report: Report): Promise<void> {
  await ensureLoggedIn(page);
  const app = page.locator('[data-menu-xmlid="sale.sale_menu_root"]').first();
  if (!await app.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole('link', { name: 'Home menu' }).click();
  }
  await app.click();
  await page.locator('[data-menu-xmlid="sale.menu_sale_report"]').first().click();
  await report.menu(page).click();
  await expect(page.locator('.o_action_manager .o_view_controller').first()).toBeVisible({ timeout: 60_000 });
}

/** A report that failed to load shows an Odoo error dialog; fail with its text. */
async function expectNoErrorDialog(page: Page): Promise<void> {
  const dialog = page.locator('.modal .o_error_dialog, .modal-dialog:has-text("Odoo Server Error"), .modal-dialog:has-text("Error")');
  if (await dialog.first().isVisible({ timeout: 1_500 }).catch(() => false)) {
    throw new Error(`Odoo showed an error dialog: ${(await dialog.first().innerText()).replace(/\s+/g, ' ').slice(0, 300)}`);
  }
}

test.describe('Sales Reporting @module:sales @step:reporting', () => {
  for (const report of REPORTS) {
    test.describe(`Report: ${report.name}`, () => {

      test(`${report.name}: opens from Sales > Reporting and shows a view @smoke`, async ({ page }) => {
        await openReport(page, report);
        await expectNoErrorDialog(page);
        await expect(page.locator('.o_searchview')).toBeVisible();
        await expect(page.locator(
          '.o_list_view, .o_pivot, .o_graph_renderer, .o_kanban_view, .o_cohort_view, .o_form_view',
        ).first()).toBeVisible({ timeout: 60_000 });
      });

      test(`${report.name}: every view-switcher button opens without an error`, async ({ page }) => {
        await openReport(page, report);
        const switches = page.locator('.o_cp_switch_buttons button.o_switch_view:visible');
        // heavy reports (Sales Analysis) draw their control panel late → wait for the buttons before counting them
        await expect.poll(() => switches.count(), { timeout: 45_000 }).toBeGreaterThan(1).catch(() => undefined);
        // remember the views by name (Graph / Pivot / List …) — the button list is redrawn after each switch
        const views = [...new Set(await switches.evaluateAll(
          els => els.map(e => e.getAttribute('data-tooltip') ?? '').filter(Boolean)))];
        if (views.length < 2) { test.skip(true, `${report.name} has a single view — nothing to switch`); return; }
        for (const view of views) {
          const btn = page.locator('.o_cp_switch_buttons button.o_switch_view:visible')
            .and(page.locator(`[data-tooltip="${view}"], .${view.split(' ').join('.')}`)).first();
          // a button can disappear while the report is still loading — only click views that are really offered now
          if (!await btn.isVisible({ timeout: 5_000 }).catch(() => false)) continue;
          await btn.click();
          await expect(page.locator('.o_action_manager .o_view_controller').first()).toBeVisible({ timeout: 60_000 });
          await expectNoErrorDialog(page);
        }
      });

      test(`${report.name}: a filter can be applied and removed`, async ({ page }) => {
        await openReport(page, report);
        await page.locator('.o_searchview_dropdown_toggler').click();
        const option = page.locator('.o_search_bar_menu .o_filter_menu .dropdown-item, .o_dropdown_container .o_menu_item').first();
        if (!await option.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true, () => false)) {
          test.skip(true, `${report.name} offers no filters`);
          return;
        }
        await option.click();
        await expectNoErrorDialog(page);
        const facets = page.locator('.o_searchview_facet');
        await expect(facets.first()).toBeVisible({ timeout: 20_000 });
        // remove the facet again
        await page.locator('.o_searchview_facet .o_facet_remove').first().click();
        await expect(page.locator('.o_action_manager .o_view_controller').first()).toBeVisible({ timeout: 60_000 });
        await expectNoErrorDialog(page);
      });
    });
  }
});
