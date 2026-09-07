import { Page, Locator } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { CharField } from '../../../core/components/CharField';
import { Many2OneField } from '../../../core/components/Many2OneField';
import { MonetaryField } from '../../../core/components/MonetaryField';
import { DateField } from '../../../core/components/DateField';
import { BooleanToggle } from '../../../core/components/BooleanToggle';
import { parseAmount } from '../calculations/SalesCalculations';

/**
 * Action/menu ids for this Odoo instance's hash-fragment router (see
 * BasePage.navigateToAction — the path-based navigateTo()/`/odoo/<path>` convention does
 * not work on this instance; discovered via `ir.actions.act_window`/`ir.ui.menu`
 * search_read against the live environment, not guessed).
 */
const SALE_ORDER_ACTION = { actionId: 514, model: 'sale.order', menuId: 330 } as const;
const CONTACTS_ACTION = { actionId: 1218, model: 'res.partner', menuId: 670 } as const;

export interface OrderLineInput {
  product: string;
  quantity: number;
  discount?: number;
  /** Overrides Odoo's auto-filled unit price when provided (used by margin/edge-case tests). */
  unitPrice?: number;
  /** Display name (or partial match) of the tax to apply to this line. Omit to leave untaxed. */
  tax?: string;
}

/**
 * Shared low-level helpers for both Sales Order and Customer (res.partner) forms —
 * validation-blocked-save detection, read-only field checks, and tolerant
 * Many2one selection against pre-existing environment master data.
 */
abstract class SalesBaseFormPage extends BaseFormPage {
  /** True when a field's widget has no visible/editable input — i.e. it is locked to its current value. */
  async isFieldReadOnly(fieldName: string): Promise<boolean> {
    const input = this.page.locator(`.o_field_widget[name="${fieldName}"] input`).first();
    const editable = await input.isVisible({ timeout: 3_000 }).catch(() => false);
    return !editable;
  }

  /** Returns the current display text of a field, whether editable or read-only. */
  async readFieldText(fieldName: string): Promise<string> {
    const widget = this.page.locator(`.o_field_widget[name="${fieldName}"]`).first();
    // Explicit timeout is required: with none, .textContent() on a locator matching zero
    // elements (e.g. a field not present on the currently active tab) waits using
    // Playwright's actionTimeout, which is unbounded in this project's config — it would
    // otherwise block until the whole test's global timeout kills it (observed: a 120s
    // hang on exactly this call for "company_id", which isn't rendered outside the
    // "Other Info" tab).
    return ((await widget.textContent({ timeout: 3_000 }).catch(() => '')) ?? '').trim().replace(/\s+/g, ' ');
  }

  /**
   * Clicks Save and reports whether Odoo blocked the save with a validation error
   * (record stays unsaved) instead of persisting it — used by every "blank required
   * field" validation test instead of duplicating the wait/race logic per test.
   */
  async attemptSaveExpectingBlock(): Promise<{ blocked: boolean; url: string }> {
    const urlBeforeSave = this.page.url();
    const saveBtn = this.page.locator('.o_control_panel').getByRole('button', { name: /^save/i });
    if (await saveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await saveBtn.click();
    } else {
      await this.page.locator('.o_form_button_save').first().click();
    }

    await Promise.race([
      this.page.locator('.o_field_invalid').waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {}),
      this.page.locator('.o_notification').waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {}),
      this.page.waitForURL((url) => url.href !== urlBeforeSave, { timeout: 8_000 }).catch(() => {}),
    ]);

    const urlAfterSave = this.page.url();
    const savedToRecord =
      /\/\d+(\?|\/|$)/.test(new URL(urlAfterSave).pathname) || /[?&]id=\d+/.test(new URL(urlAfterSave).search);
    return { blocked: !savedToRecord, url: urlAfterSave };
  }

  /**
   * Types into a Many2one field and selects the matching option only if it exists.
   * Returns false (without throwing) when the reference master-data record cannot
   * be found — callers should treat that as a config-dependent skip, not a failure.
   *
   * Retries once: this SaaS instance's autocomplete dropdown occasionally doesn't render
   * (or doesn't finish its search) within the first attempt's window, which previously
   * caused test.skip("not found") for records that do genuinely exist (confirmed via RPC
   * for every SALES_TEST_CONFIG reference) — a timing issue, not a missing-data one. The
   * retry re-clears and re-types the value rather than just re-waiting, since a stalled
   * search occasionally needs a fresh keystroke to kick off again.
   */
  async selectIfExists(fieldName: string, value: string, attempts = 2): Promise<boolean> {
    const widget = this.page.locator(`.o_field_widget[name="${fieldName}"]`).first();
    const input = widget.locator('input').first();
    await input.waitFor({ state: 'visible', timeout: 10_000 });

    for (let attempt = 1; attempt <= attempts; attempt++) {
      await input.click();
      await input.fill('');
      await input.fill(value);

      const dropdown = this.page.locator(
        '.o_field_many2one_dropdown, .ui-autocomplete, .o-dropdown--menu, .o-autocomplete--dropdown-menu',
      ).first();
      const opened = await dropdown.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);

      if (opened) {
        const match = dropdown
          .locator('.o_menu_item, .ui-menu-item, li, .o-autocomplete--dropdown-item')
          .filter({ hasText: value })
          .first();
        const found = await match.isVisible({ timeout: 5_000 }).catch(() => false);
        if (found) {
          await match.click();
          return true;
        }
      }

      if (attempt < attempts) {
        await this.page.waitForTimeout(500);
      }
    }
    return false;
  }
}

