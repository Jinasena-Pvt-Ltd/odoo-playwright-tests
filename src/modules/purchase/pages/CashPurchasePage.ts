import { Page, expect } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { Many2OneField } from '../../../core/components/Many2OneField';
import { JournalEntryFormPage } from './JournalEntryPage';

/**
 * x_purchase_request_cas form ("Cash Purchase Reference", e.g. CPR/2026/00010), reached
 * via a Purchase Requisition's "Convert to Cash Purchase" wizard. Lifecycle: Draft ->
 * Report As Ready -> Cash Issued -> Purchase Order -> Settled.
 */
export class CashPurchaseFormPage extends BaseFormPage {
  readonly vendor = new Many2OneField(this.page, 'x_studio_vendor');

  constructor(page: Page) {
    super(page);
  }

  async openById(id: number): Promise<void> {
    const baseURL = process.env.ODOO_BASE_URL ?? 'http://localhost:8069';
    // Same hash-only-navigation gotcha as PurchaseFormPage.openById — force a full
    // reload of the app shell first.
    let shellLoaded = false;
    for (let attempt = 0; attempt < 2 && !shellLoaded; attempt++) {
      await this.page.goto(`${baseURL}/odoo`);
      shellLoaded = await this.page.waitForSelector('.o_action_manager, .o_home_menu', { timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
    }
    await this.waitForOdooReady();
    await this.page.goto(`${baseURL}/web#model=x_purchase_request_cas&view_type=form&id=${id}&cids=2&menu_id=573`);
    await this.waitForOdooReady();
  }

  getRecordId(): number {
    const [, idParam] = this.page.url().match(/[?&#]id=(\d+)/) ?? [];
    return idParam ? Number(idParam) : 0;
  }

  /** Sets the unit price on every line, in row order. */
  async setLineUnitPrices(prices: number[]): Promise<void> {
    const priceCells = this.page.locator('.o_list_table .o_data_row td[name="x_studio_unit_price"]');
    for (let i = 0; i < prices.length; i++) {
      await priceCells.nth(i).click();
      await priceCells.nth(i).locator('input').fill(String(prices[i]));
      await this.page.keyboard.press('Tab');
    }
    await this.waitForOdooReady();
  }

  async reportAsReady(): Promise<void> {
    await this.page.getByRole('button', { name: 'Report As Ready', exact: true }).click();
    await this.waitForOdooReady();
  }

  /** Overrides the auto-computed "Issued Amount" (editable only right after Report As Ready). */
  async setIssuedAmount(amount: number): Promise<void> {
    const widget = this.page.locator('.o_field_widget[name="x_studio_amount_to_issue"]');
    await widget.click();
    const input = widget.locator('input').first();
    // The click above only opens edit mode asynchronously — filling before the input
    // is actually ready silently no-ops, leaving the auto-computed value in place.
    await input.waitFor({ state: 'visible', timeout: 8_000 });
    await input.fill(String(amount));
    await this.page.keyboard.press('Tab');
    await this.waitForOdooReady();
    // Tab-out alone leaves the record dirty (still shows the editable <input> rather
    // than committing) — "Issue Cash" doesn't save first, so it silently used the
    // stale auto-computed amount instead of this override. Save explicitly.
    await this.save();
  }

  async getIssuedAmountText(): Promise<string> {
    return this.readFloatField('x_studio_amount_to_issue');
  }

  async getActualAmountText(): Promise<string> {
    return this.readFloatField('x_studio_actual_amount');
  }

  /**
   * Reads a float field's displayed value, in whichever mode it currently renders as:
   * an editable field (this model's amount fields default to an <input>, not a
   * readonly span — its value never shows up via the wrapping div's innerText) or a
   * readonly span (after the record leaves edit mode).
   */
  private async readFloatField(fieldName: string): Promise<string> {
    const widget = this.fieldWidget(fieldName);
    const input = widget.locator('input').first();
    if (await input.isVisible({ timeout: 300 }).catch(() => false)) {
      return input.inputValue();
    }
    return (await widget.innerText()).trim();
  }

  /** Clicks "Issue Cash" and opens the newly created journal entry. */
  async issueCash(): Promise<JournalEntryFormPage> {
    await this.page.getByRole('button', { name: 'Issue Cash', exact: true }).click();
    await this.waitForOdooReady();
    return this.openLatestJournalEntry();
  }

  async updateActualSpent(): Promise<void> {
    await this.page.getByRole('button', { name: 'Update Actual Spent', exact: true }).click();
    await this.waitForOdooReady();
  }

  /** Clicks "Settle Cash" and opens the newly created settlement journal entry. */
  async settleCash(): Promise<JournalEntryFormPage> {
    await this.page.getByRole('button', { name: 'Settle Cash', exact: true }).click();
    await this.waitForOdooReady();
    return this.openLatestJournalEntry();
  }

  private async openLatestJournalEntry(): Promise<JournalEntryFormPage> {
    await this.page.waitForSelector('.o_list_view', { timeout: 15_000 });
    // Clicking anywhere in the row doesn't navigate — same clickable-cell pattern as
    // other Studio lists; the "Number" column ("/" for an unposted entry) carries the
    // `name` field.
    await this.page.locator('.o_list_table .o_data_row td[name="name"]').first().click();
    await this.page.waitForSelector('.o_form_view', { timeout: 15_000 });
    return new JournalEntryFormPage(this.page);
  }

  /**
   * Opens the "Create PO" wizard, selects the vendor, and submits — no line selection
   * needed here (unlike Create RFQ / Convert to Cash Purchase, this wizard has no
   * "Select All"/checkboxes and includes every line automatically). Lands on the
   * purchase.order list scoped to this Cash Purchase, so this opens the newest row
   * and returns its id.
   */
  async createPO(vendorName: string): Promise<number> {
    await this.page.getByRole('button', { name: 'Create PO', exact: true }).click();

    const modal = this.page.locator('.modal');
    await modal.waitFor({ state: 'visible', timeout: 8_000 });

    const vendorField = new Many2OneField(this.page, 'x_supplier_id');
    await vendorField.setValue(vendorName);
    await this.page.keyboard.press('Tab');
    await expect.poll(() => vendorField.getValue(), { timeout: 8_000 }).toBe(vendorName);

    await modal.getByRole('button', { name: 'Create Purchase Order', exact: true }).click();
    await this.waitForOdooReady();

    await this.page.waitForSelector('.o_list_view', { timeout: 15_000 });
    await this.page.locator('.o_list_table .o_data_row td[name="name"]').first().click();
    await this.waitForOdooReady();

    const [, orderId] = this.page.url().match(/[?&#]id=(\d+)/) ?? [];
    return orderId ? Number(orderId) : 0;
  }
}
