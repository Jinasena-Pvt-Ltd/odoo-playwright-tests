/**
 * UI helpers for walking the Sales Cash / Credit flow step by step.
 * Ported from the Step-0x specs' helpers.ts, adapted to this repo:
 * the browser session comes from the `admin` project storage state (no login here),
 * and all credentials come from the root .env (ADMIN_*, optional ODOO_APPROVER_*).
 */
import { Browser, Locator, Page, expect } from '@playwright/test';
import { OdooSystemError } from './BugLog';

export const COMPANY      = process.env.FLOW_COMPANY      ?? 'Jinasena Agricultural Machinery (Pvt) Ltd.';
export const WAREHOUSE    = process.env.FLOW_WAREHOUSE    ?? 'JAM Warehouse Ekala- (JM-EK)';
export const SALES_TEAM   = process.env.FLOW_SALES_TEAM   ?? 'Colombo Sales Centre';
export const PRODUCT_CODE = process.env.FLOW_PRODUCT_CODE ?? '02BB 023';
export const PRODUCT_NAME = process.env.FLOW_PRODUCT_NAME ?? 'BALL BEARING 6202-2RS';
export const CASH_JOURNAL = process.env.FLOW_CASH_JOURNAL ?? 'Customer Receipts - Cash';

const BASE_URL = process.env.ODOO_BASE_URL ?? 'http://localhost:8069';

// ─── Odoo error detection ─────────────────────────────────────────────────────

const ERROR_TITLE = /oh snap|invalid operation|validation error|odoo (server )?error|missing required|user error|access error|warning|error/i;
const WARN_TOAST  = /missing|not allowed|permission|cannot|can't|forbidden|error|blocked/i;

/**
 * Looks for an Odoo error dialog or warning toast. When found it is closed and an
 * OdooSystemError is thrown, so the caller (BugLog.step) records it as a bug with Odoo's own wording.
 */
