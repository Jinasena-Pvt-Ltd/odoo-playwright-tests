import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';

/** stock.picking form, reached via a Purchase Order's "Receipt" smart button. */
export class DeliveryFormPage extends BaseFormPage {
  constructor(page: Page) {
    super(page);
  }

  /** Validates the delivery, confirming the "Immediate Transfer" dialog if it appears. */
  async validate(): Promise<void> {
    await this.page.getByRole('button', { name: 'Validate', exact: true }).click();
    const dialogVisible = await this.page.locator('.modal').isVisible({ timeout: 3_000 }).catch(() => false);
    if (dialogVisible) {
      await this.confirmDialog();
    }
    await this.waitForOdooReady();
  }
}
