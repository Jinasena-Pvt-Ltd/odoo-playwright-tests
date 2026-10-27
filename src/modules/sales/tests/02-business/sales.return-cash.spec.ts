/**
 * Step 2 — Business flow: Return of a Cash sales order (credit note + advance payment).
 *
 * Derived from the "Return Cash Sales Order" Odoo tour (tour_export (12).json):
 *   1  quotation   Cash order, Sales quotation type, product line, Sales Team / Warehouse / Payment Terms
 *   2  confirm     (approvals if the instance asks for them) → Sales Order
 *   3  delivery    validate the delivery → Done
 *   4  invoice     create invoice and confirm → Posted
 *   5  credit note reverse the invoice with a reason, request / approve credit note approval, confirm
 *   6  reset       back on the original invoice: reset to draft and confirm again (when offered)
 *   7  advance     advance payment on the sales order, then the Payments smart button
 *
 * Creates REAL records → opt-in:
 *   RUN_SALES_FLOWS=true npx playwright test sales.return-cash --project=setup --project=admin
 * Optional env: FLOW_CONTROL_CUSTOMER (default "abc"), ODOO_APPROVER_EMAIL / ODOO_APPROVER_PASSWORD.
 *
 * All selectors are by field name / visible text — the recorded record IDs (button[name="1493"], S02787,
 * #autocomplete_0_2 ...) were deliberately NOT carried over.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';
import type { Page } from '@playwright/test';
import {
  COMPANY, openSalesApp, switchCompany, createQuotation, approveAndConfirm, validateDelivery,
  createInvoice, headerButtons, clickButton, saveRecord, selectMany2one, throwIfOdooError,
} from '../../flows/flowHelpers';

const CUSTOMER = process.env.FLOW_CONTROL_CUSTOMER ?? 'abc';

test.use({ actionTimeout: 20_000, navigationTimeout: 60_000, video: 'off', trace: 'off' });

async function openRecord(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.o_form_statusbar button').first()).toBeVisible({ timeout: 30_000 });
}

const stage = (page: Page) => page.locator('.o_form_statusbar .o_arrow_button_current').first();

test.describe.serial('Sales return of a cash order @module:sales @step:business @e2e', () => {
  test.skip(process.env.RUN_SALES_FLOWS !== 'true',
    'Creates real orders/deliveries/invoices/credit notes/payments — set RUN_SALES_FLOWS=true to run');

  let orderNumber = '';
  let orderUrl = '';
  let invoiceUrl = '';
  let creditNoteUrl = '';
  const returnReason = uniqueName('Customer return');

  test.beforeEach(async ({ page }) => {
    await openSalesApp(page);
    await switchCompany(page, COMPANY);
  });

  test('1. quotation: Cash order for a Sales quotation @smoke', async ({ page }) => {
    orderNumber = await createQuotation(page, { customer: CUSTOMER, paymentType: 'Cash' });
    orderUrl = page.url();
    expect(orderNumber).toMatch(/^S\d+/);
    await expect(page.locator('[name="x_studio_order_payment_method"] select').first()).toHaveValue(/cash/i);
  });

  test('2. confirm: quotation becomes a Sales Order', async ({ page, browser }) => {
    test.skip(!orderUrl, 'No quotation from step 1');
    await openRecord(page, orderUrl);
    await approveAndConfirm(page, browser);
    await expect(stage(page)).toContainText(/sales order/i);
  });

  test('3. delivery: validate → Done', async ({ page }) => {
    test.skip(!orderUrl, 'No order from step 1');
    await openRecord(page, orderUrl);
    const ref = await validateDelivery(page);
    expect(ref).toBeTruthy();
  });

  test('4. invoice: create and confirm → Posted', async ({ page }) => {
    test.skip(!orderUrl, 'No order from step 1');
    await openRecord(page, orderUrl);
    const name = await createInvoice(page);
    expect(name).toBeTruthy();
    await expect(stage(page)).toContainText(/posted/i);
    invoiceUrl = page.url();
  });

  test('5. credit note: reverse with a reason, approval, confirm', async ({ page, browser }) => {
    test.skip(!invoiceUrl, 'No invoice from step 4');
    await openRecord(page, invoiceUrl);

    await test.step('Reverse the invoice with a reason', async () => {
      const credit = page.locator('.o_form_statusbar button[name="action_reverse"]').first();
      const visible = await credit.isVisible({ timeout: 5_000 }).catch(() => false);
      test.skip(!visible, 'Credit Note (reverse) button not available on this invoice');
      await credit.click();
      const dlg = page.locator('.modal:visible').first();
      await expect(dlg).toBeVisible({ timeout: 15_000 });
      await dlg.locator('[name="reason"] input, [name="reason"] textarea').first().fill(returnReason);
      await dlg.getByRole('button', { name: /^reverse$/i }).click();
      await throwIfOdooError(page);
      await expect(page.locator('.modal:visible')).toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 30_000 });
      await expect(stage(page)).toContainText(/draft/i);
      creditNoteUrl = page.url();
    });

    await test.step('Request approval, approve (if the instance requires it) and confirm', async () => {
      for (let i = 0; i < 6; i++) {
        const buttons = await headerButtons(page);
        if (buttons.some(b => /^confirm$/i.test(b.text) && b.enabled)) break;
        const req = buttons.find(b => /^request .*approval$/i.test(b.text) && b.enabled);
        const appr = buttons.find(b => /^approve\b/i.test(b.text) && b.enabled);
        if (req) {
          await clickButton(page, new RegExp(`^${req.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
        } else if (appr) {
          // accessible name includes the avatar img alt ("Approve Credit NoteUser avatar placeholder") → prefix match
          await clickButton(page, new RegExp(`^${appr.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
        } else {
          break;
        }
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 60_000 });
      }
      const confirm = page.locator('.o_form_statusbar').getByRole('button', { name: /^confirm$/i }).first();
      test.skip(!(await confirm.isVisible({ timeout: 3_000 }).catch(() => false)),
        `Credit note needs an approval from another user (set ODOO_APPROVER_EMAIL / ODOO_APPROVER_PASSWORD). Header buttons: ${JSON.stringify(await headerButtons(page))}`);
      await confirm.click();
      await throwIfOdooError(page);
      await expect(stage(page)).toContainText(/posted/i, { timeout: 30_000 });
    });
  });

  test('6. original invoice: reset to draft and confirm again (when offered)', async ({ page }) => {
    test.skip(!invoiceUrl, 'No invoice from step 4');
    await openRecord(page, invoiceUrl);
    const reset = page.locator('.o_form_statusbar').getByRole('button', { name: /reset to draft/i }).first();
    test.skip(!(await reset.isVisible({ timeout: 3_000 }).catch(() => false)),
      'Reset to Draft not available (invoice already reversed / locked)');
    await reset.click();
    await throwIfOdooError(page);
    await expect(stage(page)).toContainText(/draft/i, { timeout: 30_000 });
    await clickButton(page, /^confirm$/i);
    await expect(stage(page)).toContainText(/posted/i, { timeout: 30_000 });
  });

  test('7. advance payment on the sales order, then the Payments smart button', async ({ page }) => {
    test.skip(!orderUrl, 'No order from step 1');
    await openRecord(page, orderUrl);

    await test.step('Register the advance payment on the order', async () => {
      const advance = page.locator('.o_form_statusbar').getByRole('button', { name: /advance payment|register payment/i }).first();
      test.skip(!(await advance.isVisible({ timeout: 3_000 }).catch(() => false)),
        'Advance Payment button not available on this order');
      await advance.click();
      await page.waitForTimeout(1_500);
      await throwIfOdooError(page);
      // The tour opens an editable payments list (click the row's Reference cell, type the amount);
      // some instances open a wizard dialog instead.
      const row = page.locator('td[name="ref"]').first();
      if (await row.isVisible({ timeout: 5_000 }).catch(() => false)) await row.click();
      const amount = page.locator('.modal:visible [name="amount"] input, .o_data_row.o_selected_row [name="amount"] input, .o_form_view [name="amount"] input').first();
      await amount.fill('1');
      await amount.press('Enter');
      await throwIfOdooError(page);
      await saveRecord(page);
      const confirmBtn = page.locator('.o_form_statusbar').getByRole('button', { name: /^confirm$/i }).first();
      if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmBtn.click();
        await throwIfOdooError(page);
      }
    });

    await test.step('Open the Payments smart button', async () => {
      await openRecord(page, orderUrl);
      const payments = page.locator('.oe_button_box button').filter({ hasText: /payments?/i }).first();
      test.skip(!(await payments.isVisible({ timeout: 5_000 }).catch(() => false)),
        'Payments smart button not shown on this order');
      await payments.click();
      await throwIfOdooError(page);
      await expect(page.locator('.o_list_view, .o_form_view').first()).toBeVisible({ timeout: 30_000 });
    });
  });
});
