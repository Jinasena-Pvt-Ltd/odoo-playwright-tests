import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { CharField } from '../../../core/components/CharField';
import { Many2OneField } from '../../../core/components/Many2OneField';

// TODO: Add typed field components matching the Odoo helpdesk model fields.

export class HelpdeskFormPage extends BaseFormPage {
  readonly name: CharField;

  constructor(page: Page) {
    super(page);
    this.name = new CharField(page, 'name');
    // TODO: Add field components for this module's primary Odoo model
  }

  // TODO: Replace with the correct Odoo URL for this module
  async navigate(): Promise<void> {
    await this.navigateTo('/odoo/helpdesk/new');
  }

  async openById(id: number): Promise<void> {
    await this.navigateTo(`/odoo/helpdesk/${id}`);
  }
}

export class HelpdeskListPage extends BaseListPage {
  constructor(page: Page) {
    super(page);
  }

  // TODO: Replace with the correct Odoo URL for this module
  async navigate(): Promise<void> {
    await this.navigateTo('/odoo/helpdesk');
  }

  async openHelpdesk(name: string): Promise<void> {
    await this.clickRowByText(name);
  }
}
