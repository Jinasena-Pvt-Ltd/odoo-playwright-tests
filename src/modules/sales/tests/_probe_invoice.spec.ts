import { test } from '../../../core/fixtures/index';
import { SalesFormPage } from '../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../data/sales.master-data';

test('probe invoice creation flow', async ({ page, salesMasterData }) => {
  const formPage = new SalesFormPage(page);
  await formPage.navigate();
  await formPage.selectCustomerIfExists(salesMasterData.customerName);
  await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
  await formPage.setOrderPaymentType(SALES_TEST_CONFIG.orderPaymentType);
  await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
  await formPage.addOrderLines([{ product: SALES_TEST_CONFIG.product, quantity: 1, discount: 0 }]);
  await formPage.save();

  console.log('--- confirming order ---');
  await formPage.confirmOrder();
  console.log('confirmed. status:', await formPage.getCurrentStatus());

  console.log('--- processing delivery ---');
  try {
    const deliveryRef = await formPage.processDelivery();
    console.log('delivery processed:', deliveryRef, 'back on SO url:', page.url());
  } catch (err) {
    console.log('processDelivery failed:', (err as Error).message.slice(0, 300));
  }

  const createInvoiceBtn = page.locator('.o_statusbar_buttons, .o_control_panel').getByRole('button', { name: /create invoice/i }).first();
  const visible = await createInvoiceBtn.isVisible({ timeout: 10000 }).catch(() => false);
  console.log('Create Invoice button visible:', visible);
  if (!visible) return;
  await createInvoiceBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'probe-after-create-invoice-click.png' });
  const notif = await page.locator('.o_notification').allTextContents();
  console.log('notifications:', JSON.stringify(notif));

  const dialog = page.locator('.modal').first();
  const dialogVisible = await dialog.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('invoice dialog visible:', dialogVisible);
  if (dialogVisible) {
    const confirmBtn = dialog.getByRole('button', { name: /create draft invoice/i }).first();
    const confirmVisible = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('confirm button in dialog visible:', confirmVisible);
    if (confirmVisible) {
      await confirmBtn.click();
      await page.waitForTimeout(1500);
      // A second confirmation ("Create Invoice? Ok/Cancel") can stack on top of the first
      // dialog — handle it if present.
      const okBtn = page.locator('.modal').last().getByRole('button', { name: /^ok$/i }).first();
      const okVisible = await okBtn.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('second Ok confirmation visible:', okVisible);
      if (okVisible) {
        await okBtn.click();
        await page.waitForTimeout(3000);
      }
      const notif2 = await page.locator('.o_notification').allTextContents();
      console.log('notifications after invoice confirm:', JSON.stringify(notif2));
      await page.screenshot({ path: 'probe-after-invoice-confirm.png' });
    }
  }

  console.log('current url after invoice creation:', page.url());
  const smartButtons = await page.locator('.o_button_box button, .oe_stat_button, .o_stat_button').allTextContents();
  console.log('smart buttons:', JSON.stringify(smartButtons));
  const invoiceSmartBtn = page.locator('.o_button_box button, .oe_stat_button, .o_stat_button').filter({ hasText: /invoice/i }).first();
  const invoiceSmartVisible = await invoiceSmartBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('invoice smart button visible:', invoiceSmartVisible);
  if (invoiceSmartVisible) {
    await invoiceSmartBtn.click();
    await page.waitForTimeout(2000);
    console.log('url after clicking invoice smart button:', page.url());
  }

  const invoiceForm = page.locator('.o_form_view').first();
  const isInvoiceForm = await invoiceForm.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('on a form view:', isInvoiceForm);

  const dueDateField = page.locator('.o_field_widget[name="invoice_date_due"]').first();
  const dueDateVisible = await dueDateField.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('due date field visible:', dueDateVisible);

  const postBtn = page.getByRole('button', { name: /^confirm$/i }).first();
  const postVisible = await postBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('post/confirm button visible on invoice:', postVisible);

  const allButtons = await page.locator('.o_statusbar_buttons button, .o_control_panel button').allTextContents();
  console.log('invoice form buttons:', JSON.stringify(allButtons));
});