/**
 * Sale Order / Quotation form. Field names match Odoo 17's standard `sale.order`
 * model; "Quotation Type" is a custom selection widget (rendered as either a
 * <select> or an autocomplete depending on instance configuration), so it is
 * handled via `setQuotationType()` rather than a typed field component.
 */
export class SalesFormPage extends SalesBaseFormPage {
  private static readonly APPROVAL_PAIRS: [string, string][] = [
    ['Request RUG Approval', 'Approve RUG'],
    ['Request Overdue Approval', 'Approve Overdue'],
    ['Request Over Commission Approval', 'Approve Over Commission'],
    ['Request Insufficient Margin Approval', 'Approve Insufficient Margin'],
    ['Request Credit Limit Approval', 'Approve Credit Limit'],
    ['Request Bank Guarantee Approval', 'Approve Bank Guarantee'],
    ['Request Temporary Credit Approval', 'Approve Temporary Credit'],
  ];

  readonly reference: CharField;
  readonly customer: Many2OneField;
  readonly paymentTerm: Many2OneField;
  readonly salesperson: Many2OneField;
  readonly salesTeam: Many2OneField;
  readonly warehouse: Many2OneField;
  readonly company: Many2OneField;
  readonly untaxedAmount: MonetaryField;
  readonly taxAmount: MonetaryField;
  readonly totalAmount: MonetaryField;

  constructor(page: Page) {
    super(page);
    this.reference = new CharField(page, 'name');
    this.customer = new Many2OneField(page, 'partner_id');
    this.paymentTerm = new Many2OneField(page, 'payment_term_id');
    this.salesperson = new Many2OneField(page, 'user_id');
    this.salesTeam = new Many2OneField(page, 'team_id');
    this.warehouse = new Many2OneField(page, 'warehouse_id');
    this.company = new Many2OneField(page, 'company_id');
    this.untaxedAmount = new MonetaryField(page, 'amount_untaxed');
    this.taxAmount = new MonetaryField(page, 'amount_tax');
    this.totalAmount = new MonetaryField(page, 'amount_total');
  }

  async navigate(): Promise<void> {
    await this.navigateToAction({ ...SALE_ORDER_ACTION, viewType: 'form' });
  }
  async openById(id: number): Promise<void> {
    await this.navigateToAction({ ...SALE_ORDER_ACTION, viewType: 'form', resId: id });
  }

  // ── Header fields (tolerant of missing master data) ─────────────────────────

  async selectCustomerIfExists(name: string): Promise<boolean> { return this.selectIfExists('partner_id', name); }
  async selectSalesTeamIfExists(name: string): Promise<boolean> { return this.selectIfExists('team_id', name); }
  async selectWarehouseIfExists(name: string): Promise<boolean> { return this.selectIfExists('warehouse_id', name); }
  async selectSalespersonIfExists(name: string): Promise<boolean> { return this.selectIfExists('user_id', name); }
  async selectCompanyIfExists(name: string): Promise<boolean> { return this.selectIfExists('company_id', name); }

