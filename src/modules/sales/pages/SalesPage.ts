import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../../../core/base/BasePage';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { parseAmount } from '../calculations/SalesCalculations';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface QuotationLine {
  product: string;
  quantity: number;
  /** Discount %, defaults to 0 */
  discount?: number;
  /** Overrides the auto-filled unit price when set */
  unitPrice?: number;
}

export interface SaveOutcome {
  /** True when Odoo accepted the save (Save button gone, no dialog). */
  saved: boolean;
  /** Number of fields flagged invalid (red) after the save attempt. */
  invalidFields: number;
  /** Text of a notification shown after the save attempt ('' if none). */
  notification: string;
  /** Text of a dialog (e.g. "Oh snap!") shown after the save attempt ('' if none). */
  dialog: string;
}

export type CompanySwitch = 'switched' | 'already-active' | 'unavailable';

const squash = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

// ─── Sales app (menus, company, settings, products, customers) ────────────────

export class SalesAppPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  private get menuSections(): Locator {
    return this.page.locator('.o_menu_sections');
  }

  /**
   * page.goto with retries for network trouble (connection timed out / reset, DNS not resolved, slow server).
   * The Odoo dev instance occasionally drops connections for a few seconds; a short wait and retry rides it out.
   */
  async gotoWithRetry(url: string, attempts = 5): Promise<void> {
    const transient = /ERR_(CONNECTION|NAME_NOT_RESOLVED|INTERNET|NETWORK|TIMED_OUT|EMPTY_RESPONSE|ADDRESS|PROXY|SSL)|Timeout|timeout/;
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await this.page.goto(url, { timeout: 60_000, waitUntil: 'domcontentloaded' });
        return;
      } catch (e) {
        lastError = e;
        if (attempt === attempts || !transient.test(String(e))) break;
        await this.page.waitForTimeout(5_000 * attempt); // back off: 5s, 10s, 15s, 20s
      }
    }
    throw lastError;
  }

  /** Opens the backend home screen (re-using the saved admin session) and enters the Sales app. */
  async open(): Promise<void> {
    const baseURL = process.env.ODOO_BASE_URL ?? 'http://localhost:8069';
    await this.gotoWithRetry(`${baseURL}/web/login`);

    const state = await Promise.race([
      this.page.locator('.o_home_menu, .o_main_navbar').first()
        .waitFor({ state: 'visible', timeout: 60_000 }).then(() => 'ready' as const),
      this.page.locator('input[name="login"]')
        .waitFor({ state: 'visible', timeout: 60_000 }).then(() => 'login' as const),
    ]);

    if (state === 'login') {
      await this.page.locator('input[name="login"]').fill(process.env.ADMIN_EMAIL ?? 'admin');
      await this.page.locator('input[name="password"]').fill(process.env.ADMIN_PASSWORD ?? 'admin');
      await this.page.getByRole('button', { name: 'Log in' }).click();
      await this.page.waitForURL((url) => !url.pathname.includes('/web/login'), { timeout: 90_000, waitUntil: 'commit' });
    }
    await expect(this.page.locator('.o_home_menu, .o_main_navbar').first()).toBeVisible({ timeout: 120_000 });

    const tile = this.page.locator('.o_app').filter({ hasText: 'Sales' }).first();
    if (await tile.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await tile.click();
    }
    await expect(this.menuSections.getByText('Orders').first()).toBeVisible({ timeout: 60_000 });
  }

  /** Returns to the home screen (app grid). */
  async goHome(): Promise<void> {
    await this.page.locator('.o_menu_toggle, .o_navbar_apps_menu, [aria-label="Home"]').first().click();
    await expect(this.page.locator('.o_home_menu')).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Switches the active company through the top-right switcher.
   * Returns 'unavailable' when the user has no company switcher (single-company users).
   */
  async switchCompany(company: string): Promise<CompanySwitch> {
    const switcher = this.page.locator('.o_switch_company_menu');
    if (!(await switcher.isVisible({ timeout: 10_000 }).catch(() => false))) return 'unavailable';

    await switcher.locator('.dropdown-toggle').click();
    const dropdown = switcher.locator('.dropdown-menu');
    await expect(dropdown).toBeVisible({ timeout: 5_000 });
    const item = dropdown.getByRole('menuitem').filter({ hasText: company }).first();
    await expect(item).toBeVisible({ timeout: 5_000 });

    const alreadySelected = await item.locator('.fa-check').isVisible().catch(() => false);
    if (alreadySelected) {
      await this.page.keyboard.press('Escape');
      await dropdown.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
      return 'already-active';
    }

    await item.click();
    const confirm = dropdown.getByRole('button', { name: 'Confirm' });
    if (await confirm.isVisible({ timeout: 2_000 }).catch(() => false)) await confirm.click();
    await this.page.waitForLoadState('load');

    // After a switch Odoo redirects client-side: either the home menu or the Sales menu appears.
    await Promise.race([
      this.page.locator('.o_home_menu').waitFor({ state: 'visible', timeout: 25_000 }).catch(() => {}),
      this.menuSections.getByText('Orders').waitFor({ state: 'visible', timeout: 25_000 }).catch(() => {}),
    ]);
    if (!(await this.menuSections.getByText('Orders').isVisible().catch(() => false))) {
      await this.open();
    }
    return 'switched';
  }

  /** Clicks a top menu then one of its items, e.g. openMenu('Orders', 'Quotations'). */
  async openMenu(top: string, item: string): Promise<void> {
    const topItem = this.menuSections.getByText(top).first();
    await expect(topItem).toBeVisible({ timeout: 30_000 });
    await topItem.click();
    const menu = this.page.locator('.o_menu_sections .dropdown-menu');
    let target = menu.getByRole('menuitem', { name: item, exact: true }).first();
    if (!(await target.isVisible({ timeout: 5_000 }).catch(() => false))) {
      target = menu.getByText(item).first();
    }
    await expect(target).toBeVisible({ timeout: 10_000 });
    await target.click();
  }

  /** Makes sure the list view (not kanban) is showing. */
  async ensureListView(): Promise<void> {
    await expect(this.page.locator('.o_list_view, .o_kanban_view')).toBeVisible({ timeout: 60_000 });
    const switchToList = this.page.locator('.o_switch_view.o_list');
    if (await switchToList.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await switchToList.click();
      await expect(this.page.locator('.o_list_view')).toBeVisible({ timeout: 60_000 });
    }
  }

  async goToQuotations(): Promise<void> {
    await this.openMenu('Orders', 'Quotations');
    await this.ensureListView();
  }

  async goToCustomers(): Promise<void> {
    await this.openMenu('Orders', 'Customers');
    await expect(this.page.locator('.o_list_view, .o_kanban_view')).toBeVisible({ timeout: 60_000 });
  }

  async goToProducts(): Promise<void> {
    await this.openMenu('Products', 'Products');
    await this.ensureListView();
  }

  async goToSettings(): Promise<void> {
    await this.openMenu('Configuration', 'Settings');
    await expect(this.page.locator('.o_form_view')).toBeVisible({ timeout: 60_000 });
    const salesTab = this.page.locator('.settings_tab .tab').filter({ hasText: /^\s*Sales\s*$/ }).first();
    if (await salesTab.isVisible({ timeout: 5_000 }).catch(() => false)) await salesTab.click();
    await expect(this.page.locator('.o_setting_box, .o_settings_container').first()).toBeVisible({ timeout: 30_000 });
  }

  /** Types a query into the control-panel search box and presses Enter. */
  async search(query: string): Promise<void> {
    const box = this.page.locator('.o_searchview_input').first();
    await expect(box).toBeVisible({ timeout: 30_000 });
    await box.click();
    await box.fill(query);
    await box.press('Enter');
  }

  /** Searches the current list/kanban and opens the first record whose text contains `text`. */
  async searchAndOpen(text: string): Promise<void> {
    await this.search(text);
    const row = this.page.locator('.o_data_row, .o_kanban_record').filter({ hasText: text }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.click();
    await expect(this.page.locator('.o_form_view')).toBeVisible({ timeout: 60_000 });
  }

  /** Reads the Minimum Sales Margin (%) from Sales ▸ Configuration ▸ Settings. Returns null if absent. */
  async readMinimumSalesMargin(): Promise<number | null> {
    await this.goToSettings();
    const byName = this.page.locator('[name="x_studio_minimum_sales_margin_"]').first();
    if (await byName.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const text = (await byName.locator('input').first().inputValue().catch(() => '')) || (await byName.textContent()) || '';
      if (/\d/.test(text)) return parseAmount(text);
    }
    const byLabel = this.page.getByLabel(/minimum.{0,20}sales.{0,20}margin/i).first();
    if (await byLabel.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const text = (await byLabel.inputValue().catch(() => '')) || (await byLabel.textContent().catch(() => '')) || '';
      if (/\d/.test(text)) return parseAmount(text);
    }
    return null;
  }

  /**
   * Reads a product's Cost from the Cost column of its row in Sales ▸ Products (list view).
   * Falls back to the Cost field on the product form. Returns null if no cost could be read.
   */
  async readProductCost(productName: string): Promise<number | null> {
    await this.goToProducts();
    await this.search(productName);
    const row = this.page.locator('.o_data_row').filter({ hasText: productName }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    const cell = row.locator('td[name="standard_price"]').first();
    if (await cell.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const text = await cell.textContent();
      if (text && /\d/.test(text)) return parseAmount(text);
    }
    await row.click();
    await expect(this.page.locator('.o_form_view')).toBeVisible({ timeout: 60_000 });
    const field = this.page.locator('[name="standard_price"]').first();
    if (await field.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const text = (await field.locator('input').first().inputValue().catch(() => '')) || (await field.textContent()) || '';
      if (/\d/.test(text)) return parseAmount(text);
    }
    return null;
  }

  /**
   * Reads a tax's percentage from Accounting ▸ Taxes. In this instance "Taxes" lives in the "+" overflow
   * menu of the Accounting top bar. Leaves the user on the home screen; call open() to return to Sales.
   * Returns null if the Accounting app or the tax is not available to this user.
   */
  async readTaxPercent(taxName: string): Promise<number | null> {
    await this.goHome();
    const accounting = this.page.getByRole('option', { name: 'Accounting', exact: true });
    if (!(await accounting.isVisible({ timeout: 10_000 }).catch(() => false))) return null;
    await accounting.click();

    const nav = this.page.locator('.o_menu_sections');
    await expect(nav.getByText('Dashboard').first()).toBeVisible({ timeout: 60_000 });
    const more = nav.locator('button:has(.fa-plus), .dropdown-toggle:has(.fa-plus)').last();
    if (!(await more.isVisible({ timeout: 10_000 }).catch(() => false))) return null;
    await more.click();

    // A second "Taxes" item exists inside Configuration; the overflow one has class o_more_dropdown_section.
    const taxes = this.page.locator('a.o_more_dropdown_section[role="menuitem"]').filter({ hasText: /^Taxes$/ });
    await taxes.scrollIntoViewIfNeeded().catch(() => {});
    if (!(await taxes.isVisible({ timeout: 10_000 }).catch(() => false))) return null;
    await taxes.click();
    await expect(this.page.locator('.o_list_view, .o_kanban_view')).toBeVisible({ timeout: 60_000 });

    const record = this.page.locator('.o_kanban_record, .o_data_row').filter({ hasText: taxName }).first();
    if (!(await record.isVisible({ timeout: 15_000 }).catch(() => false))) return null;
    await record.click();
    await expect(this.page.locator('.o_form_view')).toBeVisible({ timeout: 30_000 });
    const amount = this.page.getByRole('textbox', { name: 'Amount' });
    await expect(amount).toBeVisible({ timeout: 10_000 });
    return parseAmount(await amount.inputValue());
  }
}

// ─── Quotations list ──────────────────────────────────────────────────────────

export class QuotationListPage extends BaseListPage {
  constructor(page: Page) {
    super(page);
  }

  async clickNewQuotation(): Promise<void> {
    const newBtn = this.page.locator('.o_control_panel').getByRole('button', { name: 'New' });
    await expect(newBtn).toBeVisible({ timeout: 30_000 });
    await newBtn.click();
    await expect(this.page.locator('.o_form_view')).toBeVisible({ timeout: 60_000 });
  }
}

// ─── Quotation form ───────────────────────────────────────────────────────────

// ─── Shared save / dialog behaviour for Sales forms ───────────────────────────

export abstract class SalesFormBase extends BaseFormPage {
  constructor(page: Page) {
    super(page);
  }

  // ── Saving ──────────────────────────────────────────────────────────────────

  /** Clicks Save and reports what Odoo did, without throwing when the save is refused. */
  async trySave(opts: { strict?: boolean } = {}): Promise<SaveOutcome> {
    const saveBtn = this.page.locator('.o_form_button_save').first();
    // Nothing to save (clean form): there is no Save button, so the record is already stored.
    if (!(await saveBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      return { saved: true, invalidFields: 0, notification: '', dialog: '' };
    }
    // The record title ("New" until the first save, then e.g. "S02058").
    const title = async () => squash(await this.page.locator('.o_form_view h1').first().textContent({ timeout: 2_000 }).catch(() => ''));
    const titleBefore = await title();
    // A disabled Save button (form flagged invalid) cannot be clicked: that is Odoo refusing the save.
    const clicked = await saveBtn.click({ timeout: 20_000 }).then(() => true).catch(() => false);

    // Odoo reports a refused save as a dialog, a field flagged invalid, or a short-lived toast. A toast
    // disappears within seconds, so its text is captured the moment it appears. A toast alone does not end
    // the wait: the save may still be finishing, so the Save button gets a short window to disappear.
    let toast = '';
    if (clicked) {
      const toastSeen = this.page.locator('.o_notification').first()
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(async () => {
          toast = squash(await this.page.locator('.o_notification').first().textContent({ timeout: 2_000 }).catch(() => ''));
        });
      await Promise.race([
        saveBtn.waitFor({ state: 'hidden', timeout: 30_000 }),
        this.page.getByRole('dialog').first().waitFor({ state: 'visible', timeout: 30_000 }),
        this.page.locator('.o_field_invalid').first().waitFor({ state: 'visible', timeout: 30_000 }),
        toastSeen.then(() => saveBtn.waitFor({ state: 'hidden', timeout: 12_000 })),
      ]).catch(() => undefined);
    }

    const dialog = this.page.getByRole('dialog').first();
    const dialogText = (await dialog.isVisible({ timeout: 1_000 }).catch(() => false))
      ? squash(await dialog.textContent().catch(() => ''))
      : '';
    const notification = toast
      || squash(await this.page.locator('.o_notification').first().textContent({ timeout: 1_000 }).catch(() => ''));
    const invalidFields = await this.page.locator('.o_field_invalid').count();
    // This Odoo re-flags the form as modified right after a successful save (the Save icon comes back), so the
    // button alone is not proof of a refusal. Saved means: no dialog, and either the Save button went away, or a
    // brand-new record received its number ("New" → "S0…"), or (quotations) nothing at all signalled a refusal.
    // `strict` (used for the customer form) trusts only the Save button.
    const titleAfter = await title();
    const isNew = (t: string) => /^\s*New\s*$/i.test(t);
    const recordCreated = isNew(titleBefore) && titleAfter !== '' && !isNew(titleAfter);
    const btnHidden = await saveBtn.isHidden().catch(() => false);
    const saved = opts.strict
      ? btnHidden && dialogText === ''
      : dialogText === '' && invalidFields === 0 && (btnHidden || recordCreated || notification === '');
    return { saved, invalidFields, notification, dialog: dialogText };
  }

  /** Saves and fails with Odoo's own message (e.g. the "Oh snap!" dialog text) when the save is refused. */
  async saveOrThrow(): Promise<void> {
    const outcome = await this.trySave();
    if (!outcome.saved) {
      const why = outcome.dialog || outcome.notification || `${outcome.invalidFields} invalid field(s)`;
      throw new Error(`Odoo refused to save the quotation: ${why}`);
    }
    await this.waitForOdooReady();
  }

  /** Closes a visible dialog: "stay" keeps editing, "discard" drops the unsaved changes. */
  async dismissDialog(action: 'stay' | 'discard' = 'stay'): Promise<void> {
    const dialog = this.page.getByRole('dialog').first();
    if (!(await dialog.isVisible({ timeout: 2_000 }).catch(() => false))) return;
    const pattern = action === 'discard' ? /discard/i : /stay here|^ok$|^close$/i;
    const button = dialog.locator('button').filter({ hasText: pattern }).first();
    if (await button.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await button.click();
      await dialog.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
    }
  }
}

export class QuotationFormPage extends SalesFormBase {
  constructor(page: Page) {
    super(page);
  }

  // ── Header fields ───────────────────────────────────────────────────────────

  /** Waits until the blank new-quotation form is editable. */
  async waitForNewForm(): Promise<void> {
    const customer = this.page.locator('[name="partner_id"] input').first();
    await expect(customer).toBeVisible({ timeout: 30_000 });
    await expect(customer).toBeEditable();
  }

  async customerValue(): Promise<string> {
    return this.page.locator('[name="partner_id"] input').first().inputValue();
  }

  /** Types into a Many2one field and picks the matching autocomplete entry. */
  private async pickMany2one(fieldName: string, value: string): Promise<void> {
    const input = this.page.locator(`[name="${fieldName}"] input`).first();
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.click();
    await input.pressSequentially(value, { delay: 50 });
    const dropdown = this.page.locator('.o-autocomplete--dropdown-menu');
    await expect(dropdown).toBeVisible({ timeout: 30_000 });
    await dropdown.locator('li, .o-autocomplete--dropdown-item').filter({ hasText: value }).first().click();
  }

  async fillCustomer(customer: string): Promise<void> {
    await this.pickMany2one('partner_id', customer);
    await expect(this.page.locator('[name="partner_id"] input').first()).not.toHaveValue('', { timeout: 30_000 });
  }

  /** Quotation Type is a <select> in this instance (falls back to an autocomplete field). */
  async setQuotationType(value: string): Promise<void> {
    const field = this.page.getByLabel(/^quotation\s*type$/i).first();
    await expect(field).toBeVisible({ timeout: 30_000 });
    const tag = await field.evaluate((el) => el.tagName.toLowerCase()).catch(() => 'select');
    if (tag === 'select') {
      await field.selectOption({ label: value });
    } else {
      await field.click();
      await field.pressSequentially(value, { delay: 50 });
      const drop = this.page.locator('.o-autocomplete--dropdown-menu');
      await expect(drop).toBeVisible({ timeout: 30_000 });
      await drop.locator('li, .o-autocomplete--dropdown-item').filter({ hasText: value }).first().click();
    }
  }

  /** Opens a notebook tab such as "Order Lines" or "Other Info". */
  async openTab(name: RegExp | string): Promise<void> {
    const tab = this.page.locator('.o_notebook .nav-link, .o_notebook .nav-item a').filter({ hasText: name }).first();
    await expect(tab).toBeVisible({ timeout: 30_000 });
    await tab.click();
  }

  /** Fills Sales Team and/or Warehouse on the Other Info tab. */
  async fillOtherInfo(salesTeam?: string | null, warehouse?: string | null): Promise<void> {
    if (!salesTeam && !warehouse) return;
    await this.openTab(/other\s*info/i);
    await expect(this.page.locator('[name="team_id"]')).toBeVisible({ timeout: 30_000 });
    if (salesTeam) await this.pickMany2one('team_id', salesTeam);
    if (warehouse) await this.pickMany2one('warehouse_id', warehouse);
  }

  /** What a Many2one field currently shows (input value, or plain text when it is read-only). */
  async many2oneValue(fieldName: string): Promise<string> {
    const widget = this.page.locator(`[name="${fieldName}"]`).first();
    const input = widget.locator('input').first();
    if (await input.isVisible({ timeout: 2_000 }).catch(() => false)) return (await input.inputValue()).trim();
    return squash(await widget.textContent().catch(() => ''));
  }

  /**
   * Empties a Many2one field the way a user would (hover the field, click its X; fall back to select-all + delete).
   * Odoo pre-fills several fields (Salesperson, Sales Team, Warehouse ...), so a "blank field" test must clear them.
   * Returns true when the field is empty afterwards.
   */
  async clearMany2one(fieldName: string): Promise<boolean> {
    const widget = this.page.locator(`[name="${fieldName}"]`).first();
    const input = widget.locator('input').first();
    if (!(await input.isVisible({ timeout: 5_000 }).catch(() => false))) return (await this.many2oneValue(fieldName)) === '';
    if ((await input.inputValue()) === '') return true;

    await widget.hover().catch(() => {});
    const x = widget.locator('.o_delete').first();
    if (await x.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await x.click();
    } else {
      await input.click();
      await input.selectText().catch(() => {});
      await input.fill('');
      await this.page.keyboard.press('Tab');
    }
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.waitForTimeout(600); // let onchange handlers finish (they may re-fill the field)
    return (await input.inputValue().catch(() => 'x')) === '';
  }

  /** State of a field on the open form: whether the user can type in it, and what it shows. */
  async fieldState(fieldName: string): Promise<{ present: boolean; editable: boolean; value: string }> {
    const widget = this.page.locator(`[name="${fieldName}"]`).first();
    if (!(await widget.isVisible({ timeout: 3_000 }).catch(() => false))) {
      return { present: false, editable: false, value: '' };
    }
    const editable = await widget.locator('input, select').first().isVisible({ timeout: 2_000 }).catch(() => false);
    return { present: true, editable, value: squash(await widget.textContent().catch(() => '')) };
  }

  /** Standard quotation fill; pass null for a part to deliberately leave it blank. */
  async fillQuotation(o: {
    customer?: string | null;
    quotationType?: string | null;
    salesTeam?: string | null;
    warehouse?: string | null;
    lines?: QuotationLine[];
  }): Promise<void> {
    if (o.customer) await this.fillCustomer(o.customer);
    if (o.quotationType) await this.setQuotationType(o.quotationType);
    await this.fillOtherInfo(o.salesTeam, o.warehouse);
    if (o.lines && o.lines.length > 0) await this.addLines(o.lines);
  }

  // ── Order lines ─────────────────────────────────────────────────────────────

  async addLines(lines: QuotationLine[]): Promise<void> {
    await this.openTab(/order\s*lines/i);
    await expect(this.page.locator('.o_field_one2many')).toBeVisible({ timeout: 30_000 });
    for (const line of lines) {
      await this.addLine(line);
    }
  }

  /** Adds one product line. The row locator is re-queried per field because Odoo re-renders the row on onchange. */
  async addLine(line: QuotationLine): Promise<void> {
    const addLink = this.page.locator('.o_field_x2many_list_row_add a').filter({ hasText: /add a product/i }).first();
    await expect(addLink).toBeVisible({ timeout: 30_000 });
    await addLink.click();

    const row = () => this.page.locator('.o_data_row.o_selected_row').first();

    const product = row().locator('[name="product_id"] input').first();
    await expect(product).toBeVisible({ timeout: 30_000 });
    await product.pressSequentially(line.product, { delay: 50 });
    const dropdown = this.page.locator('.o-autocomplete--dropdown-menu');
    await expect(dropdown).toBeVisible({ timeout: 30_000 });
    await dropdown.locator('li, .o-autocomplete--dropdown-item').filter({ hasText: line.product }).first().click({ force: true });
    await dropdown.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});

    await this.fillCell(row, 'product_uom_qty', line.quantity);
    if (line.unitPrice !== undefined) await this.fillCell(row, 'price_unit', line.unitPrice);
    await this.fillCell(row, 'discount', line.discount ?? 0);
  }

  private async fillCell(row: () => Locator, name: string, value: number): Promise<void> {
    const input = row().locator(`[name="${name}"] input`).first();
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.click();
    await input.selectText();
    await input.fill(String(value));
    await input.press('Tab');
  }

  /** Picks the first option offered in the Taxes cell of order line `index` (0-based). */
  async setFirstTaxOnLine(index: number): Promise<void> {
    const cell = this.page.locator('.o_data_row').nth(index).locator('[name="tax_id"]').first();
    const existing = await cell.textContent().catch(() => '');
    if (/vat/i.test(existing ?? '')) return;
    await cell.click();
    const input = cell.locator('input[type="text"]').first();
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.click();
    const dropdown = this.page.locator('.o-autocomplete--dropdown-menu');
    if (!(await dropdown.isVisible({ timeout: 2_000 }).catch(() => false))) await input.press('ArrowDown');
    await expect(dropdown).toBeVisible({ timeout: 30_000 });
    await dropdown.locator('li, .o-autocomplete--dropdown-item').first().click({ force: true });
    await dropdown.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
  }

  async readLine(index: number): Promise<{ qty: number; unitPrice: number; discountPct: number; taxExcl: number }> {
    const row = this.page.locator('.o_data_row').nth(index);
    const read = async (name: string) => parseAmount(await row.locator(`[name="${name}"]`).textContent().catch(() => '0'));
    return {
      qty: await read('product_uom_qty'),
      unitPrice: await read('price_unit'),
      discountPct: await read('discount'),
      taxExcl: await read('price_subtotal'),
    };
  }

  /** Reads the Untaxed Amount / VAT / Total block under the order lines. */
  async readTotals(): Promise<{ untaxed: number; vat: number; total: number }> {
    const table = this.page.locator('table').filter({ hasText: /Untaxed Amount/i }).last();
    await expect(table).toBeVisible({ timeout: 30_000 });
    await table.scrollIntoViewIfNeeded();
    const value = async (re: RegExp, pick: 'first' | 'last') => {
      const rows = table.locator('tr').filter({ hasText: re });
      if ((await rows.count()) === 0) return 0;
      const row = pick === 'first' ? rows.first() : rows.last();
      return parseAmount(await row.locator('td').last().textContent());
    };
    return {
      untaxed: await value(/Untaxed Amount/i, 'first'),
      vat: await value(/VAT/i, 'first'),
      total: await value(/Total/i, 'last'),
    };
  }

  // ── Header buttons ──────────────────────────────────────────────────────────

  /**
   * Odoo can require several approvals in sequence before Confirm appears (Credit Limit, then Bank Guarantee,
   * Insufficient Margin, Overdue ...). Works through "Request X Approval" → "Approve X" until Confirm is visible.
   * Returns the name of the approval that blocks it when the signed-in user cannot complete one.
   */
  async completeRemainingApprovals(maxSteps = 8): Promise<{ blockedBy?: string }> {
    for (let i = 0; i < maxSteps; i++) {
      await this.scrollToTop();
      if (await this.isButtonVisible(/^confirm$/i, 4_000)) return {};

      const request = this.page.getByRole('button', { name: /^request .* approval$/i }).first();
      let label = '';
      if (await request.isVisible({ timeout: 4_000 }).catch(() => false)) {
        label = squash(await request.textContent().catch(() => '')).replace(/^request\s+/i, '').replace(/\s+approval$/i, '');
        await request.click({ timeout: 20_000 });
      }
      const approve = this.page.getByRole('button', { name: /^approve /i }).first();
      if (!(await approve.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false))) {
        return label ? { blockedBy: `${label}: no Approve button appeared after requesting it` } : {};
      }
      if (!label) label = squash(await approve.textContent().catch(() => '')).replace(/^approve\s+/i, '');
      await approve.click({ timeout: 20_000 });
      const cleared = await approve.waitFor({ state: 'hidden', timeout: 20_000 }).then(() => true).catch(() => false);
      if (!cleared) return { blockedBy: `${label}: clicking Approve did nothing (this user is probably not in that approval's approver group)` };
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this.page.locator('.o_form_view').waitFor({ state: 'visible', timeout: 60_000 });
    }
    return {};
  }

  async scrollToTop(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, 0));
  }

  headerButton(name: RegExp): Locator {
    return this.page.getByRole('button', { name }).first();
  }

  async isButtonVisible(name: RegExp, timeout = 5_000): Promise<boolean> {
    return this.headerButton(name).isVisible({ timeout }).catch(() => false);
  }

  /** The tooltip / title text of a button (Odoo puts "Waiting for approval" there). */
  async buttonTooltip(name: RegExp): Promise<string> {
    return this.headerButton(name).evaluate((el) => [
      el.getAttribute('title'), el.getAttribute('data-tooltip'), el.getAttribute('aria-label'),
      ...Array.from(el.querySelectorAll('img,[title],[data-tooltip]')).map((n) =>
        n.getAttribute('title') || n.getAttribute('data-tooltip') || n.getAttribute('alt') || ''),
    ].filter(Boolean).join(' | ')).catch(() => '');
  }

  /** "Approve Credit Limit" style activity text from the chatter, e.g. 'for Tharaka Herath'. */
  async pendingActivityAssignee(): Promise<string> {
    const text = squash(await this.page.locator('.o-mail-Activity, .o_mail_activity').first().textContent({ timeout: 3_000 }).catch(() => ''));
    return (text.match(/for\s+(.+?)\s*(?:Mark Done|Edit|Cancel|$)/i) || [])[1]?.trim() ?? '';
  }

  /** Current document status (e.g. "Sales Order") highlighted in the status bar. */
  async isStatus(label: RegExp): Promise<boolean> {
    return this.page.locator('.o_statusbar_status').getByText(label).isVisible({ timeout: 10_000 }).catch(() => false);
  }

  /** Current page URL (used to open the same quotation in a second browser). */
  currentUrl(): string {
    return this.page.url();
  }
}

