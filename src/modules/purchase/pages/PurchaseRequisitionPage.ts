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
    await page.getByRole('option', { name: 'Purchase Requisition MGMT', exact: true }).click();
    await page.waitForSelector('.o_list_view, .o_kanban_view', { state: 'visible', timeout: 15_000 });
    await page.getByRole('menuitem', { name: 'Purchase Requisitions - Inventory Items', exact: true }).click();
    await page.waitForSelector('.o_list_view', { state: 'visible', timeout: 15_000 });
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
      .locator('.o_datetime_picker td.o_date_item_cell:not(.o_out_of_range)')
      .filter({ hasText: new RegExp(`^${day}$`) })
      .first()
      .click();
  }

  /** Adds one product line via the "Create Order Lines" modal dialog. */
  async addProductLine(productName: string, quantity: number): Promise<void> {
    await this.page.getByRole('button', { name: 'Add a line' }).first().click();
    const modal = this.page.locator('.modal');
    await modal.waitFor({ state: 'visible', timeout: 5_000 });

    const productInput = modal.locator('.o_field_widget[name^="x_studio_many2one"] input').first();
    await productInput.fill(productName);
    const productOption = this.page.locator('.o-dropdown--menu .o_menu_item, .ui-autocomplete .ui-menu-item').filter({ hasText: productName }).first();
    await productOption.waitFor({ state: 'visible', timeout: 8_000 });
    await productOption.click();

    const quantityInput = modal.locator('.o_field_widget[name="x_studio_quantity"] input').first();
    await quantityInput.fill(String(quantity));

    await modal.getByRole('button', { name: 'Save & New' }).click();
  }

  async finishAddingLines(): Promise<void> {
    const modal = this.page.locator('.modal');
    if (await modal.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await modal.getByRole('button', { name: 'Save & Close' }).click();
    }
  }

  async confirm(): Promise<void> {
    await this.page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await this.waitForOdooReady();
  }

  async requestApproval(): Promise<void> {
    const visible = await this.page.getByRole('button', { name: /Request for Approval|Request Approval/i }).first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (visible) {
      await this.page.getByRole('button', { name: /Request for Approval|Request Approval/i }).first().click();
    } else {
      await this.clickStatusButton('To Be Approved');
    }
    await this.waitForOdooReady();
  }

  async approve(): Promise<void> {
    const visible = await this.page.getByRole('button', { name: 'Approve', exact: true }).isVisible({ timeout: 3_000 }).catch(() => false);
    if (visible) {
      await this.page.getByRole('button', { name: 'Approve', exact: true }).click();
    } else {
      await this.clickStatusButton('Approved');
    }
    await this.waitForOdooReady();
  }

  /** Selects all product lines and creates an RFQ, then opens it and returns its id. */
  async createRfqFromLines(): Promise<number> {
    await this.page.locator('.o_list_table thead .o_list_record_selector input[type="checkbox"]').check();
    await this.page.getByRole('button', { name: 'Create RFQ', exact: true }).click();
    await this.waitForOdooReady();

    const [, orderId] = this.page.url().match(/id=(\d+)/) ?? [];
    return orderId ? Number(orderId) : 0;
  }
}

export class PurchaseRequisitionListPage extends BaseListPage {
  async navigate(): Promise<void> {
    await this.navigateTo('/odoo');
    await PurchaseRequisitionFormPage.openApp(this.page);
  }
}
