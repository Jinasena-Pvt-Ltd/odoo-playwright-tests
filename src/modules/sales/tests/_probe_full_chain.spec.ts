import { test } from '../../../core/fixtures/index';
import { SalesFormPage } from '../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../data/sales.master-data';

test('probe full invoice+post chain', async ({ page, salesMasterData }) => {
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

  console.log('--- creating draft invoice ---');
  const draftRef = await formPage.createDraftInvoice();
  console.log('draft invoice created:', draftRef, 'url:', page.url());

  const dueDateWidget = page.locator('.o_field_widget[name="invoice_date_due"] input').first();
  const dueDateVisible = await dueDateWidget.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('due date input visible:', dueDateVisible);
  if (dueDateVisible) {
    await dueDateWidget.click();
    await dueDateWidget.fill('01/01/2020');
    await page.keyboard.press('Escape');
    console.log('due date backdated');
  }

  console.log('--- posting invoice ---');
  const postedRef = await formPage.postInvoice();
  console.log('posted invoice:', postedRef);

  const invoiceButtons = await page.locator('.o_statusbar_buttons button, .o_control_panel button').allTextContents();
  console.log('post-invoice buttons:', JSON.stringify(invoiceButtons));
});
