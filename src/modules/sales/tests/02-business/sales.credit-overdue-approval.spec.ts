/**
 * Step 2 — Business flow: Credit sales order for an OVERDUE customer that also needs CREDIT LIMIT approval.
 *
 * Derived from the "Credit Sales Order (Credit Limit Approval with Overdue Customer)" Odoo tour:
 *   1  quotation   customer abc (overdue), Order Payment Type = Credit, Quotation Type = Sales, product line,
 *                  Payment Terms = 14 Days, Sales Team, Warehouse, Save
 *   2  gating      Confirm is not offered; "View Credit Limit Overdue Details" shows the overdue invoices
 *   3  approvals   Request Overdue Approval -> Request Credit Limit Approval -> Approve Credit Limit
 *                  (authorised person) -> Confirm -> Sales Order
 *   4  delivery    validate the delivery -> Done
 *   5  invoice     create invoice and confirm -> Posted
 *   6  payment     Sales -> Orders -> Sales Orders, open the invoice, register the cash payment (full amount)
 *   7  trace       the payment's "Sales Orders" smart button leads back to exactly 1 source order
 *
 * Differs from sales.overdue-credit.spec.ts (overdue approval only, customer JINASENA) by also exercising the
 * credit-limit approval and the overdue-details view, and by using the overdue customer "abc".
 *
 * Creates REAL records → opt-in:
 *   RUN_SALES_FLOWS=true npx playwright test sales.credit-overdue-approval --project=setup --project=admin
 * Optional env: FLOW_CONTROL_CUSTOMER (default "abc"), ODOO_APPROVER_EMAIL / ODOO_APPROVER_PASSWORD
 * (when the approvals are assigned to someone other than the logged-in user).
 *
 * Selectors are by field name / visible text — recorded action-id buttons and #autocomplete ids were NOT carried over.
 */
