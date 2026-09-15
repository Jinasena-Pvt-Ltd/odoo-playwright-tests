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

  /**
   * SelectionField.selectByLabel's 500ms "is the <select> visible yet" probe is flaky on
   * this instance's Studio-rendered selects — a false negative sends it into a 30s+ dead
   * end looking for a radio-button fallback that doesn't exist here. Select directly instead.
   */
  private async selectStudioField(fieldName: string, label: string): Promise<void> {
    const select = this.page.locator(`.o_field_widget[name="${fieldName}"] select`).first();
    await select.waitFor({ state: 'visible', timeout: 10_000 });
    await select.selectOption({ label });
  }

  async setPaymentType(label: 'Cash' | 'Credit'): Promise<void> {
    await this.selectStudioField('x_studio_order_payment_method', label);
  }

  async setQuotationType(label: 'Sales' | 'Project' | 'Repair'): Promise<void> {
    await this.selectStudioField('x_studio_quotation_type', label);
  }

  /** See CustomerFormPage.navigate() for why this goes through the app switcher. */
  async navigate(): Promise<void> {
    await openOdooApp(this.page, 'Sales');
    await this.clickNew();
  }
  async openById(id: number): Promise<void> { await this.navigateTo(`/odoo/sales/${id}`); }

  /**
   * Adds one order line, picking whichever product is first in the dropdown — no name
   * needed. Returns the product's unit price (as it appeared with the default qty of 1,
   * before an explicit `qty` was applied), so callers can compute an expected subtotal
   * without hardcoding master-data prices.
   */
  async addFirstAvailableProduct(qty?: number): Promise<number> {
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

    // Selecting the product fires an async onchange that fetches its price — reading
    // price_unit immediately can catch it mid-flight (still "0.0000"), and if a caller
    // then starts typing into the quantity field before that onchange lands, the fetch's
    // own write can be lost entirely, leaving the row permanently priced at 0. Poll until
    // it settles (or genuinely is a free/zero-priced product) before moving on.
    let unitPrice = await this.getLastCellNumber('price_unit');
    for (let i = 0; i < 8 && unitPrice === 0; i++) {
      await this.page.waitForTimeout(500);
      unitPrice = await this.getLastCellNumber('price_unit');
    }

    if (qty !== undefined) {
      // Set the quantity now, while the row Odoo just auto-opened for this new line is
      // still in edit mode — re-entering edit mode on an already-committed row later
      // (click the cell again) was unreliable: sometimes the click just re-selects the
      // row without exposing an <input>, hanging setLastLineQuantity's own visibility wait.
      const qtyInput = this.page.locator('.o_field_widget[name="product_uom_qty"] input').last();
      await qtyInput.waitFor({ state: 'visible', timeout: 5_000 });
      await qtyInput.click();
      await this.page.keyboard.press('Control+A');
      await this.page.keyboard.type(String(qty), { delay: 50 });
    }

    // Blur the editable row onto the list's own (non-interactive) column header — clicking
    // a link/tab discards the uncommitted row, clicking a field's <label> re-opens that
    // field for editing (labels focus their control by design), and Escape intermittently
    // reverted the just-picked product (same revert behavior Many2OneField.clear() warns
    // about), causing the row to silently vanish. A header cell is inert either way.
    await this.page.locator('.o_list_renderer th', { hasText: 'Product' }).first().click().catch(() => {});
    await this.page.waitForTimeout(300);

    return unitPrice;
  }

  /** Reads the read-only subtotal ("Tax excl.") of the most recently added order line. */
  async getLastLineSubtotal(): Promise<number> {
    return this.getLastCellNumber('price_subtotal');
  }

  async getOrderReference(): Promise<string> {
    const breadcrumb = this.page.locator('.o_breadcrumb .active, .o_breadcrumb .o_last_breadcrumb_item').last();
    return (await breadcrumb.textContent())?.trim() ?? '';
  }

  async getTotal(): Promise<string> {
    return (await this.page.locator('.oe_subtotal_footer, .o_field_widget[name="amount_total"]').last().textContent())?.trim() ?? '';
  }

  /**
   * Reads a numeric order-line cell whether it's currently an editable <input> or
   * read-only text. Order-line list cells are `<td name="...">` directly (Odoo puts
   * `.o_field_widget` around the value only while that cell is being edited) — targeting
   * `.o_field_widget[name=...]` instead would match nothing once the row blurs back to
   * read mode.
   */
  private async getLastCellNumber(fieldName: string): Promise<number> {
    const cell = this.page.locator(`.o_data_row td[name="${fieldName}"]`).last();
    const input = cell.locator('input').last();
    const raw = (await input.isVisible({ timeout: 500 }).catch(() => false))
      ? await input.inputValue()
      : (await cell.textContent()) ?? '';
    return parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
  }
}

export class SalesOrderListPage extends BaseListPage {
  constructor(page: Page) { super(page); }
  async navigate(): Promise<void> { await openOdooApp(this.page, 'Sales'); }
  async openOrder(reference: string): Promise<void> { await this.clickRowByText(reference); }
}
