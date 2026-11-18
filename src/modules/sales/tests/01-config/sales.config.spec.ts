/**
 * Step 1 — Configuration Setup for the sales module.
 *
 * Recorded tour: "Payment Terms create for a sales module" (tour_export (23).json)
 *   Accounting → Configuration → Payment Terms → New → type the name → Save.
 *
 * Tests (admin only):
 *   1. Payment Terms list opens through the Accounting menu.
 *   2. A new payment term can be created and saved (and exists in the database afterwards).
 *   3. A saved payment term appears in the Payment Terms list.
 *   4. A payment term can be assigned to a customer (the reason payment terms are configured).
 * Every payment term / customer created here is archived again at the end.
 *
 * Recorded tour: "Sales Teams create for a Sales Module" (tour_export (24).json)
 *   Sales → Configuration → Sales Teams → New → type the name → press Enter → Save.
 * (second describe; the sales team created is archived again at the end)
 *
 * Recorded tour: "Customer group creating for a sales module" (tour_export (25).json)
 *   Sales → Configuration → Customer Groups → New → type the name → press Enter → Save.
 * (third describe; the customer group created is deactivated again at the end)
 *
 * Recorded tour: "Create a Pricelist for a Product" (tour_export (27).json)
 *   Sales → Products → Pricelists → New → name → Enter → Add a line → pick the product → price → Save.
 * (fourth describe; the pricelist created is archived again at the end)
 *
 * Recorded tour: "Create a Product for a Sales" (tour_export (28).json)
 *   Sales → Products → Products → New → type the name → press Enter → Save.
 * (fifth describe at the bottom; the product created is archived again at the end)
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../../../core/fixtures/index';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';
import { COMPANY } from '../../flows/flowHelpers';

const TERM_MODEL = 'account.payment.term';

/** Opens Odoo and logs in if the saved admin session is not accepted (fresh server session). */
async function ensureLoggedIn(page: Page): Promise<void> {
  await page.goto('/web', { waitUntil: 'domcontentloaded' });
  const state = await Promise.race([
    page.locator('.o_main_navbar').waitFor({ state: 'visible', timeout: 60_000 }).then(() => 'ready' as const),
    page.getByRole('textbox', { name: 'Email' }).waitFor({ state: 'visible', timeout: 60_000 }).then(() => 'login' as const),
  ]).catch(() => 'none' as const);
  if (state === 'login') {
    await page.getByRole('textbox', { name: 'Email' }).fill(process.env.ADMIN_EMAIL ?? 'admin');
    await page.getByRole('textbox', { name: 'Password' }).fill(process.env.ADMIN_PASSWORD ?? 'admin');
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.locator('.o_main_navbar').waitFor({ state: 'visible', timeout: 90_000 });
  } else if (state === 'none') {
    throw new Error('Odoo did not load (neither the navbar nor the login form appeared). Check ODOO_BASE_URL.');
  }
}

/** Opens Accounting → Configuration → Payment Terms by clicking the menus, as the tour does. */
async function openPaymentTerms(page: Page): Promise<void> {
  await ensureLoggedIn(page);
  const app = page.locator('[data-menu-xmlid="account_accountant.menu_accounting"]').first();
  if (!await app.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole('link', { name: 'Home menu' }).click();
  }
  await app.click();
  await page.locator('[data-menu-xmlid="account.menu_finance_configuration"]').first().click();
  await page.locator('[data-menu-xmlid="account.menu_action_payment_term_form"]').first().click();
  await expect(page.locator('.o_list_view').first()).toBeVisible({ timeout: 30_000 });
}

/** Creates a payment term through the form (tour steps New → name → Save). Returns its name. */
async function createTermByUi(page: Page, name: string): Promise<void> {
  await page.locator('button.o_list_button_add:visible').first().click();
  await page.locator('#name_0').fill(name);
  await page.locator('.o_form_button_save, [data-hotkey="s"]').first().click();
  // saved = the form is no longer dirty and the breadcrumb shows the new name
  await expect(page.locator('.o_form_status_indicator_buttons.invisible, .o_form_saved').first())
    .toBeAttached({ timeout: 20_000 });
  await expect(page.locator('.o_form_view')).toContainText(name);
}

