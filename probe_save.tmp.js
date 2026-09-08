require('dotenv').config();
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: 'auth-storage/admin.json' });
  const page = await context.newPage();

  const pending = new Map();
  page.on('request', req => {
    if (req.url().includes('call_kw')) {
      pending.set(req, Date.now());
    }
  });
  page.on('requestfinished', async req => {
    if (pending.has(req)) {
      const dur = Date.now() - pending.get(req);
      const post = req.postData();
      let method = '?';
      try { method = JSON.parse(post).params.method + ':' + JSON.parse(post).params.model; } catch {}
      console.log(`REQ ${dur}ms  ${method}`);
      pending.delete(req);
    }
  });
  page.on('requestfailed', req => {
    console.log('REQ FAILED', req.url(), req.failure()?.errorText);
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

  console.log('--- selecting customer ---');
  const custOk = await selectIfExists('partner_id', 'Test Customer - Playwright 1');
  console.log('customer:', custOk);

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

  async function addLine(productName, qty, disc) {
    const addLink = page.locator('.o_field_x2many_list_row_add a').filter({ hasText: /add a product/i }).first();
    await addLink.waitFor({ state: 'visible', timeout: 10000 });
    await addLink.click();
    await page.waitForTimeout(300);
    const row = page.locator('.o_data_row.o_selected_row').first();
    const productInput = row.locator('[name="product_id"] input').first();
    await productInput.waitFor({ state: 'visible', timeout: 10000 });
    await productInput.pressSequentially(productName, { delay: 50 });
    const dropdown = page.locator('.o-autocomplete--dropdown-menu');
    await dropdown.waitFor({ state: 'visible', timeout: 10000 });
    const match = dropdown.locator('li, .o-autocomplete--dropdown-item').filter({ hasText: productName }).first();
    await match.waitFor({ state: 'visible', timeout: 5000 });
    await match.click({ force: true });
    const qtyInput = row.locator('[name="product_uom_qty"] input').first();
    await qtyInput.waitFor({ state: 'visible', timeout: 20000 });
    await qtyInput.click();
    await qtyInput.fill(String(qty));
    await qtyInput.press('Tab');
    const discInput = row.locator('[name="discount"] input').first();
    await discInput.waitFor({ state: 'visible', timeout: 10000 });
    await discInput.click();
    await discInput.fill(String(disc));
    await discInput.press('Tab');
    const orderLinesTab = page.locator('.o_notebook .nav-link, .o_notebook .nav-item a').filter({ hasText: /order\s*lines/i }).first();
    await orderLinesTab.click();
    await page.waitForTimeout(500);
  }

  console.log('--- adding line 1 ---');
  await addLine('BALL BEARING 6202-2RS', 1, 10);
  console.log('--- adding line 2 ---');
  await addLine('CENTRIC TYPE PUMPING UNIT EPC 10CJ 024S', 2, 10);

  console.log('--- clicking save, timing... ---');
  const saveBtn = page.locator('.o_form_button_save, button[name="save_manually"]').first();
  await saveBtn.waitFor({ state: 'visible', timeout: 5000 });
  const t0 = Date.now();
  await saveBtn.click();
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(2000);
    const stillVisible = await saveBtn.isVisible({ timeout: 500 }).catch(() => false);
    console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s: save button visible = ${stillVisible}`);
    if (!stillVisible) break;
  }

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
