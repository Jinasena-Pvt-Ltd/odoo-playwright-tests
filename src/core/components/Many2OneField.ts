import { Page, expect } from '@playwright/test';

export class Many2OneField {
  constructor(
    private readonly page: Page,
    private readonly fieldName: string,
  ) {}

  async setValue(displayName: string): Promise<void> {
    const widget = this.page.locator(`.o_field_widget[name="${this.fieldName}"]`).first();
    const input = widget.locator('input').first();

    await input.waitFor({ state: 'visible', timeout: 5_000 });
    await input.fill(displayName);

    // Wait for the dropdown to appear
    const dropdown = this.page.locator('.o_field_many2one_dropdown, .ui-autocomplete, .o-dropdown--menu').first();
    await dropdown.waitFor({ state: 'visible', timeout: 8_000 });

    // Click the first matching option
    const option = this.page
      .locator('.o_field_many2one_dropdown .o_menu_item, .ui-autocomplete .ui-menu-item, .o-dropdown--menu .o_menu_item')
      .filter({ hasText: displayName })
      .first();
    await option.click();
  }

  async getValue(): Promise<string> {
    const widget = this.page.locator(`.o_field_widget[name="${this.fieldName}"]`).first();

    // In edit mode
    const input = widget.locator('input').first();
    if (await input.isVisible({ timeout: 300 }).catch(() => false)) {
      return input.inputValue();
    }

    // In read mode
    const link = widget.locator('.o_form_uri').first();
    if (await link.isVisible({ timeout: 300 }).catch(() => false)) {
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
    if (await clearBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
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
