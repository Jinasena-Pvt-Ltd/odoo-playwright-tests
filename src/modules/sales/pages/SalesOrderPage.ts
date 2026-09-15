import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { Many2OneField } from '../../../core/components/Many2OneField';
import { SelectionField } from '../../../core/components/SelectionField';
import { openOdooApp } from './openOdooApp';

export class SalesOrderFormPage extends BaseFormPage {
  readonly customer: Many2OneField;
  /** Studio-added required field on this instance's sale.order form ("Order Payment Type") */
  readonly paymentType: SelectionField;
  /** Studio-added required field on this instance's sale.order form ("Quotation Type") */
  readonly quotationType: SelectionField;

  constructor(page: Page) {
    super(page);
    this.customer = new Many2OneField(page, 'partner_id');
    this.paymentType = new SelectionField(page, 'x_studio_order_payment_method');
    this.quotationType = new SelectionField(page, 'x_studio_quotation_type');
  }

  /** See CustomerFormPage.navigate() for why this goes through the app switcher. */
  async navigate(): Promise<void> {
    await openOdooApp(this.page, 'Sales');
    await this.clickNew();
  }
  async openById(id: number): Promise<void> { await this.navigateTo(`/odoo/sales/${id}`); }

  /** Adds one order line, picking whichever product is first in the dropdown — no name needed. */
  async addFirstAvailableProduct(): Promise<void> {
    const addProductLink = this.page
      .locator('.o_field_x2many_list_row_add a')
      .filter({ hasText: 'Add a product' })
      .first();
    await addProductLink.waitFor({ state: 'visible', timeout: 10_000 });
    await addProductLink.click();

    const productInput = this.page
      .locator('.o_field_widget[name="product_id"] input')
      .last();
    await productInput.waitFor({ state: 'visible', timeout: 8_000 });
    await productInput.click();

    const dropdown = this.page.locator('.o-dropdown--menu, .ui-autocomplete').first();
    await dropdown.waitFor({ state: 'visible', timeout: 8_000 });

    const firstOption = this.page
      .locator('.o-dropdown--menu .o_menu_item, .ui-autocomplete .ui-menu-item')
      .first();
    await firstOption.click();
    await this.page.waitForTimeout(500);

    // Blur the editable row onto a plain, non-interactive label instead of another
    // control — clicking a link/tab here was found to discard the uncommitted row.
    await this.page.locator('.o_form_label', { hasText: 'Pricelist' }).first().click().catch(() => {});
    await this.page.waitForTimeout(300);
  }

  async getOrderReference(): Promise<string> {
    const breadcrumb = this.page.locator('.o_breadcrumb .active, .o_breadcrumb .o_last_breadcrumb_item').last();
    return (await breadcrumb.textContent())?.trim() ?? '';
  }
}

export class SalesOrderListPage extends BaseListPage {
  constructor(page: Page) { super(page); }
  async navigate(): Promise<void> { await this.navigateTo('/odoo/sales'); }
  async openOrder(reference: string): Promise<void> { await this.clickRowByText(reference); }
}
