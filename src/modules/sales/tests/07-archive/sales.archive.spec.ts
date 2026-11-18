/**
 * Step 7 — Archive & Cleanup for the sales module (soft-delete and reactivation).
 *
 * For each kind of sales record a test record is created (by RPC, as setup), then through the screen:
 *   1. Action ▸ Archive  → the record becomes inactive and drops out of the normal search
 *   2. Action ▸ Unarchive → the record is active again and is found by the normal search
 * Records: customer, product, pricelist, payment term, sales team.
 * Every record is archived again at the end, so no test data is left active.
 * Only test records created here are touched.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../../../core/fixtures/index';
import type { OdooRPC } from '../../../../core/api/OdooRPC';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';
import { COMPANY } from '../../flows/flowHelpers';

interface Kind {
  label: string;
  model: string;
  /** Values for rpc.create(); may look things up (the customer form needs a Customer Group etc.). */
  values: (rpc: OdooRPC, name: string) => Promise<Record<string, unknown>>;
}

const KINDS: Kind[] = [
  {
    label: 'customer',
    model: 'res.partner',
    values: async (rpc, name) => {
      const [co] = await rpc.searchRead<{ id: number }>('res.company', [['name', '=', COMPANY]], ['id'], { limit: 1 });
      const groups = await rpc.searchRead<{ id: number; x_studio_company_id: [number, string] | false }>(
        'x_customer_group', [['x_active', '=', true]], ['x_studio_company_id'], { order: 'id' });
      const group = groups.find(g => g.x_studio_company_id && co && g.x_studio_company_id[0] === co.id);
      return { name, customer_rank: 1, x_studio_payment_method: 'Cash', ...(group ? { x_studio_customer_group: group.id } : {}) };
    },
  },
  { label: 'product', model: 'product.template', values: async (_r, name) => ({ name }) },
  { label: 'pricelist', model: 'product.pricelist', values: async (_r, name) => ({ name }) },
  { label: 'payment term', model: 'account.payment.term', values: async (_r, name) => ({ name }) },
  { label: 'sales team', model: 'crm.team', values: async (_r, name) => ({ name }) },
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

/** Opens the record's form and picks an entry from the Action (gear) menu. */
async function chooseAction(page: Page, model: string, id: number, action: 'Archive' | 'Unarchive'): Promise<void> {
  await page.goto(`/web#id=${id}&model=${model}&view_type=form`);
  await page.locator('.o_form_view').waitFor({ timeout: 60_000 });
  await page.locator('.o_cp_action_menus .dropdown-toggle, .o_cp_action_menus button').first().click();
  await page.locator('.o-dropdown--menu .o-dropdown-item, .dropdown-menu .dropdown-item')
    .filter({ hasText: new RegExp(`^\\s*${action}\\s*$`) }).first().click();
  if (action === 'Archive') {
    // Odoo asks for confirmation before archiving
    const confirm = page.locator('.modal-dialog').getByRole('button', { name: /archive|ok|confirm/i }).first();
    if (await confirm.isVisible({ timeout: 5_000 }).catch(() => false)) await confirm.click();
  }
}

/** Is the record found by Odoo's normal (active only) search? */
async function isActive(rpc: OdooRPC, model: string, id: number): Promise<boolean> {
  const rows = await rpc.searchRead<{ id: number }>(model, [['id', '=', id]], ['id']);
  return rows.length === 1;
}

test.describe('Sales Archive & Cleanup @module:sales @step:archive', () => {
  const created: Array<{ model: string; id: number }> = [];

  test.afterEach(async ({ rpc }) => {
    for (const rec of created.splice(0)) {
      // customer groups etc. are not touched; only the records this test created are archived again
      await rpc.archive(rec.model, [rec.id]).catch(() => undefined);
    }
  });

  for (const kind of KINDS) {
    test(`${kind.label}: archive hides it, unarchive brings it back`, async ({ page, rpc }) => {
      const name = uniqueName(`Archive ${kind.label}`);
      const id = await rpc.callMethod<number>(kind.model, 'create', [await kind.values(rpc, name)]);
      created.push({ model: kind.model, id });
      expect(await isActive(rpc, kind.model, id), 'the new record starts active').toBe(true);

      await ensureLoggedIn(page);
      await chooseAction(page, kind.model, id, 'Archive');
      await expect.poll(() => isActive(rpc, kind.model, id), {
        timeout: 30_000, message: `the ${kind.label} should be archived (inactive) after Action > Archive`,
      }).toBe(false);

      await chooseAction(page, kind.model, id, 'Unarchive');
      await expect.poll(() => isActive(rpc, kind.model, id), {
        timeout: 30_000, message: `the ${kind.label} should be active again after Action > Unarchive`,
      }).toBe(true);
    });
  }
});
