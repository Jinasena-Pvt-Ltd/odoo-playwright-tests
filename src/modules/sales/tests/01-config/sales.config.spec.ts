/**
 * Step 1 — Configuration Setup for the sales module.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { SalesOrderFormPage } from '../../pages/SalesOrderPage';

test.describe('Sales Configuration Setup @module:sales @step:config', () => {
  test('quotation form exposes the required payment/quotation type selections @smoke', async ({ page }) => {
    const orderForm = new SalesOrderFormPage(page);
    await orderForm.navigate();

    // These are Studio-added required fields on this instance's sale.order form.
    // If someone removes them from the view, every downstream business test breaks —
    // catch that here instead of deep in a business-flow failure.
    await expect(page.locator('.o_field_widget[name="x_studio_order_payment_method"] select')).toBeVisible();
    await expect(page.locator('.o_field_widget[name="x_studio_quotation_type"] select')).toBeVisible();

    const paymentOptions = await page
      .locator('.o_field_widget[name="x_studio_order_payment_method"] select option')
      .allTextContents();
    expect(paymentOptions.map((o) => o.trim())).toEqual(expect.arrayContaining(['Cash', 'Credit']));

    const quotationOptions = await page
      .locator('.o_field_widget[name="x_studio_quotation_type"] select option')
      .allTextContents();
    expect(quotationOptions.map((o) => o.trim())).toEqual(expect.arrayContaining(['Sales', 'Project', 'Repair']));
  });

  test('at least one sellable product is available for order lines', async ({ page }) => {
    const orderForm = new SalesOrderFormPage(page);
    await orderForm.navigate();

    const addProductLink = page.locator('.o_field_x2many_list_row_add a').filter({ hasText: 'Add a product' }).first();
    await addProductLink.click();

    const productInput = page.locator('.o_field_widget[name="product_id"] input').last();
    await productInput.click();

    const dropdown = page.locator('.o-dropdown--menu, .ui-autocomplete').first();
    await dropdown.waitFor({ state: 'visible', timeout: 8_000 });
    const optionCount = await page
      .locator('.o-dropdown--menu .o_menu_item, .ui-autocomplete .ui-menu-item')
      .count();
    expect(optionCount).toBeGreaterThan(0);
  });
});
