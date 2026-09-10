import { test } from '../../../core/fixtures/index';
import { SalesFormPage } from '../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../data/sales.master-data';

test('probe delivery step by step 2', async ({ page, salesMasterData }) => {
  test.setTimeout(150_000);
  const formPage = new SalesFormPage(page);
  await formPage.navigate();
  await formPage.selectCustomerIfExists(salesMasterData.customerName);
  await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
  await formPage.setOrderPaymentType(SALES_TEST_CONFIG.orderPaymentType);
  await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
  await formPage.addOrderLines([{ product: SALES_TEST_CONFIG.product, quantity: 1, discount: 0 }]);
  await formPage.save();
  await formPage.confirmOrder();
  console.log('t0: confirmed');

  const soUrl = page.url();
  const statBtn = page.locator('.oe_button_box button, button.oe_stat_button, button.o_stat_button, .o_cp_stat_buttons button')
    .filter({ hasText: /delivery/i }).first();
  await statBtn.click();
  await page.waitForURL((url) => url.href !== soUrl, { timeout: 30_000 });
  const deliveryUrl = page.url();
  console.log('t2: on delivery', deliveryUrl);

  const opsTab = page.locator('.o_notebook .nav-link, .o_notebook .nav-item a').filter({ hasText: /operations/i }).first();
  await opsTab.waitFor({ state: 'visible', timeout: 10_000 });
  await opsTab.click();
  await page.locator('.o_field_one2many').waitFor({ state: 'visible', timeout: 10_000 });

  const row = page.locator('.o_data_row').first();
  const qtyDone = row.locator('[name="quantity"] input').first();
  if (!(await qtyDone.isVisible({ timeout: 1500 }).catch(() => false))) {
    await row.locator('[name="quantity"]').click();
    await qtyDone.waitFor({ state: 'visible', timeout: 5000 });
  }
  await qtyDone.click();
  await qtyDone.fill('1.0000');
  await qtyDone.press('Tab');
  console.log('t6: filled qty');

  const validateBtn = page.locator('.o_statusbar_buttons, .o_control_panel').getByRole('button', { name: /validate/i });
  await validateBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await validateBtn.click();
  console.log('t8: clicked validate');

  await page.waitForTimeout(2000);
  const modalTexts = await page.locator('.modal').allTextContents();
  console.log('t9: modals=', JSON.stringify(modalTexts));

  const immDialog = page.locator('.modal, .o_dialog').filter({ hasText: /immediate transfer/i });
  const immVisible = await immDialog.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('t10: immediate transfer dialog=', immVisible);
  if (immVisible) {
    await immDialog.getByRole('button', { name: /validate/i }).click();
    console.log('t10b: clicked validate in imm dialog');
    await page.waitForTimeout(2000);
  }

  const boDialog = page.locator('.modal, .o_dialog').filter({ hasText: /backorder/i });
  const boVisible = await boDialog.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('t11: backorder dialog=', boVisible);
  if (boVisible) {
    await boDialog.getByRole('button', { name: /create backorder/i }).click();
    console.log('t11b: clicked create backorder');
    await page.waitForTimeout(2000);
  }

  const modalTexts2 = await page.locator('.modal').allTextContents();
  console.log('t12: modals now=', JSON.stringify(modalTexts2));

  const radios = await page.getByRole('radio').allTextContents();
  console.log('t13: radios=', JSON.stringify(radios));
  const checkedRadio = await page.getByRole('radio', { checked: true }).allTextContents();
  console.log('t14: checked radio=', JSON.stringify(checkedRadio));
});
