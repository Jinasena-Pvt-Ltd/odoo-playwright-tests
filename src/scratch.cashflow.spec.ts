import { Page } from '@playwright/test';
import * as fs from 'fs';
import { test } from './core/fixtures/index';
import { PurchaseRequisitionFormPage } from './modules/purchase/pages/PurchaseRequisitionPage';
import { PURCHASE_TEST_CONFIG } from './modules/purchase/data/purchase.master-data';

async function dumpButtons(page: Page, label: string) {
  const buttons = await page.locator('.o_control_panel button, .o_form_statusbar button, .o_cp_buttons button')
    .evaluateAll((els) => els.map((el) => el.textContent?.trim()).filter(Boolean));
  console.log(`[SCRATCH] (${label}) buttons:`, JSON.stringify(buttons));
}

test('scratch: explore cash purchase flow', async ({ page }) => {
  test.setTimeout(300_000);
  const scenario = PURCHASE_TEST_CONFIG.inventoryCreditPurchase;

  const prPage = new PurchaseRequisitionFormPage(page);
  await prPage.navigate();
  await prPage.warehouse.setValue(scenario.warehouse);
  await prPage.setRequestedDeliveryDate(scenario.requestedDeliveryDay);
  await prPage.requestedBy.setValue(scenario.requestedBy);
  for (const [index, line] of scenario.lines.entries()) {
    await prPage.addProductLine(line.product, line.quantity, index === scenario.lines.length - 1);
  }
  await prPage.save();
  await prPage.confirm();
  await prPage.requestApproval();
  await prPage.approve();
  await page.waitForTimeout(1000);

  await dumpButtons(page, 'after approve');
  await page.screenshot({ path: 'test-results/scratch-cash-01-approved.png' });

  // Click "Convert to Cash Purchase"
  const convertBtn = page.getByRole('button', { name: /Convert to Cash Purchase/i });
  const hasConvert = await convertBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('[SCRATCH] Convert to Cash Purchase visible:', hasConvert);
  if (!hasConvert) {
    console.log('[SCRATCH] STOPPING - button not found');
    return;
  }
  await convertBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/scratch-cash-02-convert-modal.png' });

  const modal = page.locator('.modal');
  const modalHtml = await modal.first().evaluate((el) => el.outerHTML).catch(() => '');
  console.log('[SCRATCH] modal html length:', modalHtml.length);
  fs.writeFileSync('test-results/scratch-cash-modal.html', modalHtml);

  // Select each line's checkbox individually (same pattern as Create RFQ wizard).
  const lineRows = modal.locator('.o_list_table .o_data_row');
  const lineCount = await lineRows.count();
  console.log('[SCRATCH] line count:', lineCount);
  for (let i = 0; i < lineCount; i++) {
    const selectCell = lineRows.nth(i).locator('td[name="x_select"]');
    await selectCell.click();
    await selectCell.locator('input[type="checkbox"]').check();
  }

  await modal.getByRole('button', { name: 'Create Cash Purchase', exact: true }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/scratch-cash-03-after-create.png' });
  console.log('[SCRATCH] url after Create Cash Purchase:', page.url());

  // If it landed on a list, click the newest row.
  const onList = await page.locator('.o_list_view').isVisible({ timeout: 3000 }).catch(() => false);
  console.log('[SCRATCH] landed on list view:', onList);
  if (onList) {
    await page.locator('.o_list_table .o_data_row td[name="name"]').first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/scratch-cash-04-cash-purchase-form.png' });
  }

  await dumpButtons(page, 'cash purchase form');
  const formHtml = await page.locator('.o_form_view').first().evaluate((el) => el.outerHTML).catch(() => '');
  fs.writeFileSync('test-results/scratch-cash-purchase-form.html', formHtml);
  console.log('[SCRATCH] cash purchase form url:', page.url());
});
