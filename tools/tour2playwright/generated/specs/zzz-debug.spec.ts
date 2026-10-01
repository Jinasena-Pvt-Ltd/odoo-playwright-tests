import { test } from '@playwright/test';
import { openOdooApp } from '../../../../src/modules/sales/pages/openOdooApp';

test('inspect sales purchase tab fields', async ({ page }) => {
  await openOdooApp(page, 'Contacts');
  await page.locator('div.d-xl-inline-flex.gap-1 > button.btn.btn-primary').click();
  await page.locator('#name_1').fill('Debug Customer');
  await page.locator('a[name="sales_purchases"]').click();
  await page.waitForTimeout(1000);
  const ids = await page.locator('[id]').evaluateAll(els => els.map(e => e.id).filter(id => id.includes('studio') || id.includes('payment') || id.includes('customer')));
  console.log('IDS:', JSON.stringify(ids));
  await page.screenshot({ path: 'generated/screenshots/debug-sales-purchase-full.png', fullPage: true });
});