test.describe('Sales Configuration Setup @module:sales @step:config', () => {
  const termIds: number[] = [];
  const partnerIds: number[] = [];
  const groupIds: number[] = []; // customer groups created only when the company has none

  test.afterEach(async ({ rpc }) => {
    if (partnerIds.length) await rpc.archive('res.partner', partnerIds.splice(0)).catch(() => undefined);
    if (termIds.length) await rpc.archive(TERM_MODEL, termIds.splice(0)).catch(() => undefined);
    if (groupIds.length) await rpc.callMethod('x_customer_group', 'write', [groupIds.splice(0), { x_active: false }]).catch(() => undefined);
  });

  test('1. Payment Terms list opens from Accounting > Configuration @smoke', async ({ page }) => {
    await openPaymentTerms(page);
    await expect(page.locator('.o_breadcrumb, .breadcrumb').first()).toContainText(/payment terms/i);
    await expect(page.locator('.o_list_view')).toBeVisible();
  });

  test('2. a new payment term can be created and saved', async ({ page, rpc }) => {
    const name = uniqueName('Payment Term');
    await openPaymentTerms(page);
    await createTermByUi(page, name);

    const rows = await rpc.searchRead<{ id: number; name: string }>(TERM_MODEL, [['name', '=', name]], ['name']);
    termIds.push(...rows.map(r => r.id));
    expect(rows, 'the payment term should exist in Odoo after Save').toHaveLength(1);
  });

  test('3. a saved payment term shows in the Payment Terms list', async ({ page, rpc }) => {
    const name = uniqueName('Payment Term');
    const id = await rpc.create(TERM_MODEL, { name });
    termIds.push(id as number);

    await openPaymentTerms(page);
    await page.locator('.o_searchview_input').fill(name);
    await page.keyboard.press('Enter');
    await expect(page.locator('.o_data_row', { hasText: name })).toHaveCount(1);
  });

  test('4. a payment term can be assigned to a customer', async ({ page, rpc }) => {
    const termName = uniqueName('Payment Term');
    const termId = await rpc.create(TERM_MODEL, { name: termName }) as number;
    termIds.push(termId);
    // Customer Group and Payment Type are required (Studio) fields on the customer form → fill them so Save works
    const [co] = await rpc.searchRead<{ id: number }>('res.company', [['name', '=', COMPANY]], ['id'], { limit: 1 });
    if (!co) throw new Error(`Company "${COMPANY}" not found.`);
    const groups = await rpc.searchRead<{ id: number; x_studio_company_id: [number, string] | false }>(
      'x_customer_group', [['x_active', '=', true]], ['x_studio_company_id'], { order: 'id' });
    let groupId = groups.find(g => g.x_studio_company_id && g.x_studio_company_id[0] === co.id)?.id;
    if (!groupId) {
      // no active group for this company → make one for the test (removed again in afterEach)
      const [term] = await rpc.searchRead<{ id: number }>('account.payment.term', [], ['id'], { limit: 1 });
      const [acc] = await rpc.searchRead<{ id: number }>('account.account', [['account_type', '=', 'asset_receivable']], ['id'], { limit: 1 });
      groupId = await rpc.callMethod<number>('x_customer_group', 'create', [{
        x_name: uniqueName('Config Group'), x_studio_company_id: co.id,
        x_studio_payment_term: term?.id, x_studio_receivable_account: acc?.id,
      }], { context: { allowed_company_ids: [co.id], company_id: co.id } });
      groupIds.push(groupId);
    }
    // RPC-created partners get no receivable/payable accounts (the form then cannot be saved) → copy them from a known customer
    const refName = process.env.FLOW_CONTROL_CUSTOMER ?? 'abc';
    const [ref] = await rpc.callMethod<Array<Record<string, unknown>>>('res.partner', 'search_read',
      [[['name', '=', refName]]], {
        fields: ['property_account_receivable_id', 'property_account_payable_id'], limit: 1,
        context: { allowed_company_ids: [co.id], company_id: co.id },
      }).catch(() => []);
    const idOf = (v: unknown) => (Array.isArray(v) ? (v[0] as number) : false);
    const partnerId = await rpc.callMethod<number>('res.partner', 'create', [{
      name: uniqueName('Config Customer'), customer_rank: 1, x_studio_customer_group: groupId, x_studio_payment_method: 'Cash',
      ...(ref ? {
        property_account_receivable_id: idOf(ref.property_account_receivable_id),
        property_account_payable_id: idOf(ref.property_account_payable_id),
      } : {}),
    }], { context: { allowed_company_ids: [co.id], company_id: co.id } });
    partnerIds.push(partnerId);

    await ensureLoggedIn(page);
    await page.goto(`/web#id=${partnerId}&model=res.partner&view_type=form`);
    await page.locator('.o_form_view').waitFor();
    await page.getByRole('tab', { name: /sales\s*&\s*purchase/i }).click();
    const field = page.locator('[name="property_payment_term_id"] input');
    await field.fill(termName);
    await page.locator('.ui-autocomplete .ui-menu-item', { hasText: termName }).first().click();
    await page.locator('.o_form_button_save').click();
    // payment term is a company-dependent property → read it in the company the UI works in
    const [company] = await rpc.searchRead<{ id: number }>('res.company', [['name', '=', COMPANY]], ['id'], { limit: 1 });
    const ctx = company ? { allowed_company_ids: [company.id], company_id: company.id } : {};
    // after Save Odoo keeps the button but disables it; the database is the proof it was saved
    await expect.poll(async () => {
      const [p] = await rpc.callMethod<Array<{ property_payment_term_id: [number, string] | false }>>(
        'res.partner', 'read', [[partnerId]], { fields: ['property_payment_term_id'], context: ctx });
      return p.property_payment_term_id && p.property_payment_term_id[0];
    }, { timeout: 30_000 }).toBe(termId);
  });
});

