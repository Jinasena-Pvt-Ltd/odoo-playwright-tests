/**
 * Step 6 — Edge Cases for the sales module.
 * Boundary quantities and prices: a quotation with a zero quantity or a zero unit price must not be confirmable.
 *
 * If Odoo wrongly offers Confirm, the test clicks it to prove the failure; that would turn a test
 * quotation into a confirmed Sales Order on the live instance.
 */
import { Page } from '@playwright/test';
import { test, expect } from '../../../../core/fixtures/index';
import { SalesAppPage, QuotationListPage, QuotationFormPage, QuotationLine } from '../../pages/SalesPage';
import { SALES_MASTER_DATA } from '../../data/sales.master-data';

const D = SALES_MASTER_DATA;

/** Creates and saves a quotation with the given lines, then checks that it cannot be confirmed. */
async function expectConfirmBlocked(page: Page, lines: QuotationLine[]): Promise<void> {
  const app = new SalesAppPage(page);
  const form = new QuotationFormPage(page);

  await app.open();
  await app.switchCompany(D.company);
  await app.goToQuotations();
  await new QuotationListPage(page).clickNewQuotation();
  await form.waitForNewForm();
  await form.fillQuotation({
    customer: D.customer, quotationType: D.quotationType, salesTeam: D.salesTeam, warehouse: D.warehouse, lines,
  });
  await form.saveOrThrow();
  await form.scrollToTop();

  const confirmVisible = await form.isButtonVisible(/^confirm$/i, 5_000);
  if (!confirmVisible) return; // Odoo removed the Confirm button: blocked

  // Confirm is offered: it must not actually turn the quotation into a Sales Order.
  await form.headerButton(/^confirm$/i).click();
  expect(await form.isStatus(/sales order/i), 'Odoo confirmed a quotation that should have been blocked').toBe(false);
}

test.describe('Sales Edge Cases @module:sales @step:edge', () => {
  test('a zero-quantity order line cannot be confirmed (step 06.00)', async ({ page }) => {
    test.setTimeout(240_000);
    await expectConfirmBlocked(page, [{ product: D.product1, quantity: 0, discount: 10 }]);
  });

  test('a zero-unit-price order line cannot be confirmed (step 06.01)', async ({ page }) => {
    test.setTimeout(240_000);
    await expectConfirmBlocked(page, [
      { product: D.product1, quantity: 1, discount: 10 },
      { product: D.product1, quantity: 1, discount: 10, unitPrice: 0 },
    ]);
  });
});
