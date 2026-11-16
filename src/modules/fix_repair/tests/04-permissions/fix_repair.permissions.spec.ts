/**
 * Step 4 — User Permissions for the fix_repair module.
 *
 * What Fix-repair's own security grants (security/ir.model.access.csv, fix_repair_security.xml):
 * - Its catalogues (Resolutions, Diagnosis Areas, Repair Stages, ...): Helpdesk users and
 *   managers have full rights; every other internal user can only read them.
 * - Catalogue records are company-bound: a user sees only those of their allowed companies
 *   plus the ones without a company.
 * - The Fix Repair settings are only for Settings administrators (base.group_system).
 * The admin/manager/employee logins in .env are the same administrator on this env, so these
 * tests create their own users through RPC (as the admin), with a new random password on every
 * run, limited to JAM, and archive them afterwards:
 *   internal — internal user without Helpdesk rights
 *   helpdesk — internal user with Helpdesk / User
 */
import { randomBytes } from 'crypto';
import { Browser, Page } from '@playwright/test';
import { test, expect } from '../../../../core/fixtures/index';
import type { OdooRPC } from '../../../../core/api/OdooRPC';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';
import { waitForOdooIdle } from '../../../../core/utils/OdooIdle';

type Role = 'internal' | 'helpdesk';
const USERS: Record<Role, { name: string; login: string; groups: string[] }> = {
  internal: { name: '[TEST] PW Fix Repair Internal', login: 'pw.fixrepair.internal@test.invalid', groups: ['base.group_user'] },
  helpdesk: {
    name: '[TEST] PW Fix Repair Helpdesk',
    login: 'pw.fixrepair.helpdesk@test.invalid',
    groups: ['base.group_user', 'helpdesk.group_helpdesk_user'],
  },
};
const JAM_XMLID = 'seed_master_data_and_settings.company_jinasena_agricultural_machinery';
const ALL_COMPANIES = { context: { active_test: false } };

async function xmlidToId(rpc: OdooRPC, xmlid: string): Promise<number> {
  const [module, name] = xmlid.split('.');
  const rows = await rpc.searchRead<{ res_id: number }>('ir.model.data', [['module', '=', module], ['name', '=', name]], ['res_id']);
  if (!rows.length) throw new Error(`XML id not found: ${xmlid}`);
  return rows[0].res_id;
}

/** Create (or reactivate) the role's user with exactly its groups and a fresh password. */
async function ensureUser(rpc: OdooRPC, role: Role): Promise<{ login: string; password: string; id: number }> {
  const spec = USERS[role];
  const jam = await xmlidToId(rpc, JAM_XMLID);
  const groupIds = await Promise.all(spec.groups.map((g) => xmlidToId(rpc, g)));
  const password = randomBytes(18).toString('base64url');
  const values = {
    name: spec.name,
    login: spec.login,
    password,
    active: true,
    company_id: jam,
    company_ids: [[6, 0, [jam]]],
    groups_id: [[6, 0, groupIds]],
  };
  const found = await rpc.callMethod<number[]>('res.users', 'search', [[['login', '=', spec.login]]], ALL_COMPANIES);
  const id = found.length ? found[0] : await rpc.create('res.users', values);
  if (found.length) await rpc.write('res.users', [id], values);
  return { login: spec.login, password, id };
}

async function archiveUser(rpc: OdooRPC, id: number) {
  await rpc.write('res.users', [id], { active: false }).catch(() => undefined);
}

