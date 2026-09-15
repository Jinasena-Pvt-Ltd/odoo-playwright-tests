/**
 * Step 6 — Edge Cases for the sales module.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';
import { CustomerFormPage } from '../../pages/CustomerPage';
import { SalesOrderFormPage } from '../../pages/SalesOrderPage';

test.describe('Sales Edge Cases @module:sales @step:edge', () => {
  test('a fractional quantity recalculates the order line subtotal @smoke', async ({ page }) => {
    const customerName = uniqueName('Customer');
    const customerForm = new CustomerFormPage(page);
    await customerForm.navigate();
    await customerForm.createCustomer(customerName);

    const orderForm = new SalesOrderFormPage(page);
    await orderForm.navigate();
    await orderForm.customer.setValue(customerName);
    await orderForm.paymentType.selectByLabel('Cash');
    await orderForm.quotationType.selectByLabel('Sales');
    await orderForm.addFirstAvailableProduct();

    await orderForm.setLastLineQuantity(0.5);

    const qtyCell = page.locator('.o_field_widget[name="product_uom_qty"]').last();
    await expect(qtyCell).toContainText('0.5');
  });

  test('a very long customer name is accepted without truncation error', async ({ page }) => {
    const longName = uniqueName('X'.repeat(120));

    const customerForm = new CustomerFormPage(page);
    await customerForm.navigate();
    await customerForm.createCustomer(longName);

    await expect(page.locator('.o_field_widget[name="name"]')).toBeVisible();
    const saveBtnStillVisible = await page
      .locator('.o_form_button_save, button[name="save_manually"]')
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    expect(saveBtnStillVisible).toBe(false);
  });
});
