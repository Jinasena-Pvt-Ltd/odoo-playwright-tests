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
    await listPage.searchFor(customerName);

    const visibleActive = await page.locator('.o_data_row').filter({ hasText: customerName })
      .isVisible({ timeout: 3_000 }).catch(() => false);
    expect(visibleActive).toBe(false);

    await listPage.applyFilter('Archived');
    await listPage.expectRecordExists(customerName);
  });
});
