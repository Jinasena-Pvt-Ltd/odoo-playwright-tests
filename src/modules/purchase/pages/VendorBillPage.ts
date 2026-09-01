import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { CharField } from '../../../core/components/CharField';
import { DateField } from '../../../core/components/DateField';
import { uniqueName } from '../../../core/utils/RandomDataGenerator';

/** account.move form (move_type = 'in_invoice'), reached via a Purchase Order's "Create Bill" button. */
export class VendorBillFormPage extends BaseFormPage {
  readonly billDate = new DateField(this.page, 'invoice_date');
  readonly supplierInvoiceNumber = new CharField(this.page, 'ref');

  constructor(page: Page) {
    super(page);
  }

  /** Posts the bill (Draft -> Posted). */
  async confirm(): Promise<void> {
    // "Supplier's Invoice Number (Bill Reference)" is required — Confirm is a no-op
    // without it.
    await this.supplierInvoiceNumber.setValue(uniqueName('Sup_Inv'));
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
