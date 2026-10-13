/**
 * Replay of the "Cash Sales Order" tour (tour/cash-sales-order.json): create a cash quotation,
 * confirm, deliver, invoice and register payment — screenshotting every step for the manual.
 * Each screenshot highlights the element the step acts on (red box), taken just before the action.
 *
 * Tour replay, not a module test: raw recorded selectors, lives under the gitignored generated/ folder.
 * WARNING: with CONFIRM_REAL_RECORDS=true this creates a real sales order, delivery, invoice and payment.
 */
import { test, expect, Page, Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { openOdooApp } from '../../../../src/modules/sales/pages/openOdooApp';

const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots/cash-sales-order');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

/** Screenshots the page with `target` outlined in red (if given), then removes the outline. */
async function shot(page: Page, sequence: number, label: string, target?: Locator): Promise<void> {
  if (target) {
    await target.scrollIntoViewIfNeeded().catch(() => {});
    await target.evaluate((el) => {
      const e = el as HTMLElement;
      e.dataset.prevStyle = e.getAttribute('style') ?? '';
      e.style.outline = '4px solid #e53935';
      e.style.outlineOffset = '2px';
      e.style.boxShadow = '0 0 0 8px rgba(229,57,53,0.30)';
      e.style.zIndex = '9999';
    });
  }
  await page.waitForTimeout(500);
  const file = path.join(SCREENSHOT_DIR, `step-${String(sequence).padStart(3, '0')}.png`);
  await page.screenshot({ path: file });
  await test.info().attach(`step-${sequence}-${label}`, { path: file, contentType: 'image/png' });
  if (target) {
    await target
      .evaluate((el) => {
        const e = el as HTMLElement;
        e.setAttribute('style', e.dataset.prevStyle ?? '');
        delete e.dataset.prevStyle;
      })
      .catch(() => {});
  }
}

/** Highlight, screenshot, then click. */
async function shotThenClick(page: Page, sequence: number, label: string, target: Locator): Promise<void> {
  await target.waitFor({ state: 'visible', timeout: 15_000 });
  await shot(page, sequence, label, target);
  await target.click();
}

const MENU = '.o-dropdown--menu, .ui-autocomplete';

/** A dropdown option by visible text (the recorder's #autocomplete_N_N ids are positional and unstable). */
function option(page: Page, text: string): Locator {
  return page
    .locator('.o-dropdown--menu .o_menu_item, .ui-autocomplete .ui-menu-item')
    .filter({ hasText: text })
    .first();
}

/** Opens a many2one dropdown by field name (the recorded #field_N ids drift) and returns its input. */
async function openMany2one(page: Page, fieldName: string): Promise<Locator> {
  const input = page.locator(`.o_field_widget[name="${fieldName}"] input`).first();
  await input.scrollIntoViewIfNeeded();
  await input.click();
  const menu = page.locator(MENU).first();
  if (!(await menu.isVisible({ timeout: 3_000 }).catch(() => false))) {
    await input.click();
  }
  await menu.waitFor({ state: 'visible', timeout: 8_000 });
  return input;
}

function listRow(page: Page, text: string): Locator {
  return page.locator('.modal .o_data_row, .o_list_table .o_data_row').filter({ hasText: text }).first();
}

test('Cash Sales Order tour replay', async ({ page }) => {
  test.setTimeout(300_000);

  // 10 — app grid with the Sales tile highlighted
  await openOdooApp(page, 'Sales'); // establishes the session, lands inside Sales
  await page.getByRole('link', { name: 'Home menu' }).click();
  const salesTile = page.getByRole('option', { name: 'Sales', exact: true });
  await salesTile.waitFor({ state: 'visible', timeout: 15_000 });
  await shot(page, 10, 'open-sales', salesTile);
  await salesTile.click();
  await page.waitForSelector('.o_list_view, .o_kanban_view, .o_form_view', { state: 'visible', timeout: 20_000 });

  await shotThenClick(page, 20, 'orders', page.locator('[data-menu-xmlid="sale.sale_order_menu"]'));
  await shotThenClick(page, 30, 'quotations', page.locator('[data-menu-xmlid="sale.menu_sale_quotations"]'));
  await shotThenClick(page, 40, 'new', page.locator('div.d-xl-inline-flex.gap-1 > button.btn.btn-primary'));

  // 50/60 — customer
  const customerInput = page
    .locator('div.o_cell.o_wrap_input > div.o_field_widget.o_required_modifier > div.o_field_many2one_selection input')
    .first();
  await customerInput.click();
  await customerInput.fill('abc');
  await page.locator(MENU).first().waitFor({ state: 'visible', timeout: 8_000 });
  await shot(page, 50, 'search-customer', customerInput);
  await shotThenClick(page, 60, 'select-customer', option(page, 'abc'));

  // 70/80 — selections (highlight the field after choosing, so the chosen value is visible)
  const paymentType = page.locator('#x_studio_order_payment_method_0');
  await paymentType.selectOption({ label: 'Cash' });
  await shot(page, 70, 'payment-type', paymentType);
  const quotationType = page.locator('#x_studio_quotation_type_0');
  await quotationType.selectOption({ label: 'Sales' });
  await shot(page, 80, 'quotation-type', quotationType);

  // 90–120 — product line
  await shotThenClick(page, 90, 'add-product', page.locator('td.o_field_x2many_list_row_add > a').first());
  const productInput = page.locator('.o_field_widget[name="product_id"] input').last();
  await productInput.click();
  await productInput.fill('02BB 023');
  await page.locator(MENU).first().waitFor({ state: 'visible', timeout: 8_000 });
  await shot(page, 100, 'search-product', productInput);
  await shotThenClick(page, 110, 'select-product', option(page, '[02BB 023] BALL BEARING 6202-2RS'));
  await shotThenClick(page, 120, 'quantity', page.locator('td[name="product_uom_qty"]').first());

  // 130–183 — Other Info tab
  await shotThenClick(page, 130, 'other-info', page.locator('a[name="other_information"]'));

  const termInput = await openMany2one(page, 'payment_term_id');
  await shot(page, 140, 'payment-terms', termInput);
  await shotThenClick(page, 150, 'immediate-payment', option(page, 'Immediate Payment'));

  const teamInput = await openMany2one(page, 'team_id');
  await shot(page, 160, 'sales-team', teamInput);
  await shotThenClick(page, 170, 'team-search-more', page.getByText('Search More...').first());
  await shotThenClick(page, 180, 'team-selected', listRow(page, 'Colombo Sales Centre'));

  const whInput = await openMany2one(page, 'warehouse_id');
  await shot(page, 181, 'warehouse', whInput);
  await shotThenClick(page, 182, 'warehouse-search-more', page.getByText('Search More...').first());
  await shotThenClick(page, 183, 'warehouse-selected', listRow(page, 'JAM Warehouse Ekala'));

  // --- real records are created from here on: only replayed when CONFIRM_REAL_RECORDS=true ---
  if (process.env.CONFIRM_REAL_RECORDS !== 'true') return;

  await shotThenClick(page, 184, 'confirm-order', page.locator('[data-hotkey="q"]').first());
  await page.waitForTimeout(2000);

  await shotThenClick(page, 185, 'delivery', page.locator('button[name="action_view_delivery"]'));
  await shotThenClick(page, 186, 'validate-delivery', page.locator('[data-hotkey="v"]').first());
  await page.waitForTimeout(2000);

  await shotThenClick(page, 187, 'back-to-order', page.locator('[data-hotkey="b"]').first());
  await shotThenClick(page, 188, 'create-invoice', page.locator('[data-hotkey="q"]').first());
  await shotThenClick(page, 189, 'confirm-invoice', page.locator('[data-hotkey="q"]').first());
  await page.waitForTimeout(2000);

  await shotThenClick(page, 192, 'register-payment', page.locator('[data-hotkey="g"]').first());

  const journalInput = await openMany2one(page, 'journal_id');
  await shot(page, 193, 'journal', journalInput);
  await shotThenClick(page, 194, 'journal-search-more', page.getByText('Search More...').first());
  await shotThenClick(page, 195, 'journal-selected', listRow(page, 'Customer Receipts - Cash'));

  await shotThenClick(page, 196, 'create-payment', page.locator('[data-hotkey="q"]').first());
  await page.waitForTimeout(2000);

  await shotThenClick(page, 197, 'final-sale-order', page.locator('button[name="action_view_source_sale_orders"]'));
  await shotThenClick(page, 198, 'final-invoice', page.locator('button[name="action_view_invoice"]'));

  // 199 — final result: the paid invoice (highlight the "In Payment"/"Paid" ribbon, fall back to the title)
  await page.locator('.o_form_view').first().waitFor({ state: 'visible', timeout: 15_000 });
  const ribbon = page.locator('.o_form_view .ribbon').first();
  const paidTarget = (await ribbon.isVisible({ timeout: 3_000 }).catch(() => false))
    ? ribbon
    : page.locator('.o_form_view .oe_title').first();
  await shot(page, 199, 'invoice-paid', paidTarget);

  await expect(page.locator('.o_form_view, .o_list_view').first()).toBeVisible();
});
