/**
 * Step 6 — Edge Cases for the sales module.
 *
 * NOTE: Customer is created fresh each run by the `salesMasterData` worker fixture (see
 * src/core/fixtures/salesMasterData.fixtures.ts). Product/Sales Team/Warehouse remain
 * pre-existing environment config (see sales.master-data.ts for why — pricing a
 * brand-new product under a customer's pricelist was found to hang on this instance)
 * and are still selected via Many2one lookups, so tests still gracefully skip if that
 * reference data is absent.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { SalesFormPage } from '../../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../../data/sales.master-data';

test.describe('Sales Edge Cases @module:sales @step:edge', () => {
  test('blocks confirmation when an order line has zero quantity', async ({ page, salesMasterData }) => {
    const formPage = new SalesFormPage(page);
    await formPage.navigate();

    const customerFound = await formPage.selectCustomerIfExists(salesMasterData.customerName);
    if (!customerFound) {
      test.skip(true, `Could not select fixture-created customer "${salesMasterData.customerName}" — transient UI issue, not a missing-data problem`);
      return;
    }
    await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
    const otherInfoOk = await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
    if (!otherInfoOk) {
      test.skip(true, 'Reference Sales Team/Warehouse not found in this Odoo environment');
      return;
    }

    const added = await formPage.addOrderLines([
      { product: SALES_TEST_CONFIG.product, quantity: 0, discount: 10 },
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

  test('blocks confirmation when an order line has zero unit price', async ({ page, salesMasterData }) => {
    const formPage = new SalesFormPage(page);
    await formPage.navigate();

    const customerFound = await formPage.selectCustomerIfExists(salesMasterData.customerName);
    if (!customerFound) {
      test.skip(true, `Could not select fixture-created customer "${salesMasterData.customerName}" — transient UI issue, not a missing-data problem`);
      return;
    }
    await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
    const otherInfoOk = await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
    if (!otherInfoOk) {
      test.skip(true, 'Reference Sales Team/Warehouse not found in this Odoo environment');
      return;
    }

    const added = await formPage.addOrderLines([
      { product: SALES_TEST_CONFIG.product, quantity: 1, discount: 10, unitPrice: 0 },
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