/** Opens Sales → Configuration → Sales Teams by clicking the menus, as the tour does. */
async function openSalesTeams(page: Page): Promise<void> {
  await ensureLoggedIn(page);
  const app = page.locator('[data-menu-xmlid="sale.sale_menu_root"]').first();
  if (!await app.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole('link', { name: 'Home menu' }).click();
  }
  await app.click();
  await page.locator('[data-menu-xmlid="sale.menu_sale_config"]').first().click();
  await page.locator('[data-menu-xmlid="sale.sales_team_config"]').first().click();
  await expect(page.locator('.o_kanban_view, .o_list_view').first()).toBeVisible({ timeout: 30_000 });
}

test.describe('Sales Teams Configuration @module:sales @step:config', () => {
  const teamIds: number[] = [];

  test.afterEach(async ({ rpc }) => {
    if (teamIds.length) await rpc.archive('crm.team', teamIds.splice(0)).catch(() => undefined);
  });

  test('1. Sales Teams list opens from Sales > Configuration @smoke', async ({ page }) => {
    await openSalesTeams(page);
    await expect(page.locator('.o_breadcrumb, .breadcrumb').first()).toContainText(/sales teams/i);
  });

  test('2. a new sales team can be created and saved', async ({ page, rpc }) => {
    const name = uniqueName('Sales Team');
    await openSalesTeams(page);
    await page.locator('button.o_list_button_add:visible, button.o-kanban-button-new:visible').first().click();
    await page.locator('#name_0').fill(name);
    await page.locator('#name_0').press('Enter'); // the tour presses Enter after typing the name
    const save = page.locator('.o_form_button_save:visible').first();
    if (await save.isEnabled({ timeout: 3_000 }).catch(() => false)) await save.click();

    await expect.poll(async () => {
      const rows = await rpc.searchRead<{ id: number }>('crm.team', [['name', '=', name]], ['id']);
      teamIds.push(...rows.map(r => r.id).filter(id => !teamIds.includes(id)));
      return rows.length;
    }, { timeout: 30_000, message: 'the sales team should exist in Odoo after Save' }).toBe(1);
    await expect(page.locator('.o_form_view')).toContainText(name);
  });

  test('3. a saved sales team shows in the Sales Teams list', async ({ page, rpc }) => {
    const name = uniqueName('Sales Team');
    teamIds.push(await rpc.create('crm.team', { name }) as number);

    await openSalesTeams(page);
    await page.locator('.o_searchview_input').fill(name);
    await page.keyboard.press('Enter');
    await expect(page.locator('.o_kanban_record, .o_data_row').filter({ hasText: name })).toHaveCount(1);
  });
});

