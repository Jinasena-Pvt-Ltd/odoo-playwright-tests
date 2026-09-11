import { test } from '../../../core/fixtures/index';
import { SalesFormPage, SalesListPage } from '../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../data/sales.master-data';

test('probe bulk action menu for draft quotation', async ({ page, salesMasterData }) => {
  const formPage = new SalesFormPage(page);
  await formPage.navigate();
  await formPage.selectCustomerIfExists(salesMasterData.customerName);
  await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
  await formPage.setOrderPaymentType(SALES_TEST_CONFIG.orderPaymentType);
  await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
  await formPage.save();
  const reference = await formPage.reference.getValue();
  console.log('created draft:', reference);

  const listPage = new SalesListPage(page);
  await listPage.navigate();
  await listPage.searchFor(reference);
  await listPage.selectRecord(0);
  await page.waitForTimeout(500);

  const actionBtn = page.locator('.o_control_panel .o_cp_action_menus button, .o_cp_action_menus .o_dropdown_button').first();
  const visible = await actionBtn.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('bulk action button visible:', visible);
  if (visible) {
    await actionBtn.click();
    await page.waitForTimeout(500);
    const items = await page.locator('.dropdown-item, .o_menu_item').allTextContents();
    console.log('bulk menu items:', JSON.stringify(items));
  }

  // cleanup
  await page.keyboard.press('Escape').catch(() => {});
  await formPage.openById(Number(new URLSearchParams(page.url().split('#')[1]).get('id')) || 0).catch(() => {});
});
