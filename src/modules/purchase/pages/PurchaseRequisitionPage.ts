import { Page } from '@playwright/test';
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
   * and confirms — creating (or updating) a purchase.order. Returns its id, or 0 if the
   * app didn't navigate to it (falls back to opening the newest PO from the Purchase app).
   */
  async createRfqFromLines(vendorName: string): Promise<number> {
    await this.page.getByRole('button', { name: 'Create RFQ', exact: true }).click();

    const modal = this.page.locator('.modal');
    await modal.waitFor({ state: 'visible', timeout: 8_000 });

    const vendorField = new Many2OneField(this.page, 'x_supplier_id');
    await vendorField.setValue(vendorName);

    await modal.getByRole('button', { name: 'Select All', exact: true }).click();
    await modal.getByRole('button', { name: 'Create RFQ', exact: true }).click();
    await this.waitForOdooReady();

    // Only treat the id as a real Purchase Order id if the URL's model param actually
    // says purchase.order — the requisition form itself also uses an "id=" URL param.
    const isPurchaseOrderUrl = /model=purchase\.order/.test(this.page.url());
    const [, orderId] = isPurchaseOrderUrl ? (this.page.url().match(/[?&#]id=(\d+)/) ?? []) : [];
    return orderId ? Number(orderId) : 0;
  }
}

export class PurchaseRequisitionListPage extends BaseListPage {
  async navigate(): Promise<void> {
    await this.navigateTo('/odoo');
    await PurchaseRequisitionFormPage.openApp(this.page);
  }
}
