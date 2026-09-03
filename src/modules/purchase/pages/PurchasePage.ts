import { Page, expect } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { CharField } from '../../../core/components/CharField';
import { Many2OneField } from '../../../core/components/Many2OneField';
import { DeliveryFormPage } from './DeliveryPage';
import { VendorBillFormPage } from './VendorBillPage';

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
    // Going straight from another `/web#...` page (e.g. a delivery) to this one only
    // changes the URL hash — Odoo's SPA router doesn't reliably react to that. Force a
    // full reload of the app shell first, then navigate to the target record.
    // This instance's "/odoo" route occasionally answers with a transient HTTP 404
    // (server-side blip, not a real missing route — Odoo's SPA shell still renders
    // its default app underneath), so retry the reload once if the app shell never
    // shows up.
    let shellLoaded = false;
    for (let attempt = 0; attempt < 2 && !shellLoaded; attempt++) {
      await this.page.goto(`${baseURL}/odoo`);
      shellLoaded = await this.page.waitForSelector('.o_action_manager, .o_home_menu', { timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
    }
    await this.waitForOdooReady();
    await this.page.goto(`${baseURL}/web#action=436&model=purchase.order&view_type=form&cids=2&menu_id=271&id=${id}`);
    await this.waitForOdooReady();
  }

  /** Returns the current record's id from the URL (works for both the legacy /web#...&id= route and any /odoo/.../<id> route). */
  getRecordId(): number {
    const [, idParam] = this.page.url().match(/[?&#]id=(\d+)/) ?? [];
    if (idParam) return Number(idParam);
    const [, pathId] = this.page.url().match(/\/(\d+)(?:[/?#]|$)/) ?? [];
    return pathId ? Number(pathId) : 0;
  }

  /** Uploads the vendor's quotation file under the "Documents" tab (the "Quotation 1" slot). */
  async uploadQuotation(filePath: string): Promise<void> {
    await this.page.getByRole('tab', { name: 'Documents', exact: true }).click();
    // Clicking "Upload your file" opens a native OS file dialog that blocks Playwright's
    // click action from ever resolving — set the file directly on the underlying hidden
    // <input type="file"> instead, bypassing the dialog entirely. Two upload slots exist
    // (Quotation 1 and Quotation 2); use the first.
    await this.page.locator('input[type="file"]').first().setInputFiles(filePath);
    await this.waitForOdooReady();
  }

  /**
   * Sets the unit price on every order line, in row order. An RFQ created from a
   * requisition has zero-priced lines (the real vendor quote isn't known yet), and
   * Confirm Order silently no-ops on a zero-total order without any visible error.
   */
  async setLineUnitPrices(prices: number[]): Promise<void> {
    await this.page.getByRole('tab', { name: 'Products', exact: true }).click();
    const priceCells = this.page.locator('.o_list_table .o_data_row td[name="price_unit"]');
    for (let i = 0; i < prices.length; i++) {
      await priceCells.nth(i).click();
      await priceCells.nth(i).locator('input').fill(String(prices[i]));
      await this.page.keyboard.press('Tab');
    }
    await this.waitForOdooReady();
  }

  /** RFQ -> Purchase Order. */
  async confirmOrder(): Promise<void> {
    const confirmButton = this.page.getByRole('button', { name: 'Confirm Order', exact: true });
    // The button goes disabled while the price edits above are still saving — clicking
    // during that window doesn't register, so wait for it to re-enable first.
    await expect(confirmButton).toBeEnabled({ timeout: 10_000 });
    await confirmButton.click();
    await this.waitForOdooReady();
    // The statusbar always lists all three lifecycle labels (RFQ / RFQ Sent / Purchase
    // Order) regardless of which is active, so checking its text is a false positive.
    // The "Confirm Order" button also stays visible after confirming (it doesn't
    // disappear) — instead wait for "Create Bill", which only appears once confirmed.
    await this.page.getByRole('button', { name: 'Create Bill', exact: true })
      .waitFor({ state: 'visible', timeout: 15_000 });
  }

  /** Opens the delivery (stock.picking) created for this Purchase Order via its smart button. */
  async openDelivery(): Promise<DeliveryFormPage> {
    await this.clickSmartButton('Receipt');
    return new DeliveryFormPage(this.page);
  }

  /** Opens the delivery via the "Receive Products" button (an alternative to the "Receipt" smart button). */
  async receiveProducts(): Promise<DeliveryFormPage> {
    await this.page.getByRole('button', { name: 'Receive Products', exact: true }).click();
    await this.waitForOdooReady();
    return new DeliveryFormPage(this.page);
  }

  /**
   * Prints the RFQ (triggers a PDF download) — this transitions the RFQ to "RFQ Sent"
   * and reveals the "Receive Quotation" button, needed before Confirm Order on the
   * Cash Purchase flow.
   */
  async printRfq(): Promise<void> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 10_000 }).catch(() => null),
      this.page.getByRole('button', { name: 'Print RFQ', exact: true }).click(),
    ]);
    void download;
    await this.waitForOdooReady();
    await this.page.getByRole('button', { name: 'Receive Quotation', exact: true })
      .waitFor({ state: 'visible', timeout: 15_000 });
  }

  /** Marks the vendor's quotation as received (only available after printRfq()). */
  async receiveQuotation(): Promise<void> {
    await this.page.getByRole('button', { name: 'Receive Quotation', exact: true }).click();
    await this.waitForOdooReady();
  }

  /** Creates a vendor bill for this Purchase Order via the "Create Bill" button. */
  async createVendorBill(): Promise<VendorBillFormPage> {
    const createBillButton = this.page.getByRole('button', { name: 'Create Bill', exact: true });
    const errorDialog = this.page.locator('.modal', { hasText: 'Invalid Operation' });

    for (let attempt = 0; attempt < 3; attempt++) {
      await createBillButton.click();
      await this.waitForOdooReady();
      // "Create Bill" can reject with "Invalid Operation" — most often "no invoiceable
      // line" — because the delivery's received quantity hasn't finished propagating
      // server-side yet, right after validating it. Retry a couple times before
      // surfacing it as a real failure.
      if (!(await errorDialog.isVisible({ timeout: 3_000 }).catch(() => false))) {
        return new VendorBillFormPage(this.page);
      }
      // Two "Close" buttons exist on this dialog (the header's "X" icon and the
      // primary footer button) — use the footer one specifically.
      const closeButton = errorDialog.locator('.o-default-button', { hasText: 'Close' });
      await closeButton.click();
      await this.page.waitForTimeout(2_000);
    }

    const message = await errorDialog.innerText();
    throw new Error(`Create Bill was rejected: ${message}`);
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

  /** Opens the topmost row (the list's default sort is newest-first). */
  async openNewest(): Promise<void> {
    await this.page.locator('.o_list_table .o_data_row').first().click();
    await this.waitForOdooReady();
  }
}
