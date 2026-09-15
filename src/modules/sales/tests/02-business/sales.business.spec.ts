/**
 * Step 2 — Business Logic for the sales module.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';
import { CustomerFormPage } from '../../pages/CustomerPage';
import { SalesOrderFormPage } from '../../pages/SalesOrderPage';

test.describe('Sales Business Logic @module:sales @step:business', () => {
  test('create a customer and a sales order with one available product @smoke', async ({ page }) => {
    const customerName = uniqueName('Customer');

    const customerForm = new CustomerFormPage(page);
    await customerForm.navigate();
    await customerForm.createCustomer(customerName);
    await expect(page.locator('.o_form_view')).toBeVisible();

    const orderForm = new SalesOrderFormPage(page);
    await orderForm.navigate();
    await orderForm.customer.setValue(customerName);
    await orderForm.setPaymentType('Cash');
    await orderForm.setQuotationType('Sales');
    await orderForm.addFirstAvailableProduct();
    await orderForm.save();

    const reference = await orderForm.getOrderReference();
    expect(reference).not.toBe('New');

    expect(await orderForm.customer.getValue()).toBe(customerName);
    await expect(page.locator('.o_data_row').first()).toBeVisible({ timeout: 15_000 });
  });
});
