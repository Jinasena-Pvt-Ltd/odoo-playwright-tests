/**
 * Generated from tour/sales.json ("Sales Order" tour) — a full order-to-cash regression:
 * create a quotation, confirm it, deliver it, invoice it, and register payment.
 *
 * This is a tour REPLAY, not a module test: it intentionally uses raw selectors recorded
 * by the Odoo Tour Recorder rather than the src/modules page-object convention, and lives
 * under tools/tour2playwright/generated/ (gitignored) rather than src/modules/sales/tests/.
 *
 * See ../../../REVIEW.md for every step the translator could not map with full confidence.
 */
import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { openOdooApp } from '../../../../src/modules/sales/pages/openOdooApp';

const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots/sales');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function captureStep(page: Page, sequence: number, label: string): Promise<void> {
  await page.waitForTimeout(400);
  const file = path.join(SCREENSHOT_DIR, `step-${String(sequence).padStart(3, '0')}.png`);
  await page.screenshot({ path: file });
  await test.info().attach(`step-${sequence}-${label}`, { path: file, contentType: 'image/png' });
}

/** Picks a dropdown option by visible text instead of the recorder's index-based #autocomplete_N_N id, which isn't stable across runs. */
async function pickAutocompleteOption(page: Page, text: string): Promise<void> {
  const dropdown = page.locator('.o-dropdown--menu, .ui-autocomplete').first();
  await dropdown.waitFor({ state: 'visible', timeout: 8_000 });
  await page
    .locator('.o-dropdown--menu .o_menu_item, .ui-autocomplete .ui-menu-item')
    .filter({ hasText: text })
    .first()
    .click();
}

test('Sales Order tour replay', async ({ page }) => {
  test.setTimeout(180_000);

  // Step 10 — "Click the sales module". Adapted: the recorded `[data-menu-xmlid="sale.sale_menu_root"]`
  // selector assumes the app-switcher grid is already open; openOdooApp() reliably gets there
  // from a cold session (see openOdooApp.ts for why a plain click/goto isn't reliable here).
  await openOdooApp(page, 'Sales');
  await captureStep(page, 10, 'open-sales-app');

  // Step 20 — Click Orders
  await page.locator('[data-menu-xmlid="sale.sale_order_menu"]').click();
  await captureStep(page, 20, 'click-orders');

  // Step 30 — Click Quotations
  await page.locator('[data-menu-xmlid="sale.menu_sale_quotations"]').click();
  await captureStep(page, 30, 'click-quotations');

  // Step 40 — Click New
  await page.locator('div.d-xl-inline-flex.gap-1 > button.btn.btn-primary').click();
  await captureStep(page, 40, 'click-new');

  // Step 50/60 — Find and select a customer. Adapted: types the resulting customer's name
  // ("abc", per the recorded next step) and matches the option by visible text rather than
  // the recorder's positional #autocomplete_0_2 id.
  const customerInput = page.locator(
    'div.o_cell.o_wrap_input > div.o_field_widget.o_required_modifier > div.o_field_many2one_selection input',
  ).first();
  await customerInput.click();
  await customerInput.fill('abc');
  await captureStep(page, 50, 'search-customer');
  await pickAutocompleteOption(page, 'abc');
  await captureStep(page, 60, 'select-customer');

  // Step 70 — Order Payment Type. Adapted: the recorded title "Cash Credit" names both
  // options in the dropdown, not the one actually chosen — picked "Cash" as the
  // representative value (matches the module's own business-flow test).
  await page.locator('#x_studio_order_payment_method_0').selectOption({ label: 'Cash' });
  await captureStep(page, 70, 'select-payment-type');

  // Step 80 — Quotation Type. Same ambiguity as step 70 — picked "Sales".
  await page.locator('#x_studio_quotation_type_0').selectOption({ label: 'Sales' });
  await captureStep(page, 80, 'select-quotation-type');

  // Step 82 — "Add a product"
  await page.locator('td.o_field_x2many_list_row_add > a').first().click();
  await captureStep(page, 82, 'add-product-row');

  // Step 83/84 — Search and select the product. Adapted: types the product name and matches
  // by visible text rather than the recorder's positional #autocomplete_0_0 id.
  const productInput = page.locator('.o_field_widget[name="product_id"] input').last();
  await productInput.click();
  await productInput.fill('02BB 023');
  await captureStep(page, 83, 'search-product');
  await pickAutocompleteOption(page, '[02BB 023] BALL BEARING 6202-2RS');
  await captureStep(page, 84, 'select-product');

  // Step 85 — Quantity cell (left at the default 1.0000 — no edit was recorded, just a click)
  await page.locator('td[name="product_uom_qty"]').first().click();
  await captureStep(page, 85, 'quantity-cell');

  // Step 86 — Confirm the quotation into a sales order
  await page.locator('[data-hotkey="q"]').first().click();
  await page.waitForTimeout(1500);
  await captureStep(page, 86, 'confirm-order');

  // Step 87 — Open the Delivery smart button
  await page.locator('button[name="action_view_delivery"]').click();
  await captureStep(page, 87, 'open-delivery');

  // Step 88 — Validate the delivery
  await page.locator('[data-hotkey="v"]').first().click();
  await page.waitForTimeout(1500);
  await captureStep(page, 88, 'validate-delivery');

  // Step 89 — Back to the sales order
  await page.locator('[data-hotkey="b"]').first().click();
  await captureStep(page, 89, 'back-to-order');

  // Step 90 — Create Invoice
  await page.locator('[data-hotkey="q"]').first().click();
  await captureStep(page, 90, 'create-invoice-dialog');

  // Step 91 — Confirm the invoice creation dialog
  await page.locator('[data-hotkey="q"]').first().click();
  await page.waitForTimeout(1500);
  await captureStep(page, 91, 'confirm-invoice');

  // Step 92 — Back via the Sale Orders smart button on the invoice
  await page.locator('button[name="action_view_source_sale_orders"]').click();
  await captureStep(page, 92, 'invoice-sale-orders-button');

  // Step 93 — Open the Invoices smart button
  await page.locator('button[name="action_view_invoice"]').click();
  await captureStep(page, 93, 'open-invoice');

  // Step 94 — Register Payment
  await page.locator('[data-hotkey="g"]').first().click();
  await captureStep(page, 94, 'register-payment-dialog');

  // Step 95 — Open the journal dropdown
  await page.locator('#journal_id_0').click();
  await captureStep(page, 95, 'journal-dropdown');

  // Step 96 — "Search More..."
  await page.getByText('Search More...').click();
  await captureStep(page, 96, 'search-more-journals');

  // Step 97 — Select the "Customer Receipts - Cash" journal. Adapted: matched by visible
  // text instead of the recorder's positional `tr:nth-of-type(4)` row index.
  await page
    .locator('.modal .o_data_row, .o_list_table .o_data_row')
    .filter({ hasText: 'Customer Receipts - Cash' })
    .first()
    .click();
  await captureStep(page, 97, 'select-cash-journal');

  // Step 98 — Create Payment
  await page.locator('[data-hotkey="q"]').first().click();
  await page.waitForTimeout(1500);
  await captureStep(page, 98, 'create-payment');

  // Step 99 — Back via the Sale Orders smart button
  await page.locator('button[name="action_view_source_sale_orders"]').click();
  await captureStep(page, 99, 'post-payment-sale-orders-button');

  // Step 100 — Open the Invoices smart button (final state: paid invoice)
  await page.locator('button[name="action_view_invoice"]').click();
  await captureStep(page, 100, 'final-invoice-state');

  await expect(page.locator('.o_form_view, .o_list_view').first()).toBeVisible();
});
