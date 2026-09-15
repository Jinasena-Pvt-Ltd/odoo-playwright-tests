/**
 * Step 3 — Reporting for the sales module.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { SalesOrderFormPage } from '../../pages/SalesOrderPage';

test.describe('Sales Reporting @module:sales @step:reporting', () => {
  test('placeholder — replace with real test @smoke', async ({ page }) => {
    const formPage = new SalesOrderFormPage(page);
    await formPage.navigate();
    test.skip(true, 'Not yet implemented');
  });
});