// ─── Customer form (Bank Guarantee tab) ───────────────────────────────────────

export class CustomerFormPage extends SalesFormBase {
  constructor(page: Page) {
    super(page);
  }

  /** Sets the Customer Group. The field is found by its visible label (a combobox); nothing happens if it already shows the group. */
  async setCustomerGroup(group: string): Promise<void> {
    const field = this.page.getByRole('combobox', { name: /customer\s*group/i }).first();
    if (!(await field.isVisible({ timeout: 10_000 }).catch(() => false))) {
      // Read-only display: the label "Customer Group" followed by the value as plain text.
      const formText = squash(await this.page.locator('.o_form_view').first().textContent().catch(() => ''));
      if (new RegExp(`Customer Group\\s*${group}`).test(formText)) return; // already set, nothing to do
      throw new Error(`Customer Group is not ${group} and cannot be edited on this customer form`);
    }
    const current = (await field.inputValue().catch(() => '')) || (await field.textContent().catch(() => '')) || '';
    if (current.includes(group)) return; // already set

    await field.click();
    await field.selectText().catch(() => {});
    await field.fill(group);
    const drop = this.page.locator('.o-autocomplete--dropdown-menu');
    await expect(drop).toBeVisible({ timeout: 30_000 });
    await drop.locator('li, .o-autocomplete--dropdown-item').filter({ hasText: group }).first().click();
    await this.page.locator('.o_field_widget.o_field_many2one.o_loading').waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
  }

