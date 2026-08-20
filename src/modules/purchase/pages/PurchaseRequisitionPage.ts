import { Page, expect } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { SelectionField } from '../../../core/components/SelectionField';
import { Many2OneField } from '../../../core/components/Many2OneField';

/**
 * "Purchase Requisition MGMT" is a Studio-customized app (model `x_purchase_request`),
 * distinct from the plain "Purchase Requisition" tile (an unrelated Studio demo app)
 * and from standard Odoo's `purchase.requisition`. Field names are Studio-generated
 * (`x_studio_*`) and were confirmed against the live instance's DOM.
 */
export class PurchaseRequisitionFormPage extends BaseFormPage {
  readonly type = new SelectionField(this.page, 'x_studio_type');
  readonly warehouse = new Many2OneField(this.page, 'x_studio_warehouse');
  readonly requestedBy = new Many2OneField(this.page, 'x_studio_requested_by');

  static async openApp(page: Page): Promise<void> {
    await page.locator('a.o_menu_toggle, [aria-label="Home menu"]').first().click();
    // Text-based matching is unreliable here (the tile's caption wraps across lines),
    // so target the app tile by its known menu/action id instead — confirmed against
    // the live instance: "Purchase Requisition MGMT" is menu_id=573, action_id=813.
    await page.locator('a[href="#menu_id=573&action_id=813"]').click();
    // The app opens directly on its default submenu ("Purchase Requisitions - Inventory
    // Items"), so no extra submenu click is needed.
    await page.waitForSelector('.o_list_view, .o_kanban_view', { state: 'visible', timeout: 15_000 });
  }

  async navigate(): Promise<void> {
    await this.navigateTo('/odoo'); // boots the authenticated SPA session
    await PurchaseRequisitionFormPage.openApp(this.page);
    await this.clickNew();
  }

  /**
   * Sets the Requested Delivery Date by clicking the day in the datepicker rather than
   * typing + Escape — Escape reverts the field instead of committing it (same gotcha
   * documented on Many2OneField.clear()).
   */
  async setRequestedDeliveryDate(day: number): Promise<void> {
    const input = this.fieldWidget('x_studio_requested_delivery_date').locator('input').first();
    await input.click();
    await this.page
      .getByRole('button', { name: String(day), exact: true })
      .first()
      .click();
  }

  /**
   * Adds one product line via the "Create Order Lines" modal dialog. "Save & New"
   * (used between lines) keeps the modal open with a fresh blank line, so "Add a line"
   * is only clicked when the modal isn't already open.
   */
  async addProductLine(productName: string, quantity: number, isLastLine = false): Promise<void> {
    const modal = this.page.locator('.modal');
    if (!(await modal.isVisible({ timeout: 1_000 }).catch(() => false))) {
      await this.page.getByRole('button', { name: 'Add a line' }).first().click();
      await modal.waitFor({ state: 'visible', timeout: 5_000 });
    }

    // pressSequentially fires per-keystroke events, reliably triggering the autocomplete
    // search — this instance's product lookup can take several seconds to respond.
    const productInput = modal.locator('.o_field_widget[name^="x_studio_many2one"] input').first();
    await productInput.click();
    await productInput.pressSequentially(productName, { delay: 30 });
    const productOption = this.page.locator('.o-dropdown--menu .o_menu_item, .ui-autocomplete .ui-menu-item').filter({ hasText: productName }).first();
    await productOption.waitFor({ state: 'visible', timeout: 15_000 });
    await productOption.click();

    const quantityInput = modal.locator('.o_field_widget[name="x_studio_quantity"] input').first();
    await quantityInput.fill(String(quantity));

    const saveButtonName = isLastLine ? 'Save & Close' : 'Save & New';
    await modal.getByRole('button', { name: saveButtonName }).click();
  }

  async confirm(): Promise<void> {
    await this.page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await this.waitForOdooReady();
  }

  async requestApproval(): Promise<void> {
    await this.page.getByRole('button', { name: 'Request approval', exact: true }).click();
    await this.waitForOdooReady();
  }

  async approve(): Promise<void> {
    await this.page.getByRole('button', { name: 'Approve' }).first().click();
    await this.waitForOdooReady();
  }

  /**
   * Opens the "Create RFQ" wizard, selects the vendor, selects all requisition lines,
   * and confirms — creating a purchase.order. The wizard lands on the Purchase Orders
   * LIST view rather than the new record's form (confirmed live), so this opens the
   * newest row (the one just created) and returns its id.
   */
  async createRfqFromLines(vendorName: string): Promise<number> {
    await this.page.getByRole('button', { name: 'Create RFQ', exact: true }).click();

    const modal = this.page.locator('.modal');
    await modal.waitFor({ state: 'visible', timeout: 8_000 });

    // The "Select All" button is unreliable (it doesn't consistently check the boxes),
    // so check each requisition line's checkbox individually instead. Each row's "Select"
    // checkbox renders disabled until the row's cell is clicked into edit mode first.
    const lineRows = modal.locator('.o_list_table .o_data_row');
    const lineCount = await lineRows.count();
    for (let i = 0; i < lineCount; i++) {
      const selectCell = lineRows.nth(i).locator('td[name="x_select"]');
      await selectCell.click();
      await selectCell.locator('input[type="checkbox"]').check();
    }
    await expect.poll(async () => modal.locator('.o_list_table .o_data_row input[type="checkbox"]:checked').count())
      .toBe(lineCount);

    const vendorField = new Many2OneField(this.page, 'x_supplier_id');
    await vendorField.setValue(vendorName);
    // Selecting the dropdown option doesn't commit until the field loses focus — pressing
    // Tab forces that commit before "Create RFQ" reads the field's current value.
    await this.page.keyboard.press('Tab');
    // Many2One fields in edit mode store their value in an <input>, whose value never
    // shows up via the wrapping div's textContent — read it through getValue() instead.
    await expect.poll(() => vendorField.getValue(), { timeout: 8_000 }).toBe(vendorName);
    await modal.getByRole('button', { name: 'Create RFQ', exact: true }).click();

    // The wizard rejects the submission if the checkbox selection didn't stick, showing
    // an "Invalid Operation" dialog on top of the wizard — surface that clearly instead
    // of silently hanging on a list view that never gets its new row.
    const errorDialog = this.page.locator('.modal', { hasText: 'Invalid Operation' });
    if (await errorDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const message = await errorDialog.innerText();
      throw new Error(`Create RFQ wizard rejected the submission: ${message}`);
    }

    await this.waitForOdooReady();

    await this.page.waitForSelector('.o_list_view', { timeout: 15_000 });
    // The reference cell (e.g. "PO-00061") is a plain <td name="name">, not a link —
    // the whole cell is clickable via a "cursor-pointer" class, not an <a> tag.
    await this.page.locator('.o_list_table .o_data_row td[name="name"]').first().click();
    await this.waitForOdooReady();

    const [, orderId] = this.page.url().match(/[?&#]id=(\d+)/) ?? [];
    return orderId ? Number(orderId) : 0;
  }
}

export class PurchaseRequisitionListPage extends BaseListPage {
  async navigate(): Promise<void> {
    await this.navigateTo('/odoo');
    await PurchaseRequisitionFormPage.openApp(this.page);
  }
}