export async function throwIfOdooError(page: Page): Promise<void> {
  await page.waitForTimeout(700);

  const dialogs = page.locator('.modal:visible');
  const count = await dialogs.count();
  for (let i = 0; i < count; i++) {
    const dlg = dialogs.nth(i);
    const title = ((await dlg.locator('.modal-title').first().textContent().catch(() => '')) ?? '').trim();
    if (!ERROR_TITLE.test(title)) continue;
    const body = ((await dlg.locator('.modal-body').first().textContent().catch(() => '')) ?? '')
      .replace(/\s+/g, ' ').trim();
    const closeBtn = dlg.locator('button').filter({ hasText: /^(close|ok|stay here)$/i }).first();
    if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click().catch(() => {});
    else await page.keyboard.press('Escape').catch(() => {});
    throw new OdooSystemError(title || 'Odoo error dialog', body);
  }

  const toast = page.locator('.o_notification:visible').first();
  if (await toast.isVisible().catch(() => false)) {
    const text = ((await toast.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
    if (WARN_TOAST.test(text)) {
      await toast.locator('.o_notification_close, button').first().click().catch(() => {});
      throw new OdooSystemError('Odoo warning message', text);
    }
  }
}

// ─── Navigation ───────────────────────────────────────────────────────────────

/** Opens the Sales app from the Odoo home screen / any page (uses the logged-in admin storage state). */
export async function openSalesApp(page: Page): Promise<void> {
  await page.goto(`${BASE_URL.replace(/\/$/, '')}/web`, { waitUntil: 'domcontentloaded' });
  // The saved admin session is sometimes not accepted (fresh server session) → fall back to the login form.
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
  const ordersAlready = await page.locator('.o_menu_sections').getByText('Orders').first()
    .isVisible({ timeout: 2_000 }).catch(() => false);
  if (!ordersAlready) {
    const tile = page.getByRole('option', { name: 'Sales', exact: true });
    if (!(await tile.isVisible({ timeout: 3_000 }).catch(() => false))) {
      await page.getByRole('link', { name: 'Home menu' }).click();
    }
    await tile.click();
  }
  await expect(page.locator('.o_menu_sections').getByText('Orders').first()).toBeVisible({ timeout: 30_000 });
}

/** Switches the active company if it is not the selected one already. */
export async function switchCompany(page: Page, company: string): Promise<void> {
  const switcher = page.locator('.o_switch_company_menu');
  if (!(await switcher.isVisible({ timeout: 5_000 }).catch(() => false))) return; // single-company user
  await switcher.locator('.dropdown-toggle').click();
  const item = switcher.locator('.dropdown-menu').getByRole('menuitem').filter({ hasText: company }).first();
  await expect(item).toBeVisible({ timeout: 5_000 });
  const selected = await item.locator('.fa-check-square, .fa-check').isVisible().catch(() => false);
  if (!selected) {
    await item.click();
    await page.waitForLoadState('load');
    await expect(page.locator('.o_menu_sections').getByText('Orders').first()).toBeVisible({ timeout: 30_000 })
      .catch(async () => { await openSalesApp(page); });
  } else {
    await page.keyboard.press('Escape');
  }
}

export async function navigateToQuotations(page: Page): Promise<void> {
  const orders = page.locator('.o_menu_sections').getByText('Orders').first();
  await expect(orders).toBeVisible({ timeout: 10_000 });
  await orders.click();
  const item = page.locator('.o_menu_sections .dropdown-menu').getByText('Quotations').first();
  await expect(item).toBeVisible({ timeout: 5_000 });
  await item.click();
  await expect(page.locator('.o_list_view, .o_kanban_view').first()).toBeVisible({ timeout: 30_000 });
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

export async function selectMany2one(page: Page, fieldName: string, value: string, scope?: Locator): Promise<void> {
  const root = scope ?? page;
  const input = root.locator(`[name="${fieldName}"] input`).first();
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.click();
  await input.fill('');
  await input.pressSequentially(value, { delay: 40 });
  const drop = page.locator('.o-autocomplete--dropdown-menu');
  await expect(drop).toBeVisible({ timeout: 10_000 });
  const option = drop.locator('li, .o-autocomplete--dropdown-item').filter({ hasText: value }).first();
  // The dropdown first shows the default list and refreshes after Odoo's search debounce — wait for the match.
  if (!(await option.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false))) {
    const offered = (await drop.locator('li, .o-autocomplete--dropdown-item').allTextContents().catch(() => []))
      .map(t => t.trim()).filter(Boolean).slice(0, 8).join(' | ');
    throw new Error(`"${value}" was not offered in the ${fieldName} dropdown. Offered: ${offered || '(nothing)'}`);
  }
  await option.click({ force: true });
}

async function many2oneIsEmpty(page: Page, fieldName: string): Promise<boolean> {
  const input = page.locator(`[name="${fieldName}"] input`).first();
  return (await input.inputValue().catch(() => '')) === '';
}

export async function clickTab(page: Page, label: RegExp): Promise<void> {
  const tab = page.locator('.o_notebook .nav-link, .o_notebook .nav-item a').filter({ hasText: label }).first();
  await expect(tab).toBeVisible({ timeout: 10_000 });
  await tab.click();
}

/** Clicks a form/header button by its visible text and then checks for an Odoo error. */
export async function clickButton(page: Page, name: RegExp, timeout = 15_000): Promise<void> {
  const btn = page.locator('.o_form_statusbar, .o_statusbar_buttons, .o_cp_buttons, .o_control_panel')
    .getByRole('button', { name }).first();
  await expect(btn, `Button ${name} not visible`).toBeVisible({ timeout });
  await expect(btn, `Button ${name} is disabled`).toBeEnabled({ timeout: 5_000 });
  await btn.click();
  await throwIfOdooError(page);
}

export interface HeaderButton { text: string; enabled: boolean; waiting: boolean }

/** Visible header buttons with enabled state; `waiting` = the tooltip says it is waiting for another user's approval. */
export async function headerButtons(page: Page): Promise<HeaderButton[]> {
  const raw = await page.locator('.o_form_statusbar button, .o_statusbar_buttons button')
    .evaluateAll(els => els.filter(e => (e as HTMLElement).offsetParent !== null).map(e => {
      const el = e as HTMLButtonElement;
      const tip = [el.getAttribute('title'), el.getAttribute('data-tooltip'), el.getAttribute('aria-label'),
        ...Array.from(el.querySelectorAll('img,[title],[data-tooltip]')).map(n =>
          n.getAttribute('title') || n.getAttribute('data-tooltip') || n.getAttribute('alt') || '')]
        .filter(Boolean).join(' | ');
      return { text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(), enabled: !el.disabled, tip };
    })).catch(() => [] as { text: string; enabled: boolean; tip: string }[]);
  const seen = new Set<string>();
  return raw.filter(b => b.text && !seen.has(b.text) && seen.add(b.text))
    .map(b => ({ text: b.text, enabled: b.enabled, waiting: /waiting for approval/i.test(b.tip) }));
}

export async function visibleHeaderButtons(page: Page): Promise<string[]> {
  return (await headerButtons(page)).map(b => b.text);
}

async function approverNameOnPage(page: Page): Promise<string> {
  const t = ((await page.locator('.o-mail-Activity, .o_mail_activity').first().textContent({ timeout: 3_000 }).catch(() => '')) ?? '')
    .replace(/\s+/g, ' ').trim();
  return (t.match(/for\s+(.+?)\s*(?:Mark Done|Edit|Cancel|$)/i) || [])[1]?.trim() || 'another user';
}

const escRx = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function saveRecord(page: Page): Promise<void> {
  const save = page.locator('.o_form_button_save').first();
  if (await save.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await save.click();
    await throwIfOdooError(page);
    await save.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
    await throwIfOdooError(page);
  }
}

// ─── Quotation ────────────────────────────────────────────────────────────────

export interface OrderInput {
  customer: string;
  paymentType: 'Cash' | 'Credit';
  quantity?: number;
}

/** Creates and saves a quotation with one product line. Returns the order number (e.g. S02250). */
export async function createQuotation(page: Page, input: OrderInput): Promise<string> {
  await openSalesApp(page); // fresh start: a previous failed flow may have left an unsaved form / dialog open
  await navigateToQuotations(page);
  const newBtn = page.locator('.o_control_panel').getByRole('button', { name: 'New' });
  await expect(newBtn).toBeVisible({ timeout: 10_000 });
  await newBtn.click();
  await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 30_000 });

  await selectMany2one(page, 'partner_id', input.customer);
  await throwIfOdooError(page); // customer warnings / onchange errors

  const payType = page.locator('[name="x_studio_order_payment_method"] select').first();
  await expect(payType).toBeVisible({ timeout: 10_000 });
  await payType.selectOption({ label: input.paymentType });

  const qType = page.locator('[name="x_studio_quotation_type"] select').first();
  if (await qType.isVisible({ timeout: 3_000 }).catch(() => false)) await qType.selectOption({ label: 'Sales' });

  // Other Info: payment terms / team / warehouse are normally auto-filled — only fill what is empty.
  await clickTab(page, /other\s*info/i);
  await expect(page.locator('[name="team_id"]')).toBeVisible({ timeout: 10_000 });
  if (await many2oneIsEmpty(page, 'team_id')) await selectMany2one(page, 'team_id', SALES_TEAM);
  if (await many2oneIsEmpty(page, 'warehouse_id')) await selectMany2one(page, 'warehouse_id', WAREHOUSE);
  if (input.paymentType === 'Cash' && (await many2oneIsEmpty(page, 'payment_term_id') ||
      !/immediate/i.test(await page.locator('[name="payment_term_id"] input').first().inputValue().catch(() => '')))) {
    await selectMany2one(page, 'payment_term_id', 'Immediate Payment');
  }

  // Product line
  await clickTab(page, /order\s*lines/i);
  const addLink = page.locator('.o_field_x2many_list_row_add a').filter({ hasText: /add a product/i }).first();
  await expect(addLink).toBeVisible({ timeout: 10_000 });
  await addLink.click();
  const row = page.locator('.o_data_row.o_selected_row').first();
  const pInput = row.locator('[name="product_id"] input').first();
  await expect(pInput).toBeVisible({ timeout: 8_000 });
  await pInput.pressSequentially(PRODUCT_CODE, { delay: 50 });
  const drop = page.locator('.o-autocomplete--dropdown-menu');
  await expect(drop).toBeVisible({ timeout: 10_000 });
  await drop.locator('li, .o-autocomplete--dropdown-item').filter({ hasText: PRODUCT_NAME }).first().click({ force: true });
  if (input.quantity && input.quantity !== 1) {
    const qty = row.locator('[name="product_uom_qty"] input').first();
    await qty.click(); await qty.selectText(); await qty.fill(String(input.quantity)); await qty.press('Tab');
  }
  await throwIfOdooError(page);

  await saveRecord(page);
  const name = ((await page.locator('.o_form_view [name="name"]').first().textContent().catch(() => '')) ?? '').trim();
  if (!/^S\d+/.test(name)) throw new Error(`Quotation was not saved (title shows "${name || 'New'}").`);
  return name;
}

