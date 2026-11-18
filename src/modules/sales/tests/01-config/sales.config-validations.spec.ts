/**
 * Step 1 — Configuration: field validations on the configuration forms.
 *
 * For each configuration form that has a tour (payment term, sales team, customer group, pricelist, product):
 *   1. "blank name cannot be saved"  — New → Save with nothing typed: Odoo flags the field and creates no record
 *   2. "required fields are flagged" — only the name typed: every other mandatory field (the ones the recorded
 *      tours did not fill) is highlighted and Odoo still refuses to save
 * A record that is saved by mistake (= the validation is missing) is archived again at the end.
 *
 * Mandatory fields checked on top of the name (found on the current build):
 *   customer group → Payment Term, Receivable Account · pricelist → Group Type, Order Payment Method · product → Internal Reference
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../../../core/fixtures/index';
import type { OdooRPC } from '../../../../core/api/OdooRPC';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';

interface Form {
  label: string;
  model: string;
  /** Menu entries to click, outermost first (CSS selectors). */
  menu: string[];
  nameInput: string;
  nameField: string;
  /** Other mandatory fields (field names) that must be flagged when only the name is filled. */
  requiredExtras: string[];
  /** Field used for the active/archive flag. */
  activeField: 'active' | 'x_active';
}

const SALES = '[data-menu-xmlid="sale.sale_menu_root"]';
const FORMS: Form[] = [
  {
    label: 'payment term', model: 'account.payment.term', nameInput: '#name_0', nameField: 'name',
    menu: ['[data-menu-xmlid="account_accountant.menu_accounting"]', '[data-menu-xmlid="account.menu_finance_configuration"]',
      '[data-menu-xmlid="account.menu_action_payment_term_form"]'],
    requiredExtras: [], activeField: 'active',
  },
  {
    label: 'sales team', model: 'crm.team', nameInput: '#name_0', nameField: 'name',
    menu: [SALES, '[data-menu-xmlid="sale.menu_sale_config"]', '[data-menu-xmlid="sale.sales_team_config"]'],
    requiredExtras: [], activeField: 'active',
  },
  {
    label: 'customer group', model: 'x_customer_group', nameInput: '#x_name_0', nameField: 'x_name',
    menu: [SALES, '[data-menu-xmlid="sale.menu_sale_config"]',
      '[data-menu-xmlid^="studio_customization.sales_customer_group"], .dropdown-menu a:has-text("Customer Groups")'],
    requiredExtras: ['x_studio_payment_term', 'x_studio_receivable_account'], activeField: 'x_active',
  },
  {
    label: 'pricelist', model: 'product.pricelist', nameInput: '#name_0', nameField: 'name',
    menu: [SALES, '[data-menu-xmlid="sale.product_menu_catalog"]', '[data-menu-xmlid="sale.menu_product_pricelist_main"]'],
    requiredExtras: ['x_studio_group_type', 'x_studio_order_payment_method'], activeField: 'active',
  },
  {
    label: 'product', model: 'product.template', nameInput: '#name_0', nameField: 'name',
    menu: [SALES, '[data-menu-xmlid="sale.product_menu_catalog"]', '[data-menu-xmlid="sale.menu_product_template_action"]'],
    requiredExtras: ['default_code'], activeField: 'active',
  },
];

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

/** Clicks through the menus, then New, and waits for the empty form. */
async function openNewForm(page: Page, form: Form): Promise<void> {
  await ensureLoggedIn(page);
  const first = page.locator(form.menu[0]).first();
  if (!await first.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole('link', { name: 'Home menu' }).click();
  }
  for (const sel of form.menu) await page.locator(sel).first().click();
  await expect(page.locator('.o_kanban_view, .o_list_view').first()).toBeVisible({ timeout: 60_000 });
  await page.locator('button.o_list_button_add:visible, button.o-kanban-button-new:visible').first().click();
  await expect(page.locator(form.nameInput)).toBeVisible({ timeout: 30_000 });
}

const totalRecords = (rpc: OdooRPC, model: string) =>
  rpc.callMethod<number>(model, 'search_count', [[]], { context: { active_test: false } });

test.describe('Configuration field validations @module:sales @step:config', () => {
  const stray: Array<{ model: string; field: string; name: string }> = [];

  test.afterEach(async ({ rpc }) => {
    // anything that was saved although it should have been refused is deactivated again
    for (const s of stray.splice(0)) {
      const rows = await rpc.callMethod<Array<{ id: number }>>(s.model, 'search_read', [[[s.field, '=', s.name]]], { fields: ['id'] }).catch(() => []);
      if (rows.length) {
        const form = FORMS.find(f => f.model === s.model)!;
        await rpc.callMethod(s.model, 'write', [rows.map(r => r.id), { [form.activeField]: false }]).catch(() => undefined);
      }
    }
  });

  for (const form of FORMS) {
    test.describe(`${form.label} form`, () => {

      test(`${form.label}: a blank name cannot be saved`, async ({ page, rpc }) => {
        const before = await totalRecords(rpc, form.model);
        await openNewForm(page, form);
        await page.locator('.o_form_button_save:visible').first().click();

        // Odoo highlights the empty mandatory field and stays on the unsaved form
        await expect(page.locator('.o_field_invalid').first(), 'the empty name should be flagged as invalid').toBeVisible({ timeout: 20_000 });
        expect(await totalRecords(rpc, form.model), 'no record should be created from a blank form').toBe(before);
      });

      if (form.requiredExtras.length) {
        test(`${form.label}: the other mandatory fields are flagged when only the name is filled`, async ({ page, rpc }) => {
          const name = uniqueName(`Validation ${form.label}`);
          stray.push({ model: form.model, field: form.nameField, name });
          const before = await totalRecords(rpc, form.model);

          await openNewForm(page, form);
          await page.locator(form.nameInput).fill(name);
          await page.locator('.o_form_button_save:visible').first().click();

          for (const field of form.requiredExtras) {
            await expect(page.locator(`[name="${field}"].o_field_invalid, [name="${field}"] .o_field_invalid`).first(),
              `${field} is mandatory and should be flagged`).toBeVisible({ timeout: 20_000 });
          }
          expect(await totalRecords(rpc, form.model), 'Odoo must not save a record with mandatory fields empty').toBe(before);
        });
      }
    });
  }
});
