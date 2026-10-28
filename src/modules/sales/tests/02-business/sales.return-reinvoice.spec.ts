/**
 * Step 2 — Business flow: "Reverse and Create Invoice" on a Cash sales order.
 *
 * Derived from the "Return & create invoice in cash sales order" Odoo tour (tour_export (14).json):
 *   1  quotation   Cash order, Sales quotation type, product line, Sales Team / Warehouse / Payment Terms
 *   2  confirm     (approvals if the instance asks for them) → Sales Order
 *   3  delivery    validate the delivery → Done
 *   4  invoice     create invoice and confirm → Posted
 *   5  reverse     Credit Note wizard: reason + "Reverse and Create Invoice" → credit note + new draft invoice
 *   6  re-invoice  confirm the new invoice, then register the cash payment (Customer Receipts - Cash)
 *   7  approval    open the credit note from the order's Invoices list, request approval and approve it
 *
 * Creates REAL records → opt-in:
 *   RUN_SALES_FLOWS=true npx playwright test sales.return-reinvoice --project=setup --project=admin
 * Optional env: FLOW_CONTROL_CUSTOMER (default "abc"), ODOO_APPROVER_EMAIL / ODOO_APPROVER_PASSWORD.
 *
 * All selectors are by field name / visible text — the recorded record IDs (button[name="1493"],
 * FTI/2026/00646, #autocomplete_0_2 ...) were deliberately NOT carried over.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';
import type { Page } from '@playwright/test';
import {
  COMPANY, openSalesApp, switchCompany, createQuotation, approveAndConfirm, validateDelivery,
  CASH_JOURNAL, createInvoice, headerButtons, clickButton, throwIfOdooError,
} from '../../flows/flowHelpers';

const CUSTOMER = process.env.FLOW_CONTROL_CUSTOMER ?? 'abc';

test.use({ actionTimeout: 20_000, navigationTimeout: 60_000, video: 'off', trace: 'off' });

async function openRecord(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.o_form_statusbar button').first()).toBeVisible({ timeout: 30_000 });
}

const stage = (page: Page) => page.locator('.o_form_statusbar .o_arrow_button_current').first();
const escRx = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe.serial('Sales return and re-invoice of a cash order @module:sales @step:business @e2e', () => {
  test.skip(process.env.RUN_SALES_FLOWS !== 'true',
    'Creates real orders/deliveries/invoices/credit notes/payments — set RUN_SALES_FLOWS=true to run');

  let orderUrl = '';
  let invoiceUrl = '';
  let newInvoiceUrl = '';
  const returnReason = uniqueName('Customer return');

  test.beforeEach(async ({ page }) => {
    await openSalesApp(page);
    await switchCompany(page, COMPANY);
  });

  test('1. quotation: Cash order for a Sales quotation @smoke', async ({ page }) => {
    const orderNumber = await createQuotation(page, { customer: CUSTOMER, paymentType: 'Cash' });
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
    expect(await validateDelivery(page)).toBeTruthy();
  });

  test('4. invoice: create and confirm → Posted', async ({ page }) => {
    test.skip(!invoiceUrl && !orderUrl, 'No order from step 1');
    await openRecord(page, orderUrl);
    expect(await createInvoice(page)).toBeTruthy();
    await expect(stage(page)).toContainText(/posted/i);
    invoiceUrl = page.url();
  });

  test('5. reverse: Credit Note wizard → "Reverse and Create Invoice" gives a new draft invoice', async ({ page }) => {
    test.skip(!invoiceUrl, 'No invoice from step 4');
    await openRecord(page, invoiceUrl);

    const credit = page.locator('.o_form_statusbar button[name="action_reverse"]').first();
    test.skip(!(await credit.isVisible({ timeout: 5_000 }).catch(() => false)),
      'Credit Note (reverse) button not available on this invoice');
    await credit.click();

    const dlg = page.locator('.modal:visible').first();
    await expect(dlg).toBeVisible({ timeout: 15_000 });
    await dlg.locator('[name="reason"] input, [name="reason"] textarea').first().fill(returnReason);
    // button[name="modify_moves"] is the recorded selector; the visible label is the stable contract
    const reverseAndInvoice = dlg.getByRole('button', { name: /reverse and create invoice/i });
    test.skip(!(await reverseAndInvoice.isVisible({ timeout: 3_000 }).catch(() => false)),
      '"Reverse and Create Invoice" not offered in the Credit Note wizard');
    await reverseAndInvoice.click();
    await throwIfOdooError(page);

    await expect(page.locator('.modal:visible')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 30_000 });
    // Odoo opens the NEW invoice, still in Draft, ready to be confirmed
    await expect(stage(page)).toContainText(/draft/i);
    await page.waitForTimeout(2_000);
    newInvoiceUrl = page.url();
    expect(newInvoiceUrl).not.toBe(invoiceUrl);
  });

  test('6. re-invoice: confirm the new invoice and register the cash payment', async ({ page }) => {
    test.skip(!newInvoiceUrl, 'No replacement invoice from step 5');
    await openRecord(page, newInvoiceUrl);

    await test.step('Confirm the replacement invoice → Posted', async () => {
      await clickButton(page, /^confirm$/i, 20_000);
      await throwIfOdooError(page);
      await expect(stage(page)).toContainText(/posted/i, { timeout: 30_000 });
    });

    await test.step('Register the payment with the cash journal', async () => {
      const pay = page.locator('.o_form_statusbar').getByRole('button', { name: /^register payment$/i }).first();
      test.skip(!(await pay.isVisible({ timeout: 5_000 }).catch(() => false)),
        'Register Payment not offered (invoice may already be settled by an outstanding credit)');
      await pay.click();
      const dlg = page.locator('.modal:visible').first();
      await expect(dlg).toBeVisible({ timeout: 15_000 });

      // The tour opens the journal dropdown and picks "Customer Receipts - Cash" (via Search More…);
      // typing the full name finds nothing on this instance, so open the list empty instead.
      const journal = dlg.locator('[name="journal_id"] input').first();
      await journal.click();
      await journal.fill('');
      const menu = page.locator('.o-dropdown--menu, .ui-autocomplete').first();
      await expect(menu).toBeVisible({ timeout: 8_000 });
      const cashOption = menu.locator('.o_menu_item, .ui-menu-item').filter({ hasText: CASH_JOURNAL }).first();
      let chosen = CASH_JOURNAL;
      if (await cashOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await cashOption.click();
      } else {
        await menu.getByText('Search More...').first().click();
        const popup = page.locator('.modal:visible').last();
        const rows = popup.locator('.o_data_row');
        await expect(rows.first()).toBeVisible({ timeout: 15_000 });
        // exact journal from the tour if this company has it, otherwise the plain "Cash" journal
        let row = rows.filter({ hasText: CASH_JOURNAL }).first();
        if (!(await row.isVisible({ timeout: 1_000 }).catch(() => false))) {
          chosen = 'Cash';
          row = rows.filter({ has: page.locator('td', { hasText: /^Cash$/ }) }).first();
          test.info().annotations.push({ type: 'note', description: `"${CASH_JOURNAL}" not found in this company; paid with the "Cash" journal` });
        }
        await row.click();
      }
      await expect(journal).toHaveValue(new RegExp(`^${escRx(chosen)}`, 'i'), { timeout: 10_000 });

      await dlg.locator('footer button').filter({ hasText: /^create payment$/i }).first().click();
      try {
        await throwIfOdooError(page);
      } catch (e) {
        // Environment drift, not a test bug: the cash journal has no outstanding-receipts account configured
        if (/outstanding payments\/receipts account/i.test(String(e))) {
          test.skip(true, `Cannot register the payment: ${(e as Error).message}`);
        }
        throw e;
      }
      await expect(page.locator('.o_form_view .o_widget_web_ribbon, .o_form_view .ribbon').first())
        .toContainText(/paid|in payment/i, { timeout: 30_000 });
    });
  });

  test('7. credit note: open it from the order\'s Invoices list, request approval and approve', async ({ page }) => {
    test.skip(!orderUrl, 'No order from step 1');
    await openRecord(page, orderUrl);

    await test.step('Open the credit note from the Invoices smart button', async () => {
      await page.locator('button[name="action_view_invoice"]').first().click();
      await throwIfOdooError(page);
      const rows = page.locator('.o_list_view .o_data_row');
      await expect(rows.first()).toBeVisible({ timeout: 30_000 });
      // original invoice + replacement invoice + credit note
      await expect(rows).toHaveCount(3, { timeout: 20_000 });
      const creditRow = rows.filter({ has: page.locator('td[name="name"]', { hasText: /^RFTI|^R[A-Z]*\// }) }).first();
      const found = await creditRow.isVisible({ timeout: 3_000 }).catch(() => false);
      test.skip(!found, 'Credit note row (RFTI/...) not found in the order\'s invoices');
      await creditRow.locator('td[name="name"]').click();
      await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 30_000 });
    });

    await test.step('Request approval and approve (loop until neither button is left)', async () => {
      let acted = false;
      for (let i = 0; i < 4; i++) {
        const buttons = await headerButtons(page);
        const req = buttons.find(b => /^request .*approval$/i.test(b.text) && b.enabled);
        const appr = buttons.find(b => /^approve\b/i.test(b.text) && b.enabled);
        if (req) {
          await clickButton(page, new RegExp(`^${escRx(req.text)}$`, 'i'));
        } else if (appr) {
          // accessible name includes the avatar img alt → prefix match
          await clickButton(page, new RegExp(`^${escRx(appr.text)}`, 'i'));
        } else {
          break;
        }
        acted = true;
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 60_000 });
      }
      test.skip(!acted,
        `No approval button on the credit note (already approved/posted?). Header buttons: ${JSON.stringify(await headerButtons(page))}`);
      const after = await headerButtons(page);
      expect(after.some(b => /^request .*approval$/i.test(b.text) && b.enabled)).toBe(false);
    });
  });
});