// ─── Approvals & confirm ──────────────────────────────────────────────────────

export interface ApprovalOutcome { taken: string[]; buttonsSeen: string[]; }

/** Logs in as a separate approver and clicks an Approve button on the given record URL. */
async function approveAsApprover(browser: Browser, recordUrl: string, approveName: string): Promise<void> {
  const email = process.env.ODOO_APPROVER_EMAIL ?? '';
  const password = process.env.ODOO_APPROVER_PASSWORD ?? '';
  if (!email || !password) throw new Error('ODOO_APPROVER_EMAIL / ODOO_APPROVER_PASSWORD are not set in .env.');
  const ctx = await browser.newContext({ locale: 'en-US' });
  try {
    const ap = await ctx.newPage();
    await ap.goto(`${BASE_URL.replace(/\/$/, '')}/web/login`);
    await ap.locator('input[name="login"]').fill(email);
    await ap.locator('input[name="password"]').fill(password);
    await ap.getByRole('button', { name: 'Log in' }).click();
    await expect(ap.locator('.o_main_navbar')).toBeVisible({ timeout: 90_000 });
    await ap.goto(recordUrl);
    await expect(ap.locator('.o_form_view')).toBeVisible({ timeout: 60_000 });
    await clickButton(ap, new RegExp(`^${approveName}$`, 'i'), 30_000);
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Walks every "Request … Approval" / "Approve …" button until Confirm is available, then confirms.
 * Throws OdooSystemError / Error when the flow gets stuck, with the visible buttons as evidence.
 */
export async function approveAndConfirm(page: Page, browser: Browser): Promise<ApprovalOutcome> {
  const out: ApprovalOutcome = { taken: [], buttonsSeen: [] };
  const recordUrl = page.url();
  const requested = new Set<string>();

  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const buttons = await headerButtons(page);
    out.buttonsSeen = buttons.map(b => b.text + (b.enabled ? '' : ' (disabled)') + (b.waiting ? ' (waiting for approval)' : ''));

    if (buttons.some(b => /^confirm$/i.test(b.text) && b.enabled)) {
      await clickButton(page, /^confirm$/i);
      await expect(page.locator('.o_form_statusbar .o_statusbar_status')).toContainText(/sales order/i, { timeout: 60_000 });
      return out;
    }

    const req = buttons.find(b => /^request .*approval$/i.test(b.text) && b.enabled && !requested.has(b.text));
    if (req) {
      await clickButton(page, new RegExp(`^${escRx(req.text)}$`, 'i'));
      requested.add(req.text);
      out.taken.push(req.text);
      await page.waitForTimeout(1_500);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 60_000 });
      continue;
    }

    const appr = buttons.find(b => /^approve\b/i.test(b.text));
    if (appr) {
      if (appr.waiting || !appr.enabled) {
        // The approval is assigned to another user — the requester cannot approve it.
        const who = await approverNameOnPage(page);
        if (!process.env.ODOO_APPROVER_EMAIL || !process.env.ODOO_APPROVER_PASSWORD) {
          throw new Error(
            `"${appr.text}" is waiting for approval by ${who}; the requesting user cannot approve it. ` +
            `Add ODOO_APPROVER_EMAIL / ODOO_APPROVER_PASSWORD (the approver's login) to .env to continue.`);
        }
        await approveAsApprover(browser, recordUrl, appr.text);
        out.taken.push(`${appr.text} (as ${process.env.ODOO_APPROVER_EMAIL})`);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 60_000 });
      } else {
        await clickButton(page, new RegExp(`^${escRx(appr.text)}$`, 'i'), 10_000);
        out.taken.push(`${appr.text} (as ${process.env.ADMIN_EMAIL ?? 'admin'})`);
        await page.waitForTimeout(1_000);
      }
      continue;
    }

    throw new Error(
      `Stuck before Confirm: no Confirm / Request / Approve button usable.\nVisible header buttons: ${out.buttonsSeen.join(' | ') || '(none)'}`,
    );
  }
  throw new Error(`Approval loop did not reach Confirm after 12 rounds. Taken: ${out.taken.join(', ')}`);
}

