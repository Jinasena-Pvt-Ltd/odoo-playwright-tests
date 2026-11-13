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
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../../../core/fixtures/index';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';

const TERM_MODEL = 'account.payment.term';

/** Opens Accounting → Configuration → Payment Terms by clicking the menus, as the tour does. */
async function openPaymentTerms(page: Page): Promise<void> {
  await page.goto('/web');
  const app = page.locator('[data-menu-xmlid="account_accountant.menu_accounting"]').first();
  if (!await app.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator('.o_menu_toggle, .o_navbar_apps_menu button').first().click();
  }
  await app.click();
  await page.locator('[data-menu-xmlid="account.menu_finance_configuration"]').first().click();
  await page.locator('[data-menu-xmlid="account.menu_action_payment_term_form"]').first().click();
  await expect(page.locator('.o_list_view, .o_view_controller').first()).toBeVisible();
}

/** Creates a payment term through the form (tour steps New → name → Save). Returns its name. */
async function createTermByUi(page: Page, name: string): Promise<void> {
  await page.locator('.o_control_panel button.o_list_button_add, div.d-xl-inline-flex button.btn-primary').first().click();
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

  test.afterEach(async ({ rpc }) => {
    if (partnerIds.length) await rpc.archive('res.partner', partnerIds.splice(0)).catch(() => undefined);
    if (termIds.length) await rpc.archive(TERM_MODEL, termIds.splice(0)).catch(() => undefined);
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
    const partnerId = await rpc.create('res.partner', { name: uniqueName('Config Customer'), customer_rank: 1 }) as number;
    partnerIds.push(partnerId);

    await page.goto(`/web#id=${partnerId}&model=res.partner&view_type=form`);
    await page.locator('.o_form_view').waitFor();
    await page.getByRole('tab', { name: /sales\s*&\s*purchase/i }).click();
    const field = page.locator('[name="property_payment_term_id"] input');
    await field.fill(termName);
    await page.locator('.ui-autocomplete .ui-menu-item', { hasText: termName }).first().click();
    await page.locator('.o_form_button_save').click();
    await expect(page.locator('.o_form_button_save')).toBeHidden({ timeout: 20_000 });

    const [p] = await rpc.callMethod<Array<{ property_payment_term_id: [number, string] | false }>>(
      'res.partner', 'read', [[partnerId]], { fields: ['property_payment_term_id'] });
    expect(p.property_payment_term_id && p.property_payment_term_id[0]).toBe(termId);
  });
});
