import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { CharField } from '../../../core/components/CharField';
import { uniqueName } from '../../../core/utils/RandomDataGenerator';

/** stock.picking form, reached via a Purchase Order's "Receipt" smart button. */
export class DeliveryFormPage extends BaseFormPage {
  readonly supplierInvoiceNumber = new CharField(this.page, 'x_studio_supplier_invoice_number');

  constructor(page: Page) {
    super(page);
  }

  /** Validates the delivery, confirming the "Immediate Transfer" dialog if it appears. */
  async validate(): Promise<void> {
    // "Supplier Invoice Number" is a required field on this delivery — Validate is a
    // no-op without it.
    await this.supplierInvoiceNumber.setValue(uniqueName('INV'));
    await this.page.getByRole('button', { name: 'Validate', exact: true }).click();
    const dialogVisible = await this.page.locator('.modal').isVisible({ timeout: 3_000 }).catch(() => false);
    if (dialogVisible) {
      await this.confirmDialog();
    }
    await this.waitForOdooReady();
  }
}
