import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { CharField } from '../../../core/components/CharField';
import { openOdooApp } from './openOdooApp';

export class CustomerFormPage extends BaseFormPage {
  readonly name: CharField;

  constructor(page: Page) {
    super(page);
    this.name = new CharField(page, 'name');
  }

  /**
   * Cross-app pushState navigation (BasePage.navigateTo) is only proven reliable for the
   * Employees app it was built against — jumping straight from a fresh session to
   * /odoo/contacts/new leaves the URL updated but the previous Kanban view still rendered
   * (OWL's router never re-resolves the action). Going through the real app-switcher click
   * (see openOdooApp) exercises OWL's own menu click handler instead of a synthetic
   * popstate, so it reliably lands on the Contacts app.
   */
  async navigate(): Promise<void> {
    await openOdooApp(this.page, 'Contacts');
    await this.clickNew();
  }
  async openById(id: number): Promise<void> { await this.navigateTo(`/odoo/contacts/${id}`); }

  async createCustomer(customerName: string): Promise<void> {
    await this.name.setValue(customerName);
    await this.save();
  }
}

export class CustomerListPage extends BaseListPage {
  constructor(page: Page) { super(page); }
  async navigate(): Promise<void> { await this.navigateTo('/odoo/contacts'); }
  async openCustomer(name: string): Promise<void> { await this.clickRowByText(name); }
}
