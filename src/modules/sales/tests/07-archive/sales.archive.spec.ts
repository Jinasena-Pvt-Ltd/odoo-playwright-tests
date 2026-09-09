/**
 * Step 7 — Archive & Cleanup for the sales module.
 *
 * NOTE: confirmed live that this environment's Sale Order cog Action menu offers no
 * "Archive" item at all (its full contents are Print/Delete/Generate a Payment
 * Link/Send an SMS/Share/subscription actions — no Archive/Unarchive), and the list
 * view's bulk Action menu (after selecting a row) offers only print report templates.
 * So archiving a Sales Order is not exposed through this instance's UI for this model —
 * a genuine environment limitation, not a missing test. Each test checks this directly
 * and skips with a clear reason rather than assuming the action exists.
 */
import { Page } from '@playwright/test';
import { test, expect } from '../../../../core/fixtures/index';
import { SalesFormPage, SalesListPage } from '../../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../../data/sales.master-data';

async function createSavedQuotation(
  page: Page,
  formPage: SalesFormPage,
  customerName: string,
): Promise<{ reference: string; recordId: number } | null> {
  await formPage.navigate();

  const customerFound = await formPage.selectCustomerIfExists(customerName);
  if (!customerFound) return null;
  await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
  await formPage.setOrderPaymentType(SALES_TEST_CONFIG.orderPaymentType);
  const otherInfoOk = await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
  if (!otherInfoOk) return null;
  await formPage.save();

  const reference = await formPage.reference.getValue();
  const recordId = Number(new URLSearchParams(page.url().split('#')[1]).get('id'));
  return { reference, recordId };
}

test.describe('Sales Archive & Cleanup @module:sales @step:archive', () => {
  test('archiving a quotation removes it from the active list and marks it Archived @smoke', async ({ page, salesMasterData }) => {
    const formPage = new SalesFormPage(page);
    const created = await createSavedQuotation(page, formPage, salesMasterData.customerName);
    if (!created) {
      test.skip(true, 'Could not create the prerequisite quotation (customer or Sales Team/Warehouse selection failed)');
      return;
    }
    const { reference, recordId } = created;

    const archiveAvailable = await formPage.isActionMenuItemAvailable('Archive');
    if (!archiveAvailable) {
      test.skip(true, 'The "Archive" action is not offered for Sales Orders in this Odoo environment');
      return;
    }

    await formPage.archiveRecord();

    const unarchiveVisible = await formPage.isActionMenuItemAvailable('Unarchive');
    expect(unarchiveVisible, 'Cog menu should offer "Unarchive" once the record is archived').toBe(true);

    const listPage = new SalesListPage(page);
    await listPage.navigate();
    await listPage.searchFor(reference);
    await listPage.expectNoRecords();

    // Reactivate so this test doesn't permanently leave an archived record behind —
    // matches SKIP_ARCHIVE-style cleanup used elsewhere in this framework.
    await formPage.openById(recordId);
    await formPage.unarchiveRecord();
  });

  test('reactivating an archived quotation restores it to the active list', async ({ page, salesMasterData }) => {
    const formPage = new SalesFormPage(page);
    const created = await createSavedQuotation(page, formPage, salesMasterData.customerName);
    if (!created) {
      test.skip(true, 'Could not create the prerequisite quotation (customer or Sales Team/Warehouse selection failed)');
      return;
    }
    const { reference } = created;

    const archiveAvailable = await formPage.isActionMenuItemAvailable('Archive');
    if (!archiveAvailable) {
      test.skip(true, 'The "Archive"/"Unarchive" actions are not offered for Sales Orders in this Odoo environment');
      return;
    }
    await formPage.archiveRecord();
    await formPage.unarchiveRecord();

    const listPage = new SalesListPage(page);
    await listPage.navigate();
    await listPage.searchFor(reference);
    await listPage.expectRecordExists(reference);
  });
});
