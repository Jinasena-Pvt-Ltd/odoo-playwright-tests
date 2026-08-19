import { test } from './core/fixtures/index';
import { PurchaseFormPage } from './modules/purchase/pages/PurchasePage';

test('check purchase model', async ({ rpc, page }) => {
  const formPage = new PurchaseFormPage(page);
  await formPage.navigate(); // boots the SPA session (lands on Employees, per hardcoded boot flow)

  const homeMenuBtn = page.locator('a.o_menu_toggle, [aria-label="Home menu"]').first();
  await homeMenuBtn.click({ timeout: 5000 });
  await page.waitForTimeout(800);
  const searchBox = page.getByPlaceholder('Search...').first();
  await searchBox.fill('Purchase');
  await page.waitForTimeout(800);
  const options = page.getByRole('option');
  const count = await options.count();
  for (let i = 0; i < count; i++) {
    console.log('option:', await options.nth(i).innerText());
  }
  await options.first().click();
  await page.waitForTimeout(1500);
  console.log('URL after clicking Purchase app:', page.url(), await page.title());
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
