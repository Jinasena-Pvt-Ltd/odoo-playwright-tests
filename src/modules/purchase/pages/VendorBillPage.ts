import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { CharField } from '../../../core/components/CharField';
import { DateField } from '../../../core/components/DateField';
import { uniqueName } from '../../../core/utils/RandomDataGenerator';
import { today } from '../../../core/utils/DateHelper';

/** account.move form (move_type = 'in_invoice'), reached via a Purchase Order's "Create Bill" button. */
export class VendorBillFormPage extends BaseFormPage {
  readonly billDate = new DateField(this.page, 'invoice_date');
  // NOTE: "Bill Reference" (the standard `ref` field) is a *different*, non-required
  // field from "Supplier's Invoice Number (Bill Reference)" below — despite the similar
  // label, they are two distinct fields on this form.
  readonly supplierInvoiceNumber = new CharField(this.page, 'x_studio_supplier_invoice_number');

  constructor(page: Page) {
    super(page);
  }

  /** Posts the bill (Draft -> Posted). */
  async confirm(): Promise<void> {
    // Both the Bill/Refund date and "Supplier's Invoice Number (Bill Reference)" are
    // required — Confirm raises "Invalid Operation" / silently no-ops without them.
    await this.billDate.setValue(today());
    await this.supplierInvoiceNumber.setValue(uniqueName('Sup_Inv'));
    const confirmButton = this.page.getByRole('button', { name: 'Confirm', exact: true });
    await confirmButton.click();
    await this.waitForOdooReady();
    // Confirm silently no-ops without the required field above — wait for "Register
    // Payment" (only present once posted) as proof it actually confirmed.
    await this.page.getByRole('button', { name: 'Register Payment', exact: true })
      .waitFor({ state: 'visible', timeout: 15_000 });
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
