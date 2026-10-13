/**
 * Replay of the "Cash Sales Order" tour (tour/cash-sales-order.json): create a cash quotation,
 * confirm, deliver, invoice and register payment — screenshotting every step for the manual.
 *
 * Tour replay, not a module test: raw recorded selectors, lives under the gitignored generated/ folder.
 * WARNING: creates a real sales order, delivery, invoice and payment on the configured Odoo instance.
 */
import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { openOdooApp } from '../../../../src/modules/sales/pages/openOdooApp';

const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots/cash-sales-order');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function captureStep(page: Page, sequence: number, label: string): Promise<void> {
  await page.waitForTimeout(500);
  const file = path.join(SCREENSHOT_DIR, `step-${String(sequence).padStart(3, '0')}.png`);
  await page.screenshot({ path: file });
  await test.info().attach(`step-${sequence}-${label}`, { path: file, contentType: 'image/png' });
}

/** Picks a dropdown option by visible text (the recorder's #autocomplete_N_N ids are positional and unstable). */
async function pickOption(page: Page, text: string): Promise<void> {
  const dropdown = page.locator('.o-dropdown--menu, .ui-autocomplete').first();
  await dropdown.waitFor({ state: 'visible', timeout: 8_000 });
  await page
    .locator('.o-dropdown--menu .o_menu_item, .ui-autocomplete .ui-menu-item')
    .filter({ hasText: text })
    .first()
    .click();
}

async function openMany2one(page: Page, id: string): Promise<void> {
  await page.locator(`#${id}`).click();
  await page.locator('.o-dropdown--menu, .ui-autocomplete').first().waitFor({ state: 'visible', timeout: 8_000 });
}

async function pickFromSearchMore(page: Page, text: string): Promise<void> {
  await page
    .locator('.modal .o_data_row, .o_list_table .o_data_row')
    .filter({ hasText: text })
    .first()
    .click();
}

test('Cash Sales Order tour replay', async ({ page }) => {
  test.setTimeout(240_000);

  await openOdooApp(page, 'Sales');
  await captureStep(page, 10, 'open-sales');

  await page.locator('[data-menu-xmlid="sale.sale_order_menu"]').click();
  await captureStep(page, 20, 'orders');

  await page.locator('[data-menu-xmlid="sale.menu_sale_quotations"]').click();
  await captureStep(page, 30, 'quotations');

  await page.locator('div.d-xl-inline-flex.gap-1 > button.btn.btn-primary').click();
  await captureStep(page, 40, 'new');

  const customerInput = page.locator(
    'div.o_cell.o_wrap_input > div.o_field_widget.o_required_modifier > div.o_field_many2one_selection input',
  ).first();
  await customerInput.click();
  await customerInput.fill('abc');
  await captureStep(page, 50, 'search-customer');
  await pickOption(page, 'abc');
  await captureStep(page, 60, 'select-customer');

  await page.locator('#x_studio_order_payment_method_0').selectOption({ label: 'Cash' });
  await captureStep(page, 70, 'payment-type');

  await page.locator('#x_studio_quotation_type_0').selectOption({ label: 'Sales' });
  await captureStep(page, 80, 'quotation-type');

  await page.locator('td.o_field_x2many_list_row_add > a').first().click();
  await captureStep(page, 90, 'add-product');

  const productInput = page.locator('.o_field_widget[name="product_id"] input').last();
  await productInput.click();
  await productInput.fill('02BB 023');
  await captureStep(page, 100, 'search-product');
  await pickOption(page, '[02BB 023] BALL BEARING 6202-2RS');
  await captureStep(page, 110, 'select-product');

  await page.locator('td[name="product_uom_qty"]').first().click();
  await captureStep(page, 120, 'quantity');

  await page.locator('a[name="other_information"]').click();
  await captureStep(page, 130, 'other-info');

  await openMany2one(page, 'payment_term_id_0');
  await captureStep(page, 140, 'payment-terms');
  await pickOption(page, 'Immediate Payment');
  await captureStep(page, 150, 'immediate-payment');

  await openMany2one(page, 'team_id_0');
  await captureStep(page, 160, 'sales-team');
  await page.getByText('Search More...').click();
  await captureStep(page, 170, 'team-search-more');
  await pickFromSearchMore(page, 'Colombo Sales Centre');
  await captureStep(page, 180, 'team-selected');

  await openMany2one(page, 'warehouse_id_1');
  await captureStep(page, 181, 'warehouse');
  await page.getByText('Search More...').click();
  await captureStep(page, 182, 'warehouse-search-more');
  await pickFromSearchMore(page, 'JAM Warehouse Ekala');
  await captureStep(page, 183, 'warehouse-selected');

  // --- real records are created from here on: only replayed when CONFIRM_REAL_RECORDS=true ---
  if (process.env.CONFIRM_REAL_RECORDS !== 'true') return;

  await page.locator('[data-hotkey="q"]').first().click();
  await page.waitForTimeout(2000);
  await captureStep(page, 184, 'confirm-order');

  await page.locator('button[name="action_view_delivery"]').click();
  await captureStep(page, 185, 'delivery');

  await page.locator('[data-hotkey="v"]').first().click();
  await page.waitForTimeout(2000);
  await captureStep(page, 186, 'validate-delivery');

  await page.locator('[data-hotkey="b"]').first().click();
  await captureStep(page, 187, 'back-to-order');

  await page.locator('[data-hotkey="q"]').first().click();
  await captureStep(page, 188, 'create-invoice');

  await page.locator('[data-hotkey="q"]').first().click();
  await page.waitForTimeout(2000);
  await captureStep(page, 189, 'confirm-invoice');

  await page.locator('button[name="action_view_source_sale_orders"]').click();
  await captureStep(page, 190, 'sale-orders-button');

  await page.locator('button[name="action_view_invoice"]').click();
  await captureStep(page, 191, 'invoices-button');

  await page.locator('[data-hotkey="g"]').first().click();
  await captureStep(page, 192, 'register-payment');

  await openMany2one(page, 'journal_id_0');
  await captureStep(page, 193, 'journal');
  await page.getByText('Search More...').click();
  await captureStep(page, 194, 'journal-search-more');
  await pickFromSearchMore(page, 'Customer Receipts - Cash');
  await captureStep(page, 195, 'journal-selected');

  await page.locator('[data-hotkey="q"]').first().click();
  await page.waitForTimeout(2000);
  await captureStep(page, 196, 'create-payment');

  await page.locator('button[name="action_view_source_sale_orders"]').click();
  await captureStep(page, 197, 'final-sale-order');

  await page.locator('button[name="action_view_invoice"]').click();
  await captureStep(page, 198, 'final-invoice');

  await expect(page.locator('.o_form_view, .o_list_view').first()).toBeVisible();
});
