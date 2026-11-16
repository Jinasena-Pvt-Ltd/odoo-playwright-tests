import { Page, expect } from '@playwright/test';
import { isVisibleWhenIdle, waitForOdooIdle } from '../utils/OdooIdle';

export class Many2OneField {
  constructor(
    private readonly page: Page,
    private readonly fieldName: string,
  ) {}

  async setValue(displayName: string): Promise<void> {
    const widget = this.page.locator(`.o_field_widget[name="${this.fieldName}"]`).first();
    const input = widget.locator('input').first();

    // An earlier change (e.g. an onchange) may still be re-rendering the form; typing into
    // the old input then loses the text and the option never appears.
    await waitForOdooIdle(this.page).catch(() => undefined);
    await input.waitFor({ state: 'visible', timeout: 5_000 });
    const option = this.page
      .locator('.o_field_many2one_dropdown .o_menu_item, .ui-autocomplete .ui-menu-item, .o-dropdown--menu .o_menu_item, .o-autocomplete--dropdown-item')
      .filter({ hasText: displayName })
      .first();
    for (let attempt = 1; ; attempt++) {
      await input.fill(displayName);
      // Odoo searches ~250 ms after typing stops; wait for the searched option itself
      // (another field's dropdown may still be open).
      const shown = await option.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true, () => false);
      if (shown) break;
      if (attempt === 2) {
        throw new Error(`Many2OneField ${this.fieldName}: no option "${displayName}" after typing it twice`);
      }
      await waitForOdooIdle(this.page).catch(() => undefined);
    }
    await option.click();
  }

  async getValue(): Promise<string> {
    const widget = this.page.locator(`.o_field_widget[name="${this.fieldName}"]`).first();

    // In edit mode
    const input = widget.locator('input').first();
    if (await isVisibleWhenIdle(input).catch(() => false)) {
      return input.inputValue();
    }

    // In read mode
    const link = widget.locator('.o_form_uri').first();
    if (await isVisibleWhenIdle(link).catch(() => false)) {
      return (await link.textContent())?.trim() ?? '';
    }

    return (await widget.textContent())?.trim() ?? '';
  }

  async clear(): Promise<void> {
    const widget = this.page.locator(`.o_field_widget[name="${this.fieldName}"]`).first();
    // Hover first — Odoo 17 only shows the X (delete) button on hover.
    await widget.hover().catch(() => {});
    await this.page.waitForTimeout(150);
    const clearBtn = widget.locator('.o_field_many2one .o_delete, .o_delete').first();
    if (await isVisibleWhenIdle(clearBtn).catch(() => false)) {
      await clearBtn.click();
      // Close any autocomplete dropdown that may open after clearing.
      await this.page.keyboard.press('Escape').catch(() => {});
    } else {
      // Fallback: select-all + Delete in the input, then Tab out.
      // DO NOT press Escape — it reverts the Many2One to its previous value.
      const input = widget.locator('input').first();
      await input.click();
      await input.fill('');
      // Tab moves focus away and commits the empty value without reverting.
      await this.page.keyboard.press('Tab');
    }
  }

  async openRelatedRecord(): Promise<void> {
    const link = this.page.locator(`.o_field_widget[name="${this.fieldName}"] .o_form_uri`).first();
    await link.click();
  }

  async createAndEdit(name?: string): Promise<void> {
    const widget = this.page.locator(`.o_field_widget[name="${this.fieldName}"]`).first();
    const input = widget.locator('input').first();
    if (name) {
      await input.fill(name);
    }
    const createOption = this.page.locator('.o_field_many2one_dropdown .o_m2o_footer .o_m2o_option, .o-dropdown--menu .o_create_edit').first();
    await createOption.click();
  }
}
