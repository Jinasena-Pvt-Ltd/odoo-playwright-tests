/**
 * Step 2 — Business Logic for the sales module.
 * Quotation maths, the insufficient-margin approval, and the credit-limit approval workflow.
 *
 * These tests create real quotations (named by Odoo, e.g. S01996) for the master-data customer;
 * they are not removed afterwards. An order is only confirmed when the credit-limit approval completes
 * (see notes/sales.notes.md).
 */
import { Page } from '@playwright/test';
import { test, expect } from '../../../../core/fixtures/index';
import { SalesAppPage, QuotationListPage, QuotationFormPage } from '../../pages/SalesPage';
import { SALES_MASTER_DATA, OVER_LIMIT_QUANTITY, BELOW_COST_UNIT_PRICE, APPROVER_LOGIN } from '../../data/sales.master-data';
import { approxEqual, lineNet, marginPct, sum, vatAmount } from '../../calculations/SalesCalculations';

const D = SALES_MASTER_DATA;

/** Opens the Sales app in the sales company and starts a new quotation. */
async function startNewQuotation(app: SalesAppPage, form: QuotationFormPage, page: Page): Promise<void> {
  await app.open();
  await app.switchCompany(D.company);
  await app.goToQuotations();
  await new QuotationListPage(page).clickNewQuotation();
  await form.waitForNewForm();
}

/** Creates an over-limit quotation, saves it and requests credit-limit approval. Returns the form page. */
async function requestOverLimitApproval(page: Page): Promise<QuotationFormPage> {
  const app = new SalesAppPage(page);
  const form = new QuotationFormPage(page);
  await startNewQuotation(app, form, page);
  // Huge quantity on purpose: the sale exceeds any realistic credit limit.
  await form.fillQuotation({
    customer: D.customer, quotationType: D.quotationType, salesTeam: D.salesTeam, warehouse: D.warehouse,
    lines: [
      { product: D.product1, quantity: 1, discount: 0 },
      { product: D.product2, quantity: OVER_LIMIT_QUANTITY, discount: 0 },
    ],
  });
  await form.saveOrThrow();
  await form.scrollToTop();

  // Over the limit: approval can be requested, overdue details are offered, Confirm is hidden.
  await expect(form.headerButton(/request.*credit.*limit.*approval/i)).toBeVisible({ timeout: 30_000 });
  expect(await form.isButtonVisible(/view.*credit.*limit.*overdue/i)).toBe(true);
  expect(await form.isButtonVisible(/^confirm$/i, 3_000), 'Confirm must be hidden before approval').toBe(false);

  await form.headerButton(/request.*credit.*limit.*approval/i).click();
  await expect(
    form.headerButton(/approve.*credit/i),
    'an "Approve Credit Limit" button should follow the request',
  ).toBeVisible({ timeout: 30_000 });
  return form;
}

