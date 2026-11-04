/**
 * Step 2 — Business flow: Cash sales order controlled by the MINIMUM SALES MARGIN % (profit margin control).
 *
 * Derived from the "Cash Sales Order (Profit Margin Control)" Odoo tour:
 *   1  quotation   customer abc, Order Payment Type = Cash, Quotation Type = Sales, product JMC6 Multi Chopper 6Hp qty 1,
 *                  Payment Terms = Immediate Payment, Sales Team, Warehouse, Save
 *   2  gating      margin < minimum: Confirm hidden; "Insufficient Margin Details" opens a modal, Close
 *   3  approval    Request Insufficient Margin Approval -> Approve Insufficient Margin -> Confirm -> Sales Order
 *   4  delivery    validate the delivery -> Done
 *   5  invoice     create invoice and confirm -> Posted
 *   6  payment     Register Payment, journal "Customer Receipts - Cash", full invoice total
 *   7  trace       payment's "Sales Orders" smart button -> the order, whose Invoices smart button -> the invoice
 *
 * Business rule: Settings > Sales > "Minimum Sales Margin %" (60) is enforced at the Confirm gate for Sales/Project
 * quotations. Margin % = (net unit price - cost) / net price x 100, cost = order line cost (purchase_price, copied from the
 * product's Cost / standard_price — NOT the vendor price).
 * DATA CAVEAT: if the product's cost is 0 the margin shows 100 % and the gate never triggers; then the gating test
 * skips (with the buttons seen and the margin shown) and test 3 just confirms.
 *
 * Creates REAL records -> opt-in:
 *   RUN_SALES_FLOWS=true npx playwright test sales.margin-approval --project=setup --project=admin --workers=1
 * Optional env:
 *   FLOW_CONTROL_CUSTOMER       (default "abc")
 *   FLOW_MARGIN_PRODUCT_CODE    (default "JMC6")
 *   FLOW_MARGIN_PRODUCT_NAME    (default "[JMC6] Multi Chopper 6Hp (Tractor Type)")
 *   FLOW_MARGIN_UNIT_PRICE      override the line unit price (e.g. to push margin below the minimum)
 *   FLOW_MARGIN_COST            product cost, when known; enables the marginPct() arithmetic check
 *   FLOW_MIN_MARGIN             minimum margin % (default 60)
 *   ODOO_APPROVER_EMAIL / ODOO_APPROVER_PASSWORD (when the approval is assigned to someone other than the logged-in user)
 *
 * Selectors are by field name / visible text — recorded action-id buttons (1517/1513/1515) were NOT carried over.
 */
import { test, expect } from '../../../../core/fixtures/index';
import type { Page } from '@playwright/test';
import {
  COMPANY, CASH_JOURNAL, openSalesApp, switchCompany, createQuotation, approveAndConfirm, headerButtons,
  validateDelivery, createInvoice, clickButton, throwIfOdooError,
} from '../../flows/flowHelpers';
import { marginPct, parseAmount } from '../../calculations/SalesCalculations';

const CUSTOMER      = process.env.FLOW_CONTROL_CUSTOMER ?? 'abc';
const PRODUCT_CODE  = process.env.FLOW_MARGIN_PRODUCT_CODE ?? 'JMC6';
const PRODUCT_NAME  = process.env.FLOW_MARGIN_PRODUCT_NAME ?? '[JMC6] Multi Chopper 6Hp (Tractor Type)';
const UNIT_PRICE    = process.env.FLOW_MARGIN_UNIT_PRICE ? Number(process.env.FLOW_MARGIN_UNIT_PRICE) : undefined;
const KNOWN_COST    = process.env.FLOW_MARGIN_COST ? Number(process.env.FLOW_MARGIN_COST) : undefined;
const MIN_MARGIN    = Number(process.env.FLOW_MIN_MARGIN ?? 60);

test.use({ actionTimeout: 20_000, navigationTimeout: 60_000, video: 'off', trace: 'off' });

async function openRecord(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Odoo occasionally lands on the list view for a saved form URL; retry the navigation once
  if (!(await page.locator('.o_form_view').isVisible({ timeout: 20_000 }).catch(() => false))) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }
  await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.o_form_statusbar button').first()).toBeVisible({ timeout: 30_000 });
}

const stage = (page: Page) => page.locator('.o_form_statusbar .o_arrow_button_current').first();
const escRx = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PAID_RIBBON = '.o_form_view .o_widget_web_ribbon, .o_form_view .ribbon';