// ─── Delivery / invoice / payment ─────────────────────────────────────────────

async function pressThroughDialogs(page: Page): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(800);
    await throwIfOdooError(page);
    const dlg = page.locator('.modal:visible').first();
    if (!(await dlg.isVisible().catch(() => false))) return;
    const btn = dlg.locator('footer button').filter({ hasText: /^(apply|validate|create backorder|confirm|ok|process)$/i }).first();
    if (!(await btn.isVisible().catch(() => false))) return;
    await btn.click();
  }
}

/** Opens the delivery from the order, validates it, comes back to the order. */
export async function validateDelivery(page: Page): Promise<string> {
  const orderUrl = page.url();
  const smart = page.locator('button[name="action_view_delivery"]').first();
  await expect(smart, 'Delivery smart button missing on the confirmed order').toBeVisible({ timeout: 20_000 });
  await smart.click();
  if (await page.locator('.o_list_view').isVisible({ timeout: 3_000 }).catch(() => false)) {
    await page.locator('.o_list_view .o_data_row').first().click();
  }
  await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 20_000 });
  const ref = ((await page.locator('.o_form_view [name="name"]').first().textContent().catch(() => '')) ?? '').trim();

  const check = page.locator('.o_form_statusbar').getByRole('button', { name: /check availability/i });
  if (await check.isVisible({ timeout: 2_000 }).catch(() => false)) await check.click();

  await clickButton(page, /^validate$/i, 20_000);
  await pressThroughDialogs(page);
  await expect(page.locator('.o_form_statusbar .o_statusbar_status'))
    .toContainText(/done/i, { timeout: 30_000 })
    .catch(() => { throw new Error(`Delivery ${ref} did not reach Done. Header buttons: ${'(see screenshot)'}`); });

  await page.goto(orderUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.o_form_view')).toBeVisible({ timeout: 30_000 });
  return ref;
}

