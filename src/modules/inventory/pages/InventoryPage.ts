import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { CharField } from '../../../core/components/CharField';

// TODO: Add typed field components matching the Odoo inventory model fields.

export class InventoryFormPage extends BaseFormPage {
  readonly name: CharField;

  constructor(page: Page) {
    super(page);
    this.name = new CharField(page, 'name');
    // TODO: Add field components for this module's primary Odoo model
  }

  async navigate(): Promise<void> { await this.navigateTo('/odoo/inventory/new'); }
  async openById(id: number): Promise<void> { await this.navigateTo(`/odoo/inventory/${id}`); }
}

export class InventoryListPage extends BaseListPage {
  constructor(page: Page) { super(page); }
  async navigate(): Promise<void> { await this.navigateTo('/odoo/inventory'); }
  async openInventory(name: string): Promise<void> { await this.clickRowByText(name); }
}
