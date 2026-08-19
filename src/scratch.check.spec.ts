import { test } from './core/fixtures/index';
import { PurchaseFormPage } from './modules/purchase/pages/PurchasePage';

test('check purchase model', async ({ rpc, page }) => {
  await page.goto((process.env.ODOO_BASE_URL ?? '') + '/web/login');
  await page.waitForSelector('.o_main_navbar', { timeout: 20000 }).catch(() => {});
  await page.goto((process.env.ODOO_BASE_URL ?? '') + '/odoo');
  await page.waitForTimeout(1500);
  const homeMenuBtn = page.locator('.o_menu_toggle, a.o_menu_brand, [aria-label="Home menu"]').first();
  await homeMenuBtn.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const searchBox = page.locator('input[placeholder*="Search"]').first();
  await searchBox.fill('Purchase').catch(() => {});
  await page.waitForTimeout(1000);
  const html = await page.locator('.o_home_menu, .o_apps').first().innerText().catch(() => 'NONE');
  console.log('apps text:', html);
  return;
  const menus = await rpc.searchRead<{ id: number; name: string; action: string }>(
    'ir.ui.menu', [['name', 'ilike', 'purchase']], ['id', 'name', 'action'],
  );
  console.log('menus:', JSON.stringify(menus));
  const actions = await rpc.searchRead<{ id: number; name: string; res_model: string }>(
    'ir.actions.act_window', [['res_model', '=', 'purchase.order']], ['id', 'name', 'res_model'],
  );
  console.log('actions:', JSON.stringify(actions));

  await page.goto((process.env.ODOO_BASE_URL ?? '') + '/odoo/action-437/new');
  await page.waitForTimeout(3000);
  console.log('URL after action-437:', page.url(), await page.title());
});
