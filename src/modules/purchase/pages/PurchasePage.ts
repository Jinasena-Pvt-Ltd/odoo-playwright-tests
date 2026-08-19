import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { CharField } from '../../../core/components/CharField';
import { Many2OneField } from '../../../core/components/Many2OneField';

// TODO: Add typed field components matching the Odoo purchase model fields.

export class PurchaseFormPage extends BaseFormPage {
  readonly name: CharField;
  readonly vendor: Many2OneField;

  constructor(page: Page) {
    super(page);
    this.name = new CharField(page, 'name');
    this.vendor = new Many2OneField(page, 'partner_id');
    // TODO: Add remaining field components for this module's primary Odoo model
  }

  // This instance's Purchase app has no /odoo/<slug> route registered — it only
  // resolves via the legacy /web#action=... URL reached through the home-menu
  // app tile, so we boot the SPA then click through to it instead of pushState.
  async navigate(): Promise<void> {
    await this.navigateTo('/odoo'); // boots the authenticated SPA session
    await PurchaseListPage.openPurchaseApp(this.page);
    await this.clickNew();
  }

  async openById(id: number): Promise<void> {
    const baseURL = process.env.ODOO_BASE_URL ?? 'http://localhost:8069';
    await this.page.goto(`${baseURL}/web#action=436&model=purchase.order&view_type=form&cids=2&menu_id=271&id=${id}`);
    await this.waitForOdooReady();
  }
}

export class PurchaseListPage extends BaseListPage {
  constructor(page: Page) {
    super(page);
  }

  static async openPurchaseApp(page: Page): Promise<void> {
    await page.locator('a.o_menu_toggle, [aria-label="Home menu"]').first().click();
    await page.getByRole('option', { name: 'Purchase', exact: true }).click();
    await page.waitForSelector('.o_list_view', { state: 'visible', timeout: 15_000 });
  }

  async navigate(): Promise<void> {
    await this.navigateTo('/odoo'); // boots the authenticated SPA session
    await PurchaseListPage.openPurchaseApp(this.page);
  }

  async openPurchase(name: string): Promise<void> {
    await this.clickRowByText(name);
  }
}
