/**
 * Step 3 — Reporting for the sales module.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';
import { CustomerFormPage } from '../../pages/CustomerPage';
import { SalesOrderFormPage, SalesOrderListPage } from '../../pages/SalesOrderPage';

test.describe('Sales Reporting @module:sales @step:reporting', () => {
  test('a saved quotation is visible and searchable in the Orders list @smoke', async ({ page }) => {
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
    await orderForm.save();

    const reference = await orderForm.getOrderReference();

    const listPage = new SalesOrderListPage(page);
    await listPage.navigate();
    await listPage.searchFor(reference);
    await listPage.expectRecordExists(reference);
  });

  test('the Orders list view exposes the standard view switcher', async ({ page }) => {
    const listPage = new SalesOrderListPage(page);
    await listPage.navigate();
    await expect(page.locator('.o_list_view, .o_kanban_view')).toBeVisible();
  });
});