test.describe('Sales Business Logic @module:sales @step:business', () => {
  test('quotation amounts add up: net, untaxed, VAT and total @e2e', async ({ page }) => {
    test.setTimeout(300_000);
    const app = new SalesAppPage(page);
    const form = new QuotationFormPage(page);

    // Read the VAT % from Accounting first (it needs the Accounting app).
    await app.open();
    await app.switchCompany(D.company);
    const vatPercent = await app.readTaxPercent(D.salesTax);
    test.skip(vatPercent === null, `Tax "${D.salesTax}" is not readable in Accounting for this user`);

    await startNewQuotation(app, form, page);
    await form.fillQuotation({
      customer: D.customer, quotationType: D.quotationType, salesTeam: D.salesTeam, warehouse: D.warehouse,
      lines: [
        { product: D.product1, quantity: 1, discount: 0 },
        { product: D.product2, quantity: 2, discount: 0 },
      ],
    });
    await form.saveOrThrow(); // commits both rows
    await form.openTab(/order\s*lines/i);
    await form.setFirstTaxOnLine(0); // VAT on line 1 only; line 2 stays untaxed
    await form.saveOrThrow();
    await form.openTab(/order\s*lines/i);

    const lines = [await form.readLine(0), await form.readLine(1)];
    const totals = await form.readTotals();
    const rates = [vatPercent!, 0];

    // 1) each line's "Tax excl." equals qty × unit price
    lines.forEach((l, i) => {
      expect(approxEqual(l.taxExcl, lineNet(l.qty, l.unitPrice, 0)), `Line ${i + 1} Tax excl.`).toBe(true);
    });
    // 2) untaxed amount = sum of the lines
    expect(approxEqual(totals.untaxed, sum(lines.map((l) => l.taxExcl))), 'Untaxed Amount').toBe(true);
    // 3) VAT = taxed lines × VAT %
    const expectedVat = sum(lines.map((l, i) => vatAmount(l.taxExcl, rates[i])));
    expect(approxEqual(totals.vat, expectedVat), 'VAT total').toBe(true);
    // 4) total = untaxed + VAT
    expect(approxEqual(totals.total, totals.untaxed + totals.vat), 'Total').toBe(true);
  });

  test('a line below the minimum margin needs approval and hides Confirm @e2e', async ({ page }) => {
    test.setTimeout(400_000);
    const app = new SalesAppPage(page);
    const form = new QuotationFormPage(page);

    await app.open();
    await app.switchCompany(D.company);
    const minMargin = await app.readMinimumSalesMargin();
    test.skip(minMargin === null, 'Minimum Sales Margin is not available in Sales settings');
    const cost1 = await app.readProductCost(D.product1);
    const cost2 = await app.readProductCost(D.product2);
    test.skip(cost1 === null || cost2 === null, 'Product cost is not readable for this user');

    await startNewQuotation(app, form, page);
    await form.fillQuotation({
      customer: D.customer, quotationType: D.quotationType, salesTeam: D.salesTeam, warehouse: D.warehouse,
      lines: [
        { product: D.product1, quantity: 1, discount: 0 },
        { product: D.product2, quantity: 1, discount: 0, unitPrice: BELOW_COST_UNIT_PRICE },
      ],
    });
    await form.saveOrThrow();
    await form.openTab(/order\s*lines/i);

    const costs = [cost1!, cost2!];
    const margins: number[] = [];
    for (let i = 0; i < 2; i++) {
      const l = await form.readLine(i);
      margins.push(marginPct(lineNet(1, l.unitPrice, l.discountPct), costs[i]));
    }
    const anyBelow = margins.some((m) => m < minMargin!);

    await form.scrollToTop();
    const confirmVisible = await form.isButtonVisible(/^confirm$/i, 8_000);
    const approvalVisible = await form.isButtonVisible(/request.*insufficient.*margin.*approval/i, 8_000);

    if (anyBelow) {
      expect(approvalVisible, 'Request Insufficient Margin Approval should be visible').toBe(true);
      expect(confirmVisible, 'Confirm should be hidden').toBe(false);
    } else {
      expect(confirmVisible, 'Confirm should be visible').toBe(true);
      expect(approvalVisible, 'Request Insufficient Margin Approval should be hidden').toBe(false);
    }
  });

  test('an over-limit sale asks for credit-limit approval and blocks Confirm while pending @e2e', async ({ page }) => {
    test.setTimeout(400_000);
    const form = await requestOverLimitApproval(page);
    expect(await form.isButtonVisible(/^confirm$/i, 3_000), 'Confirm must stay hidden while approval is pending').toBe(false);

    // The request must be recorded as pending: waiting on an approver, or actionable by this user.
    const tooltip = await form.buttonTooltip(/approve.*credit/i);
    const assignee = await form.pendingActivityAssignee();
    expect(
      /waiting for approval/i.test(tooltip) || assignee !== '' || (await form.isButtonVisible(/approve.*credit/i)),
      'the request should leave an approval pending',
    ).toBe(true);
  });

  test('once the credit limit is approved the order can be confirmed @e2e', async ({ page }) => {
    test.setTimeout(400_000);
    const form = await requestOverLimitApproval(page);
    const approve = form.headerButton(/approve.*credit/i);
    const waiting = /waiting for approval/i.test(await form.buttonTooltip(/approve.*credit/i));
    const assignee = await form.pendingActivityAssignee();

    if (waiting) {
      // The signed-in user is not the approver: approve as the approver when a login is provided.
      test.skip(
        !(APPROVER_LOGIN.email && APPROVER_LOGIN.password),
        `Approval is assigned to ${assignee || 'another user'}; set ODOO_APPROVER_EMAIL and ODOO_APPROVER_PASSWORD in .env to run approve → confirm`,
      );
      const recordUrl = form.currentUrl();
      const approverContext = await page.context().browser()!.newContext();
      try {
        const approverPage = await approverContext.newPage();
        const baseURL = process.env.ODOO_BASE_URL ?? 'http://localhost:8069';
        await approverPage.goto(`${baseURL}/web/login`);
        await approverPage.locator('input[name="login"]').fill(APPROVER_LOGIN.email);
        await approverPage.locator('input[name="password"]').fill(APPROVER_LOGIN.password);
        await approverPage.getByRole('button', { name: 'Log in' }).click();
        await expect(approverPage.locator('.o_home_menu, .o_main_navbar').first()).toBeVisible({ timeout: 120_000 });
        await approverPage.goto(recordUrl);
        await expect(approverPage.locator('.o_form_view')).toBeVisible({ timeout: 60_000 });
        const approverButton = approverPage.getByRole('button', { name: /approve.*credit/i }).first();
        await approverButton.click({ timeout: 30_000 });
        await expect(approverButton).toBeHidden({ timeout: 30_000 });
      } finally {
        await approverContext.close();
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
    } else {
      // The signed-in user is the approver: approve directly.
      await approve.click();
      await expect(approve).toBeHidden({ timeout: 30_000 });
    }

    await expect(form.headerButton(/^confirm$/i)).toBeVisible({ timeout: 30_000 });
    await form.headerButton(/^confirm$/i).click();
    expect(await form.isStatus(/sales order/i), 'status should become Sales Order').toBe(true);
  });
});