  async openBankGuaranteeTab(): Promise<void> {
    const tab = this.page.locator('.o_notebook .nav-link, .o_notebook .nav-item a').filter({ hasText: /bank.*guarantee.*details/i }).first();
    await expect(tab).toBeVisible({ timeout: 30_000 });
    await tab.click();
    await this.page.locator('.o_notebook .tab-pane.active').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  }

  /** Finds a field's <input> by technical name first, then by its visible label inside the active tab. */
  private async inputByNameOrLabel(names: string[], label: RegExp): Promise<Locator> {
    const byName = this.page.locator(names.map((n) => `[name="${n}"]`).join(', ')).first().locator('input').first();
    if (await byName.isVisible({ timeout: 3_000 }).catch(() => false)) return byName;

    const pane = this.page.locator('.o_notebook .tab-pane.active');
    const labelEl = pane.locator('label.o_form_label').filter({ hasText: label }).first();
    await expect(labelEl).toBeVisible({ timeout: 15_000 });
    const forAttr = await labelEl.getAttribute('for');
    if (forAttr) {
      const direct = this.page.locator(`input#${forAttr}`).first();
      if (await direct.isVisible({ timeout: 2_000 }).catch(() => false)) return direct;
      return this.page.locator(`#${forAttr} input`).first();
    }
    return labelEl.locator('xpath=../..//input[not(@type="checkbox")]').first();
  }

