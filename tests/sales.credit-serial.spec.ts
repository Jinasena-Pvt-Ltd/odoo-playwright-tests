/**
 * Step 2 — Business flow: Credit sales order for a serial-number product (14 Days payment terms).
 *
 * Test cases derived from the "Credit Sales Order - Serial" tour (tour/credit-sales-order-serial.json):
 *   precondition  credit customer exists, is set to Credit and has no overdue invoices
 *   1  quotation   Credit order, serial product, Payment Terms 14 Days
 *   2  confirm     no approval needed, order becomes a Sales Order
 *   3  delivery    new serial number on the delivery, validate → Done
 *   4  invoice     post the invoice, it keeps 14 Days and is due 14 days after the invoice date
 *   5  payment     "14 days later": back through the Sales app (Orders > Orders > search > Invoices),
 *                  register the payment, invoice shows the IN PAYMENT ribbon
 *
 * Creates REAL records (order, delivery, serial number, invoice, payment) → opt-in:
 *   RUN_SALES_FLOWS=true npx playwright test sales.credit-serial --project=setup --project=admin
 * Optional env: CREDIT_CUSTOMER (default DIDULA MOTORES — must be a Credit customer with NO overdue invoices),
 *   SERIAL_PRODUCT_CODE / SERIAL_PRODUCT_NAME (default EY20KP), ODOO_APPROVER_EMAIL / ODOO_APPROVER_PASSWORD.
 */
import { test, expect } from '../src/core/fixtures/index';
import type { Page } from '@playwright/test';
import {
  COMPANY, openSalesApp, switchCompany, createQuotation, approveAndConfirm, validateDelivery,
  createInvoice, registerCashPayment, headerButtons, throwIfOdooError,
} from '../src/modules/sales/flows/flowHelpers';

const CUSTOMER = process.env.CREDIT_CUSTOMER ?? 'DIDULA MOTORES';
const SERIAL_CODE = process.env.SERIAL_PRODUCT_CODE ?? 'EY20KP';
const SERIAL_NAME = process.env.SERIAL_PRODUCT_NAME ?? 'EY20KP';
const PAYMENT_TERM = '14 Days';
const TERM_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

/** Opens the saved order and waits until the form and its header buttons are really rendered. */
async function openOrder(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.o_form_statusbar button').first()).toBeVisible({ timeout: 30_000 });
}

test.use({ actionTimeout: 20_000, navigationTimeout: 60_000, video: 'off', trace: 'off' });

