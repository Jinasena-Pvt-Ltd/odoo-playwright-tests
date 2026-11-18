/**
 * Step 4 — User permissions for the sales module (admin-only audit).
 *
 * Only the admin login is configured, so instead of logging in as each role these tests read the
 * security setup straight from Odoo (groups, access rights, record rules) and check it is what the
 * business expects. A group that is renamed, emptied, or given the wrong CRUD rights fails here.
 *
 *   1. every custom "Jin - Sales" group exists
 *   2. every approver group has at least one user (otherwise its approvals can never be given)
 *   3. sales order access rights: Administrator full · Own Documents Only cannot delete · Read-only cannot write
 *   4. the "View Only" group has no create / write / delete right on any model (except the allowed Sales Model Debug)
 *   5. sales orders are protected by record rules, and "Own Documents Only" is limited to the user's own orders
 *   6. admin can open Sales > Configuration > Settings in the browser
 *   7. security audit: the CRUD matrix of every group on sale.order is attached to the report
 *
 * Nothing is created or changed, so there is nothing to clean up.
 */
import { test, expect } from '../../../../core/fixtures/index';
import type { OdooRPC } from '../../../../core/api/OdooRPC';

/** The custom Sales groups the business relies on (label as shown after "Sales / "). */
const CUSTOM_GROUPS = [
  'Jin - Sales - Add/Edit/Del Ca Customers',
  'Jin - Sales - Bank Guarantee Approvers',
  'Jin - Sales - Credit Limit Approvers',
  'Jin - Sales - Credit Note Approvers',
  'Jin - Sales - Over Commission Approvers',
  'Jin - Sales - Overdue Approvers',
  'Jin - Sales - POS Users',
  'Jin - Sales - Sales Margin Approvers',
  'Jin - Sales - Temporary Credit Approvers',
  'Jin - Sales - View Only',
];
/** Models the View Only group is deliberately allowed to change. */
const VIEW_ONLY_ALLOWED_MODELS = ['x_sales_model_debug'];
/** Groups whose whole purpose is to give approvals — they must have somebody in them. */
const APPROVER_GROUPS = CUSTOM_GROUPS.filter(g => /Approvers$/.test(g));

interface Group { id: number; full_name: string; users: number[] }
interface Access {
  group_id: [number, string] | false;
  perm_read: boolean; perm_write: boolean; perm_create: boolean; perm_unlink: boolean;
}

async function salesGroups(rpc: OdooRPC): Promise<Group[]> {
  return rpc.searchRead<Group>('res.groups', [['category_id.name', 'ilike', 'Sales']], ['full_name', 'users'], { order: 'full_name' });
}

const groupOf = (groups: Group[], label: string) => groups.find(g => g.full_name.endsWith(label));
const crud = (a: Access) => `${a.perm_read ? 'R' : '-'}${a.perm_write ? 'W' : '-'}${a.perm_create ? 'C' : '-'}${a.perm_unlink ? 'D' : '-'}`;

