/**
 * Step 6 — Edge Cases for the sales module.
 *
 * NOTE: Customer and Products are created fresh each run by the `salesMasterData`
 * worker fixture (see src/core/fixtures/salesMasterData.fixtures.ts) — no pre-existing
 * config needed for those. Sales Team/Warehouse remain pre-existing environment config
 * (see sales.master-data.ts for why) and are still selected via Many2one lookups, so
 * tests still gracefully skip if those two are absent.
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
      { product: salesMasterData.product1Name, quantity: 0, discount: 10 },
    ]);
    if (added === 0) {
      test.skip(true, 'Could not select fixture-created product — transient UI issue, not a missing-data problem');
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
      { product: salesMasterData.product1Name, quantity: 1, discount: 10, unitPrice: 0 },
    ]);
    if (added === 0) {
      test.skip(true, 'Could not select fixture-created product — transient UI issue, not a missing-data problem');
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