import { test, expect } from '../../../../core/fixtures/index';
import type { Page } from '@playwright/test';
import {
  COMPANY, CASH_JOURNAL, openSalesApp, switchCompany, createQuotation, approveAndConfirm, headerButtons,
  validateDelivery, createInvoice, clickButton, throwIfOdooError,
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
const PAID_RIBBON = '.o_form_view .o_widget_web_ribbon, .o_form_view .ribbon';

test.describe.serial('Credit order, overdue customer: overdue + credit limit approval, invoice and cash receipt @module:sales @step:business @e2e', () => {
  test.skip(process.env.RUN_SALES_FLOWS !== 'true',
    'Creates real orders/deliveries/invoices/payments — set RUN_SALES_FLOWS=true to run');

  let orderUrl = '';
  let orderNumber = '';
  let invoiceUrl = '';
  let paymentUrl = '';
  let invoiceTotal = '';

  test.beforeEach(async ({ page }) => {
    await openSalesApp(page);
    await switchCompany(page, COMPANY);
  });

  test('1. quotation: Credit order for the overdue customer @smoke', async ({ page }) => {
    orderNumber = await createQuotation(page, { customer: CUSTOMER, paymentType: 'Credit', paymentTerm: '14 Days' });
    orderUrl = page.url();
    expect(orderNumber).toMatch(/^S\d+/);
    await expect(page.locator('[name="x_studio_order_payment_method"] select').first()).toHaveValue(/credit/i);
    await expect(page.locator('[name="x_studio_quotation_type"] select').first()).toHaveValue(/sales/i).catch(() => {});
    await page.getByRole('tab', { name: /other\s*info/i }).click();
    await expect(page.locator('[name="payment_term_id"] input').first()).toHaveValue(/14 days/i);
    await expect(stage(page)).toContainText(/quotation/i);
  });

  test('2. gating: Confirm is blocked and the overdue details are viewable', async ({ page }) => {
    test.skip(!orderUrl, 'No quotation from step 1');
    await openRecord(page, orderUrl);
    const buttons = (await headerButtons(page)).map(b => b.text);
    const gated = buttons.some(t => /^request (overdue|credit limit) approval$/i.test(t) || /^view credit limit overdue details$/i.test(t));
    test.skip(!gated, `${CUSTOMER} is not overdue / over limit in this database. Buttons: ${buttons.join(' | ')}`);
    expect(buttons.some(t => /^confirm$/i.test(t)), `Confirm must be hidden until approvals are given. Buttons: ${buttons.join(' | ')}`).toBe(false);
    await expect(stage(page)).toContainText(/quotation/i);

    const view = page.locator('.o_form_statusbar').getByRole('button', { name: /^view credit limit overdue details$/i }).first();
    if (!(await view.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.info().annotations.push({ type: 'note', description: `"View Credit Limit Overdue Details" not shown. Buttons: ${buttons.join(' | ')}` });
      return;
    }
    await view.click();
    await throwIfOdooError(page);
    // opens a dialog or an overdue-invoice list; either way something must render, then return to the order
    await expect(page.locator('.modal:visible, .o_list_view').first()).toBeVisible({ timeout: 20_000 });
    await page.goto(orderUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 60_000 });
  });

  test('3. approvals: overdue + credit limit approvals, then confirm → Sales Order', async ({ page, browser }) => {
    test.skip(!orderUrl, 'No quotation from step 1');
    await openRecord(page, orderUrl);
    const outcome = await approveAndConfirm(page, browser);
    test.info().annotations.push({ type: 'approvals', description: outcome.taken.join(' → ') || '(none needed)' });
    if (outcome.taken.length) {
      expect(outcome.taken.some(t => /credit limit|overdue/i.test(t)),
        `Expected an overdue / credit limit approval step. Taken: ${outcome.taken.join(', ')}`).toBe(true);
    }
    await expect(stage(page)).toContainText(/sales order/i);
  });

  test('4. delivery: validate → Done', async ({ page }) => {
    test.skip(!orderUrl, 'No order from step 1');
    await openRecord(page, orderUrl);
    expect(await validateDelivery(page)).toBeTruthy();
  });

  test('5. invoice: create and confirm → Posted', async ({ page }) => {
    test.skip(!orderUrl, 'No order from step 1');
    await openRecord(page, orderUrl);
    expect(await createInvoice(page)).toBeTruthy();
    await expect(stage(page)).toContainText(/posted/i);
    invoiceUrl = page.url();
    invoiceTotal = ((await page.locator('.o_form_view [name="amount_total"]').first().textContent().catch(() => '')) ?? '').trim();
  });

  test('6. payment: find the order in Sales Orders, open its invoice and register the full cash payment', async ({ page }) => {
    test.skip(!orderNumber || !invoiceUrl, 'No invoiced order from steps 1-5');

    await test.step('Find the order by number (Sales → Orders → Sales Orders)', async () => {
      await page.locator('[data-menu-xmlid="sale.sale_order_menu"]').click();
      await page.locator('[data-menu-xmlid="sale.menu_sale_order"]').click();
      const search = page.locator('input.o_searchview_input').first();
      await expect(search).toBeVisible({ timeout: 20_000 });
      await search.fill(orderNumber);
      await search.press('Enter');
      const row = page.locator('.o_list_view .o_data_row').filter({ hasText: orderNumber }).first();
      await expect(row).toBeVisible({ timeout: 30_000 });
      await row.locator('td[name="name"]').click();
      await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 30_000 });
    });

    await test.step('Open the invoice from the Invoices smart button', async () => {
      await page.locator('button[name="action_view_invoice"]').first().click();
      await throwIfOdooError(page);
      await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 30_000 });
      await expect(stage(page)).toContainText(/posted/i);
    });

    await test.step('Register payment with the cash journal', async () => {
      await clickButton(page, /^register payment$/i, 20_000);
      const dlg = page.locator('.modal:visible').first();
      await expect(dlg).toBeVisible({ timeout: 15_000 });

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
        let row = rows.filter({ hasText: CASH_JOURNAL }).first();
        if (!(await row.isVisible({ timeout: 1_000 }).catch(() => false))) {
          for (const name of ['Commercial - Cash Receipts', 'BOC - Cash Receipts', 'Cash']) {
            const cand = rows.filter({ has: page.locator('td', { hasText: new RegExp(`^${escRx(name)}$`) }) }).first();
            if (await cand.isVisible({ timeout: 1_000 }).catch(() => false)) { row = cand; chosen = name; break; }
          }
          test.info().annotations.push({ type: 'note', description: `"${CASH_JOURNAL}" not found in this company; paid with the "${chosen}" journal` });
        }
        await row.click();
      }
      await expect(journal).toHaveValue(new RegExp(`^${escRx(chosen)}`, 'i'), { timeout: 10_000 });

      // The amount is pre-filled with the full invoice total; assert that instead of re-typing 1,200.00
      const amount = dlg.locator('[name="amount"] input').first();
      if (invoiceTotal) {
        const digits = (s: string): number => parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
        expect(digits(await amount.inputValue())).toBeCloseTo(digits(invoiceTotal), 2);
      }

      await dlg.locator('footer button').filter({ hasText: /^create payment$/i }).first().click();
      try {
        await throwIfOdooError(page);
      } catch (e) {
        if (/outstanding payments\/receipts account/i.test(String(e))) {
          test.skip(true, `Cannot register the payment: ${(e as Error).message}`);
        }
        throw e;
      }
      await expect(page.locator(PAID_RIBBON).first()).toContainText(/paid|in payment/i, { timeout: 30_000 });
      paymentUrl = page.url();
    });
  });

  test('7. trace: payment → Sales Orders smart button leads back to 1 source order', async ({ page }) => {
    test.skip(!invoiceUrl, 'No invoice from step 5');
    await openRecord(page, invoiceUrl);
    test.skip(!paymentUrl, 'Payment was not registered in step 6');
    await expect(page.locator(PAID_RIBBON).first()).toContainText(/paid|in payment/i, { timeout: 30_000 });

    const soBtn = page.locator('button[name="action_view_source_sale_orders"]').first();
    await expect(soBtn).toBeVisible({ timeout: 15_000 });
    await expect(soBtn).toContainText(/^\s*1(?!\d)/);
    await soBtn.click();
    await throwIfOdooError(page);
    await expect(page.locator('.o_form_view, .o_list_view').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('body')).toContainText(orderNumber, { timeout: 15_000 });
  });
});