test.describe('Sales User Permissions @module:sales @step:permissions @module:security-audit', () => {

  test('1. every custom Sales group exists @smoke', async ({ rpc }) => {
    const groups = await salesGroups(rpc);
    const missing = CUSTOM_GROUPS.filter(label => !groupOf(groups, label));
    expect(missing, `Missing Sales groups: ${missing.join(', ')}`).toEqual([]);
  });

  test('2. every approver group has at least one user', async ({ rpc }) => {
    const groups = await salesGroups(rpc);
    const empty = APPROVER_GROUPS.filter(label => (groupOf(groups, label)?.users.length ?? 0) === 0);
    expect(empty, `Approver groups with no user: ${empty.join(', ')}`).toEqual([]);
  });

  test('3. sales order access rights: Administrator full, Own Documents cannot delete, Read-only cannot write', async ({ rpc }) => {
    const acl = await rpc.searchRead<Access>('ir.model.access', [['model_id.model', '=', 'sale.order']],
      ['group_id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink']);
    const forGroup = (label: string) => acl.filter(a => a.group_id && a.group_id[1] === label);

    const admin = forGroup('Sales / Administrator');
    expect(admin.length, 'Sales / Administrator must have an access rule on sale.order').toBeGreaterThan(0);
    expect(admin.some(a => a.perm_read && a.perm_write && a.perm_create && a.perm_unlink),
      'Sales Administrator should be able to read, edit, create and delete orders').toBe(true);

    const own = forGroup('Sales / User: Own Documents Only');
    expect(own.length, '"User: Own Documents Only" must have an access rule on sale.order').toBeGreaterThan(0);
    expect(own.some(a => a.perm_unlink), '"User: Own Documents Only" must NOT be able to delete orders').toBe(false);
    expect(own.some(a => a.perm_read && a.perm_write && a.perm_create), 'Own Documents users should read, edit and create').toBe(true);

    const readOnly = acl.filter(a => a.group_id && /Read-only/.test(a.group_id[1]));
    for (const a of readOnly) {
      expect(a.perm_write || a.perm_create || a.perm_unlink, `${a.group_id && a.group_id[1]} must be read-only`).toBeFalsy();
    }
  });

  test('4. the View Only group has no create, edit or delete right', async ({ rpc }) => {
    const groups = await salesGroups(rpc);
    const viewOnly = groupOf(groups, 'Jin - Sales - View Only');
    expect(viewOnly, 'Jin - Sales - View Only group not found').toBeTruthy();
    // Sales Model Debug is intentionally fully editable (view, edit, create, delete) by View Only users — agreed with the business.
    const writable = await rpc.searchRead<{ name: string; model_id: [number, string] }>('ir.model.access',
      [['group_id', '=', viewOnly!.id], ['model_id.model', 'not in', VIEW_ONLY_ALLOWED_MODELS],
        '|', '|', ['perm_write', '=', true], ['perm_create', '=', true], ['perm_unlink', '=', true]],
      ['name', 'model_id']);
    expect(writable.map(w => `${w.model_id[1]} (${w.name})`),
      'View Only must not be able to change any model').toEqual([]);
  });

  test('5. sales orders are protected by record rules; Own Documents Only is limited to own orders', async ({ rpc }) => {
    const rules = await rpc.searchRead<{ name: string; domain_force: string; groups: number[] }>(
      'ir.rule', [['model_id.model', '=', 'sale.order']], ['name', 'domain_force', 'groups']);
    expect(rules.length, 'sale.order should have record rules').toBeGreaterThan(0);

    const groups = await salesGroups(rpc);
    const own = groupOf(groups, 'User: Own Documents Only');
    expect(own, '"User: Own Documents Only" group not found').toBeTruthy();
    const ownRule = rules.find(r => r.groups.includes(own!.id));
    expect(ownRule, 'a record rule should apply to "User: Own Documents Only"').toBeTruthy();
    expect(ownRule!.domain_force, 'the Own Documents rule must restrict orders to the user').toMatch(/user_id|create_uid/);
  });

  test('6. admin can open Sales > Configuration > Settings', async ({ page }) => {
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
    }
    const app = page.locator('[data-menu-xmlid="sale.sale_menu_root"]').first();
    if (!await app.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.getByRole('link', { name: 'Home menu' }).click();
    }
    await app.click();
    await page.locator('[data-menu-xmlid="sale.menu_sale_config"]').first().click();
    await page.locator('[data-menu-xmlid="sale.menu_sale_general_settings"]').first().click();
    await expect(page.locator('.o_form_view, .o_base_settings').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.modal .o_error_dialog')).toHaveCount(0);
  });

  test('7. security audit: attach the CRUD matrix of every group on sale.order', async ({ rpc }, testInfo) => {
    const acl = await rpc.searchRead<Access>('ir.model.access', [['model_id.model', '=', 'sale.order']],
      ['group_id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink']);
    const rows = acl.map(a => `${(a.group_id ? a.group_id[1] : '(everyone)').padEnd(46)} ${crud(a)}`);
    await testInfo.attach('sale.order access rights', {
      body: `Group                                          R=read W=write C=create D=delete\n${rows.join('\n')}`,
      contentType: 'text/plain',
    });
    expect(rows.length, 'sale.order should have access rules').toBeGreaterThan(0);
  });
});
