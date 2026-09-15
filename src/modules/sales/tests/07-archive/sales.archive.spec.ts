/**
 * Step 7 — Archive & Cleanup for the sales module.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';
import { CustomerFormPage, CustomerListPage } from '../../pages/CustomerPage';

test.describe('Sales Archive & Cleanup @module:sales @step:archive', () => {
  test('an archived customer disappears from the default list and reappears under Archived @smoke', async ({ page }) => {
    const customerName = uniqueName('Customer');
    const customerForm = new CustomerFormPage(page);
    await customerForm.navigate();
    await customerForm.createCustomer(customerName);

    await customerForm.archiveRecord();

    const listPage = new CustomerListPage(page);
    await listPage.navigate();
    // Contacts opens in Kanban by default — switch to List so BaseListPage's
    // .o_list_table-based helpers (searchFor/expectRecordExists) have something to match.
    await page.locator('.o_switch_view.o_list, button[data-tooltip="List"]').first().click();
    await page.waitForSelector('.o_list_view', { state: 'visible', timeout: 10_000 });
    await listPage.searchFor(customerName);

    const visibleActive = await page.locator('.o_data_row').filter({ hasText: customerName })
      .isVisible({ timeout: 3_000 }).catch(() => false);
    expect(visibleActive).toBe(false);

    // Apply the Archived filter before re-searching: with the "Name" facet chip already
    // on the search bar, the search bar's dropdown arrow opens that facet's own "Modify
    // Condition" editor instead of the global Filters/Group By menu applyFilter() expects.
    await listPage.clearSearch();
    await listPage.applyFilter('Archived');
    await listPage.searchFor(customerName);
    await listPage.expectRecordExists(customerName);
  });
});
