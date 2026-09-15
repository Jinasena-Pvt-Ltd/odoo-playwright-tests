/**
 * Step 5 — Field Validations for the sales module.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { SalesOrderFormPage } from '../../pages/SalesOrderPage';

test.describe('Sales Field Validations @module:sales @step:validations', () => {
  test('saving without the required payment/quotation type shows an invalid-fields error @smoke', async ({ page }) => {
    const orderForm = new SalesOrderFormPage(page);
    await orderForm.navigate();
    // Intentionally leave x_studio_order_payment_method and x_studio_quotation_type unset.

    const saveBtn = page.locator('.o_form_button_save, button[name="save_manually"]').first();
    await saveBtn.click();

    await orderForm.expectErrorToast();
    const toastText = await orderForm.getToastMessage();
    expect(toastText).toContain('Invalid fields');
  });

  test('saving without a customer keeps the required-field marker on partner_id', async ({ page }) => {
    const orderForm = new SalesOrderFormPage(page);
    await orderForm.navigate();
    await orderForm.paymentType.selectByLabel('Cash');
    await orderForm.quotationType.selectByLabel('Sales');
    // No customer set.

    const saveBtn = page.locator('.o_form_button_save, button[name="save_manually"]').first();
    await saveBtn.click();

    const error = await orderForm.getFieldError('partner_id');
    expect(error.length).toBeGreaterThan(0);
  });
});
