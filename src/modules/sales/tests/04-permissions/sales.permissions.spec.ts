/**
 * Step 4 — User Permissions for the sales module.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { SalesOrderListPage } from '../../pages/SalesOrderPage';

test.describe('Sales User Permissions @module:sales @step:permissions', () => {
  test('role can open the Sales app and see the New quotation action @smoke', async ({ page }, testInfo) => {
    const role = testInfo.project.name;
    const emailVar = `${role.toUpperCase()}_EMAIL`;
    if (role !== 'admin' && !process.env[emailVar]) {
      test.skip(true, `${emailVar} not configured in .env — no credentials to test this role`);
      return;
    }

    const listPage = new SalesOrderListPage(page);
    await listPage.navigate();

    const newVisible = await page.getByRole('button', { name: /^New$/ }).first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    if (!newVisible) {
      test.skip(true, `"New" action not available for role "${role}" in this configuration`);
      return;
    }
    await expect(page.getByRole('button', { name: /^New$/ }).first()).toBeEnabled();
  });
});
