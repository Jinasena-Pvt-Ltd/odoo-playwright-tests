/**
 * Step 1 — Configuration Setup for the sales module.
 * Covers: Sales app access, company selection, quotation list/form, and the margin setting.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { SalesAppPage, QuotationListPage, QuotationFormPage } from '../../pages/SalesPage';
import { SALES_MASTER_DATA } from '../../data/sales.master-data';

test.describe('Sales Configuration Setup @module:sales @step:config', () => {
  test('opens the Sales app with its Orders menu @smoke', async ({ page }) => {
    const app = new SalesAppPage(page);
    await app.open();
    await expect(page.locator('.o_menu_sections').getByText('Orders').first()).toBeVisible();
  });

  test('switches to the sales company @smoke', async ({ page }) => {
    const app = new SalesAppPage(page);
    await app.open();
    const result = await app.switchCompany(SALES_MASTER_DATA.company);
    test.skip(result === 'unavailable', 'No company switcher: this user has access to a single company');
    await expect(page.locator('.o_switch_company_menu')).toContainText(SALES_MASTER_DATA.company.split(' ')[0]);
  });

  test('lists quotations or shows the empty state', async ({ page }) => {
    const app = new SalesAppPage(page);
    await app.open();
    await app.switchCompany(SALES_MASTER_DATA.company);
    await app.goToQuotations();
    await expect(
      page.locator('.o_list_view .o_data_row, .o_view_nocontent, .o_nocontent_help').first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('opens a blank quotation form with an empty, editable customer @smoke', async ({ page }) => {
    const app = new SalesAppPage(page);
    await app.open();
    await app.switchCompany(SALES_MASTER_DATA.company);
    await app.goToQuotations();
    await new QuotationListPage(page).clickNewQuotation();

    const form = new QuotationFormPage(page);
    await form.waitForNewForm();
    expect(await form.customerValue()).toBe('');
  });

  test('has a Minimum Sales Margin configured in Sales settings', async ({ page }) => {
    const app = new SalesAppPage(page);
    await app.open();
    await app.switchCompany(SALES_MASTER_DATA.company);
    const margin = await app.readMinimumSalesMargin();
    test.skip(margin === null, 'Minimum Sales Margin field is not shown in Sales settings for this configuration');
    expect(margin!).toBeGreaterThan(0);
  });
});