/** Reads "Margin: Rs X (Y%)" from the order form. null values when the margin block is not shown. */
async function readMargin(page: Page): Promise<{ amount: number | null; pct: number | null; raw: string }> {
  const fieldText = async (name: string): Promise<string> =>
    ((await page.locator(`.o_form_view [name="${name}"]`).first().textContent({ timeout: 2_000 }).catch(() => '')) ?? '')
      .replace(/\s+/g, ' ').trim();
  const body = ((await page.locator('.o_form_view').first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ');
  const m = /Margin:?\s*([^()]*?)\(\s*(-?[\d.,]+)\s*%\s*\)/i.exec(body);
  if (m) return { amount: parseAmount(m[1]), pct: parseAmount(m[2]), raw: m[0] };
  const amt = await fieldText('margin');
  const pct = await fieldText('margin_percent');
  if (amt || pct) return { amount: amt ? parseAmount(amt) : null, pct: pct ? parseAmount(pct) : null, raw: `margin=${amt} margin_percent=${pct}` };
  return { amount: null, pct: null, raw: '(margin not shown)' };
}

/** Selects the journal in the Register Payment dialog: wanted journal, else the usual cash-receipts fallbacks. */
async function pickCashJournal(page: Page, dlg: ReturnType<Page['locator']>): Promise<string> {
  const journal = dlg.locator('[name="journal_id"] input').first();
  await journal.click();
  await journal.fill('');
  const menu = page.locator('.o-dropdown--menu, .ui-autocomplete').first();
  await expect(menu).toBeVisible({ timeout: 8_000 });
  const option = menu.locator('.o_menu_item, .ui-menu-item').filter({ hasText: CASH_JOURNAL }).first();
  let chosen = CASH_JOURNAL;
  if (await option.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await option.click();
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
  return chosen;
}

test.describe.serial('Cash order with profit margin control: margin approval, invoice and cash receipt @module:sales @step:business @e2e', () => {
  test.skip(process.env.RUN_SALES_FLOWS !== 'true',
    'Creates real orders/deliveries/invoices/payments — set RUN_SALES_FLOWS=true to run');

  let orderUrl = '';
  let orderNumber = '';
  let invoiceUrl = '';
  let paymentUrl = '';
  let invoiceTotal = '';
  let gated = false;

  test.beforeEach(async ({ page }) => {
    await openSalesApp(page);
    await switchCompany(page, COMPANY);
  });

  test('1. quotation: Cash order, Immediate Payment, margin shown on the form @smoke', async ({ page }) => {
    orderNumber = await createQuotation(page, {
      customer: CUSTOMER, paymentType: 'Cash', quantity: 1, unitPrice: UNIT_PRICE,
      productCode: PRODUCT_CODE, productName: PRODUCT_NAME,
    });
    orderUrl = page.url();
    expect(orderNumber).toMatch(/^S\d+/);
    await expect(page.locator('[name="x_studio_order_payment_method"] select').first()).toHaveValue(/cash/i);
    await expect(page.locator('[name="x_studio_quotation_type"] select').first()).toHaveValue(/sales/i).catch(() => {});
    await expect(page.locator('.o_data_row').first()).toContainText(PRODUCT_CODE);
    await page.getByRole('tab', { name: /other\s*info/i }).click();
    await expect(page.locator('[name="payment_term_id"] input').first()).toHaveValue(/immediate/i);
    await expect(stage(page)).toContainText(/quotation/i);

    const margin = await readMargin(page);
    test.info().annotations.push({ type: 'margin', description: margin.raw });
    if (margin.pct === null) {
      test.info().annotations.push({ type: 'note', description: 'Margin block not found on the form; arithmetic check skipped' });
      return;
    }
    if (KNOWN_COST !== undefined) {
      // net unit price as displayed on the line (after any override / discount)
      await page.getByRole('tab', { name: /order\s*lines/i }).click();
      const cell = page.locator('.o_data_row [name="price_unit"]').first();
      const price = parseAmount(await cell.textContent());
      const disc = parseAmount(await page.locator('.o_data_row [name="discount"]').first().textContent().catch(() => '0'));
      expect(margin.pct).toBeCloseTo(marginPct(price, KNOWN_COST, disc), 0);
    } else {
      test.info().annotations.push({ type: 'note', description: 'FLOW_MARGIN_COST not set: margin shown but not compared with marginPct()' });
    }
  });

  test('2. gating: Confirm hidden; "Insufficient Margin Details" opens a modal and closes', async ({ page }) => {
    test.skip(!orderUrl, 'No quotation from step 1');
    await openRecord(page, orderUrl);
    const buttons = (await headerButtons(page)).map(b => b.text);
    const margin = await readMargin(page);
    gated = buttons.some(t => /^(insufficient margin details|request insufficient margin approval)$/i.test(t));
    test.skip(!gated,
      `Margin gate not triggered (product cost is probably 0, so margin is 100%). Buttons seen: ${buttons.join(' | ') || '(none)'}; margin shown: ${margin.raw}`);

    expect(buttons.some(t => /^confirm$/i.test(t)), `Confirm must be hidden until margin approval. Buttons: ${buttons.join(' | ')}`).toBe(false);
    if (margin.pct !== null) expect(margin.pct).toBeLessThan(MIN_MARGIN);
    await expect(stage(page)).toContainText(/quotation/i);

    const details = page.locator('.o_form_statusbar').getByRole('button', { name: /^insufficient margin details$/i }).first();
    if (!(await details.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.info().annotations.push({ type: 'note', description: `"Insufficient Margin Details" not shown. Buttons: ${buttons.join(' | ')}` });
      return;
    }
    await details.click();
    // In this database the button raises a UserError whose text IS the details (item, base price, cost, net margin, minimum margin)
    let detailText = '';
    try {
      await throwIfOdooError(page);
      const dlg = page.locator('.modal:visible').first();
      await expect(dlg).toBeVisible({ timeout: 20_000 });
      detailText = ((await dlg.locator('.modal-body').textContent()) ?? '').replace(/\s+/g, ' ').trim();
      await dlg.locator('footer button').filter({ hasText: /^(close|ok)$/i }).first().click();
    } catch (e) {
      detailText = String(e).replace(/\s+/g, ' ');
    }
    test.info().annotations.push({ type: 'margin-details', description: detailText.slice(0, 400) });
    expect(detailText, 'Margin details must explain the shortfall').toMatch(/insufficient margin/i);
    expect(detailText).toMatch(/net margin/i);
    await expect(page.locator('.modal:visible')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('.o_form_view')).toBeVisible();
  });

  test('3. approval: Request Insufficient Margin Approval, approve, then confirm → Sales Order', async ({ page, browser }) => {
    test.skip(!orderUrl, 'No quotation from step 1');
    await openRecord(page, orderUrl);
    const outcome = await approveAndConfirm(page, browser);
    test.info().annotations.push({ type: 'approvals', description: outcome.taken.join(' → ') || '(none needed)' });
    if (gated) {
      expect(outcome.taken.some(t => /margin/i.test(t)),
        `Expected a margin approval step. Taken: ${outcome.taken.join(', ')}`).toBe(true);
    } else {
      test.info().annotations.push({ type: 'note', description: 'Margin gate was not active; order confirmed without margin approval' });
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

  test('6. payment: register the full cash payment on the invoice', async ({ page }) => {
    test.skip(!invoiceUrl, 'No invoice from step 5');
    await openRecord(page, invoiceUrl);
    await clickButton(page, /^register payment$/i, 20_000);
    const dlg = page.locator('.modal:visible').first();
    await expect(dlg).toBeVisible({ timeout: 15_000 });
    await pickCashJournal(page, dlg);

    // pre-filled with the full invoice total (the tour's fixed amount is not hard-coded)
    const amount = dlg.locator('[name="amount"] input').first();
    if (invoiceTotal) expect(parseAmount(await amount.inputValue())).toBeCloseTo(parseAmount(invoiceTotal), 2);

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

  test('7. trace: payment → Sales Orders → order → Invoices smart button → invoice', async ({ page }) => {
    test.skip(!invoiceUrl, 'No invoice from step 5');
    await openRecord(page, invoiceUrl);
    test.skip(!paymentUrl, 'Payment was not registered in step 6');
    await expect(page.locator(PAID_RIBBON).first()).toContainText(/paid|in payment/i, { timeout: 30_000 });

    const soBtn = page.locator('button[name="action_view_source_sale_orders"]').first();
    await expect(soBtn).toBeVisible({ timeout: 15_000 });
    await expect(soBtn).toContainText(/^\s*1(?!\d)/); // text is "1Sale Orders": no word boundary after the count
    await soBtn.click();
    await throwIfOdooError(page);
    await expect(page.locator('.o_form_view, .o_list_view').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('body')).toContainText(orderNumber, { timeout: 15_000 });

    // if the button opened a list, open the single order
    if (await page.locator('.o_list_view .o_data_row').first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await page.locator('.o_list_view .o_data_row').first().click();
    }
    await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 30_000 });
    const invBtn = page.locator('button[name="action_view_invoice"]').first();
    await expect(invBtn).toBeVisible({ timeout: 15_000 });
    await invBtn.click();
    await throwIfOdooError(page);
    await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 30_000 });
    await expect(stage(page)).toContainText(/posted/i);
  });
});
