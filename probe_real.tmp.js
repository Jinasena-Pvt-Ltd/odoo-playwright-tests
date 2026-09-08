require('dotenv').config();
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: 'auth-storage/admin.json' });
  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText));
  page.on('response', async res => {
    if (res.url().includes('call_kw') && res.status() !== 200) {
      console.log('BAD RESPONSE:', res.status(), res.url());
    }
  });

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

  async function selectIfExists(fieldName, value) {
    const widget = page.locator(`.o_field_widget[name="${fieldName}"]`).first();
    const input = widget.locator('input').first();
    await input.waitFor({ state: 'visible', timeout: 10000 });
    await input.click();
    await input.fill('');
    await input.fill(value);
    const dropdown = page.locator('.o_field_many2one_dropdown, .ui-autocomplete, .o-dropdown--menu, .o-autocomplete--dropdown-menu').first();
    const opened = await dropdown.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!opened) return false;
    const match = dropdown.locator('.o_menu_item, .ui-menu-item, li, .o-autocomplete--dropdown-item').filter({ hasText: value }).first();
    const found = await match.isVisible({ timeout: 5000 }).catch(() => false);
    if (!found) return false;
    await match.click();
    return true;
  }

  const custOk = await selectIfExists('partner_id', '[TEST] Test Customer 6235F875');
  console.log('customer selected:', custOk);

  const field = page.getByLabel(/^quotation\s*type$/i).first();
  await field.waitFor({ state: 'visible', timeout: 10000 });
  await field.selectOption({ label: 'Sales' });

  const tab = page.locator('.o_notebook .nav-link, .o_notebook .nav-item a').filter({ hasText: /other\s*info/i }).first();
  await tab.waitFor({ state: 'visible', timeout: 20000 });
  await tab.click();
  await page.locator('[name="team_id"]').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(300);
  await selectIfExists('team_id', 'Colombo Sales Centre');
  await selectIfExists('warehouse_id', 'JAM Warehouse Ekala- (JM-EK)');

  const olTab = page.locator('.o_notebook .nav-link, .o_notebook .nav-item a').filter({ hasText: /order\s*lines/i }).first();
  await olTab.waitFor({ state: 'visible', timeout: 10000 });
  await olTab.click();
  await page.locator('.o_field_one2many').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(300);

  const addLink = page.locator('.o_field_x2many_list_row_add a').filter({ hasText: /add a product/i }).first();
  await addLink.waitFor({ state: 'visible', timeout: 10000 });
  await addLink.click();
  await page.waitForTimeout(300);
  const row = page.locator('.o_data_row.o_selected_row').first();
  const productInput = row.locator('[name="product_id"] input').first();
  await productInput.waitFor({ state: 'visible', timeout: 10000 });

  const productName = '[TEST] Test Product 1 6235F875';
  console.log('typing product name...');
  await productInput.pressSequentially(productName, { delay: 50 });
  const dropdown = page.locator('.o-autocomplete--dropdown-menu');
  const opened = await dropdown.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
  console.log('dropdown opened:', opened);
  const match = dropdown.locator('li, .o-autocomplete--dropdown-item').filter({ hasText: productName }).first();
  const found = opened && await match.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('match found:', found);
  if (found) {
    console.log('clicking match, watching for 40s...');
    await match.click({ force: true });
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(2000);
      const qtyVisible = await row.locator('[name="product_uom_qty"] input').first().isVisible({ timeout: 500 }).catch(() => false);
      const rowCount = await page.locator('.o_data_row').count();
      const loadingVisible = await page.locator('.o_loading_indicator').isVisible({timeout:300}).catch(()=>false);
      console.log((i + 1) * 2 + 's: qty visible=', qtyVisible, '| rows=', rowCount, '| loading=', loadingVisible);
      if (qtyVisible) break;
    }
  }

  await page.screenshot({ path: 'probe_real_result.png' });
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
