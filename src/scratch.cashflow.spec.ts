import { Page } from '@playwright/test';
import * as fs from 'fs';
import { test } from './core/fixtures/index';
import { PurchaseFormPage } from './modules/purchase/pages/PurchasePage';

async function dumpButtons(page: Page, label: string) {
  const buttons = await page.locator('.o_control_panel button, .o_form_statusbar button, .o_cp_buttons button')
    .evaluateAll((els) => els.map((el) => el.textContent?.trim()).filter(Boolean));
  console.log(`[SCRATCH] (${label}) buttons:`, JSON.stringify(buttons));
}

test('scratch: explore cash purchase form', async ({ page, rpc }) => {
  test.setTimeout(120_000);

  const rows = await rpc.searchRead<{ id: number }>('x_purchase_request_cas', [], ['id']);
  rows.sort((a, b) => b.id - a.id);
  const id = rows[0]?.id;
  console.log('[SCRATCH] id:', id, JSON.stringify(rows.slice(0, 3)));
  if (!id) return;

  const poPage = new PurchaseFormPage(page);
  await poPage.navigateTo('/odoo');
  await page.waitForTimeout(1000);
  await page.goto(`${process.env.ODOO_BASE_URL}/web#model=x_purchase_request_cas&view_type=form&id=${id}&cids=2&menu_id=573`);
  await page.waitForSelector('.o_form_view', { timeout: 20000 });
  await page.waitForTimeout(1500);

  await dumpButtons(page, 'cash purchase form');
  await page.screenshot({ path: 'test-results/scratch-cash-04-cash-purchase-form.png' });
  const formHtml = await page.locator('.o_form_view').first().evaluate((el) => el.outerHTML).catch(() => '');
  fs.writeFileSync('test-results/scratch-cash-purchase-form.html', formHtml);
  console.log('[SCRATCH] cash purchase form url:', page.url());

  const reportReadyBtn = page.getByRole('button', { name: 'Report As Ready', exact: true });
  if (await reportReadyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Set the Vendor.
    const vendorField = page.locator('.o_field_widget[name="x_studio_vendor"] input').first();
    await vendorField.click();
    await vendorField.pressSequentially('JINASENA (PVT) LTD - CASH', { delay: 30 });
    const vendorOption = page.locator('.o-dropdown--menu .o_menu_item, .ui-autocomplete .ui-menu-item')
      .filter({ hasText: 'JINASENA' }).first();
    await vendorOption.waitFor({ state: 'visible', timeout: 10000 });
    const vendorOptText = await vendorOption.innerText();
    console.log('[SCRATCH] vendor option text:', vendorOptText);
    await vendorOption.click();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    // Update unit prices on both lines.
    const priceCells = page.locator('.o_list_table .o_data_row td[name="x_studio_unit_price"]');
    const priceCount = await priceCells.count();
    console.log('[SCRATCH] price cell count:', priceCount);
    for (let i = 0; i < priceCount; i++) {
      await priceCells.nth(i).click();
      await priceCells.nth(i).locator('input').fill('500');
      await page.keyboard.press('Tab');
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/scratch-cash-05-vendor-prices-set.png' });

    // Click Report As Ready.
    await reportReadyBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/scratch-cash-06-report-as-ready.png' });
    await dumpButtons(page, 'after report as ready');
  } else {
    console.log('[SCRATCH] already past Report As Ready, skipping to Issue Cash');
  }

  // Try editing "Issued Amount" to a higher value.
  const issuedAmountWidget = page.locator('.o_field_widget[name="x_studio_amount_to_issue"]');
  const issuedWidgetHtml = await issuedAmountWidget.first().evaluate((el) => el.outerHTML).catch(() => 'NOT FOUND');
  console.log('[SCRATCH] issued amount widget html:', issuedWidgetHtml);

  await issuedAmountWidget.click();
  await page.waitForTimeout(500);
  const issuedInput = issuedAmountWidget.locator('input').first();
  const hasInput = await issuedInput.isVisible({ timeout: 2000 }).catch(() => false);
  console.log('[SCRATCH] issued amount has editable input after click:', hasInput);
  if (hasInput) {
    await issuedInput.fill('15000');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: 'test-results/scratch-cash-07-issued-amount-edited.png' });

  // Click Issue Cash.
  const issueCashBtn = page.getByRole('button', { name: 'Issue Cash', exact: true });
  if (await issueCashBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await issueCashBtn.click();
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: 'test-results/scratch-cash-08-after-issue-cash.png' });
  await dumpButtons(page, 'after issue cash');
  console.log('[SCRATCH] url after issue cash:', page.url());

  // Open the journal entry — either we're already on its list (fresh Issue Cash click)
  // or need to use the "Cash Issued/Settled" smart button (already-advanced record).
  let onJournalList = page.url().includes('model=account.move') && page.url().includes('view_type=list');
  if (!onJournalList) {
    const smartBtn = page.locator('.o_button_box button, .o_stat_button, .oe_stat_button')
      .filter({ hasText: /Cash Issued.*Settled/i }).first();
    if (await smartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await smartBtn.click();
      await page.waitForTimeout(1500);
      onJournalList = page.url().includes('model=account.move') && page.url().includes('view_type=list');
    }
  }
  console.log('[SCRATCH] on journal list:', onJournalList, page.url());
  await page.screenshot({ path: 'test-results/scratch-cash-08b-journal-list.png' });
  if (onJournalList) {
    await page.locator('.o_list_table .o_data_row').first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/scratch-cash-09-journal-entry.png' });
    await dumpButtons(page, 'journal entry form');
    const jHtml = await page.locator('.o_form_view').first().evaluate((el) => el.outerHTML).catch(() => '');
    fs.writeFileSync('test-results/scratch-cash-journal.html', jHtml);

    const totalDebitText = await page.locator('[data-tooltip="Total Debit"]').first().innerText().catch(() => 'NOT FOUND');
    console.log('[SCRATCH] journal total debit:', totalDebitText);

    const postBtn = page.getByRole('button', { name: 'Post', exact: true });
    if (await postBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await postBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/scratch-cash-10-journal-posted.png' });
    }

    // Go back to the Cash Purchase via breadcrumb.
    const breadcrumb = page.locator('.o_breadcrumb, .o_control_panel_breadcrumbs').getByText('CPR/2026', { exact: false }).first();
    if (await breadcrumb.isVisible({ timeout: 2000 }).catch(() => false)) {
      await breadcrumb.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/scratch-cash-11-back-to-cp.png' });
      await dumpButtons(page, 'back at cash purchase after journal posted');
    }
  }

  // Click Create PO, or use the "PO" smart button if one already exists.
  const poSmartBtn = page.locator('.o_button_box button, .o_stat_button, .oe_stat_button').filter({ hasText: /^\d*PO$/ }).first();
  if (await poSmartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await poSmartBtn.click();
    await page.waitForTimeout(1500);
    if (page.url().includes('view_type=list')) {
      await page.locator('.o_list_table .o_data_row td[name="name"]').first().click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: 'test-results/scratch-cash-14-po-form.png' });
    await dumpButtons(page, 'cash-purchase PO form (via smart button)');
    console.log('[SCRATCH] po url:', page.url());
    const poFormHtml = await page.locator('.o_form_view').first().evaluate((el) => el.outerHTML).catch(() => '');
    fs.writeFileSync('test-results/scratch-cash-po-form.html', poFormHtml);

    // Slightly change unit prices.
    const priceCells2 = page.locator('.o_list_table .o_data_row td[name="price_unit"]');
    const priceCount2 = await priceCells2.count();
    console.log('[SCRATCH] PO price cell count:', priceCount2);
    for (let i = 0; i < priceCount2; i++) {
      const current = await priceCells2.nth(i).innerText();
      console.log(`[SCRATCH] PO line ${i} current price:`, current);
      await priceCells2.nth(i).click();
      await priceCells2.nth(i).locator('input').fill('510');
      await page.keyboard.press('Tab');
    }
    await page.waitForTimeout(1000);

    // Click Print RFQ — this may trigger a download or open a report tab.
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
      page.getByRole('button', { name: 'Print RFQ', exact: true }).click(),
    ]);
    console.log('[SCRATCH] Print RFQ triggered download:', !!download);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/scratch-cash-15-after-print-rfq.png' });
    await dumpButtons(page, 'after print rfq');
    console.log('[SCRATCH] url after print rfq:', page.url());

    // Upload quotation under Documents tab.
    await page.getByRole('tab', { name: 'Documents', exact: true }).click();
    await page.locator('input[type="file"]').first().setInputFiles(
      'D:\\My Documents\\#Dummy Documents\\Quotation.pdf',
    );
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/scratch-cash-16-quotation-uploaded.png' });

    // Click Receive Quotation.
    await page.getByRole('button', { name: 'Receive Quotation', exact: true }).click();
    await page.waitForTimeout(1500);
    await dumpButtons(page, 'after receive quotation');
    await page.screenshot({ path: 'test-results/scratch-cash-17-after-receive-quotation.png' });

    // Confirm Order.
    const confirmBtn = page.getByRole('button', { name: 'Confirm Order', exact: true }).first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(3000);
    }
    await dumpButtons(page, 'after confirm order');
    await page.screenshot({ path: 'test-results/scratch-cash-18-after-confirm.png' });
    console.log('[SCRATCH] po id for reuse:', page.url());

    // Receive Products -> Delivery.
    const receiveBtn = page.getByRole('button', { name: 'Receive Products', exact: true });
    if (await receiveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await receiveBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/scratch-cash-19-delivery.png' });
      await dumpButtons(page, 'delivery form');

      const invNumInput = page.locator('.o_field_widget[name="x_studio_supplier_invoice_number"] input').first();
      if (await invNumInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await invNumInput.fill('SUP_INV_123');
      }
      await page.getByRole('button', { name: 'Validate', exact: true }).click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/scratch-cash-20-delivery-validated.png' });
      await dumpButtons(page, 'delivery after validate');
    }
    return;
  }

  const createPoBtn = page.getByRole('button', { name: 'Create PO', exact: true });
  if (await createPoBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await createPoBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/scratch-cash-12-create-po-modal.png' });
    const cpoModalHtml = await page.locator('.modal').first().evaluate((el) => el.outerHTML).catch(() => 'NO MODAL');
    fs.writeFileSync('test-results/scratch-cash-create-po-modal.html', cpoModalHtml);
    console.log('[SCRATCH] create po modal html length:', cpoModalHtml.length);

    const cpoModal = page.locator('.modal');
    const cpoVendorField = cpoModal.locator('.o_field_widget[name="x_supplier_id"] input').first();
    await cpoVendorField.click();
    await cpoVendorField.pressSequentially('JINASENA (PVT) LTD - CASH', { delay: 30 });
    const cpoVendorOption = page.locator('.o-dropdown--menu .o_menu_item, .ui-autocomplete .ui-menu-item')
      .filter({ hasText: 'JINASENA' }).first();
    await cpoVendorOption.waitFor({ state: 'visible', timeout: 10000 });
    await cpoVendorOption.click();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    await cpoModal.getByRole('button', { name: 'Create Purchase Order', exact: true }).click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/scratch-cash-13-after-create-po.png' });
    console.log('[SCRATCH] url after create po:', page.url());
    await dumpButtons(page, 'after create po');

    const errDialog = page.locator('.modal', { hasText: 'Invalid Operation' });
    if (await errDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[SCRATCH] ERROR DIALOG:', await errDialog.innerText());
    }

    // Open the created PO.
    const onPoList = page.url().includes('model=purchase.order') && page.url().includes('view_type=list');
    if (onPoList) {
      await page.locator('.o_list_table .o_data_row td[name="name"]').first().click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/scratch-cash-14-po-form.png' });
      await dumpButtons(page, 'cash-purchase PO form');
      console.log('[SCRATCH] po url:', page.url());
    }
  }
});
