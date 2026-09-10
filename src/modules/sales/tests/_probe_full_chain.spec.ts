import { test } from '../../../core/fixtures/index';
import { SalesFormPage } from '../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../data/sales.master-data';

test('probe full invoice chain 2', async ({ page, salesMasterData }) => {
  test.setTimeout(180_000);
  const formPage = new SalesFormPage(page);
  await formPage.navigate();
  await formPage.selectCustomerIfExists(salesMasterData.customerName);
  await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
  await formPage.setOrderPaymentType(SALES_TEST_CONFIG.orderPaymentType);
  await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
  await formPage.addOrderLines([{ product: SALES_TEST_CONFIG.product, quantity: 1, discount: 0 }]);
  await formPage.save();

  console.log('--- confirming ---');
  await formPage.confirmOrder();

  console.log('--- processing delivery ---');
  const deliveryRef = await formPage.processDelivery();
  console.log('delivery done:', deliveryRef, 'back on SO url:', page.url());

  console.log('--- creating invoice ---');
  const createInvoiceBtn = page.locator('.o_statusbar_buttons, .o_control_panel').getByRole('button', { name: /create invoice/i }).first();
  await createInvoiceBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await createInvoiceBtn.click();
  await page.waitForTimeout(1000);
  const dialog = page.locator('.modal').first();
  if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dialog.getByRole('button', { name: /create draft invoice/i }).click();
    await page.waitForTimeout(2000);
  }

  const errModal = page.locator('.modal').filter({ hasText: /invalid operation/i });
  const hasErr = await errModal.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('invoice error modal:', hasErr);
  if (hasErr) {
    console.log('error text:', (await errModal.textContent())?.slice(0, 300));
    return;
  }

  const smartButtons = await page.locator('.o_button_box button, .oe_stat_button, .o_stat_button').allTextContents();
  console.log('smart buttons after invoice:', JSON.stringify(smartButtons));
  const invoiceSmartBtn = page.locator('.o_button_box button, .oe_stat_button, .o_stat_button').filter({ hasText: /invoice/i }).first();
  const invoiceSmartVisible = await invoiceSmartBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('invoice smart button visible:', invoiceSmartVisible);
  if (invoiceSmartVisible) {
    await invoiceSmartBtn.click();
    await page.waitForTimeout(2000);
    console.log('url after clicking invoice smart button:', page.url());
    const invButtons = await page.locator('.o_control_panel button, .o_statusbar_buttons button').allTextContents();
    console.log('invoice form buttons:', JSON.stringify(invButtons));
    const dueDateVisible = await page.locator('.o_field_widget[name="invoice_date_due"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log('due date field visible:', dueDateVisible);
  }
});
