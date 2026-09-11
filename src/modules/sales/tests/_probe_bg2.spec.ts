import { test } from '../../../core/fixtures/index';
import { SalesFormPage } from '../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../data/sales.master-data';

test('probe RUG trigger via high discount', async ({ page, salesMasterData }) => {
  const formPage = new SalesFormPage(page);
  await formPage.navigate();
  await formPage.selectCustomerIfExists(salesMasterData.customerName);
  await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
  await formPage.setOrderPaymentType(SALES_TEST_CONFIG.orderPaymentType);
  await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
  await formPage.addOrderLines([{ product: SALES_TEST_CONFIG.product, quantity: 1, discount: 90 }]);
  await formPage.save();

  console.log('status:', await formPage.getCurrentStatus());
  const radios = await page.getByRole('radio').allTextContents();
  console.log('radios:', JSON.stringify(radios));

  const btns = page.locator('.o_statusbar_buttons button, .o_control_panel button');
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    const title = await btns.nth(i).getAttribute('title').catch(() => null);
    const aria = await btns.nth(i).getAttribute('aria-label').catch(() => null);
    const text = await btns.nth(i).textContent().catch(() => null);
    console.log(`btn[${i}] text="${text}" title="${title}" aria="${aria}"`);
  }

  const rugVisible = await formPage.isStatusButtonVisible(/request.*rug.*approval/i);
  console.log('RUG approval request visible:', rugVisible);
  if (rugVisible) return;

  console.log('--- clicking Confirm ---');
  await formPage.clickStatusButtonByRole(/^confirm$/i, 15000);
  await page.waitForTimeout(2000);
  console.log('status after confirm click:', await formPage.getCurrentStatus());
  const notif = await page.locator('.o_notification').allTextContents();
  console.log('notifications:', JSON.stringify(notif));
  const modal = await page.locator('.modal').allTextContents();
  console.log('modals:', JSON.stringify(modal));
  const btns2 = await page.locator('.o_statusbar_buttons button, .o_control_panel button').allTextContents();
  console.log('buttons after confirm attempt:', JSON.stringify(btns2));
});