const GROUP_MODEL = 'x_customer_group';
// Studio generates this menu's xmlid with a random suffix on every build → match the prefix or the label
const GROUP_MENU = '[data-menu-xmlid^="studio_customization.sales_customer_group"], .dropdown-menu a:has-text("Customer Groups")';

/** Opens Sales → Configuration → Customer Groups by clicking the menus, as the tour does. */
async function openCustomerGroups(page: Page): Promise<void> {
  await ensureLoggedIn(page);
  const app = page.locator('[data-menu-xmlid="sale.sale_menu_root"]').first();
  if (!await app.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole('link', { name: 'Home menu' }).click();
  }
  await app.click();
  await page.locator('[data-menu-xmlid="sale.menu_sale_config"]').first().click();
  await page.locator(GROUP_MENU).first().click();
  await expect(page.locator('.o_list_view, .o_kanban_view').first()).toBeVisible({ timeout: 30_000 });
}

test.describe('Customer Groups Configuration @module:sales @step:config', () => {
  const groupIds: number[] = [];

  test.afterEach(async ({ rpc }) => {
    // customer groups use x_active (not "active") → deactivate instead of deleting
    if (groupIds.length) {
      await rpc.callMethod(GROUP_MODEL, 'write', [groupIds.splice(0), { x_active: false }]).catch(() => undefined);
    }
  });

  test('1. Customer Groups list opens from Sales > Configuration @smoke', async ({ page }) => {
    await openCustomerGroups(page);
    await expect(page.locator('.o_breadcrumb, .breadcrumb').first()).toContainText(/customer groups?/i);
  });

  test('2. a new customer group can be created and saved', async ({ page, rpc }) => {
    const name = uniqueName('Customer Group');
    await openCustomerGroups(page);
    await page.locator('button.o_list_button_add:visible, button.o-kanban-button-new:visible').first().click();
    await page.locator('#x_name_0').fill(name);
    await page.locator('#x_name_0').press('Enter'); // the tour presses Enter after typing the name
    // Payment Term and Receivable Account are required on this build (not in the recorded tour) → fill both
    const [receivable] = await rpc.searchRead<{ code: string }>(
      'account.account', [['account_type', '=', 'asset_receivable']], ['code'], { limit: 1 });
    const term = page.locator('[name="x_studio_payment_term"] input').first();
    if (await term.isVisible({ timeout: 3_000 }).catch(() => false) && !(await term.inputValue())) {
      await term.fill('Immediate');
      const termOpt = page.locator('.ui-autocomplete .ui-menu-item', { hasText: 'Immediate Payment' }).first();
      await termOpt.waitFor({ state: 'visible', timeout: 20_000 });
      await termOpt.click();
      await expect(term).toHaveValue(/Immediate/);
    }
    const acc = page.locator('[name="x_studio_receivable_account"] input').first();
    if (receivable && await acc.isVisible({ timeout: 3_000 }).catch(() => false) && !(await acc.inputValue())) {
      await acc.fill(receivable.code);
      const opt = page.locator('.ui-autocomplete .ui-menu-item', { hasText: receivable.code }).first();
      await opt.waitFor({ state: 'visible', timeout: 20_000 });
      await opt.click();
    }
    const save = page.locator('.o_form_button_save:visible').first();
    if (await save.isEnabled({ timeout: 3_000 }).catch(() => false)) await save.click();

    await expect.poll(async () => {
      const rows = await rpc.searchRead<{ id: number }>(GROUP_MODEL, [['x_name', '=', name]], ['id']);
      groupIds.push(...rows.map(r => r.id).filter(id => !groupIds.includes(id)));
      return rows.length;
    }, { timeout: 30_000, message: 'the customer group should exist in Odoo after Save' }).toBe(1);
    await expect(page.locator('.o_form_view')).toContainText(name);
  });

  test('3. a saved customer group shows in the Customer Groups list', async ({ page, rpc }) => {
    const name = uniqueName('Customer Group');
    groupIds.push(await rpc.create(GROUP_MODEL, { x_name: name }) as number);

    await openCustomerGroups(page);
    await page.locator('.o_searchview_input').fill(name);
    await page.keyboard.press('Enter');
    await expect(page.locator('.o_kanban_record, .o_data_row').filter({ hasText: name })).toHaveCount(1);
  });

  test('4. a customer group can be chosen on a customer', async ({ page, rpc }) => {
    const [co] = await rpc.searchRead<{ id: number }>('res.company', [['name', '=', COMPANY]], ['id'], { limit: 1 });
    const name = uniqueName('Customer Group');
    groupIds.push(await rpc.callMethod<number>(GROUP_MODEL, 'create', [{ x_name: name, x_studio_company_id: co?.id }],
      { context: { allowed_company_ids: co ? [co.id] : [] } }));

    await ensureLoggedIn(page);
    const app = page.locator('[data-menu-xmlid="sale.sale_menu_root"]').first();
    if (!await app.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.getByRole('link', { name: 'Home menu' }).click();
    }
    await app.click();
    await page.locator('.o_menu_sections').getByText('Orders').first().click();
    await page.locator('.o_menu_sections .dropdown-menu').getByText('Customers').first().click();
    await page.locator('button.o_list_button_add:visible, button.o-kanban-button-new:visible').first().click();
    await page.locator('.o_form_view').waitFor();
    const field = page.locator('[name="x_studio_customer_group"] input');
    await field.fill(name);
    await expect(page.locator('.ui-autocomplete .ui-menu-item', { hasText: name }).first()).toBeVisible({ timeout: 20_000 });
  });
});

