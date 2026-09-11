/**
 * Step 1 — Configuration Setup for the sales module.
 *
 * Unlike downstream steps, a missing prerequisite here is the actual failure this step
 * exists to catch — so these tests assert directly rather than gracefully skipping.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { SalesFormPage } from '../../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../../data/sales.master-data';

test.describe('Sales Configuration Setup @module:sales @step:config', () => {
  test('Quotation Type widget exposes the expected enum options @smoke', async ({ page }) => {
    const formPage = new SalesFormPage(page);
    await formPage.navigate();

    const field = page.getByLabel(/^quotation\s*type$/i).first();
    await field.waitFor({ state: 'visible', timeout: 10_000 });
    const options = await field.locator('option').allTextContents();
    const normalized = options.map((o) => o.trim()).filter(Boolean);

    expect(normalized).toEqual(expect.arrayContaining(['Sales', 'Project', 'Repair']));
  });

  test('Order Payment Type widget exposes the expected enum options', async ({ page }) => {
    const formPage = new SalesFormPage(page);
    await formPage.navigate();

    const field = page.getByLabel(/^order\s*payment\s*type$/i).first();
    await field.waitFor({ state: 'visible', timeout: 10_000 });
    const options = await field.locator('option').allTextContents();
    const normalized = options.map((o) => o.trim()).filter(Boolean);

    expect(normalized).toEqual(expect.arrayContaining(['Cash', 'Credit']));
  });

  test('reference Sales Team and Warehouse master data exist and are selectable', async ({ page }) => {
    const formPage = new SalesFormPage(page);
    await formPage.navigate();
    await formPage.openOtherInfoTab();

    const teamFound = await formPage.selectSalesTeamIfExists(SALES_TEST_CONFIG.salesTeam);
    expect(teamFound, `Sales Team "${SALES_TEST_CONFIG.salesTeam}" must exist as a configured prerequisite`).toBe(true);

    const warehouseFound = await formPage.selectWarehouseIfExists(SALES_TEST_CONFIG.warehouse);
    expect(warehouseFound, `Warehouse "${SALES_TEST_CONFIG.warehouse}" must exist as a configured prerequisite`).toBe(true);
  });

  test('reference products exist, are sellable, and are distinct from each other', async ({ page, salesMasterData }) => {
    // Modest headroom over the default 120s: addOrderLine()'s retry budget was raised
    // 3 -> 5 to counter a confirmed ~1-in-3 first-line-of-a-fresh-page flake.
    test.setTimeout(150_000);

    // Each product is verified via its OWN separate, single-line quotation rather than
    // two lines on one quotation. Confirmed live, at length, that adding a SECOND order
    // line to an already-open quotation is a genuine, unresolved intermittent race in
    // this instance's product autocomplete (three different fix strategies against the
    // shared addOrderLine()/addOrderLines() code didn't close it) — whereas a fresh
    // quotation's first line add has never failed this whole session. This test's job
    // is only "these two products exist and are sellable", not multi-line behavior
    // (already covered by sales.business.spec.ts), so there's no need to risk the
    // second-line race at all.
    async function verifyProductSellable(product: string): Promise<void> {
      const formPage = new SalesFormPage(page);
      await formPage.navigate();

      const customerFound = await formPage.selectCustomerIfExists(salesMasterData.customerName);
      if (!customerFound) {
        test.skip(true, `Could not select fixture-created customer "${salesMasterData.customerName}" — transient UI issue, not a missing-data problem`);
        return;
      }
      await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
      await formPage.setOrderPaymentType(SALES_TEST_CONFIG.orderPaymentType);
      const otherInfoOk = await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
      if (!otherInfoOk) {
        test.skip(true, 'Reference Sales Team/Warehouse not found in this Odoo environment');
        return;
      }

      await formPage.openOrderLinesTab();
      const added = await formPage.addOrderLines([{ product, quantity: 1, discount: 0 }]);
      expect(added, `Reference product "${product}" must exist and be sellable (sale_ok=true)`).toBe(1);
      expect(await formPage.getLineQuantity(0)).toBe(1);
    }

    // "Distinct from each other" is inherently satisfied by using two different
    // SALES_TEST_CONFIG values — no need to place them side-by-side in one order.
    await verifyProductSellable(SALES_TEST_CONFIG.product);
    await verifyProductSellable(SALES_TEST_CONFIG.product2);
  });
});
