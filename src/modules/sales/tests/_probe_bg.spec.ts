import { test } from '../../../core/fixtures/index';
import { SalesFormPage, SalesCustomerFormPage } from '../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../data/sales.master-data';
import { uniqueName } from '../../../core/utils/RandomDataGenerator';

test('probe bank guarantee trigger', async ({ page }) => {
  const customerPage = new SalesCustomerFormPage(page);
  await customerPage.navigate();
  await customerPage.customerName.setValue(uniqueName('BG Probe Customer'));
  await customerPage.openBankGuaranteeTabIfPresent();
  await customerPage.mandatoryBankGuarantee.enable();
  await customerPage.bankGuaranteeAmount.setValue(0);
  await customerPage.bankGuaranteeExpiryDate.setValue('2020-01-01');
  await customerPage.save();
  const customerName = await customerPage.customerName.getValue();
  console.log('customer created:', customerName);

  const formPage = new SalesFormPage(page);
  await formPage.navigate();
  await formPage.selectCustomerIfExists(customerName);
  await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
  await formPage.setOrderPaymentType(SALES_TEST_CONFIG.orderPaymentType);
  await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
  await formPage.addOrderLines([{ product: SALES_TEST_CONFIG.product, quantity: 1, discount: 0 }]);
  await formPage.save();

  const buttons = await page.locator('.o_statusbar_buttons button, .o_control_panel button').allTextContents();
  console.log('buttons after save:', JSON.stringify(buttons));

  const confirmVisible = await formPage.isConfirmVisible();
  console.log('confirm visible:', confirmVisible);
});