  async isCustomerFieldEmpty(): Promise<boolean> {
    const value = await this.customer.getValue();
    return value.trim() === '';
  }

  /** Sets the "Quotation Type" (a.k.a. "Order Payment Type" in some instances) widget. */
  async setQuotationType(value: string): Promise<void> {
    const field = this.page.getByLabel(/^quotation\s*type$/i).first();
    await field.waitFor({ state: 'visible', timeout: 10_000 });
    const tagName = await field.evaluate((el) => el.tagName.toLowerCase()).catch(() => 'select');
    if (tagName === 'select') {
      await field.selectOption({ label: value });
      return;
    }
    await field.click();
    await field.pressSequentially(value, { delay: 50 });
    const dropdown = this.page.locator('.o-autocomplete--dropdown-menu');
    await dropdown.waitFor({ state: 'visible', timeout: 8_000 });
    await dropdown.locator('li, .o-autocomplete--dropdown-item').filter({ hasText: value }).first().click();
  }

  // ── Other Info tab ───────────────────────────────────────────────────────────

  async openOtherInfoTab(): Promise<void> {
    const tab = this.page.locator('.o_notebook .nav-link, .o_notebook .nav-item a')
      .filter({ hasText: /other\s*info/i }).first();
    // Generous timeouts: this SaaS instance can be slow enough under load that the
    // default 10s occasionally isn't enough, observed as a hard test-timeout failure.
    await tab.waitFor({ state: 'visible', timeout: 20_000 });
    await tab.click();
    await this.page.locator('[name="team_id"]').waitFor({ state: 'visible', timeout: 20_000 });
    await this.page.waitForTimeout(300);
  }

  /** Fills Sales Team and Warehouse on the Other Info tab. Returns false if either is missing. */
  async fillOtherInfo(salesTeam: string, warehouse: string): Promise<boolean> {
    await this.openOtherInfoTab();
    const teamOk = await this.selectSalesTeamIfExists(salesTeam);
    if (!teamOk) return false;
    return this.selectWarehouseIfExists(warehouse);
  }

  // ── Order Lines tab ───────────────────────────────────────────────────────────

  async openOrderLinesTab(): Promise<void> {
    const tab = this.page.locator('.o_notebook .nav-link, .o_notebook .nav-item a')
      .filter({ hasText: /order\s*lines/i }).first();
    await tab.waitFor({ state: 'visible', timeout: 10_000 });
    await tab.click();
    await this.page.locator('.o_field_one2many').waitFor({ state: 'visible', timeout: 10_000 });
    // Brief settle: the "Add a product" link can render a moment after the tab body does.
    await this.page.waitForTimeout(300);
  }

  /**
   * Adds a single order line. Returns false (without throwing) if the product cannot be found.
   *
   * Retries the whole "click Add a product → row appears → type → dropdown match" sequence
   * up to twice: on this SaaS instance, the newly-inserted editable row (and its product
   * autocomplete) occasionally isn't fully settled by the time we query for it right after
   * the click — confirmed empirically that the product genuinely exists and the dropdown
   * does open reliably in isolation, so this is a rendering-timing issue, not a data gap.
   */
  async addOrderLine(line: OrderLineInput, attempts = 2): Promise<boolean> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const addLink = this.page.locator('.o_field_x2many_list_row_add a')
        .filter({ hasText: /add a product/i }).first();
      await addLink.waitFor({ state: 'visible', timeout: 10_000 });
      await addLink.click();
      await this.page.waitForTimeout(300);

      const row = this.page.locator('.o_data_row.o_selected_row').first();
      const productInput = row.locator('[name="product_id"] input').first();
      const rowReady = await productInput.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
      if (!rowReady) {
        if (attempt < attempts) { await this.page.waitForTimeout(500); continue; }
        return false;
      }

      await productInput.pressSequentially(line.product, { delay: 50 });

