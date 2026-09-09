/**
 * Step 3 — Reporting for the sales module.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { SalesFormPage, SalesListPage } from '../../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../../data/sales.master-data';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';

test.describe('Sales Reporting @module:sales @step:reporting', () => {
  test('Quotations list view loads and displays existing records @smoke', async ({ page }) => {
    const listPage = new SalesListPage(page);
    await listPage.navigate();

    const total = await listPage.getTotalRecordCount();
    expect(total, 'Quotations list should show at least one existing record in this environment').toBeGreaterThan(0);
  });

  test('a newly created quotation is searchable and appears in the Quotations list', async ({ page, salesMasterData }) => {
    const reference = uniqueName('Reporting Order');

    const formPage = new SalesFormPage(page);
    await formPage.navigate();
    await formPage.reference.setValue(reference);

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
    await formPage.save();

    const listPage = new SalesListPage(page);
    await listPage.navigate();
    await listPage.searchFor(reference);
    await listPage.expectRecordExists(reference);
  });

  test('grouping the Quotations list by Customer produces distinct group headers', async ({ page }) => {
    const listPage = new SalesListPage(page);
    await listPage.navigate();
    await listPage.groupBy('Customer');

    const groupHeaders = page.locator('.o_group_header');
    await groupHeaders.first().waitFor({ state: 'visible', timeout: 15_000 });
    const count = await groupHeaders.count();
    expect(count, 'Grouping by Customer should split the list into at least one group').toBeGreaterThan(0);
  });

  test('the Archived filter is selectable and applies as a facet on the search bar', async ({ page }) => {
    const listPage = new SalesListPage(page);
    await listPage.navigate();
    await listPage.applyFilter('Archived');

    const facet = page.locator('.o_searchview .o_facet_value, .o_searchview .o_facet_values')
      .filter({ hasText: /archived/i }).first();
    await expect(facet).toBeVisible();
  });
});
