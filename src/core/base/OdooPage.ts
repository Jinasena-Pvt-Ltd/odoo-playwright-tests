/**
 * Minimal concrete subclass of BasePage for specs that need to navigate
 * to arbitrary Odoo URLs without a dedicated page object.
 *
 * Usage:
 *   const odoo = new OdooPage(page);
 *   await odoo.navigateTo('/odoo/settings');
 */
import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class OdooPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }
}