async function loginAs(browser: Browser, creds: { login: string; password: string }): Promise<Page> {
  const context = await browser.newContext({ baseURL: process.env.ODOO_BASE_URL });
  const page = await context.newPage();
  await page.goto('/web/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(creds.login);
  await page.getByRole('textbox', { name: 'Password' }).fill(creds.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.locator('.o_main_navbar').waitFor({ state: 'visible', timeout: 60_000 });
  await waitForOdooIdle(page);
  return page;
}

async function homeMenuHas(page: Page, menuXmlid: string): Promise<boolean> {
  await page.goto('/web');
  await waitForOdooIdle(page);
  // With no app open (e.g. a new user) Odoo shows the app grid and hides the toggle; otherwise
  // the toggle opens it. Wait until one of the two is on screen before deciding.
  const grid = page.locator('.o_home_menu, .o_apps').first();
  await page.locator('.o_home_menu, .o_apps, a.o_menu_toggle:visible').first().waitFor({ state: 'visible', timeout: 30_000 });
  if (!(await grid.isVisible())) await page.locator('a.o_menu_toggle:visible').click();
  await grid.waitFor({ state: 'visible', timeout: 15_000 });
  return (await page.locator(`[data-menu-xmlid="${menuXmlid}"]`).count()) > 0;
}

async function openResolutionsList(page: Page) {
  // By its action (Helpdesk > Repair Diagnosis > Resolutions), so it also opens for a user
  // without the Helpdesk app.
  await page.goto('/web#action=Fix-repair.action_resolutions');
  await page.locator('.o_list_view').first().waitFor({ state: 'visible', timeout: 30_000 });
  await waitForOdooIdle(page);
}

test.describe('Fix Repair User Permissions @module:fix_repair @step:permissions', () => {
  test('an internal user without Helpdesk rights has no Helpdesk app and only reads the catalogues @smoke', async ({ rpc, browser }) => {
    const user = await ensureUser(rpc, 'internal');
    const page = await loginAs(browser, user);
    try {
      expect(await homeMenuHas(page, 'helpdesk.menu_helpdesk_root'), 'Helpdesk app hidden').toBe(false);
      await openResolutionsList(page);
      expect(await page.locator('.o_data_row').count(), 'catalogue rows readable').toBeGreaterThan(0);
      await expect(page.locator('.o_list_button_add'), 'no New button without create rights').toHaveCount(0);
    } finally {
      await page.context().close();
      await archiveUser(rpc, user.id);
    }
  });

  test('a Helpdesk user has the Helpdesk app and can create and delete catalogue records', async ({ rpc, browser }) => {
    const user = await ensureUser(rpc, 'helpdesk');
    const page = await loginAs(browser, user);
    const name = uniqueName('PW resolution');
    try {
      expect(await homeMenuHas(page, 'helpdesk.menu_helpdesk_root'), 'Helpdesk app shown').toBe(true);
      await openResolutionsList(page);
      await page.locator('.o_list_button_add:visible').first().click();
      const nameInput = page.locator('.o_field_widget[name="x_name"] input').first();
      await nameInput.waitFor({ state: 'visible', timeout: 15_000 });
      await nameInput.fill(name);
      await page.locator('.o_list_button_save:visible, .o_form_button_save:visible').first().click();
      await waitForOdooIdle(page);
      const created = await rpc.callMethod<number[]>('x_resolutions', 'search', [[['x_name', '=', name]]], ALL_COMPANIES);
      expect(created.length, 'record created by the Helpdesk user').toBe(1);

      const row = page.locator('.o_data_row', { hasText: name }).first();
      await row.locator('.o_list_record_selector input').check();
      await page.locator('.o_cp_action_menus button, .o_control_panel .dropdown-toggle', { hasText: 'Actions' }).first().click();
      await page.locator('.o-dropdown--menu .dropdown-item, .o_menu_item', { hasText: 'Delete' }).first().click();
      await page.locator('.modal .btn-primary', { hasText: /Delete|Ok/ }).first().click();
      await waitForOdooIdle(page);
      expect(
        (await rpc.callMethod<number[]>('x_resolutions', 'search', [[['x_name', '=', name]]], ALL_COMPANIES)).length,
        'record deleted by the Helpdesk user',
      ).toBe(0);
    } finally {
      const left = await rpc.callMethod<number[]>('x_resolutions', 'search', [[['x_name', '=', name]]], ALL_COMPANIES).catch(() => []);
      if (left.length) await rpc.unlink('x_resolutions', left).catch(() => undefined);
      await page.context().close();
      await archiveUser(rpc, user.id);
    }
  });

  test('a JAM-only user sees only JAM and shared catalogue records', async ({ rpc, browser }) => {
    const jam = await xmlidToId(rpc, JAM_XMLID);
    // The admin's own companies (asking for others is refused).
    const [admin] = await rpc.searchRead<{ company_ids: number[] }>(
      'res.users',
      [['login', '=', process.env.ADMIN_EMAIL ?? 'admin']],
      ['company_ids'],
    );
    const everywhere = { context: { active_test: true, allowed_company_ids: admin.company_ids } };
    const visibleForJam = await rpc.callMethod<number>(
      'x_resolutions',
      'search_count',
      [['|', ['x_studio_company_id', '=', jam], ['x_studio_company_id', '=', false]]],
      everywhere,
    );
    const total = await rpc.callMethod<number>('x_resolutions', 'search_count', [[]], everywhere);
    test.skip(total === visibleForJam, 'every Resolutions record is JAM or shared; nothing to hide');

    const user = await ensureUser(rpc, 'helpdesk');
    const page = await loginAs(browser, user);
    try {
      await openResolutionsList(page);
      await expect(page.locator('.o_data_row')).toHaveCount(visibleForJam);
    } finally {
      await page.context().close();
      await archiveUser(rpc, user.id);
    }
  });

  test('the Fix Repair settings are only for administrators', async ({ rpc, browser, page }) => {
    await page.goto('/web#action=base_setup.action_general_configuration');
    await page.locator('.o_setting_container, .settings').first().waitFor({ state: 'visible', timeout: 30_000 });
    await waitForOdooIdle(page);
    await expect(page.getByText('Fix Repair').first(), 'admin sees the Fix Repair settings').toBeVisible();

    const user = await ensureUser(rpc, 'helpdesk');
    const userPage = await loginAs(browser, user);
    try {
      expect(await homeMenuHas(userPage, 'base.menu_administration'), 'no Settings app for a Helpdesk user').toBe(false);
    } finally {
      await userPage.context().close();
      await archiveUser(rpc, user.id);
    }
  });
});
