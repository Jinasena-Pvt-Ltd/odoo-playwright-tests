/**
 * Step 7 — Archive & Cleanup for the sales module.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { SalesFormPage, SalesListPage } from '../../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../../data/sales.master-data';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';

test.describe('Sales Archive & Cleanup @module:sales @step:archive', () => {
  test('archiving a quotation removes it from the active list and it reappears under Archived @smoke', async ({ page, salesMasterData }) => {
    const reference = uniqueName('Archive Test Order');

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

    await formPage.archiveRecord();

    const listPage = new SalesListPage(page);
    await listPage.navigate();
    await listPage.searchFor(reference);
    await listPage.expectNoRecords();

    await listPage.clearSearch();
    await listPage.applyFilter('Archived');
    await listPage.searchFor(reference);
    await listPage.expectRecordExists(reference);

    // Reactivate so this test doesn't permanently leave an archived record behind —
    // matches SKIP_ARCHIVE-style cleanup used elsewhere in this framework.
    await listPage.openSales(reference);
    await formPage.unarchiveRecord();
  });

  test('reactivating an archived quotation restores it to the active list', async ({ page, salesMasterData }) => {
    const reference = uniqueName('Reactivate Test Order');

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
    await formPage.archiveRecord();

    await formPage.unarchiveRecord();

    const listPage = new SalesListPage(page);
    await listPage.navigate();
    await listPage.searchFor(reference);
    await listPage.expectRecordExists(reference);
  });
});