      const dropdown = this.page.locator('.o-autocomplete--dropdown-menu');
      const opened = await dropdown.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
      const match = dropdown.locator('li, .o-autocomplete--dropdown-item').filter({ hasText: line.product }).first();
      const found = opened && await match.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!found) {
        // Discard this half-filled row before retrying — otherwise the next "Add a
        // product" click leaves TWO incomplete rows in edit state (observed: a stray
        // empty row that permanently blocked Save from ever completing).
        await this.discardIncompleteRow(row);
        if (attempt < attempts) { await this.page.waitForTimeout(500); continue; }
        return false;
      }
      await match.click({ force: true });
      return this.finishOrderLine(row, line);
    }
    return false;
  }

  /** Cancels an unsaved, incomplete one2many list row via Escape (Odoo discards it). */
  private async discardIncompleteRow(row: Locator): Promise<void> {
    const stillEditing = await row.isVisible({ timeout: 1_000 }).catch(() => false);
    if (!stillEditing) return;
    await this.page.keyboard.press('Escape').catch(() => {});
    await row.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
  }

  /** Fills quantity/price/discount/tax on an already-selected order line row. */
  private async finishOrderLine(row: Locator, line: OrderLineInput): Promise<boolean> {

    const qty = row.locator('[name="product_uom_qty"] input').first();
    await qty.waitFor({ state: 'visible', timeout: 8_000 });
    await qty.click();
    await qty.fill(String(line.quantity));
    await qty.press('Tab');

    if (line.unitPrice !== undefined) {
      const priceInput = row.locator('[name="price_unit"] input').first();
      await priceInput.waitFor({ state: 'visible', timeout: 8_000 });
      await priceInput.click();
      await priceInput.fill(String(line.unitPrice));
      await priceInput.press('Tab');
    }

    if (line.discount !== undefined) {
      const discInput = row.locator('[name="discount"] input').first();
      await discInput.waitFor({ state: 'visible', timeout: 5_000 });
      await discInput.click();
      await discInput.fill(String(line.discount));
      await discInput.press('Tab');
    }

    if (line.tax) {
      const lastRow = this.page.locator('.o_data_row').last();
      await this.applyTaxToRow(lastRow, line.tax);
    }

    return true;
  }

  /** Opens the Order Lines tab and adds every line. Returns the number successfully added. */
  async addOrderLines(lines: OrderLineInput[]): Promise<number> {
    await this.openOrderLinesTab();
    let added = 0;
    for (const line of lines) {
      if (await this.addOrderLine(line)) added++;
    }
    return added;
  }

  async setLineTax(rowIndex: number, taxName: string): Promise<void> {
    await this.applyTaxToRow(this.rowAt(rowIndex), taxName);
  }

  async getLineCount(): Promise<number> { return this.page.locator('.o_data_row').count(); }

  async getLineQuantity(rowIndex: number): Promise<number> {
    return parseAmount(await this.rowAt(rowIndex).locator('[name="product_uom_qty"]').textContent());
  }

  async getLineUnitPrice(rowIndex: number): Promise<number> {
    return parseAmount(await this.rowAt(rowIndex).locator('[name="price_unit"]').textContent());
  }

  async getLineDiscount(rowIndex: number): Promise<number> {
    return parseAmount(await this.rowAt(rowIndex).locator('[name="discount"]').textContent());
  }

  /** "Tax excl." net amount for a line (Odoo field `price_subtotal`). */
  async getLineNetAmount(rowIndex: number): Promise<number> {
    return parseAmount(await this.rowAt(rowIndex).locator('[name="price_subtotal"]').textContent());
  }

  private rowAt(index: number): Locator {
    return this.page.locator('.o_data_row').nth(index);
  }

  private async applyTaxToRow(row: Locator, taxName: string): Promise<void> {
    const taxCell = row.locator('[name="tax_id"]').first();
    const existingText = ((await taxCell.textContent().catch(() => '')) ?? '').toLowerCase();
    if (existingText && taxName.toLowerCase().includes(existingText.trim())) return;

    await taxCell.scrollIntoViewIfNeeded();
    await taxCell.click();
    const taxInput = taxCell.locator('input[type="text"]').first();
    await taxInput.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    await taxInput.click();
    await this.page.keyboard.type(taxName, { delay: 60 });
    const dropdown = this.page.locator('.o-autocomplete--dropdown-menu');
    await dropdown.waitFor({ state: 'visible', timeout: 8_000 });
    await dropdown.locator('li, .o-autocomplete--dropdown-item')
      .filter({ hasText: taxName }).first().click({ force: true });
  }

  // ── Confirm / Approval workflow ───────────────────────────────────────────────
  // Odoo 17 renders quotation action buttons either inside `.o_statusbar_buttons`
  // (form-sheet status bar) or `.o_control_panel`, depending on viewport/theme —
  // this instance has been observed using both, so both are matched.

  private statusButton(label: string | RegExp): Locator {
    return this.page.locator('.o_statusbar_buttons, .o_control_panel').getByRole('button', { name: label });
  }

  async isConfirmVisible(): Promise<boolean> { return this.isStatusButtonVisible(/^confirm$/i); }

  async isStatusButtonVisible(label: string | RegExp): Promise<boolean> {
    return this.statusButton(label).first().isVisible({ timeout: 5_000 }).catch(() => false);
  }

  async clickStatusButtonByRole(label: string | RegExp): Promise<void> {
    const btn = this.statusButton(label).first();
    await btn.waitFor({ state: 'visible', timeout: 10_000 });
    await btn.click();
  }

  /** Handles every visible approval request/approve pair, then clicks Confirm and waits for "Sales Order". */
  async confirmOrder(): Promise<void> {
    for (const [requestLabel, approveLabel] of SalesFormPage.APPROVAL_PAIRS) {
      if (await this.isStatusButtonVisible(requestLabel)) {
        await this.clickStatusButtonByRole(requestLabel);
        await this.statusButton(approveLabel).first().waitFor({ state: 'visible', timeout: 30_000 });
        await this.clickStatusButtonByRole(approveLabel);
        await this.statusButton(approveLabel).first().waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
      }
    }
    await this.clickStatusButtonByRole(/^confirm$/i);
    await this.page.locator('.o_statusbar_status').filter({ hasText: /sales order/i })
      .waitFor({ state: 'visible', timeout: 60_000 });
  }

  // ── Downstream document workflow ──────────────────────────────────────────────

  /** Creates a percentage-based advance payment. `done` is false if the dialog never opened. */
  async createAdvancePayment(percent: number): Promise<{ done: boolean; amount: string }> {
    const totalNum = await this.totalAmount.getValue();
    const advanceAmount = ((totalNum * percent) / 100).toFixed(2);

    const createBtn = this.page.locator('.o_control_panel').getByRole('button', { name: /create advance payment/i });
    await createBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await createBtn.click();

    const dialog = this.page.locator('.modal-content, .o_dialog').first();
    const dialogVisible = await dialog.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!dialogVisible) return { done: false, amount: advanceAmount };

    const amountInput = dialog.locator('[name="amount"] input, [name="fixed_amount"] input').first();
    if (await amountInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await amountInput.click();
      await amountInput.fill(advanceAmount);
    }

    const okBtn = dialog.getByRole('button', { name: /create (payment|invoice)|ok|confirm/i }).first();
    await okBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await okBtn.click();
    await dialog.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});

    return { done: true, amount: advanceAmount };
  }

  /** Opens the linked delivery, sets Done quantities to Demand, validates, and returns to the Sales Order. */
  async processDelivery(): Promise<string> {
    const soUrl = this.page.url();

    let clicked = false;
    for (const sel of ['button[name="action_view_delivery"]', 'button[name="action_view_delivery_ids"]']) {
      const btn = this.page.locator(sel);
      if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) { await btn.click(); clicked = true; break; }
    }
    if (!clicked) {
      const statBtn = this.page.locator(
        '.oe_button_box button, button.oe_stat_button, button.o_stat_button, .o_cp_stat_buttons button',
      ).filter({ hasText: /delivery/i }).first();
      if (await statBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await statBtn.click();
      } else {
        const fallbackBtn = this.page.getByRole('button').filter({ hasText: /delivery/i }).first();
        await fallbackBtn.waitFor({ state: 'visible', timeout: 10_000 });
        await fallbackBtn.click();
      }
    }

    await this.page.waitForURL((url) => url.href !== soUrl, { timeout: 30_000 });

    if (await this.page.locator('.o_list_view').isVisible({ timeout: 3_000 }).catch(() => false)) {
      await this.page.locator('.o_list_view .o_data_row').first().click();
      await this.page.locator('.o_form_view').waitFor({ state: 'visible', timeout: 15_000 });
    }

    const deliveryUrl = this.page.url();
    const deliveryRef = ((await this.page.locator('[name="name"] .o_field_char, [name="name"] span')
      .first().textContent().catch(() => '')) ?? '').trim() || 'WH/OUT/xxxxx';

    const checkAvail = this.page.locator('.o_control_panel').getByRole('button', { name: /check availability/i });
    if (await checkAvail.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await checkAvail.click();
      await checkAvail.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    }

    const opsTab = this.page.locator('.o_notebook .nav-link, .o_notebook .nav-item a')
      .filter({ hasText: /operations/i }).first();
    await opsTab.waitFor({ state: 'visible', timeout: 10_000 });
    await opsTab.click();
    await this.page.locator('.o_field_one2many').waitFor({ state: 'visible', timeout: 10_000 });

    const rows = this.page.locator('.o_data_row');
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const demandText = ((await row.locator('[name="product_uom_qty"]').textContent().catch(() => '0')) ?? '0').trim();
      const demand = demandText.replace(/,/g, '');
      if (!demand || demand === '0' || demand === '0.00') continue;
      const qtyDone = row.locator('[name="qty_done"] input').first();
      if (!(await qtyDone.isVisible({ timeout: 1_500 }).catch(() => false))) {
        await row.locator('[name="qty_done"]').click();
        await qtyDone.waitFor({ state: 'visible', timeout: 5_000 });
      }
      await qtyDone.click();
      await qtyDone.fill(demand);
      await qtyDone.press('Tab');
    }

    const validateBtn = this.page.locator('.o_control_panel').getByRole('button', { name: /^validate/i });
    await validateBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await validateBtn.click();

    const immDialog = this.page.locator('.modal, .o_dialog').filter({ hasText: /immediate transfer/i });
    if (await immDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await immDialog.getByRole('button', { name: /^validate/i }).click();
    }

    const boDialog = this.page.locator('.modal, .o_dialog').filter({ hasText: /backorder/i });
    if (await boDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await boDialog.getByRole('button', { name: /create backorder/i }).click();
    }

    const doneLocator = this.page.locator('.o_statusbar_status').filter({ hasText: /done/i });
    const isDone = await doneLocator.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!isDone) {
      await this.page.goto(deliveryUrl);
      await this.page.locator('.o_form_view').waitFor({ state: 'visible', timeout: 15_000 });
      await doneLocator.waitFor({ state: 'visible', timeout: 30_000 });
    }

    const breadcrumb = this.page.locator('.o_breadcrumb a, .o_breadcrumb .o_back_button').first();
    if (await breadcrumb.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await breadcrumb.click();
    } else {
      await this.page.goto(soUrl);
    }
    await this.page.locator('.o_form_view').waitFor({ state: 'visible', timeout: 20_000 });

    return deliveryRef;
  }

  /** Creates a draft (Regular) customer invoice from the Sales Order. Returns the draft's reference. */
  async createDraftInvoice(): Promise<string> {
    const createInvBtn = this.page.locator('.o_control_panel').getByRole('button', { name: /create invoice/i });
    await createInvBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await createInvBtn.click();

    const dialog = this.page.locator('.modal-content, .o_dialog').first();
    await dialog.waitFor({ state: 'visible', timeout: 15_000 });

    const regularRadio = dialog.locator('input[value="regular"], input[id*="regular"]').first();
    if (await regularRadio.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await regularRadio.click();
    }

    const createDraftBtn = dialog.getByRole('button', { name: /create.*draft|create.*invoice/i }).first();
    await createDraftBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await createDraftBtn.click();

    await this.page.locator('.o_form_view').waitFor({ state: 'visible', timeout: 30_000 });

    return ((await this.page.locator('[name="name"] .o_field_char, [name="name"] span')
      .first().textContent().catch(() => '')) ?? '').trim() || 'Draft';
  }

  /** Confirms (posts) a draft invoice. Returns the posted invoice's reference. */
  async postInvoice(): Promise<string> {
    const confirmBtn = this.page.locator('.o_control_panel').getByRole('button', { name: /^confirm$/i });
    await confirmBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await confirmBtn.click();
    await this.page.locator('.o_statusbar_status').filter({ hasText: /posted/i })
      .waitFor({ state: 'visible', timeout: 30_000 });
    return ((await this.page.locator('[name="name"] .o_field_char, [name="name"] span')
      .first().textContent().catch(() => '')) ?? '').trim() || 'INV/xxxx';
  }

  /** Clicks Send & Print on a posted invoice and waits for the dialog to close. */
  async sendAndPrintInvoice(): Promise<void> {
    const sendBtn = this.page.locator('.o_control_panel').getByRole('button', { name: /send.*&.*print|send.*print/i });
    await sendBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await sendBtn.click();

    const dialog = this.page.locator('.modal-content, .o_dialog').first();
    await dialog.waitFor({ state: 'visible', timeout: 15_000 });

    const confirmBtn = dialog.getByRole('button', { name: /send.*&.*print|send.*print/i }).first();
    await confirmBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await confirmBtn.click();

    await dialog.waitFor({ state: 'hidden', timeout: 60_000 });
  }
}