/** Unlocks the sales order (known workaround when delivery validation hits the locked-order analytic error). */
export async function unlockOrder(page: Page): Promise<boolean> {
  const unlock = page.locator('.o_form_statusbar').getByRole('button', { name: /^unlock$/i }).first();
  if (!(await unlock.isVisible({ timeout: 3_000 }).catch(() => false))) return false;
  await unlock.click();
  await page.waitForTimeout(1_000);
  return true;
}

/** Creates and posts the invoice from the sales order. Leaves the page on the invoice form. */
export async function createInvoice(page: Page): Promise<string> {
  await clickButton(page, /^create invoice$/i, 20_000);
  // Some configurations open a "Create invoices" wizard, others create the draft invoice straight away.
  const dlg = page.locator('.modal:visible').first();
  if (await dlg.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await dlg.locator('footer button').filter({ hasText: /create (draft )?invoice/i }).first().click();
    await throwIfOdooError(page);
  }
  await expect(page.locator('.o_form_view [name="partner_id"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.o_form_statusbar .o_statusbar_status')).toContainText(/draft|posted/i, { timeout: 30_000 });
  const confirm = page.locator('.o_form_statusbar').getByRole('button', { name: /^confirm$/i }).first();
  if (await confirm.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await confirm.click();
    await throwIfOdooError(page);
  }
  await expect(page.locator('.o_form_statusbar .o_statusbar_status')).toContainText(/posted/i, { timeout: 30_000 });
  return ((await page.locator('.o_form_view [name="name"]').first().textContent().catch(() => '')) ?? '').trim();
}

/** Registers the cash payment on the posted invoice and checks the paid ribbon. */
export async function registerCashPayment(page: Page): Promise<void> {
  await clickButton(page, /^register payment$/i, 20_000);
  const dlg = page.locator('.modal:visible').first();
  await expect(dlg).toBeVisible({ timeout: 15_000 });
  await selectMany2one(page, 'journal_id', CASH_JOURNAL, dlg);
  await dlg.locator('footer button').filter({ hasText: /^create payment$/i }).first().click();
  await throwIfOdooError(page);
  await expect(page.locator('.o_form_view .o_widget_web_ribbon, .o_form_view .ribbon').first())
    .toContainText(/paid|in payment/i, { timeout: 30_000 });
}
