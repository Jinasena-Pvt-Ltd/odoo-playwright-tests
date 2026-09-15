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

    // This instance's toast for a failed save doesn't carry the danger/error CSS class
    // that expectErrorToast() filters on, so read the generic notification directly.
    // getToastMessage() only reads the body (.o_notification_content), which lists the
    // invalid field labels run together without the "Invalid fields:" title text.
    const toastText = await orderForm.getToastMessage();
    expect(toastText).toContain('Order Payment Type');
    expect(toastText).toContain('Quotation Type');
  });

  test('saving without a customer keeps the required-field marker on partner_id', async ({ page }) => {
    const orderForm = new SalesOrderFormPage(page);
    await orderForm.navigate();
    await orderForm.setPaymentType('Cash');
    await orderForm.setQuotationType('Sales');
    // No customer set.

    const saveBtn = page.locator('.o_form_button_save, button[name="save_manually"]').first();
    await saveBtn.click();

    const error = await orderForm.getFieldError('partner_id');
    expect(error.length).toBeGreaterThan(0);
  });
});
