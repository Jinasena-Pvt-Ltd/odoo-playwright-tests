import { Page, Locator } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { CharField } from '../../../core/components/CharField';
import { Many2OneField } from '../../../core/components/Many2OneField';
import { MonetaryField } from '../../../core/components/MonetaryField';
import { DateField } from '../../../core/components/DateField';
import { BooleanToggle } from '../../../core/components/BooleanToggle';
import { parseAmount } from '../calculations/SalesCalculations';

/** Thrown by SalesFormPage.confirmOrder() when an approval step cannot be completed
 * because the current test user lacks membership in the required Studio approver group. */
export class ApprovalPermissionError extends Error {}

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
  async selectIfExists(fieldName: string, value: string, attempts = 6): Promise<boolean> {
    const widget = this.page.locator(`.o_field_widget[name="${fieldName}"]`).first();
    const input = widget.locator('input').first();
    await input.waitFor({ state: 'visible', timeout: 10_000 });
    // Brief settle before the very first attempt — this field is frequently reached
    // right after a tab switch or page navigation, and typing into it while the widget
    // is still mounting was one contributor to the "click landed, nothing typed" flake.
    await this.page.waitForTimeout(300);

    for (let attempt = 1; attempt <= attempts; attempt++) {
      await input.click();
      await input.fill('');
      // Odoo's autocomplete debounces its search (~300ms) — typing via pressSequentially
      // instead of a single fill() reliably re-triggers that debounce on every attempt,
      // whereas a single fill() was occasionally ignored on retries (stale search state).
      await input.pressSequentially(value, { delay: 30 });
      await this.page.waitForTimeout(400);

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
          // Verify the click actually committed a value (the dropdown can close from
          // a re-render mid-click, silently leaving the field blank) — if not, fall
          // through and retry instead of returning a false positive.
          let committed = await input.inputValue().catch(() => '');
          if (!committed.trim()) {
            // Mouse click can occasionally land on a stale/repositioned element right as
            // the dropdown re-renders — a keyboard-driven selection (re-open, arrow down
            // to the first result, Enter) doesn't depend on the item's on-screen position
            // and has proven more robust elsewhere in this suite for the same class of
            // "click resolved but nothing happened" flake.
            await input.click();
            await this.page.keyboard.press('ArrowDown');
            await this.page.keyboard.press('Enter');
            await this.page.waitForTimeout(300);
            committed = await input.inputValue().catch(() => '');
          }
          if (committed.trim().length > 0) {
            return true;
          }
        }
      }

      if (attempt < attempts) {
        await this.page.waitForTimeout(600);
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
  // Request-label matchers use a fuzzy regex (word-boundary-free on the noun) rather than
  // an exact string: confirmed live that this instance's actual button reads "Request
  // Insufficient Marginn Approval" — a genuine typo baked into this Studio config, not a
  // framework bug — which silently failed to match the exact string "...Margin Approval"
  // (the literal substring never appears once "Margin" is followed by an extra "n").
  // A tolerant regex survives this and any similar typo in the other approval labels.
  private static readonly APPROVAL_PAIRS: [string | RegExp, string][] = [
    ['Request RUG Approval', 'Approve RUG'],
    ['Request Overdue Approval', 'Approve Overdue'],
    ['Request Over Commission Approval', 'Approve Over Commission'],
    [/request\s+insufficient\s+margin\w*\s+approval/i, 'Approve Insufficient Margin'],
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

  /**
   * Sets the "Quotation Type" widget (a custom selection widget, not a standard
   * `[name=...]` attribute we can rely on).
   *
   * CORRECTION (2026-09-08): "Quotation Type" and "Order Payment Type" were previously
   * assumed to be the same field/widget (based on legacy test naming) and only this one
   * was ever filled. Confirmed live via DOM inspection that they are two entirely
   * separate, independently-required Studio fields — "Order Payment Type" is
   * `x_studio_order_payment_method`, a plain `<select>` with options "", "Cash",
   * "Credit". Leaving it unset silently blocked every save with "Invalid fields: Order
   * Payment Type", surfacing only as a mysterious save timeout (fixed generically in
   * BaseFormPage.save(), which now fails fast on this instead of hanging). Every caller
   * of setQuotationType() must also call setOrderPaymentType() unless the field being
   * deliberately left blank is Order Payment Type itself.
   */
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

  /** Sets the separate "Order Payment Type" (`x_studio_order_payment_method`) select. */
  async setOrderPaymentType(value: string): Promise<void> {
    const field = this.page.getByLabel(/^order\s*payment\s*type$/i).first();
    await field.waitFor({ state: 'visible', timeout: 10_000 });
    await field.selectOption({ label: value });
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
  async addOrderLine(line: OrderLineInput, attempts = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const addLink = this.page.locator('.o_field_x2many_list_row_add a')
        .filter({ hasText: /add a product/i }).first();
      await addLink.waitFor({ state: 'visible', timeout: 10_000 });
      await addLink.click();
      // Bumped 300ms -> 600ms (2026-09-10): same cold-start reasoning as
      // addOrderLines()'s inter-line settle — the newly-created row's product
      // autocomplete needs slightly longer to fully mount before it reliably accepts
      // typed input, most visibly on the very first order-line add of a session.
      await this.page.waitForTimeout(600);

      // .last() (not .first()): a previous row occasionally hasn't finished being
      // deselected by the time the next "Add a product" click fires — confirmed live —
      // so BOTH rows can transiently carry `.o_selected_row` at once. `.first()` then
      // grabbed the OLD, already-populated row instead of the new empty one: typing into
      // its (non-empty, no-longer-autocompleting) product input silently did nothing,
      // while a page-wide dropdown locator picked up the truly-new row's own
      // auto-opened-but-untyped-into dropdown — two different rows, silently mismatched.
      // The newest row is always the last one appended to the list.
      const row = this.page.locator('.o_data_row.o_selected_row').last();
      const productInput = row.locator('[name="product_id"] input').first();
      const rowReady = await productInput.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
      if (!rowReady) {
        if (attempt < attempts) { await this.page.waitForTimeout(500); continue; }
        return false;
      }
      // Defensive check on top of .last(): a genuinely fresh row's product input must be
      // empty. If it isn't, the wrong row was still somehow picked — fail this attempt
      // fast (and retry) rather than silently typing into an already-populated field.
      const alreadyHasValue = ((await productInput.inputValue().catch(() => '')) || '').trim().length > 0;
      if (alreadyHasValue) {
        if (attempt < attempts) { await this.page.waitForTimeout(500); continue; }
        return false;
      }

      const dropdown = this.page.locator('.o-autocomplete--dropdown-menu');
      let found = false;
      let match = dropdown.locator('li, .o-autocomplete--dropdown-item').filter({ hasText: line.product }).first();

      // In-place retype retry BEFORE the more expensive "discard row and re-add" cycle:
      // mirrors the pattern already proven in selectIfExists() — a debounced search
      // occasionally doesn't fire (or the dropdown doesn't render) from the first
      // keystroke batch, and simply clearing + retyping resolves it without needing to
      // throw away and recreate the whole row.
      //
      // CONFIRMED LIVE (2026-09-10): a freshly-created row auto-focuses its product
      // input AND auto-opens the dropdown showing its default (untyped) suggestion list
      // — so the old `dropdown.waitFor({state:'visible'})` check right after typing was
      // never a real signal that the keystrokes registered, since the dropdown was
      // already open before any typing happened. When pressSequentially's keystrokes
      // occasionally didn't land in that already-open, already-focused input, this loop
      // saw "dropdown open" = true and short-circuited past the "did it actually
      // filter?" question — reporting `found: false` after checking the wrong thing
      // rather than genuinely detecting and correcting the untyped state.
      // Fix: explicitly select-all + Delete before every typing attempt (not just
      // retries) to force a real, unambiguous input change, and check that the "Start
      // typing..." placeholder item is gone as the real signal that text was received.
      for (let typeAttempt = 1; typeAttempt <= 3 && !found; typeAttempt++) {
        await productInput.click();
        await this.page.keyboard.press('Control+A');
        await this.page.keyboard.press('Delete');
        await this.page.waitForTimeout(150);
        await productInput.pressSequentially(line.product, { delay: 50 });
        await dropdown.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
        const stillShowingPlaceholder = await dropdown
          .locator('li, .o-autocomplete--dropdown-item')
          .filter({ hasText: /^start typing/i }).first()
          .isVisible({ timeout: 1_000 }).catch(() => false);
        match = dropdown.locator('li, .o-autocomplete--dropdown-item').filter({ hasText: line.product }).first();
        found = !stillShowingPlaceholder && await match.isVisible({ timeout: 5_000 }).catch(() => false);
        if (!found) await this.page.waitForTimeout(300);
      }

      if (!found) {
        // Discard this half-filled row before retrying — otherwise the next "Add a
        // product" click leaves TWO incomplete rows in edit state (observed: a stray
        // empty row that permanently blocked Save from ever completing).
        await this.discardIncompleteRow(row);
        if (attempt < attempts) { await this.page.waitForTimeout(500); continue; }
        return false;
      }
      await match.click({ force: true });

      // The click can also silently fail to actually commit the row (observed: the
      // dropdown match resolves and gets clicked, but the row's other cells — qty,
      // price — never populate, and finishOrderLine's wait times out). Previously that
      // exception propagated straight out of addOrderLine with no retry at all. Now it
      // is caught here so the same "discard and retry the whole attempt" recovery
      // applies to this failure mode too, not just "product not found in dropdown".
      try {
        return await this.finishOrderLine(row, line);
      } catch (err) {
        await this.discardIncompleteRow(row);
        if (attempt < attempts) {
          await this.page.waitForTimeout(500);
          continue;
        }
        throw err;
      }
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
    // Selecting a product triggers an onchange RPC (price/UoM/tax defaults) before
    // Odoo finishes populating the row's other cells — wait for that to actually
    // finish (loading indicator gone) rather than just padding a fixed delay, which
    // only papered over the race under recording overhead (video/trace) without
    // addressing why it was racing in the first place.
    await this.page.locator('.o_loading_indicator').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    await this.page.waitForTimeout(300);

    const qty = row.locator('[name="product_uom_qty"] input').first();
    // A freshly-created product being priced for the first time under a customer's
    // specific pricelist appears to trigger a genuinely slower one-time server-side
    // computation than an established product with cached pricing (confirmed: swapping
    // in old, long-existing products made the same test pass reliably where fresh
    // fixture-created products consistently timed out here) — a generous timeout
    // rather than a client-side race is the right accommodation for that.
    await qty.waitFor({ state: 'visible', timeout: 45_000 });
    await qty.click();
    await qty.fill(String(line.quantity));
    await qty.press('Tab');

    if (line.unitPrice !== undefined) {
      const priceInput = row.locator('[name="price_unit"] input').first();
      await priceInput.waitFor({ state: 'visible', timeout: 15_000 });
      await priceInput.click();
      await priceInput.fill(String(line.unitPrice));
      await priceInput.press('Tab');
    }

    if (line.discount !== undefined) {
      const discInput = row.locator('[name="discount"] input').first();
      await discInput.waitFor({ state: 'visible', timeout: 10_000 });
      await discInput.click();
      await discInput.fill(String(line.discount));
      await discInput.press('Tab');
    }

    if (line.tax) {
      const lastRow = this.page.locator('.o_data_row').last();
      await this.applyTaxToRow(lastRow, line.tax);
    }

    // Explicitly commit/deselect this row before returning. Without this, the row can
    // remain in `.o_selected_row` (edit) state, and the NEXT "Add a product" click
    // occasionally re-enters this same still-selected row instead of creating a new
    // one — observed as a second line silently overwriting/replacing the first rather
    // than being appended alongside it. Clicking the (already-active) Order Lines tab
    // header blurs/commits the row without risking a discard, unlike Escape.
    const orderLinesTab = this.page.locator('.o_notebook .nav-link, .o_notebook .nav-item a')
      .filter({ hasText: /order\s*lines/i }).first();
    await orderLinesTab.click().catch(() => {});
    await row.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});

    return true;
  }

  /** Opens the Order Lines tab and adds every line. Returns the number successfully added. */
  async addOrderLines(lines: OrderLineInput[]): Promise<number> {
    await this.openOrderLinesTab();
    let added = 0;
    for (const line of lines) {
      if (await this.addOrderLine(line)) added++;
      // Settle before clicking "Add a product" again — the previous line's onchange
      // (price/uom/tax recompute) can still be wrapping up, and clicking too soon
      // occasionally raced ahead of it on this instance (observed: a 2nd line silently
      // failing to add with no error, when clicked immediately after the 1st). Bumped
      // 500ms -> 1000ms (2026-09-10): confirmed live this failure is markedly more
      // frequent specifically when this is the FIRST two-line add of an entire suite
      // run (cold JS/render state, before anything has warmed up) — matches the same
      // "first invocation is slower" pattern documented elsewhere in this codebase for
      // fresh-product pricing and similar first-use interactions.
      await this.page.waitForTimeout(1_000);
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

  async clickStatusButtonByRole(label: string | RegExp, timeout = 10_000): Promise<void> {
    const btn = this.statusButton(label).first();
    await btn.waitFor({ state: 'visible', timeout });
    await btn.click();
  }

  /**
   * True when clicking an "Approve ..." button was rejected because the current test user
   * is not a member of the Studio-configured approver security group for that rule.
   * Confirmed live via RPC: `studio.approval.rule.check_approval` returns
   * `{ approved: false, rules: [{ can_validate: false, ... }] }` for the `admin` test user
   * against e.g. "Sales / Jin - Sales - Sales Margin Approvers", and Odoo surfaces this as
   * a toast ("The following approvals are missing: <group name>") rather than an error —
   * the approve button stays visible/clickable but never actually approves anything. This
   * is a genuine environment/permissions limitation, not a bug: no amount of retrying or
   * waiting longer will make it succeed, so callers must catch `ApprovalPermissionError`
   * and skip rather than fail.
   */
  private async isApprovalBlockedByPermissions(): Promise<boolean> {
    const notification = this.page.locator('.o_notification').filter({ hasText: /approvals? .* (missing|not.*approved)/i }).first();
    return notification.isVisible({ timeout: 2_000 }).catch(() => false);
  }

  /**
   * Clicks the given "Approve ..." button and reports whether Odoo actually rejected it
   * for lack of security-group membership (see isApprovalBlockedByPermissions above),
   * without throwing. Used directly by permission tests that want to assert the denial
   * itself, as opposed to confirmOrder() which treats the same denial as fatal.
   */
  async attemptApprovalAndCheckIfDenied(approveLabel: string | RegExp): Promise<boolean> {
    await this.clickStatusButtonByRole(approveLabel);
    const outcome = await Promise.race([
      this.statusButton(approveLabel).first().waitFor({ state: 'hidden', timeout: 20_000 }).then(() => 'gone' as const),
      this.page.locator('.o_notification').filter({ hasText: /approvals? .* (missing|not.*approved)/i }).first()
        .waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'blocked' as const),
    ]).catch(() => 'timeout' as const);
    if (outcome === 'gone') return false;
    return outcome === 'blocked' || this.isApprovalBlockedByPermissions();
  }

  /** Handles every visible approval request/approve pair, then clicks Confirm and waits for "Sales Order". */
  async confirmOrder(): Promise<void> {
    for (const [requestLabel, approveLabel] of SalesFormPage.APPROVAL_PAIRS) {
      if (await this.isStatusButtonVisible(requestLabel)) {
        await this.clickStatusButtonByRole(requestLabel);
        await this.statusButton(approveLabel).first().waitFor({ state: 'visible', timeout: 30_000 });
        const denied = await this.attemptApprovalAndCheckIfDenied(approveLabel);
        if (denied) {
          throw new ApprovalPermissionError(
            `Cannot complete "${approveLabel}" — the current test user is not a member of the ` +
            'Studio-configured approver group for this rule (confirmed via a "missing approvals" ' +
            'notification), so this environment cannot fully exercise this approval workflow.',
          );
        }
      }
    }
    // 30s (not the default 10s): after an approval round-trip, the status bar can take
    // noticeably longer to re-render with "Confirm" available again on this instance.
    await this.clickStatusButtonByRole(/^confirm$/i, 30_000);
    // waitForStatus() (not a raw hasText filter): confirmed live that the statusbar's
    // text can contain "Sales Order" for a moment before that stage's radio is actually
    // marked checked — a hasText wait resolves on the text alone and returns too early,
    // so a getCurrentStatus() call immediately after this method still read back the
    // still-checked "Quotation" radio. waitForStatus() checks the checked radio itself.
    await this.waitForStatus('Sales Order');
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

    // `.o_statusbar_buttons, .o_control_panel` (not `.o_control_panel` alone): confirmed
    // live via screenshot that this stock.picking form's "Validate"/"Check Availability"
    // buttons render in `.o_statusbar_buttons`, matching the same dual-container pattern
    // SalesFormPage.statusButton() already accounts for on sale.order — the plain
    // `.o_control_panel`-only locator silently never matched them.
    const checkAvail = this.page.locator('.o_statusbar_buttons, .o_control_panel').getByRole('button', { name: /check availability/i });
    if (await checkAvail.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await checkAvail.click();
      await checkAvail.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    }

    const opsTab = this.page.locator('.o_notebook .nav-link, .o_notebook .nav-item a')
      .filter({ hasText: /operations/i }).first();
    await opsTab.waitFor({ state: 'visible', timeout: 10_000 });
    await opsTab.click({ timeout: 10_000 });
    await this.page.locator('.o_field_one2many').waitFor({ state: 'visible', timeout: 10_000 });

    const rows = this.page.locator('.o_data_row');
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const demandText = ((await row.locator('[name="product_uom_qty"]').textContent().catch(() => '0')) ?? '0').trim();
      const demand = demandText.replace(/,/g, '');
      if (!demand || demand === '0' || demand === '0.00') continue;
      // Confirmed live: this Odoo version names the delivered-quantity cell "quantity",
      // not the older "qty_done" — a row-cell name dump showed
      // ["product_id","product_packaging_id","product_uom_qty","quantity","product_uom",...]
      // with no "qty_done" anywhere. The old name silently matched nothing, every time.
      const qtyDone = row.locator('[name="quantity"] input').first();
      if (!(await qtyDone.isVisible({ timeout: 1_500 }).catch(() => false))) {
        await row.locator('[name="quantity"]').click();
        await qtyDone.waitFor({ state: 'visible', timeout: 5_000 });
      }
      await qtyDone.click();
      await qtyDone.fill(demand);
      await qtyDone.press('Tab');
    }

    // Non-anchored regex: confirmed live the accessible name check-availability/validate
    // buttons match /validate/i but not /^validate/i (a live button-text dump showed
    // "Validate" present among the control panel's buttons, yet the anchored version
    // never matched it — likely due to leading icon/whitespace content in the accessible
    // name that a `^`-anchored pattern can't skip past).
    const validateBtn = this.page.locator('.o_statusbar_buttons, .o_control_panel').getByRole('button', { name: /validate/i });
    await validateBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await validateBtn.click();

    const immDialog = this.page.locator('.modal, .o_dialog').filter({ hasText: /immediate transfer/i });
    if (await immDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await immDialog.getByRole('button', { name: /validate/i }).click();
    }

    const boDialog = this.page.locator('.modal, .o_dialog').filter({ hasText: /backorder/i });
    if (await boDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await boDialog.getByRole('button', { name: /create backorder/i }).click();
    }

    // stock.picking's statusbar is the same ARIA radiogroup markup as sale.order's (not
    // the classic `.o_statusbar_status` this previously assumed — confirmed live via a
    // radio-role dump: ["Done","Ready","Waiting","Draft",""]), so the same dual-selector
    // approach BaseFormPage.getCurrentStatus()/waitForStatus() use is applied here too.
    // The checked radio is matched WITHOUT an accessible-name filter (just `checked:
    // true`), then its text is checked separately — confirmed live this is more reliable
    // than combining `name` + `checked` in one getByRole call.
    const legacyDone = this.page.locator('.o_statusbar_status').filter({ hasText: /done/i });
    const checkedRadio = this.page.getByRole('radio', { checked: true });
    const checkIsDone = async (timeout: number) => {
      // Each branch resolves to true/false on its OWN — never rejects — so
      // Promise.race can't be won by whichever side happens to fail first. The
      // previous version let both `.waitFor()` calls reject, and since this
      // instance's legacy selector never exists, it reliably "won" the race with a
      // rejection before the ARIA check (which does succeed) ever got to resolve —
      // silently treating a genuinely completed delivery as not-done every time.
      return Promise.race([
        legacyDone.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false),
        checkedRadio.waitFor({ state: 'visible', timeout })
          .then(() => checkedRadio.textContent())
          .then((t) => /done/i.test(t ?? ''))
          .catch(() => false),
      ]);
    };
    const isDone = await checkIsDone(10_000);
    if (!isDone) {
      await this.page.goto(deliveryUrl);
      await this.page.locator('.o_form_view').waitFor({ state: 'visible', timeout: 15_000 });
      const isDoneAfterReload = await checkIsDone(30_000);
      if (!isDoneAfterReload) {
        throw new Error('processDelivery(): delivery never reached "Done" status after Validate — check for an unhandled dialog or stock issue.');
      }
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

  /**
   * Creates a draft (Regular) customer invoice from the Sales Order. Returns the draft's
   * reference.
   *
   * NOTE: confirmed live this dialog can present a SECOND stacked confirmation ("Create
   * Invoice? Ok/Cancel") on top of the first "Create invoices" dialog after clicking
   * "Create Draft Invoice" — handled below. Also confirmed the product's Invoicing
   * Policy must be "Ordered Quantities", or "Delivered Quantities" with the delivery
   * already validated (see processDelivery()) — otherwise this fails with "Cannot
   * create an invoice. No items are available to invoice."
   */
  async createDraftInvoice(): Promise<string> {
    // `.o_statusbar_buttons, .o_control_panel` (not `.o_control_panel` alone) — same
    // dual-container fix as processDelivery()'s Validate/Check Availability buttons.
    const createInvBtn = this.page.locator('.o_statusbar_buttons, .o_control_panel').getByRole('button', { name: /create invoice/i });
    await createInvBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await createInvBtn.click();

    // `.modal` (not `.modal-content, .o_dialog`) — confirmed live via screenshot this is
    // the actual class Odoo renders this dialog with; the old selector never matched it.
    const dialog = this.page.locator('.modal').first();
    await dialog.waitFor({ state: 'visible', timeout: 15_000 });

    const regularRadio = dialog.locator('input[value="regular"], input[id*="regular"]').first();
    if (await regularRadio.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await regularRadio.click();
    }

    const createDraftBtn = dialog.getByRole('button', { name: /create draft invoice/i }).first();
    await createDraftBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await createDraftBtn.click();

    // A second confirmation ("Create Invoice? Ok/Cancel") can stack on top — confirmed
    // live. Handle it if present before waiting for navigation.
    const okBtn = this.page.locator('.modal').last().getByRole('button', { name: /^ok$/i }).first();
    if (await okBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await okBtn.click();
    }

    await this.page.locator('.o_form_view').waitFor({ state: 'visible', timeout: 30_000 });

    return ((await this.page.locator('[name="name"] .o_field_char, [name="name"] span')
      .first().textContent().catch(() => '')) ?? '').trim() || 'Draft';
  }

  /** Confirms (posts) a draft invoice. Returns the posted invoice's reference. */
  async postInvoice(): Promise<string> {
    const confirmBtn = this.page.locator('.o_statusbar_buttons, .o_control_panel').getByRole('button', { name: /^confirm$/i });
    await confirmBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await confirmBtn.click();
    // Same ARIA-radiogroup statusbar as sale.order/stock.picking — see processDelivery()'s
    // checkIsDone helper for why each branch must resolve true/false rather than reject
    // (a rejecting branch can "win" Promise.race before the correct branch settles).
    const legacyPosted = this.page.locator('.o_statusbar_status').filter({ hasText: /posted/i });
    const checkedRadio = this.page.getByRole('radio', { checked: true });
    const posted = await Promise.race([
      legacyPosted.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true).catch(() => false),
      checkedRadio.waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => checkedRadio.textContent())
        .then((t) => /posted/i.test(t ?? ''))
        .catch(() => false),
    ]);
    if (!posted) throw new Error('postInvoice(): invoice never reached "Posted" status after Confirm.');
    return ((await this.page.locator('[name="name"] .o_field_char, [name="name"] span')
      .first().textContent().catch(() => '')) ?? '').trim() || 'INV/xxxx';
  }

  /** Clicks Send & Print on a posted invoice and waits for the dialog to close. */
  async sendAndPrintInvoice(): Promise<void> {
    const sendBtn = this.page.locator('.o_statusbar_buttons, .o_control_panel').getByRole('button', { name: /send.*&.*print|send.*print/i });
    await sendBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await sendBtn.click();

    const dialog = this.page.locator('.modal').first();
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