test.describe.serial('Sales credit order with serial product @module:sales @step:business @e2e', () => {
  test.skip(process.env.RUN_SALES_FLOWS !== 'true',
    'Creates real orders/deliveries/invoices/payments — set RUN_SALES_FLOWS=true to run');

  // State carried from one case to the next (the cases are ordered steps of one business flow).
  let orderNumber = '';
  let orderUrl = '';
  let invoiceName = '';

  test.beforeEach(async ({ page }) => {
    await openSalesApp(page);
    await switchCompany(page, COMPANY);
  });

  test('precondition: credit customer is set to Credit and has no overdue invoices @smoke', async ({ rpc }) => {
    const [company] = await test.step(`Read company "${COMPANY}"`, async () => {
      const rows = await rpc.searchRead<{ id: number }>('res.company', [['name', '=', COMPANY]], ['id'], { limit: 1 });
      expect(rows[0], `Company "${COMPANY}" not found`).toBeTruthy();
      return rows;
    });
    const [partner] = await rpc.callMethod<Array<{
      name: string; total_overdue: number; x_studio_payment_method: string | false;
      use_partner_credit_limit: boolean; credit_limit: number;
    }>>('res.partner', 'search_read', [[['name', '=', CUSTOMER]]], {
      fields: ['name', 'total_overdue', 'x_studio_payment_method', 'use_partner_credit_limit', 'credit_limit'],
      limit: 1,
      context: { allowed_company_ids: [company.id], company_id: company.id },
    });
    await test.step(`Customer "${CUSTOMER}" exists`, async () => {
      expect(partner, `Customer "${CUSTOMER}" not found`).toBeTruthy();
    });
    await test.step('Customer is set to Credit', async () => {
      expect(partner.x_studio_payment_method, `${CUSTOMER} must be a Credit customer`).toBe('Credit');
    });
    await test.step('Customer has no overdue invoices', async () => {
      expect(partner.total_overdue, `${CUSTOMER} has overdue invoices — choose another customer (CREDIT_CUSTOMER)`).toBe(0);
    });
    await test.step('Customer has a credit limit', async () => {
      expect(partner.credit_limit, `${CUSTOMER} needs a credit limit`).toBeGreaterThan(0);
    });
  });

  test('1. quotation: Credit order, serial product, Payment Terms 14 Days', async ({ page }) => {
    orderNumber = await createQuotation(page, {
      customer: CUSTOMER, paymentType: 'Credit',
      productCode: SERIAL_CODE, productName: SERIAL_NAME, paymentTerm: PAYMENT_TERM,
    });
    orderUrl = page.url();
    await test.step(`Quotation number assigned (${orderNumber})`, async () => {
      expect(orderNumber).toMatch(/^S\d+/);
    });
    await test.step('Order Payment Type shows Credit', async () => {
      await expect(page.locator('[name="x_studio_order_payment_method"] select').first()).toHaveValue(/credit/i);
    });
    await test.step(`Payment Terms show ${PAYMENT_TERM}, not Immediate Payment`, async () => {
      await page.locator('.o_notebook .nav-link').filter({ hasText: /other\s*info/i }).first().click();
      await expect(page.locator('[name="payment_term_id"] input').first()).toHaveValue(PAYMENT_TERM);
      // A credit order must never use Immediate Payment.
      await expect(page.locator('[name="payment_term_id"] input').first()).not.toHaveValue(/immediate/i);
    });
  });

  test('2. confirm: no approval needed, quotation becomes a Sales Order', async ({ page, browser }) => {
    await openOrder(page, orderUrl);
    await test.step('No approval request is offered (customer within limit)', async () => {
      const buttons = (await headerButtons(page)).map(b => b.text);
      expect(buttons.some(t => /^request .*approval$/i.test(t)),
        `${CUSTOMER} needs a credit limit approval (over limit or overdue). Buttons: ${buttons.join(' | ')}`).toBe(false);
    });
    const outcome = await approveAndConfirm(page, browser);
    await test.step('No approvals were needed', async () => {
      expect(outcome.taken, 'no approvals expected for a customer within the credit limit').toEqual([]);
    });
    await test.step('Status is Sales Order and the Delivery button appears', async () => {
      await expect(page.locator('.o_form_statusbar .o_statusbar_status')).toContainText(/sales order/i);
      await expect(page.locator('button[name="action_view_delivery"]').first()).toBeVisible();
    });
  });

  test('3. delivery: new serial number, validate → Done', async ({ page }) => {
    await openOrder(page, orderUrl);
    const ref = await validateDelivery(page); // creates the serial, puts it in stock, validates, returns to the order
    await test.step(`Delivery ${ref} is an outgoing transfer`, async () => { expect(ref).toMatch(/OUT/i); });
    await test.step('Order shows the Create Invoice button after delivery', async () => {
      await expect(page.locator('button[name="action_view_delivery"]').first()).toBeVisible();
      await expect(page.locator('button', { hasText: /create invoice/i }).first()).toBeVisible();
    });
  });

  test('4. invoice: posted, keeps 14 Days, due 14 days after the invoice date', async ({ page, rpc }) => {
    await openOrder(page, orderUrl);
    invoiceName = await createInvoice(page);
    await test.step(`Invoice ${invoiceName} is Posted, with no payment ribbon yet`, async () => {
      expect(invoiceName).toMatch(/\//);
      await expect(page.locator('.o_form_statusbar .o_statusbar_status')).toContainText(/posted/i);
      // A credit sale is not paid at invoicing time: no payment ribbon yet.
      await expect(page.locator('.o_form_view .ribbon span')).toHaveCount(0);
    });

    const [move] = await rpc.searchRead<{
      invoice_date: string; invoice_date_due: string; invoice_payment_term_id: [number, string] | false; payment_state: string;
    }>('account.move', [['name', '=', invoiceName]],
      ['invoice_date', 'invoice_date_due', 'invoice_payment_term_id', 'payment_state'], { limit: 1 });
    await test.step(`Invoice keeps ${PAYMENT_TERM}`, async () => {
      expect(move.invoice_payment_term_id && move.invoice_payment_term_id[1]).toBe(PAYMENT_TERM);
    });
    await test.step(`Due date is ${TERM_DAYS} days after the invoice date`, async () => {
      expect(daysBetween(move.invoice_date, move.invoice_date_due)).toBe(TERM_DAYS);
    });
    await test.step('Payment state is Not Paid', async () => {
      expect(move.payment_state).toBe('not_paid');
    });
  });

  test('5. payment day: come back through the Sales app, register the payment → IN PAYMENT', async ({ page, rpc }) => {
    // "14 days later": start from the Sales app, not from a saved link.
    await openSalesApp(page);
    await test.step('Orders > Orders: open the list of confirmed orders', async () => {
      await page.locator('.o_menu_sections').getByText('Orders').first().click();
      await page.locator('[data-menu-xmlid="sale.menu_sale_order"]').click();
      await expect(page.locator('.o_list_view')).toBeVisible({ timeout: 30_000 });
    });
    await test.step(`Search for order ${orderNumber} and open it`, async () => {
      const search = page.locator('input.o_searchview_input').first();
      await search.fill(orderNumber);
      await search.press('Enter');
      await expect(page.locator('.o_searchview_facet').filter({ hasText: orderNumber }).first()).toBeVisible({ timeout: 10_000 });
      await page.locator('.o_list_table .o_data_row').filter({ hasText: orderNumber }).first().click();
      await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 30_000 });
    });
    await test.step(`Click Invoices: the posted invoice ${invoiceName} opens`, async () => {
      await page.locator('button[name="action_view_invoice"]').first().click();
      await throwIfOdooError(page);
      await expect(page.locator('.o_form_statusbar .o_statusbar_status')).toContainText(/posted/i, { timeout: 30_000 });
      await expect(page.locator('.o_form_view [name="name"]').first()).toContainText(invoiceName);
    });

    await registerCashPayment(page); // Register Payment → Customer Receipts - Cash → Create Payment → ribbon
    await test.step('Invoice shows the IN PAYMENT ribbon', async () => {
      await expect(page.locator('.o_form_view .ribbon span').first()).toHaveText(/in payment|paid/i);
    });

    const [move] = await rpc.searchRead<{ payment_state: string; amount_residual: number }>(
      'account.move', [['name', '=', invoiceName]], ['payment_state', 'amount_residual'], { limit: 1 });
    await test.step('Stored payment state is In Payment / Paid, amount due is 0', async () => {
      expect(['in_payment', 'paid']).toContain(move.payment_state);
      expect(move.amount_residual).toBe(0);
    });
  });
});
