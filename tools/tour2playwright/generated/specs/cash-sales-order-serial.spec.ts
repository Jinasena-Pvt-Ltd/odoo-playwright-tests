/**
 * Replay of the "Cash Sales Order - Serial" tour (tour/cash-sales-order-serial.json): a Cash order for a
 * serial-number product, a new serial number on the delivery, validate, invoice and cash payment —
 * screenshotting every step for the manual. Each screenshot outlines the element the step acts on (red box),
 * taken just before the action. Step numbers (sequence) match the tour JSON.
 *
 * Tour replay, not a module test: lives under the gitignored generated/ folder.
 * WARNING: with CONFIRM_REAL_RECORDS=true this creates a real sales order, delivery, new serial number,
 * invoice and payment.
 */
import { test, Page, Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { openOdooApp } from '../../../../src/modules/sales/pages/openOdooApp';

const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots/cash-sales-order-serial');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
const SERIAL = 'DOC' + Date.now().toString(36).toUpperCase();
const failures: string[] = [];

async function shot(page: Page, sequence: number, label: string, target?: Locator): Promise<void> {
  if (target) {
    await target.scrollIntoViewIfNeeded().catch(() => {});
    await target
      .evaluate((el) => {
        const e = el as HTMLElement;
        e.dataset.prevStyle = e.getAttribute('style') ?? '';
        e.style.outline = '4px solid #e53935';
        e.style.outlineOffset = '2px';
        e.style.boxShadow = '0 0 0 8px rgba(229,57,53,0.30)';
        e.style.zIndex = '9999';
      })
      .catch(() => {});
  }
  await page.waitForTimeout(500);
  const file = path.join(SCREENSHOT_DIR, `step-${String(sequence).padStart(3, '0')}.png`);
  await page.screenshot({ path: file });
  await test.info().attach(`step-${sequence}-${label}`, { path: file, contentType: 'image/png' });
  if (target) {
    await target
      .evaluate((el) => {
        const e = el as HTMLElement;
        e.setAttribute('style', e.dataset.prevStyle ?? '');
        delete e.dataset.prevStyle;
      })
      .catch(() => {});
  }
}

async function shotThenClick(page: Page, sequence: number, label: string, target: Locator): Promise<void> {
  await target.waitFor({ state: 'visible', timeout: 15_000 });
  await shot(page, sequence, label, target);
  await target.click({ timeout: 20_000 });
}

/** Runs one documented step; a failure is logged and the replay carries on (the manual notes missing shots). */
async function step(sequence: number, label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    const msg = `step ${sequence} (${label}): ${String(e).split('\n')[0]}`;
    failures.push(msg);
    console.log('STEPFAIL', msg);
  }
}

const MENU = '.o-dropdown--menu, .ui-autocomplete, .o-autocomplete--dropdown-menu';
const topModal = (page: Page) => page.locator('.modal:visible').last();

function option(page: Page, text: string): Locator {
  return page
    .locator('.o-dropdown--menu .o_menu_item, .ui-autocomplete .ui-menu-item, .o-autocomplete--dropdown-item')
    .filter({ hasText: text })
    .first();
}

async function openMany2one(page: Page, fieldName: string): Promise<Locator> {
  const input = page.locator(`.o_field_widget[name="${fieldName}"] input`).first();
  await input.scrollIntoViewIfNeeded();
  await input.click();
  const menu = page.locator(MENU).first();
  if (!(await menu.isVisible({ timeout: 3_000 }).catch(() => false))) await input.click();
  await menu.waitFor({ state: 'visible', timeout: 8_000 });
  return input;
}

function listRow(page: Page, text: string): Locator {
  return page.locator('.modal .o_data_row, .o_list_table .o_data_row').filter({ hasText: text }).first();
}

/** Press through any confirmation dialog Odoo shows after a click (Apply / Validate / Confirm / OK). */
async function acceptDialogs(page: Page): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(1200);
    const dlg = page.locator('.modal:visible').last();
    if (!(await dlg.isVisible().catch(() => false))) return;
    const btn = dlg.locator('footer button').filter({ hasText: /^(apply|validate|confirm|ok|process|create draft invoice|create invoice)$/i }).first();
    if (!(await btn.isVisible().catch(() => false))) return;
    await btn.click();
  }
}

