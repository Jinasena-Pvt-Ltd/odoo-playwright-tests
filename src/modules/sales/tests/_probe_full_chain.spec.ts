import { test } from '../../../core/fixtures/index';
import { SalesFormPage } from '../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../data/sales.master-data';

test('probe delivery step by step', async ({ page, salesMasterData }) => {
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
  console.log('t1: clicked delivery stat button');
  await page.waitForURL((url) => url.href !== soUrl, { timeout: 30_000 });
  console.log('t2: navigated to delivery, url=', page.url());

  const checkAvail = page.locator('.o_control_panel').getByRole('button', { name: /check availability/i });
  const caVisible = await checkAvail.isVisible({ timeout: 3_000 }).catch(() => false);
  console.log('t3: check availability visible=', caVisible);
  if (caVisible) {
    await checkAvail.click();
    console.log('t3b: clicked check availability');
    await checkAvail.waitFor({ state: 'hidden', timeout: 15_000 }).catch((e) => console.log('t3c: hide wait failed', e.message.slice(0,100)));
  }

  const opsTab = page.locator('.o_notebook .nav-link, .o_notebook .nav-item a').filter({ hasText: /operations/i }).first();
  await opsTab.waitFor({ state: 'visible', timeout: 10_000 });
  await opsTab.click();
  console.log('t4: clicked operations tab');
  await page.locator('.o_field_one2many').waitFor({ state: 'visible', timeout: 10_000 });
  console.log('t5: one2many visible');

  const rows = page.locator('.o_data_row');
  const rowCount = await rows.count();
  console.log('t6: row count', rowCount);
  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const demandText = ((await row.locator('[name="product_uom_qty"]').textContent().catch(() => '0')) ?? '0').trim();
    const demand = demandText.replace(/,/g, '');
    console.log(`t6.${i}: demand=${demand}`);
    if (!demand || demand === '0' || demand === '0.00') continue;
    const qtyDone = row.locator('[name="quantity"] input').first();
    const qdVisible = await qtyDone.isVisible({ timeout: 1_500 }).catch(() => false);
    console.log(`t6.${i}: qty input visible=${qdVisible}`);
    if (!qdVisible) {
      await row.locator('[name="quantity"]').click();
      await qtyDone.waitFor({ state: 'visible', timeout: 5_000 });
    }
    await qtyDone.click();
    await qtyDone.fill(demand);
    await qtyDone.press('Tab');
    console.log(`t6.${i}: filled`);
  }

  const validateBtn = page.locator('.o_control_panel').getByRole('button', { name: /validate/i });
  const valVisible = await validateBtn.isVisible({ timeout: 10_000 }).catch(() => false);
  console.log('t7: validate visible=', valVisible);
  await validateBtn.click();
  console.log('t8: clicked validate');

  await page.waitForTimeout(2000);
  const modalTexts = await page.locator('.modal').allTextContents();
  console.log('t9: modals=', JSON.stringify(modalTexts));
});
