import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';

/** Page object for the Engineering Change Order (mrp.eco) form of Odoo PLM. */
export class PlmEcoPage extends BaseFormPage {
  constructor(page: Page) {
    super(page);
  }

  async openById(id: number): Promise<void> {
    const url = new URL(this.page.url());
    url.hash = `id=${id}&model=mrp.eco&view_type=form`;
    await this.page.goto(url.toString());
    await this.page.reload();
  }
}