export class SalesListPage extends BaseListPage {
  constructor(page: Page) { super(page); }
  async navigate(): Promise<void> {
    await this.navigateToAction({ ...SALE_ORDER_ACTION, viewType: 'list' });
  }
  async openSales(name: string): Promise<void> { await this.clickRowByText(name); }
}

/**
 * Customer (res.partner) form — used by the mandatory-Bank-Guarantee validation
 * and (potentially) credit-limit lookups. `x_customer_group_id`, `x_bank_guarantee_amount`,
 * and `x_bank_guarantee_expiry_date` are Odoo Studio custom fields; their technical
 * names may differ per instance — see src/modules/sales/notes/sales.notes.md.
 */
export class SalesCustomerFormPage extends SalesBaseFormPage {
  readonly customerName: CharField;
  /**
   * `x_studio_customer_group` (the Many2one Studio field the legacy tests keyed off of)
   * exists on the res.partner model but is NOT placed on this instance's contact form view
   * (confirmed empirically — zero matching elements render, on any tab). The actual
   * UI-editable trigger for "this customer needs a bank guarantee" is this boolean instead.
   */
  readonly mandatoryBankGuarantee: BooleanToggle;
  readonly creditLimit: MonetaryField;
  readonly bankGuaranteeAmount: MonetaryField;
  readonly bankGuaranteeExpiryDate: DateField;

