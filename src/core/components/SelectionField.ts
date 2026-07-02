import { Page } from '@playwright/test';

export class SelectionField {
  constructor(
    private readonly page: Page,
    private readonly fieldName: string,
  ) {}

  async selectByValue(value: string): Promise<void> {
    const select = this.page.locator(`.o_field_widget[name="${this.fieldName}"] select`).first();
    if (await select.isVisible({ timeout: 500 }).catch(() => false)) {
      await select.selectOption({ value });
      return;
    }
    // Odoo 17 sometimes renders selection as a radio-like widget
    await this.selectByLabel(value);
  }

  async selectByLabel(label: string): Promise<void> {
    const select = this.page.locator(`.o_field_widget[name="${this.fieldName}"] select`).first();
    if (await select.isVisible({ timeout: 500 }).catch(() => false)) {
      await select.selectOption({ label });
      return;
    }
    // Fallback: click a radio option
    const option = this.page.locator(`.o_field_widget[name="${this.fieldName}"] .o_radio_input + label`).filter({ hasText: label }).first();
    await option.click();
  }

  async getValue(): Promise<string> {
    const select = this.page.locator(`.o_field_widget[name="${this.fieldName}"] select`).first();
    if (await select.isVisible({ timeout: 500 }).catch(() => false)) {
      return select.evaluate((el: HTMLSelectElement) => el.options[el.selectedIndex]?.text ?? '');
    }
    // Read mode: span text
    const widget = this.page.locator(`.o_field_widget[name="${this.fieldName}"]`).first();
    return (await widget.textContent())?.trim() ?? '';
  }
}
