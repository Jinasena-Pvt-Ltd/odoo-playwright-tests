import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { DateField } from '../../../core/components/DateField';

/** account.move form (move_type = 'in_invoice'), reached via a Purchase Order's "Create Bill" button. */
export class VendorBillFormPage extends BaseFormPage {
  readonly billDate = new DateField(this.page, 'invoice_date');

  constructor(page: Page) {
    super(page);
  }

  /** Posts the bill (Draft -> Posted). */
  async confirm(): Promise<void> {
    await this.page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await this.waitForOdooReady();
  }

  /** Opens the "Register Payment" wizard and confirms it. */
  async registerPayment(): Promise<void> {
    await this.page.getByRole('button', { name: 'Register Payment', exact: true }).click();
    const modal = this.page.locator('.modal');
    await modal.waitFor({ state: 'visible', timeout: 5_000 });
    await modal.getByRole('button', { name: 'Create Payment', exact: true }).click();
    await this.waitForOdooReady();
  }
}
