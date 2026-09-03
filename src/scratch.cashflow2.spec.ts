import { Page } from '@playwright/test';
import * as fs from 'fs';
import { test } from './core/fixtures/index';
import { PurchaseFormPage } from './modules/purchase/pages/PurchasePage';

async function dumpButtons(page: Page, label: string) {
  const buttons = await page.locator('.o_control_panel button, .o_form_statusbar button, .o_cp_buttons button')
    .evaluateAll((els) => els.map((el) => el.textContent?.trim()).filter(Boolean));
  console.log(`[SCRATCH] (${label}) buttons:`, JSON.stringify(buttons));
}

test('scratch: continue cash flow from known PO', async ({ page }) => {
  test.setTimeout(180_000);
  const poId = 3061;

  const poPage = new PurchaseFormPage(page);
  await poPage.navigateTo('/odoo');
  await poPage.openById(poId);
  await page.waitForSelector('.o_form_view', { timeout: 20000 });
  await dumpButtons(page, 'PO current state');
  await page.screenshot({ path: 'test-results/scratch-cash2-00-po-state.png' });

  const receiveBtn = page.getByRole('button', { name: 'Receive Products', exact: true });
  if (await receiveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await receiveBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/scratch-cash2-01-delivery.png' });
    await dumpButtons(page, 'delivery form');
    const html = await page.locator('.o_form_view').first().evaluate((el) => el.outerHTML).catch(() => '');
    fs.writeFileSync('test-results/scratch-cash2-delivery.html', html);

    const invNumInput = page.locator('.o_field_widget[name="x_studio_supplier_invoice_number"] input').first();
    if (await invNumInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await invNumInput.fill('SUP_INV_123');
    }
    await page.getByRole('button', { name: 'Validate', exact: true }).click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/scratch-cash2-02-delivery-validated.png' });
    await dumpButtons(page, 'delivery after validate');
  }

  // Go back to PO.
  await poPage.openById(poId);
  await page.waitForSelector('.o_form_view', { timeout: 20000 });
  await dumpButtons(page, 'PO after delivery');
  await page.screenshot({ path: 'test-results/scratch-cash2-03-po-after-delivery.png' });

  const totalText = await page.locator('.o_field_widget[name="amount_total"]').first().innerText().catch(() => 'N/A');
  console.log('[SCRATCH] PO total:', totalText);

  const createBillBtn = page.getByRole('button', { name: 'Create Bill', exact: true });
  if (await createBillBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await createBillBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/scratch-cash2-04-bill-form.png' });
    await dumpButtons(page, 'bill form');

    const refInput = page.locator('.o_field_widget[name="x_studio_supplier_invoice_number"] input').first();
    if (await refInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await refInput.fill('SUP_INV_123');
    }
    const dateInput = page.locator('.o_field_widget[name="invoice_date"] input').first();
    if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dateInput.fill('');
      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      await dateInput.type(`${mm}/${dd}/${today.getFullYear()}`);
      await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'test-results/scratch-cash2-05-bill-confirmed.png' });
    await dumpButtons(page, 'bill after confirm');

    const registerPaymentVisible = await page.getByRole('button', { name: 'Register Payment', exact: true })
      .isVisible({ timeout: 2000 }).catch(() => false);
    console.log('[SCRATCH] Register Payment button visible on cash-purchase bill:', registerPaymentVisible);
  }
});