/** Opens Sales → Products → Pricelists by clicking the menus, as the tour does. */
async function openPricelists(page: Page): Promise<void> {
  await ensureLoggedIn(page);
  const app = page.locator('[data-menu-xmlid="sale.sale_menu_root"]').first();
  if (!await app.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole('link', { name: 'Home menu' }).click();
  }
  await app.click();
  await page.locator('[data-menu-xmlid="sale.product_menu_catalog"]').first().click();
  await page.locator('[data-menu-xmlid="sale.menu_product_pricelist_main"]').first().click();
  await expect(page.locator('.o_list_view, .o_kanban_view').first()).toBeVisible({ timeout: 30_000 });
}

test.describe('Pricelists Configuration @module:sales @step:config', () => {
  const listIds: number[] = [];
  const productIds: number[] = []; // only filled when the named product does not exist and one is created for the test
  const PRODUCT = process.env.FLOW_PRICELIST_PRODUCT ?? 'BALL BEARING 6202-2RS';

  test.afterEach(async ({ rpc }) => {
    if (listIds.length) await rpc.archive('product.pricelist', listIds.splice(0)).catch(() => undefined);
    if (productIds.length) await rpc.archive('product.template', productIds.splice(0)).catch(() => undefined);
  });

  test('1. Pricelists list opens from Sales > Products @smoke', async ({ page }) => {
    await openPricelists(page);
    await expect(page.locator('.o_breadcrumb, .breadcrumb').first()).toContainText(/pricelists/i);
  });

  test('2. a pricelist with a product price rule can be created and saved', async ({ page, rpc }) => {
    const name = uniqueName('Pricelist');
    const price = 123.45;
    let [product] = await rpc.searchRead<{ id: number; name: string }>(
      'product.template', [['name', 'ilike', PRODUCT], ['sale_ok', '=', true]], ['name'], { limit: 1 });
    if (!product) {
      // the named product does not exist on this environment → create one for the test (archived again in afterEach)
      const newName = uniqueName('Pricelist Product');
      const id = await rpc.callMethod<number>('product.template', 'create',
        [{ name: newName, sale_ok: true, default_code: `TST${Date.now()}` }]);
      productIds.push(id);
      product = { id, name: newName };
    }

    await openPricelists(page);
    await page.locator('button.o_list_button_add:visible, button.o-kanban-button-new:visible').first().click();
    await page.locator('#name_0').fill(name);
    await page.locator('#name_0').press('Enter'); // the tour presses Enter after typing the name

    // Group Type and Order Payment Method are required on this build (not in the recorded tour)
    for (const [field, value] of [['x_studio_group_type', 'General'], ['x_studio_order_payment_method', 'Cash']]) {
      const select = page.locator(`[name="${field}"] select`).first();
      if (await select.isVisible({ timeout: 3_000 }).catch(() => false)) await select.selectOption(value);
    }
    await page.locator('td.o_field_x2many_list_row_add > a').first().click(); // Add a line
    // Some builds add the rule in an inline row (as recorded), others open a "Create Pricelist Rules" dialog.
    const dialog = page.locator('.modal-dialog');
    const inlineRow = page.locator('.o_data_row.o_selected_row').first();
    await Promise.race([
      dialog.waitFor({ state: 'visible', timeout: 30_000 }),
      inlineRow.waitFor({ state: 'visible', timeout: 30_000 }),
    ]).catch(() => undefined);
    if (await dialog.isVisible()) {
      await dialog.getByText('Product', { exact: true }).first().click(); // Apply On → Product
      await dialog.locator('[name="product_tmpl_id"] input').first().fill(product.name);
      const opt = page.locator('.ui-autocomplete .ui-menu-item', { hasText: product.name }).first();
      await opt.waitFor({ state: 'visible', timeout: 20_000 });
      await opt.click();
      await dialog.locator('[name="fixed_price"] input').first().fill(String(price));
      await dialog.getByRole('button', { name: 'Save & Close' }).click();
      await dialog.waitFor({ state: 'hidden' });
    } else {
      const row = page.locator('.o_data_row.o_selected_row').first();
      await row.locator('td[name="product_tmpl_id"] input').first().fill(product.name);
      await page.locator('.ui-autocomplete .ui-menu-item').first().click();
      await row.locator('td[name="fixed_price"] input').first().fill(String(price));
    }
    // Group Type and Order Payment Method are required on this build (not in the recorded tour)
    for (const [field, value] of [['x_studio_group_type', 'General'], ['x_studio_order_payment_method', 'Cash']]) {
      const sel = page.locator(`[name="${field}"] select`).first();
      if (await sel.isVisible({ timeout: 3_000 }).catch(() => false)) await sel.selectOption(value);
    }
    await page.locator('.o_form_button_save:visible').first().click();

    await expect.poll(async () => {
      const rows = await rpc.searchRead<{ id: number }>('product.pricelist', [['name', '=', name]], ['id']);
      listIds.push(...rows.map(r => r.id).filter(id => !listIds.includes(id)));
      return rows.length;
    }, { timeout: 30_000, message: 'the pricelist should exist in Odoo after Save' }).toBe(1);

    const items = await rpc.searchRead<{ fixed_price: number; product_tmpl_id: [number, string] | false }>(
      'product.pricelist.item', [['pricelist_id', '=', listIds[0]]], ['fixed_price', 'product_tmpl_id']);
    expect(items, 'the price rule should be saved with the pricelist').toHaveLength(1);
    expect(items[0].fixed_price).toBeCloseTo(price, 2);
    expect(items[0].product_tmpl_id && items[0].product_tmpl_id[0]).toBe(product.id);
  });

  test('3. a saved pricelist shows in the Pricelists list', async ({ page, rpc }) => {
    const name = uniqueName('Pricelist');
    listIds.push(await rpc.create('product.pricelist', { name }) as number);

    await openPricelists(page);
    await page.locator('.o_searchview_input').fill(name);
    await page.keyboard.press('Enter');
    await expect(page.locator('.o_kanban_record, .o_data_row').filter({ hasText: name })).toHaveCount(1);
  });
});