  constructor(page: Page) {
    super(page);
    this.customerName = new CharField(page, 'name');
    this.mandatoryBankGuarantee = new BooleanToggle(page, 'x_studio_mandatory_bank_guarantee');
    this.creditLimit = new MonetaryField(page, 'credit_limit');
    this.bankGuaranteeAmount = new MonetaryField(page, 'x_studio_bank_guarantee_amount');
    this.bankGuaranteeExpiryDate = new DateField(page, 'x_studio_expiry_date');
  }

  async navigate(): Promise<void> {
    await this.navigateToAction({ ...CONTACTS_ACTION, viewType: 'form' });
  }
  async openById(id: number): Promise<void> {
    await this.navigateToAction({ ...CONTACTS_ACTION, viewType: 'form', resId: id });
  }

  async openSalesPurchaseTab(): Promise<void> {
    const tab = this.page.locator('.o_notebook .nav-link, .o_notebook .nav-item a')
      .filter({ hasText: /sales.*purchase/i }).first();
    await tab.waitFor({ state: 'visible', timeout: 10_000 });
    await tab.click();
  }

  /** Opens the Bank Guarantee Details tab if present. Returns false if the tab doesn't exist. */
  async openBankGuaranteeTabIfPresent(): Promise<boolean> {
    const tab = this.page.locator('.o_notebook .nav-link, .o_notebook .nav-item a')
      .filter({ hasText: /bank\s*guarantee\s*details/i }).first();
    const visible = await tab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) return false;
    await tab.click();
    return true;
  }

  /** True only if both Bank Guarantee fields render as editable inputs in this environment. */
  async hasBankGuaranteeFields(): Promise<boolean> {
    const amountVisible = await this.page.locator('.o_field_widget[name="x_studio_bank_guarantee_amount"] input')
      .isVisible({ timeout: 3_000 }).catch(() => false);
    const expiryVisible = await this.page.locator('.o_field_widget[name="x_studio_expiry_date"] input')
      .isVisible({ timeout: 3_000 }).catch(() => false);
    return amountVisible && expiryVisible;
  }
}
