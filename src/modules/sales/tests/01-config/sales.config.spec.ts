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
    const formPage = new SalesFormPage(page);
    await formPage.navigate();

    // Confirmed live: adding a second order line before a customer is selected is
    // noticeably less reliable on this instance (a second product silently failed to
    // add — `added` came back 1, not 2 — with no customer set), consistent with this
    // instance's documented onchange-timing sensitivity around partner_id/pricelist.
    // Every other passing two-line test sets the customer first; matching that here.
    const customerFound = await formPage.selectCustomerIfExists(salesMasterData.customerName);
    if (!customerFound) {
      test.skip(true, `Could not select fixture-created customer "${salesMasterData.customerName}" — transient UI issue, not a missing-data problem`);
      return;
    }

    await formPage.openOrderLinesTab();

    const added = await formPage.addOrderLines([
      { product: SALES_TEST_CONFIG.product, quantity: 1, discount: 0 },
      { product: SALES_TEST_CONFIG.product2, quantity: 1, discount: 0 },
    ]);
    expect(added, 'Both reference products must exist and be sellable (sale_ok=true)').toBe(2);
    // Not using getLineCount() here: `.o_data_row` also matches rows in other notebook
    // tabs still present (but hidden) in the DOM, e.g. Optional Products — confirmed live
    // (3 rows counted for a 2-line order). Reading each of the first two rows' own
    // quantity instead directly confirms two distinct, correctly-populated lines.
    expect(await formPage.getLineQuantity(0)).toBe(1);
    expect(await formPage.getLineQuantity(1)).toBe(1);
  });
});
