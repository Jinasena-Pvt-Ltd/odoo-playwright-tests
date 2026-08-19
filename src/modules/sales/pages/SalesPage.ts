import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { CharField } from '../../../core/components/CharField';
import { Many2OneField } from '../../../core/components/Many2OneField';

// TODO: Add typed field components matching the Odoo sale.order model fields.

export class SalesFormPage extends BaseFormPage {
  readonly name: CharField;

  constructor(page: Page) {
    super(page);
    this.name = new CharField(page, 'name');
    // TODO: Add field components for this module's primary Odoo model (sale.order)
  }

  // TODO: Replace with the correct Odoo URL for this module
  async navigate(): Promise<void> {
    await this.navigateTo('/odoo/sales/new');
  }

  async openById(id: number): Promise<void> {
    await this.navigateTo(`/odoo/sales/${id}`);
  }
}

export class SalesListPage extends BaseListPage {
  constructor(page: Page) {
    super(page);
  }

  // TODO: Replace with the correct Odoo URL for this module
  async navigate(): Promise<void> {
    await this.navigateTo('/odoo/sales');
  }

  async openSales(name: string): Promise<void> {
    await this.clickRowByText(name);
  }
}
