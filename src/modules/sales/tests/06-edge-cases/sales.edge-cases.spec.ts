/**
 * Step 6 — Edge Cases for the sales module.
 *
 * NOTE: Customer/Product/Sales Team/Warehouse names below are pre-existing
 * environment master data (see sales.master-data.ts) — they are selected via
 * Many2one lookups, not created by these tests, so uniqueName() does not apply
 * to them. Every test gracefully skips when that reference data is absent.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { SalesFormPage } from '../../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../../data/sales.master-data';

test.describe('Sales Edge Cases @module:sales @step:edge', () => {
  test('blocks confirmation when an order line has zero quantity', async ({ page }) => {
    const formPage = new SalesFormPage(page);
    await formPage.navigate();

    const customerFound = await formPage.selectCustomerIfExists(SALES_TEST_CONFIG.customer);
    if (!customerFound) {
      test.skip(true, `Reference customer "${SALES_TEST_CONFIG.customer}" not found in this Odoo environment`);
      return;
    }
    await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
    const otherInfoOk = await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
    if (!otherInfoOk) {
      test.skip(true, 'Reference Sales Team/Warehouse not found in this Odoo environment');
      return;
    }

    const added = await formPage.addOrderLines([
      { product: SALES_TEST_CONFIG.product1, quantity: 0, discount: 10 },
    ]);
    if (added === 0) {
      test.skip(true, 'Reference product not found in this Odoo environment');
      return;
    }

    await formPage.save();

    if (await formPage.isConfirmVisible()) {
      await formPage.clickStatusButtonByRole(/^confirm$/i);
    }

    const status = await formPage.getCurrentStatus();
    expect(status.toLowerCase()).not.toContain('sales order');
  });

  test('blocks confirmation when an order line has zero unit price', async ({ page }) => {
    const formPage = new SalesFormPage(page);
    await formPage.navigate();

    const customerFound = await formPage.selectCustomerIfExists(SALES_TEST_CONFIG.customer);
    if (!customerFound) {
      test.skip(true, `Reference customer "${SALES_TEST_CONFIG.customer}" not found in this Odoo environment`);
      return;
    }
    await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
    const otherInfoOk = await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
    if (!otherInfoOk) {
      test.skip(true, 'Reference Sales Team/Warehouse not found in this Odoo environment');
      return;
    }

    const added = await formPage.addOrderLines([
      { product: SALES_TEST_CONFIG.product1, quantity: 1, discount: 10, unitPrice: 0 },
    ]);
    if (added === 0) {
      test.skip(true, 'Reference product not found in this Odoo environment');
      return;
    }

    await formPage.save();

    if (await formPage.isConfirmVisible()) {
      await formPage.clickStatusButtonByRole(/^confirm$/i);
    }

    const status = await formPage.getCurrentStatus();
    expect(status.toLowerCase()).not.toContain('sales order');
  });
});
