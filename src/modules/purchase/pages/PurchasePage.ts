import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { CharField } from '../../../core/components/CharField';
import { Many2OneField } from '../../../core/components/Many2OneField';

// TODO: Add typed field components matching the Odoo purchase model fields.

export class PurchaseFormPage extends BaseFormPage {
  readonly name: CharField;
  readonly vendor: Many2OneField;

  constructor(page: Page) {
    super(page);
    this.name = new CharField(page, 'name');
    this.vendor = new Many2OneField(page, 'partner_id');
    // TODO: Add remaining field components for this module's primary Odoo model
  }

  // TODO: Replace with the correct Odoo URL for this module
  async navigate(): Promise<void> {
    await this.navigateTo('/odoo/purchase/new');
  }

  async openById(id: number): Promise<void> {
    await this.navigateTo(`/odoo/purchase/${id}`);
  }
}

export class PurchaseListPage extends BaseListPage {
  constructor(page: Page) {
    super(page);
  }

  // TODO: Replace with the correct Odoo URL for this module
  async navigate(): Promise<void> {
    await this.navigateTo('/odoo/purchase');
  }

  async openPurchase(name: string): Promise<void> {
    await this.clickRowByText(name);
  }
}