test('Cash Sales Order - Serial tour replay', async ({ page }) => {
  test.setTimeout(600_000);

  // 10 — app grid with the Sales tile outlined
  await openOdooApp(page, 'Sales');
  await step(10, 'open-sales', async () => {
    await page.getByRole('link', { name: 'Home menu' }).click();
    const salesTile = page.getByRole('option', { name: 'Sales', exact: true });
    await salesTile.waitFor({ state: 'visible', timeout: 15_000 });
    await shot(page, 10, 'open-sales', salesTile);
    await salesTile.click();
    await page.waitForSelector('.o_list_view, .o_kanban_view, .o_form_view', { state: 'visible', timeout: 20_000 });
  });
  await step(20, 'orders', () => shotThenClick(page, 20, 'orders', page.locator('[data-menu-xmlid="sale.sale_order_menu"]')));
  await step(30, 'quotations', () => shotThenClick(page, 30, 'quotations', page.locator('[data-menu-xmlid="sale.menu_sale_quotations"]')));
  await step(40, 'new', () => shotThenClick(page, 40, 'new', page.locator('.o_control_panel').getByRole('button', { name: 'New' })));

  // 50/60 — customer
  await step(50, 'search-customer', async () => {
    const customerInput = page.locator('.o_field_widget[name="partner_id"] input').first();
    await customerInput.click();
    await customerInput.fill('abc');
    await page.locator(MENU).first().waitFor({ state: 'visible', timeout: 8_000 });
    await shot(page, 50, 'search-customer', customerInput);
  });
  await step(60, 'select-customer', () => shotThenClick(page, 60, 'select-customer', option(page, 'abc')));

  // 70/80 — selections (outline after choosing so the chosen value is visible)
  await step(70, 'payment-type', async () => {
    const paymentType = page.locator('#x_studio_order_payment_method_0');
    await paymentType.selectOption({ label: 'Cash' });
    await shot(page, 70, 'payment-type', paymentType);
  });
  await step(80, 'quotation-type', async () => {
    const quotationType = page.locator('#x_studio_quotation_type_0');
    await quotationType.selectOption({ label: 'Sales' });
    await shot(page, 80, 'quotation-type', quotationType);
  });

  // 90–130 — product line (open the field, Search More..., search EY20KP, pick the row)
  await step(90, 'add-product', () => shotThenClick(page, 90, 'add-product', page.locator('td.o_field_x2many_list_row_add > a').first()));
  await step(100, 'product-field', async () => {
    const productInput = page.locator('.o_field_widget[name="product_id"] input').last();
    await productInput.click();
    await page.locator(MENU).first().waitFor({ state: 'visible', timeout: 8_000 });
    await shot(page, 100, 'product-field', productInput);
  });
  await step(110, 'product-search-more', () => shotThenClick(page, 110, 'product-search-more', page.getByText('Search More...').first()));
  await step(120, 'product-search', async () => {
    const search = topModal(page).locator('input.o_searchview_input').first();
    await search.waitFor({ state: 'visible', timeout: 15_000 });
    await search.fill('EY20KP');
    await search.press('Enter');
    await page.waitForTimeout(1500);
    await shot(page, 120, 'product-search', search);
  });
  await step(130, 'product-selected', () => shotThenClick(page, 130, 'product-selected', listRow(page, 'EY20KP')));

  // 140–220 — Other Info tab
  await step(140, 'other-info', () => shotThenClick(page, 140, 'other-info', page.locator('a[name="other_information"]')));
  await step(150, 'payment-terms', async () => {
    const termInput = await openMany2one(page, 'payment_term_id');
    await shot(page, 150, 'payment-terms', termInput);
  });
  await step(160, 'immediate-payment', () => shotThenClick(page, 160, 'immediate-payment', option(page, 'Immediate Payment')));
  await step(170, 'sales-team', async () => {
    const teamInput = await openMany2one(page, 'team_id');
    await shot(page, 170, 'sales-team', teamInput);
  });
  await step(180, 'team-search-more', () => shotThenClick(page, 180, 'team-search-more', page.getByText('Search More...').first()));
  await step(190, 'team-selected', () => shotThenClick(page, 190, 'team-selected', listRow(page, 'Colombo Sales Centre')));
  await step(200, 'warehouse', async () => {
    await page.waitForTimeout(1500);
    const whInput = page.locator('.o_field_widget[name="warehouse_id"] input').first();
    await whInput.scrollIntoViewIfNeeded();
    await shot(page, 200, 'warehouse', whInput); // Odoo fills the warehouse from the Sales Team
  });
  await step(210, 'warehouse-filled', async () => {
    await shot(page, 210, 'warehouse-filled', page.locator('.o_field_widget[name="warehouse_id"]').first());
  });
  await step(220, 'warehouse-selected', async () => {
    await shot(page, 220, 'warehouse-selected', page.locator('.o_field_widget[name="warehouse_id"] input').first());
  });

  // --- real records are created from here on: only replayed when CONFIRM_REAL_RECORDS=true ---
  if (process.env.CONFIRM_REAL_RECORDS !== 'true') return;

  await step(230, 'confirm-order', async () => {
    await shotThenClick(page, 230, 'confirm-order', page.locator('[data-hotkey="q"]').first());
    await page.waitForTimeout(2500);
  });
  await step(240, 'delivery', () => shotThenClick(page, 240, 'delivery', page.locator('button[name="action_view_delivery"]')));
  await step(250, 'open-move', () => shotThenClick(page, 250, 'open-move', page.locator('button[name="Open Move"]').first()));
  await step(260, 'add-a-line', () => shotThenClick(page, 260, 'add-a-line', topModal(page).locator('.o_field_x2many_list_row_add a').first()));
  await step(270, 'new-serial', () => shotThenClick(page, 270, 'new-serial', topModal(page).locator('footer .o_create_button').first()));
  await step(280, 'type-serial', async () => {
    const lot = topModal(page).locator('.o_field_widget[name="lot_id"] input').first();
    await lot.waitFor({ state: 'visible', timeout: 15_000 });
    await lot.click();
    await lot.fill('');
    await lot.pressSequentially(SERIAL, { delay: 60 });
    await page.locator('.o-autocomplete--dropdown-item').first().waitFor({ state: 'visible', timeout: 8_000 });
    await shot(page, 280, 'type-serial', lot);
  });
  await step(281, 'create-serial', () => shotThenClick(page, 281, 'create-serial', page.locator('.o-autocomplete--dropdown-item').filter({ hasText: /^Create "/ }).first()));
  await step(282, 'serial-entered', async () => {
    await page.waitForTimeout(800);
    await shot(page, 282, 'serial-entered', topModal(page).locator('.o_field_widget[name="lot_id"]').first());
  });
  await step(283, 'save-and-close', () => shotThenClick(page, 283, 'save-and-close', page.getByRole('button', { name: 'Save & Close' }).last()));
  await step(284, 'save-move', async () => {
    await page.waitForTimeout(1000);
    await shotThenClick(page, 284, 'save-move', topModal(page).getByRole('button', { name: 'Save', exact: true }).last());
    await page.waitForTimeout(1200);
  });
  await step(285, 'save-delivery', async () => {
    const save = page.locator('.o_form_button_save').first();
    if (await save.isVisible({ timeout: 4_000 }).catch(() => false)) await shotThenClick(page, 285, 'save-delivery', save);
    else await shot(page, 285, 'save-delivery');
    await page.waitForTimeout(1500);
  });

  // Not part of the tour: a brand-new serial has no stock, and Odoo refuses to deliver it (negative stock),
  // so put one unit into stock first (an inventory adjustment for the serial we just created).
  const err = await page.evaluate(async (name) => {
    const call = async (model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) => {
      const r = await fetch('/web/dataset/call_kw', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs } }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.data?.message ?? j.error.message);
      return j.result;
    };
    try {
      const info = await (await fetch('/web/session/get_session_info', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {} }) })).json();
      const cids = Object.keys(info.result?.user_companies?.allowed_companies ?? {}).map(Number);
      let lots: { id: number; product_id: [number, string]; company_id: [number, string] | false }[] = [];
      for (let i = 0; i < 10 && !lots.length; i++) {
        lots = await call('stock.lot', 'search_read', [[['name', '=', name]], ['id', 'product_id', 'company_id']], { context: { allowed_company_ids: cids } });
        if (!lots.length) await new Promise((r) => setTimeout(r, 1000));
      }
      if (!lots.length) return `serial ${name} not found`;
      const loc = await call('stock.location', 'search_read', [[['complete_name', 'ilike', 'JM-EK/Stock'], ['usage', '=', 'internal']], ['id']], { limit: 1 });
      const ctx = { inventory_mode: true, allowed_company_ids: lots[0].company_id ? [lots[0].company_id[0]] : cids };
      const q = await call('stock.quant', 'create', [{ product_id: lots[0].product_id[0], location_id: loc[0].id, lot_id: lots[0].id, inventory_quantity: 1 }], { context: ctx });
      await call('stock.quant', 'action_apply_inventory', [[q]], { context: ctx });
      return '';
    } catch (e) { return e instanceof Error ? e.message : String(e); }
  }, SERIAL);
  if (err) failures.push(`stock for serial ${SERIAL}: ${err}`);

  await step(286, 'validate-delivery', async () => {
    await shotThenClick(page, 286, 'validate-delivery', page.locator('[data-hotkey="v"]').first());
    await acceptDialogs(page);
    await page.waitForTimeout(2000);
  });
  await step(287, 'back-to-order', () => shotThenClick(page, 287, 'back-to-order', page.locator('[data-hotkey="b"]').first()));
  await step(288, 'create-invoice', async () => {
    await shotThenClick(page, 288, 'create-invoice', page.locator('[data-hotkey="q"]').first());
    await acceptDialogs(page);
    await page.waitForTimeout(2000);
  });
  await step(289, 'confirm-invoice', async () => {
    await shotThenClick(page, 289, 'confirm-invoice', page.locator('[data-hotkey="q"]').first());
    await page.waitForTimeout(2500);
  });
  await step(290, 'register-payment', () => shotThenClick(page, 290, 'register-payment', page.locator('[data-hotkey="g"]').first()));
  await step(291, 'payment-window', async () => {
    await page.waitForTimeout(1200);
    await shot(page, 291, 'payment-window', topModal(page));
  });
  await step(311, 'journal', async () => {
    const journalInput = await openMany2one(page, 'journal_id');
    await shot(page, 311, 'journal', journalInput);
  });
  await step(312, 'journal-typing', async () => {
    const journalInput = page.locator('.o_field_widget[name="journal_id"] input').first();
    await shot(page, 312, 'journal-typing', journalInput);
  });
  await step(313, 'journal-search-more', () => shotThenClick(page, 313, 'journal-search-more', page.getByText('Search More...').first()));
  await step(314, 'journal-selected', () => shotThenClick(page, 314, 'journal-selected', listRow(page, 'Customer Receipts - Cash')));
  await step(315, 'create-payment', async () => {
    await shotThenClick(page, 315, 'create-payment', page.locator('[data-hotkey="q"]').first());
    await page.waitForTimeout(2500);
  });
  await step(316, 'sale-orders', () => shotThenClick(page, 316, 'sale-orders', page.locator('button[name="action_view_source_sale_orders"]')));
  await step(317, 'invoices', () => shotThenClick(page, 317, 'invoices', page.locator('button[name="action_view_invoice"]')));
  await step(318, 'invoice-form', async () => {
    await page.locator('.o_form_view').first().waitFor({ state: 'visible', timeout: 15_000 });
    await shot(page, 318, 'invoice-form', page.locator('.o_form_view .oe_title').first());
  });
  await step(319, 'invoice-line', async () => {
    await shot(page, 319, 'invoice-line', page.locator('.o_list_table .o_data_row').first());
  });
  await step(320, 'invoice-paid', async () => {
    const ribbon = page.locator('.o_form_view .ribbon').first();
    const target = (await ribbon.isVisible({ timeout: 3_000 }).catch(() => false)) ? ribbon : page.locator('.o_form_view .oe_title').first();
    await shot(page, 320, 'invoice-paid', target);
  });

  console.log('SERIAL', SERIAL);
  console.log('FAILURES', failures.length, failures.join(' || '));
});
