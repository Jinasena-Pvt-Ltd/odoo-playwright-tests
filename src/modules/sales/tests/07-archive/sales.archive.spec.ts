/**
 * Step 7 — Archive & Cleanup for the sales module.
 *
 * NOTE: confirmed live that this environment's Sale Order cog Action menu offers no
 * "Archive"/"Unarchive" item at all (its full contents are Print/Delete/Generate a
 * Payment Link/Send an SMS/Share/subscription actions), and the list view's bulk
 * Action menu (after selecting a row) offers only print report templates. This traces
 * to sale.order having no `active` field on this instance (confirmed via a live
 * fields_get() call) — Odoo only offers Archive/Unarchive for models that have one.
 * That's a live production schema gap, not something a test can work around, and
 * fixing it means a real Odoo Studio schema change outside this suite's scope.
 *
 * These tests instead verify the record-lifecycle operations this instance DOES
 * support — Delete and "Mark Quotation as Sent" (a genuine state-transition action,
 * both confirmed present in the cog menu; "Duplicate" was also tried and is NOT
 * present here despite existing as a generic BaseFormPage method) — so this step still
 * exercises real cleanup/lifecycle behavior instead of skipping outright.
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
  test('a draft quotation can be deleted via the Action menu @smoke', async ({ page, salesMasterData }) => {
    const formPage = new SalesFormPage(page);
    const created = await createSavedQuotation(page, formPage, salesMasterData.customerName);
    if (!created) {
      test.skip(true, 'Could not create the prerequisite quotation (customer or Sales Team/Warehouse selection failed)');
      return;
    }
    const { reference } = created;

    await formPage.clickActionMenuItem('Delete');
    await formPage.confirmDialog();

    const listPage = new SalesListPage(page);
    await listPage.navigate();
    await listPage.searchFor(reference);
    await listPage.expectNoRecords();
  });

  test('marking a quotation as sent transitions its status', async ({ page, salesMasterData }) => {
    const formPage = new SalesFormPage(page);
    const created = await createSavedQuotation(page, formPage, salesMasterData.customerName);
    if (!created) {
      test.skip(true, 'Could not create the prerequisite quotation (customer or Sales Team/Warehouse selection failed)');
      return;
    }

    expect((await formPage.getCurrentStatus()).toLowerCase()).toBe('quotation');

    await formPage.clickActionMenuItem('Mark Quotation as Sent');
    await formPage.waitForStatus('Quotation Sent');

    // Clean up — delete rather than leave a stray "Quotation Sent" record behind.
    await formPage.clickActionMenuItem('Delete');
    await formPage.confirmDialog();
  });
});