  async bankGuaranteeAmountInput(): Promise<Locator> {
    return this.inputByNameOrLabel(
      ['x_bank_guarantee_amount', 'bank_guarantee_amount', 'x_bg_amount', 'x_bg_guarantee_amount'],
      /bank.*guarantee.*amount/i,
    );
  }

  async bankGuaranteeExpiryInput(): Promise<Locator> {
    return this.inputByNameOrLabel(
      ['x_bank_guarantee_expiry_date', 'bank_guarantee_expiry_date', 'x_bg_expiry_date', 'x_expiry_date'],
      /expiry.*date/i,
    );
  }

  /** Builds a valid future date in the same order/separator as the input's placeholder (any locale). */
  async futureDateFor(input: Locator, y: number, m: number, d: number): Promise<string> {
    const placeholder = ((await input.getAttribute('placeholder').catch(() => '')) || '').toUpperCase();
    const sep = placeholder.includes('-') ? '-' : '/';
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    if (placeholder.startsWith('YYYY')) return `${y}${sep}${mm}${sep}${dd}`;
    if (placeholder.startsWith('DD')) return `${dd}${sep}${mm}${sep}${y}`;
    return `${mm}${sep}${dd}${sep}${y}`;
  }

  async setInput(input: Locator, value: string): Promise<void> {
    await input.click();
    await input.selectText();
    await input.fill(value);
  }
}
