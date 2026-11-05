import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { CharField } from '../../../core/components/CharField';

// TODO: Add typed field components matching the Odoo imports model fields.
// Reference: src/modules/purchase/pages/PurchasePage.ts

export class ImportsFormPage extends BaseFormPage {
  readonly name: CharField;

  constructor(page: Page) {
    super(page);
    this.name = new CharField(page, 'name');
    // TODO: Add field components for this module's primary Odoo model
  }

  // TODO: Replace with the correct Odoo URL for this module
  async navigate(): Promise<void> {
    await this.navigateTo('/odoo/imports/new');
  }

  async openById(id: number): Promise<void> {
    await this.navigateTo(`/odoo/imports/${id}`);
  }
}

export class ImportsListPage extends BaseListPage {
  constructor(page: Page) {
    super(page);
  }

  // TODO: Replace with the correct Odoo URL for this module
  async navigate(): Promise<void> {
    await this.navigateTo('/odoo/imports');
  }

  async openImports(name: string): Promise<void> {
    await this.clickRowByText(name);
  }
}
