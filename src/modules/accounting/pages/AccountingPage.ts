import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { CharField } from '../../../core/components/CharField';

// TODO: Add typed field components matching the Odoo accounting model fields.

export class AccountingFormPage extends BaseFormPage {
  readonly name: CharField;

  constructor(page: Page) {
    super(page);
    this.name = new CharField(page, 'name');
    // TODO: Add field components for this module's primary Odoo model
  }

  async navigate(): Promise<void> { await this.navigateTo('/odoo/accounting/new'); }
  async openById(id: number): Promise<void> { await this.navigateTo(`/odoo/accounting/${id}`); }
}

export class AccountingListPage extends BaseListPage {
  constructor(page: Page) { super(page); }
  async navigate(): Promise<void> { await this.navigateTo('/odoo/accounting'); }
  async openAccounting(name: string): Promise<void> { await this.clickRowByText(name); }
}