/** Opens Sales → Products → Products by clicking the menus, as the tour does. */
async function openProducts(page: Page): Promise<void> {
  await ensureLoggedIn(page);
  const app = page.locator('[data-menu-xmlid="sale.sale_menu_root"]').first();
  if (!await app.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole('link', { name: 'Home menu' }).click();
  }
  await app.click();
  await page.locator('[data-menu-xmlid="sale.product_menu_catalog"]').first().click();
  await page.locator('[data-menu-xmlid="sale.menu_product_template_action"]').first().click();
  await expect(page.locator('.o_kanban_view, .o_list_view').first()).toBeVisible({ timeout: 30_000 });
}

test.describe('Products Configuration @module:sales @step:config', () => {
  const productIds: number[] = [];

  test.afterEach(async ({ rpc }) => {
    if (productIds.length) await rpc.archive('product.template', productIds.splice(0)).catch(() => undefined);
  });

  test('1. Products list opens from Sales > Products @smoke', async ({ page }) => {
    await openProducts(page);
    await expect(page.locator('.o_breadcrumb, .breadcrumb').first()).toContainText(/products/i);
  });

  test('2. a new product can be created and saved', async ({ page, rpc }) => {
    const name = uniqueName('Product');
    await openProducts(page);
    await page.locator('button.o_list_button_add:visible, button.o-kanban-button-new:visible').first().click();
    await page.locator('#name_0').fill(name);
    await page.locator('#name_0').press('Enter'); // the tour presses Enter after typing the name
    // Internal Reference is required on this build (not in the recorded tour)
    const ref = page.locator('[name="default_code"] input').first();
    if (await ref.isVisible({ timeout: 3_000 }).catch(() => false) && !(await ref.inputValue())) {
      await ref.fill(`TST${Date.now()}`);
    }
    const save = page.locator('.o_form_button_save:visible').first();
    if (await save.isEnabled({ timeout: 3_000 }).catch(() => false)) await save.click();

    await expect.poll(async () => {
      const rows = await rpc.searchRead<{ id: number }>('product.template', [['name', '=', name]], ['id']);
      productIds.push(...rows.map(r => r.id).filter(id => !productIds.includes(id)));
      return rows.length;
    }, { timeout: 30_000, message: 'the product should exist in Odoo after Save' }).toBe(1);
    await expect(page.locator('.o_form_view')).toContainText(name);
  });

  test('3. a saved product shows in the Products list', async ({ page, rpc }) => {
    const name = uniqueName('Product');
    productIds.push(await rpc.create('product.template', { name }) as number);

    await openProducts(page);
    await page.locator('.o_searchview_input').fill(name);
    await page.keyboard.press('Enter');
    await expect(page.locator('.o_kanban_record, .o_data_row').filter({ hasText: name })).toHaveCount(1);
  });
});
