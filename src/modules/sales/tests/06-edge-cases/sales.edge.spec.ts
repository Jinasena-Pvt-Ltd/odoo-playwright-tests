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
    await orderForm.setPaymentType('Cash');
    await orderForm.setQuotationType('Sales');
    const unitPrice = await orderForm.addFirstAvailableProduct(0.5);

    // Check the row's read-only subtotal rather than the quantity input's own value —
    // whether that cell is still in edit mode (showing an <input>) or already blurred
    // back to plain text varies run to run, so its raw value isn't a stable thing to
    // assert on. The recalculated subtotal reflects the fractional quantity either way.
    const subtotalText = await page.locator('.o_field_widget[name="price_subtotal"]').last().textContent();
    const subtotal = parseFloat((subtotalText ?? '0').replace(/[^0-9.]/g, ''));
    expect(subtotal).toBeCloseTo(unitPrice * 0.5, 2);
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
