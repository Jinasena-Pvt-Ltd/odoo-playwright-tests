require('dotenv').config();
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: 'auth-storage/admin.json' });
  const page = await context.newPage();
  const base = process.env.ODOO_BASE_URL.replace(/\/$/, '');
  await page.goto(base + '/web/login');
  const state = await Promise.race([
    page.locator('.o_main_navbar').waitFor({ state: 'visible', timeout: 20000 }).then(() => 'ready'),
    page.getByRole('textbox', { name: 'Email' }).waitFor({ state: 'visible', timeout: 20000 }).then(() => 'login'),
  ]).catch(() => 'login');
  if (state === 'login') {
    await page.getByRole('textbox', { name: 'Email' }).fill(process.env.ADMIN_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(process.env.ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForSelector('.o_main_navbar', { timeout: 45000 });
  }

  await page.evaluate(() => { window.location.hash = 'action=514&model=sale.order&view_type=form&cids=2&menu_id=330'; });
  await page.waitForTimeout(3000);

  // Select customer (real recent fixture customer)
  const customerName = '[TEST] Test Product 1 442417D8'.replace('Test Product 1', 'Test Customer'); // placeholder, will fix below

  async function selectIfExists(fieldName, value) {
    const widget = page.locator(`.o_field_widget[name="${fieldName}"]`).first();
    const input = widget.locator('input').first();
    await input.waitFor({ state: 'visible', timeout: 10000 });
    for (let attempt = 1; attempt <= 3; attempt++) {
      await input.click();
      await input.fill('');
      await input.fill(value);
      const dropdown = page.locator('.o_field_many2one_dropdown, .ui-autocomplete, .o-dropdown--menu, .o-autocomplete--dropdown-menu').first();
      const opened = await dropdown.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
      if (opened) {
        const match = dropdown.locator('.o_menu_item, .ui-menu-item, li, .o-autocomplete--dropdown-item').filter({ hasText: value }).first();
        const found = await match.isVisible({ timeout: 5000 }).catch(() => false);
        if (found) { await match.click(); return true; }
      }
      if (attempt < 3) await page.waitForTimeout(500);
    }
    return false;
  }

  // Use the pre-existing real customer for reliability of this step
  const custOk = await selectIfExists('partner_id', 'Test Customer - Playwright 1');
  console.log('customer selected:', custOk);

  // Quotation type
  const field = page.getByLabel(/^quotation\s*type$/i).first();
  await field.waitFor({ state: 'visible', timeout: 10000 });
  await field.selectOption({ label: 'Sales' });
  console.log('quotation type set');

  // Other info tab -> team + warehouse
  const tab = page.locator('.o_notebook .nav-link, .o_notebook .nav-item a').filter({ hasText: /other\s*info/i }).first();
  await tab.waitFor({ state: 'visible', timeout: 20000 });
  await tab.click();
  await page.locator('[name="team_id"]').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(300);

  const teamOk = await selectIfExists('team_id', 'Colombo Sales Centre');
  console.log('team selected:', teamOk);
  const whOk = await selectIfExists('warehouse_id', 'JAM Warehouse Ekala- (JM-EK)');
  console.log('warehouse selected:', whOk);

  // Now order lines tab
  const olTab = page.locator('.o_notebook .nav-link, .o_notebook .nav-item a').filter({ hasText: /order\s*lines/i }).first();
  await olTab.waitFor({ state: 'visible', timeout: 10000 });
  await olTab.click();
  await page.locator('.o_field_one2many').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(300);
  console.log('order lines tab opened');

  const addLink = page.locator('.o_field_x2many_list_row_add a').filter({ hasText: /add a product/i }).first();
  await addLink.waitFor({ state: 'visible', timeout: 10000 });
  await addLink.click();
  await page.waitForTimeout(300);
  const row = page.locator('.o_data_row.o_selected_row').first();
  const productInput = row.locator('[name="product_id"] input').first();
  await productInput.waitFor({ state: 'visible', timeout: 10000 });
  console.log('row ready, product input visible');

  const productName = 'CENTRIC TYPE PUMPING UNIT EPC 10CJ 024S';
  await productInput.pressSequentially(productName, { delay: 50 });
  const dropdown = page.locator('.o-autocomplete--dropdown-menu');
  const opened = await dropdown.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
  console.log('dropdown opened:', opened);
  const match = dropdown.locator('li, .o-autocomplete--dropdown-item').filter({ hasText: productName }).first();
  const found = opened && await match.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('match found:', found);
  if (found) {
    await match.click({ force: true });
    console.log('clicked, watching...');
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(2000);
      const qtyVisible = await row.locator('[name="product_uom_qty"] input').first().isVisible({ timeout: 500 }).catch(() => false);
      const rowCount = await page.locator('.o_data_row').count();
      console.log((i + 1) * 2 + 's: qty visible=', qtyVisible, '| rows=', rowCount);
    }
  }

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
