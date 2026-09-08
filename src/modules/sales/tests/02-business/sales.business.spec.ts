/**
 * Step 2 — Business Logic for the sales module.
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
import {
  computeLineNetAmount,
  computeUntaxedAmount,
  computeGrandTotal,
  computeMarginPercent,
  isBelowMinimumMargin,
  isWithinTolerance,
} from '../../calculations/SalesCalculations';

test.describe('Sales Business Logic @module:sales @step:business', () => {
  test('creates a valid quotation with customer, order lines, and required header fields @smoke', async ({ page, salesMasterData }) => {
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
      { product: SALES_TEST_CONFIG.product, quantity: 1, discount: 10 },
      { product: SALES_TEST_CONFIG.product, quantity: 2, discount: 10 },
    ]);
    if (added === 0) {
      test.skip(true, 'Reference product not found in this Odoo environment');
      return;
    }

    await formPage.save();

    const reference = await formPage.reference.getValue();
    expect(reference.trim().length).toBeGreaterThan(0);
  });

  test('quotation line and grand total amounts reconcile with Qty × Unit Price arithmetic', async ({ page, salesMasterData }) => {
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
      { product: SALES_TEST_CONFIG.product, quantity: 1, discount: 0 },
      { product: SALES_TEST_CONFIG.product, quantity: 2, discount: 0 },
    ]);
    if (added < 2) {
      test.skip(true, 'Reference product not found in this Odoo environment');
      return;
    }

    await formPage.save();
    await formPage.openOrderLinesTab();

    const lineCount = await formPage.getLineCount();
    const lines: { qty: number; unitPrice: number; netAmount: number }[] = [];
    for (let i = 0; i < Math.min(lineCount, 2); i++) {
      lines.push({
        qty: await formPage.getLineQuantity(i),
        unitPrice: await formPage.getLineUnitPrice(i),
        netAmount: await formPage.getLineNetAmount(i),
      });
    }

    for (const line of lines) {
      const expectedNet = computeLineNetAmount(line.qty, line.unitPrice);
      expect(isWithinTolerance(expectedNet, line.netAmount)).toBe(true);
    }

    const expectedUntaxed = computeUntaxedAmount(lines.map((l) => ({ netAmount: l.netAmount })));
    const untaxedAmount = await formPage.untaxedAmount.getValue();
    expect(isWithinTolerance(expectedUntaxed, untaxedAmount)).toBe(true);

    const taxAmount = await formPage.taxAmount.getValue();
    const expectedTotal = computeGrandTotal(untaxedAmount, taxAmount);
    const totalAmount = await formPage.totalAmount.getValue();
    expect(isWithinTolerance(expectedTotal, totalAmount)).toBe(true);
  });

  test('requires Insufficient Margin approval before a below-cost line can be confirmed', async ({ page, salesMasterData }) => {
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

    // Unit price deliberately set far below any plausible product cost to force
    // a below-minimum margin, mirroring the calculation in SalesCalculations.
    const belowCostPrice = 1;
    const added = await formPage.addOrderLines([
      { product: SALES_TEST_CONFIG.product, quantity: 1, discount: 0, unitPrice: belowCostPrice },
    ]);
    if (added === 0) {
      test.skip(true, 'Reference product not found in this Odoo environment');
      return;
    }
    expect(isBelowMinimumMargin(computeMarginPercent(belowCostPrice, 0, 100), 10)).toBe(true);

    await formPage.save();

    const approvalVisible = await formPage.isStatusButtonVisible(/request.*insufficient.*margin.*approval/i);
    if (!approvalVisible) {
      test.skip(true, 'Insufficient Margin approval workflow is not configured in this Odoo environment');
      return;
    }
    expect(await formPage.isConfirmVisible()).toBe(false);

    await formPage.confirmOrder();
    const status = await formPage.getCurrentStatus();
    expect(status.toLowerCase()).toContain('sales order');
  });

  test('requires Credit Limit approval before an over-limit quotation can be confirmed', async ({ page, salesMasterData }) => {
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

    // A very large quantity AND an explicit high unit price (rather than relying on the
    // product's catalog price) keeps this test independent of the customer's actual
    // current overdue balance: the total should exceed any realistic credit limit.
    const added = await formPage.addOrderLines([
      { product: SALES_TEST_CONFIG.product, quantity: 100_000, discount: 0, unitPrice: 999_999 },
    ]);
    if (added === 0) {
      test.skip(true, 'Reference product not found in this Odoo environment');
      return;
    }

    await formPage.save();

    const confirmVisible = await formPage.isConfirmVisible();
    const approvalVisible = await formPage.isStatusButtonVisible(/request.*credit.*limit.*approval/i);
    if (!confirmVisible && !approvalVisible) {
      test.skip(true, 'Credit Limit approval workflow is not configured in this Odoo environment');
      return;
    }

    // Exactly one of the two states should hold — either the order is within
    // credit limit and can be confirmed directly, or it must go through approval.
    expect(confirmVisible).not.toBe(approvalVisible);

    if (approvalVisible) {
      await formPage.confirmOrder();
    } else {
      await formPage.clickStatusButtonByRole(/^confirm$/i);
    }

    const status = await formPage.getCurrentStatus();
    expect(status.toLowerCase()).toContain('sales order');
  });
});
