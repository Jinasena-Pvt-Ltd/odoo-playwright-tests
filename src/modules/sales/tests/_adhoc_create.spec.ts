import { test } from '../../../core/fixtures/index';
import { SalesFormPage, SalesCustomerFormPage } from '../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../data/sales.master-data';
import { uniqueName } from '../../../core/utils/RandomDataGenerator';

test('ad-hoc: create a customer and a sales order with one product', async ({ page }) => {
  const customerPage = new SalesCustomerFormPage(page);
  await customerPage.navigate();
  const customerName = uniqueName('Test Customer');
  await customerPage.customerName.setValue(customerName);
  await customerPage.save();
  console.log('CUSTOMER_CREATED:', customerName);

  const formPage = new SalesFormPage(page);
  await formPage.navigate();

  const customerFound = await formPage.selectCustomerIfExists(customerName);
  console.log('CUSTOMER_SELECTED:', customerFound);

  await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
  await formPage.setOrderPaymentType(SALES_TEST_CONFIG.orderPaymentType);
  const otherInfoOk = await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
  console.log('OTHER_INFO_OK:', otherInfoOk);

  await formPage.openOrderLinesTab();
  const added = await formPage.addOrderLines([
    { product: SALES_TEST_CONFIG.product, quantity: 1, discount: 0 },
  ]);
  console.log('PRODUCT_ADDED:', added);

  await formPage.save();
  const reference = await formPage.reference.getValue();
  console.log('ORDER_REFERENCE:', reference);
  console.log('ORDER_URL:', page.url());
});
